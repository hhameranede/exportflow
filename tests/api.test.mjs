import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { authenticateRequest, createRateLimiter } from "../src/core/auth.js";
import { hashApiKey } from "../src/core/tenant-auth.js";
import { TaskContractError, validateTaskRequest } from "../src/core/task-contract.js";
import { fetchPublicResource, FetchAdapterError } from "../src/core/http-fetch.js";
import { startServer } from "../src/server.js";
import { createDurableTenantBurstTestNamespace } from "./helpers/durable-tenant-burst-test-namespace.js";
import { createDurableTaskD1 } from "./helpers/durable-task-d1.js";

const TEST_KEY_ID = "0123456789abcdef";
const TEST_TOKEN = `ef_live_${TEST_KEY_ID}_${"A".repeat(43)}`;
const TEST_KEY_HASH = await hashApiKey(TEST_TOKEN);

function makeTestEnv({ requestLimit = 10_000, keyStatus = "active", tenantStatus = "active", planStatus = "active", scopes = ["tasks:fetch"], expiresAt = null } = {}) {
  const fixture = createDurableTaskD1({
    requestLimit,
    tenantIds: ["tenant_test_001"],
    planCode: "test",
    policyVersion: "test-v1",
  });
  fixture.sqlite.prepare("UPDATE tenants SET status = ?1 WHERE tenant_id = ?2")
    .run(tenantStatus, "tenant_test_001");
  fixture.sqlite.prepare("UPDATE plan_policies SET status = ?1 WHERE plan_code = ?2")
    .run(planStatus, "test");
  fixture.sqlite.prepare(
    "INSERT INTO api_keys (key_id, tenant_id, key_hash, status, scopes_json, expires_at, created_at) " +
    "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
  ).run(
    TEST_KEY_ID,
    "tenant_test_001",
    TEST_KEY_HASH,
    keyStatus,
    JSON.stringify(scopes),
    expiresAt,
    "2026-11-24T10:00:00.000Z",
  );
  return {
    EXPORTFLOW_AUTH_DB: fixture.db,
    TENANT_BURST_LIMITER: createDurableTenantBurstTestNamespace(),
    __fixture: fixture,
  };
}

function makeTaskRequest(body, {
  token = TEST_TOKEN,
  contentType = "application/json",
  method = "POST",
  headers = {},
} = {}) {
  const reqHeaders = new Headers(headers);
  if (contentType) reqHeaders.set("content-type", contentType);
  if (token !== null && token !== undefined) reqHeaders.set("authorization", `Bearer ${token}`);
  return new Request("https://api.exportflow.local/api/v1/tasks", {
    method,
    headers: reqHeaders,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("tenant API authentication fails closed when the dedicated D1 binding is missing or invalid", async () => {
  const worker = createWorker();
  const request = makeTaskRequest({ goal: "Fetch page", url: "https://example.com" });

  const missing = await worker.fetch(request, {});
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error.code, "AUTH_NOT_CONFIGURED");

  const invalidBinding = await worker.fetch(
    makeTaskRequest({ goal: "Fetch page", url: "https://example.com" }),
    { EXPORTFLOW_AUTH_DB: {} },
  );
  assert.equal(invalidBinding.status, 503);
  assert.equal((await invalidBinding.json()).error.code, "AUTH_NOT_CONFIGURED");
});

test("REST rejects an unauthenticated task before reading or parsing its body", async () => {
  const request = makeTaskRequest({ goal: "Fetch", url: "https://example.com" }, { token: null });
  const bodyGetter = Object.getOwnPropertyDescriptor(Request.prototype, "body").get;
  let bodyReads = 0;
  Object.defineProperty(request, "body", {
    configurable: true,
    get() {
      bodyReads += 1;
      return bodyGetter.call(this);
    },
  });
  const response = await createWorker().fetch(request, makeTestEnv());
  assert.equal(response.status, 401);
  assert.equal(bodyReads, 0);
});

test("auth rejects missing, empty, oversized, malformed, and invalid Bearer tokens with 401", async () => {
  const worker = createWorker();
  const env = makeTestEnv();

  const missing = await worker.fetch(makeTaskRequest({ goal: "Fetch", url: "https://example.com" }, { token: null }), env);
  assert.equal(missing.status, 401);
  assert.ok(missing.headers.get("www-authenticate")?.includes("Bearer"));

  const emptyBearer = await worker.fetch(makeTaskRequest({ goal: "Fetch", url: "https://example.com" }, { token: "   " }), env);
  assert.equal(emptyBearer.status, 401);

  const oversizedHeader = await worker.fetch(
    makeTaskRequest({ goal: "Fetch", url: "https://example.com" }, { token: "a".repeat(600) }),
    env,
  );
  assert.equal(oversizedHeader.status, 401);

  const malformed = await worker.fetch(
    new Request("https://api.exportflow.local/api/v1/tasks", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Basic abc" },
      body: JSON.stringify({ goal: "Fetch", url: "https://example.com" }),
    }),
    env,
  );
  assert.equal(malformed.status, 401);

  const invalid = await worker.fetch(makeTaskRequest({ goal: "Fetch", url: "https://example.com" }, { token: `ef_live_${TEST_KEY_ID}_${"B".repeat(43)}` }), env);
  assert.equal(invalid.status, 401);
  assert.equal((await invalid.json()).error.code, "INVALID_TOKEN");
});

test("authenticateRequest uses fixed-length SHA-256 comparison safely", async () => {
  const req = new Request("https://api.exportflow.local/api/v1/tasks", {
    headers: { authorization: `Bearer ${TEST_TOKEN}` },
  });
  const ok = await authenticateRequest(req, makeTestEnv());
  assert.equal(ok.ok, true);

  const sameLenBad = new Request("https://api.exportflow.local/api/v1/tasks", {
    headers: { authorization: `Bearer ef_live_${TEST_KEY_ID}_${"B".repeat(43)}` },
  });
  const bad = await authenticateRequest(sameLenBad, makeTestEnv());
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "INVALID_TOKEN");
});

test("POST /api/v1/tasks enforces content-type, empty/invalid UTF-8/malformed JSON, oversized payloads, and unknown fields", async () => {
  const worker = createWorker();
  const env = makeTestEnv();

  const wrongType = await worker.fetch(makeTaskRequest("{}", { contentType: "text/plain" }), env);
  assert.equal(wrongType.status, 415);

  const emptyBody = await worker.fetch(makeTaskRequest("   "), env);
  assert.equal(emptyBody.status, 400);
  assert.equal((await emptyBody.json()).error.code, "INVALID_JSON");

  const invalidUtf8 = await worker.fetch(
    new Request("https://api.exportflow.local/api/v1/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: new Uint8Array([0xff, 0xfe, 0xfd]),
    }),
    env,
  );
  assert.equal(invalidUtf8.status, 400);
  assert.equal((await invalidUtf8.json()).error.code, "INVALID_JSON");

  const badJson = await worker.fetch(makeTaskRequest("{not-json"), env);
  assert.equal(badJson.status, 400);
  assert.equal((await badJson.json()).error.code, "INVALID_JSON");

  const oversized = await worker.fetch(
    makeTaskRequest({ goal: "x".repeat(40_000), url: "https://example.com" }),
    env,
  );
  assert.equal(oversized.status, 413);

  const unknownField = await worker.fetch(
    makeTaskRequest({ goal: "Fetch", url: "https://example.com", headers: { cookie: "a=b" } }),
    env,
  );
  assert.equal(unknownField.status, 400);
  assert.equal((await unknownField.json()).error.code, "INVALID_TASK");

  const unknownOp = await worker.fetch(
    makeTaskRequest({ goal: "Delete", url: "https://example.com", operation: "delete" }),
    env,
  );
  assert.equal(unknownOp.status, 400);
  assert.equal((await unknownOp.json()).error.code, "UNSUPPORTED_OPERATION");
});

test("validateTaskRequest enables bounded static operations and rejects browser requirements", () => {
  for (const [operation, payload] of [
    ["map", { url: "https://example.com", maxUrls: 10 }],
    ["crawl", { url: "https://example.com", maxPages: 3, maxDepth: 1 }],
    ["extract", { url: "https://example.com", schema: { type: "object", properties: { title: { type: "string" } } } }],
    ["search", { query: "example", source: "openalex", limit: 5 }],
    ["research", { query: "example", source: "crossref", schema: { type: "object", properties: { title: { type: "string" } } }, candidateLimit: 2 }],
  ]) assert.equal(validateTaskRequest({ goal: "Run " + operation, operation, ...payload }).operation, operation);
  for (const badLimits of [null, [], "fast", { timeoutMs: 0 }, { timeoutMs: -1 }, { timeoutMs: 1.5 }, { timeoutMs: "1000" }, { timeoutMs: 99_999 }, { maxBytes: 0 }, { maxBytes: 2_000_000 }, { maxRedirects: -1 }, { maxRedirects: 4 }, { unknownLimit: 10 }]) {
    assert.throws(() => validateTaskRequest({ goal: "Fetch", url: "https://example.com", limits: badLimits }),
      (err) => err instanceof TaskContractError && err.code === "INVALID_LIMIT");
  }
  const valid = validateTaskRequest({ goal: "Fetch docs", url: "https://example.com/docs#section",
    limits: { timeoutMs: 2500, maxBytes: 4096, maxRedirects: 1 } });
  assert.equal(valid.url, "https://example.com/docs");
  assert.equal(valid.cacheMode, "default");
  assert.deepEqual(valid.limits, { timeoutMs: 2500, maxBytes: 4096, maxRedirects: 1 });
  assert.equal(validateTaskRequest({ goal: "Fetch", url: "https://example.com", cacheMode: "bypass" }).cacheMode, "bypass");
  assert.throws(() => validateTaskRequest({ goal: "Fetch", url: "https://example.com", cacheMode: "force" }),
    (err) => err instanceof TaskContractError && err.code === "INVALID_CACHE_MODE");
  assert.throws(() => validateTaskRequest({ goal: "Render", url: "https://example.com", requiresJavascript: true }),
    (err) => err instanceof TaskContractError && err.code === "INVALID_TASK");
});

test("POST /api/v1/tasks rejects private, loopback, metadata, and invalid URLs before outbound fetch", async () => {
  let fetchCalls = 0;
  const worker = createWorker({
    fetchImpl: async () => {
      fetchCalls++;
      return new Response("should not execute");
    },
  });
  const env = makeTestEnv();

  for (const url of [
    "http://127.0.0.1/admin",
    "http://localhost/internal",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://[::1]/",
    "ftp://example.com/file",
    "not-a-url",
  ]) {
    const res = await worker.fetch(makeTaskRequest({ goal: "Fetch target", url }), env);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, "URL_NOT_ALLOWED");
  }
  assert.equal(fetchCalls, 0);
});

test("POST /api/v1/tasks enforces egress redirect validation, redirect limit, stream size cap, and timeout end-to-end", async () => {
  const env = makeTestEnv();

  const redirectToPrivate = createWorker({
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } }),
  });
  const rPrivate = await redirectToPrivate.fetch(
    makeTaskRequest({ goal: "Follow redirect", url: "https://example.com/go" }),
    env,
  );
  assert.equal(rPrivate.status, 502);
  assert.equal((await rPrivate.json()).result.data.errorCode, "REDIRECT_NOT_ALLOWED");

  const tooManyRedirects = createWorker({
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: `https://example.com/hop-${Math.random()}` } }),
  });
  const rTooMany = await tooManyRedirects.fetch(
    makeTaskRequest({ goal: "Loop hops", url: "https://example.com/start", limits: { maxRedirects: 1 } }),
    env,
  );
  assert.equal(rTooMany.status, 502);
  assert.equal((await rTooMany.json()).result.data.errorCode, "TOO_MANY_REDIRECTS");

  const oversizedStream = createWorker({
    fetchImpl: async () => new Response("0123456789", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
  });
  const rLarge = await oversizedStream.fetch(
    makeTaskRequest({ goal: "Bounded body", url: "https://example.com/big", limits: { maxBytes: 4 } }),
    env,
  );
  assert.equal(rLarge.status, 413);
  assert.equal((await rLarge.json()).result.data.errorCode, "RESPONSE_TOO_LARGE");

  const slowWorker = createWorker({
    fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
      const keepAlive = setTimeout(() => {}, 500);
      init.signal.addEventListener("abort", () => {
        clearTimeout(keepAlive);
        reject(new DOMException("Aborted", "AbortError"));
      });
    }),
  });
  const rTimeout = await slowWorker.fetch(
    makeTaskRequest({ goal: "Timeout test", url: "https://example.com/slow", limits: { timeoutMs: 20 } }),
    env,
  );
  assert.equal(rTimeout.status, 504);
  const timeoutBody = await rTimeout.json();
  assert.equal(timeoutBody.state, "failed");
  assert.equal(timeoutBody.result.data.errorCode, "UPSTREAM_TIMEOUT");
  assert.equal(timeoutBody.errors[0].code, "UPSTREAM_TIMEOUT");
});

test("POST /api/v1/tasks executes end-to-end bounded HTTP fetch and returns structured evidence & usage", async () => {
  const timestamps = [
    "2026-11-19T10:00:00.000Z",
    "2026-11-19T10:00:00.010Z",
    "2026-11-19T10:00:00.085Z",
  ];
  const worker = createWorker({
    idFactory: () => "task-e2e-0001",
    now: () => timestamps.shift(),
    fetchImpl: async (url, init) => {
      assert.equal(init.method, "GET");
      assert.equal(init.redirect, "manual");
      assert.equal(init.cache, "default");
      assert.equal(Object.hasOwn(init, "cf"), false);
      if (url === "https://example.com/start") {
        return new Response(null, { status: 302, headers: { location: "/final" } });
      }
      assert.equal(url, "https://example.com/final");
      return new Response("<html><title>Synthetic Page</title><body>Hello agent</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "set-cookie": "session=secret" },
      });
    },
  });

  const res = await worker.fetch(
    makeTaskRequest({ goal: "Retrieve synthetic public page", url: "https://example.com/start" }),
    makeTestEnv(),
  );
  assert.equal(res.status, 200);
  const task = await res.json();

  assert.equal(task.id, "task-e2e-0001");
  assert.equal(task.state, "succeeded");
  assert.equal(task.requestedUrl, "https://example.com/start");
  assert.equal(task.execution.path, "http");
  assert.equal(task.execution.adapterId, "http.fetch.v1");
  assert.equal(task.timestamps.createdAt, "2026-11-19T10:00:00.000Z");
  assert.equal(task.timestamps.startedAt, "2026-11-19T10:00:00.010Z");
  assert.equal(task.timestamps.completedAt, "2026-11-19T10:00:00.085Z");
  assert.deepEqual(task.errors, []);
  assert.equal(task.usage.durationMs, 75);
  assert.equal(task.usage.requestsAttempted, 2);
  assert.equal(task.usage.responseBytes, 66);
  assert.equal(task.usage.cost, null);
  assert.equal(JSON.stringify(task).includes("session=secret"), false);

  assert.equal(task.result.status, "succeeded");
  assert.equal(task.result.data.httpStatus, 200);
  assert.equal(task.result.data.requestedUrl, "https://example.com/start");
  assert.equal(task.result.data.finalUrl, "https://example.com/final");
  assert.equal(task.result.data.contentType, "text/html; charset=utf-8");
  assert.equal(task.result.data.body.includes("Hello agent"), true);
  assert.equal(task.result.sources[0].url, "https://example.com/final");
  assert.equal(task.result.sources[0].evidence[0].redirectCount, 1);
  assert.deepEqual(task.events.map((e) => e.type), ["task.accepted", "task.started", "task.succeeded"]);
});

test("POST /api/v1/tasks supports explicit cache bypass without custom TTL overrides", async () => {
  let observedInit;
  const worker = createWorker({
    fetchImpl: async (_url, init) => {
      observedInit = init;
      return new Response("fresh response", {
        headers: {
          "content-type": "text/plain",
          "cf-cache-status": "BYPASS",
          "cache-control": "no-store",
        },
      });
    },
  });

  const response = await worker.fetch(
    makeTaskRequest({
      goal: "Read a fresh public resource",
      url: "https://example.com/fresh",
      cacheMode: "bypass",
    }),
    makeTestEnv(),
  );

  assert.equal(response.status, 200);
  assert.equal(observedInit.cache, "no-store");
  assert.equal(Object.hasOwn(observedInit, "cf"), false);
  const task = await response.json();
  assert.equal(task.result.data.cacheStatus, "BYPASS");
});

test("POST /api/v1/tasks handles upstream 404, 500, and network failures without leaking secrets", async () => {
  const env = makeTestEnv();

  const worker404 = createWorker({
    idFactory: () => "task-404-0001",
    fetchImpl: async () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } }),
  });
  const res404 = await worker404.fetch(makeTaskRequest({ goal: "Missing", url: "https://example.com/missing" }), env);
  assert.equal(res404.status, 200);
  const task404 = await res404.json();
  assert.equal(task404.state, "failed");
  assert.equal(task404.result.data.httpStatus, 404);
  assert.equal(task404.errors[0].code, "UPSTREAM_HTTP_ERROR");

  const worker500 = createWorker({
    idFactory: () => "task-500-0001",
    fetchImpl: async () => new Response("Server error", { status: 500, headers: { "content-type": "text/plain" } }),
  });
  const res500 = await worker500.fetch(makeTaskRequest({ goal: "Server err", url: "https://example.com/err" }), env);
  assert.equal(res500.status, 200);
  const task500 = await res500.json();
  assert.equal(task500.state, "failed");
  assert.equal(task500.result.data.httpStatus, 500);
  assert.equal(task500.errors[0].code, "UPSTREAM_HTTP_ERROR");

  const failingWorker = createWorker({
    idFactory: () => "task-err-0001",
    fetchImpl: async () => {
      throw new Error("internal socket token secret-123");
    },
  });
  const errRes = await failingWorker.fetch(makeTaskRequest({ goal: "Down", url: "https://example.com/down" }), env);
  assert.equal(errRes.status, 502);
  const errTask = await errRes.json();
  assert.equal(errTask.state, "failed");
  assert.equal(errTask.errors[0].code, "UPSTREAM_FETCH_FAILED");
  assert.equal(JSON.stringify(errTask).includes("secret-123"), false);
  assert.equal(errTask.usage.requestsAttempted, null);
});

test("POST /api/v1/tasks refuses browser rendering and interaction flags", async () => {
  let fetchCalls = 0;
  const worker = createWorker({ fetchImpl: async () => { fetchCalls++; return new Response("unused"); } });
  const env = makeTestEnv();
  for (const flags of [{ requiresJavascript: true }, { requiresInteraction: true }]) {
    const response = await worker.fetch(makeTaskRequest({ goal: "Dynamic page", url: "https://example.com/app", ...flags }), env);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_TASK");
  }
  assert.equal(fetchCalls, 0);
});

test("rate limiter enforces boundary, concurrent burst, window reset, auth isolation, and invalid-request accounting", async () => {
  let currentMs = 1_000;
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3, now: () => currentMs });
  const worker = createWorker({
    rateLimiter: limiter,
    fetchImpl: async () => new Response("ok", { headers: { "content-type": "text/plain" } }),
  });
  const env = makeTestEnv();

  // Failed auth requests must NOT consume the legitimate client's quota
  const badAuth = await worker.fetch(makeTaskRequest({ goal: "Bad", url: "https://example.com/0" }, { token: "bad" }), env);
  assert.equal(badAuth.status, 401);

  // Concurrent requests: 2 valid + 1 invalid authenticated JSON = 3 (consumes full quota)
  const [r1, r2, r3, r4] = await Promise.all([
    worker.fetch(makeTaskRequest({ goal: "Req 1", url: "https://example.com/1" }), env),
    worker.fetch(makeTaskRequest({ goal: "Req 2", url: "https://example.com/2" }), env),
    worker.fetch(makeTaskRequest("{invalid-json"), env),
    worker.fetch(makeTaskRequest({ goal: "Req 4", url: "https://example.com/4" }), env),
  ]);
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.equal(r3.status, 400);
  assert.equal(r4.status, 429);
  assert.equal(r4.headers.get("retry-after"), "60");

  // Window reset restores quota
  currentMs += 60_000;
  const r5 = await worker.fetch(makeTaskRequest({ goal: "Req 5", url: "https://example.com/5" }), env);
  assert.equal(r5.status, 200);
});

test("existing Worker routes remain backward compatible and reflect liveCapabilities accurately", async () => {
  const worker = createWorker();

  const home = await worker.fetch(new Request("https://exportflow.local/"), {});
  assert.equal(home.status, 200);
  assert.ok((await home.text()).includes("ExportFlow"));

  const health = await worker.fetch(new Request("https://exportflow.local/api/v1/health"), {});
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");

  const unconfiguredPlatform = await worker.fetch(new Request("https://exportflow.local/api/v1/platform"), {});
  assert.deepEqual((await unconfiguredPlatform.json()).liveCapabilities, []);

  const configuredPlatform = await worker.fetch(
    new Request("https://exportflow.local/api/v1/platform", {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    }),
    makeTestEnv(),
  );
  const platformData = await configuredPlatform.json();
  assert.deepEqual(platformData.liveCapabilities, ["http.fetch.v1"]);
  assert.equal(platformData.endpoints.tasks, "/api/v1/tasks");

  const preview = await worker.fetch(new Request("https://exportflow.local/api/v1/router-preview?javascript=true"), {});
  assert.equal((await preview.json()).decision.path, "http");

  const badMethod = await worker.fetch(new Request("https://exportflow.local/api/v1/tasks", { method: "GET" }), {});
  assert.equal(badMethod.status, 405);
});

test("Node HTTP server bridges localhost requests safely, enforces body limits, and ignores spoofed Host headers", async () => {
  let observedRequestUrl = null;
  const baseWorker = createWorker({
    idFactory: () => "task-node-0001",
    fetchImpl: async () => new Response('{"ok":true}', {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  const spyWorker = {
    async fetch(request, env) {
      observedRequestUrl = request.url;
      return baseWorker.fetch(request, env);
    },
  };

  const server = await startServer({
    port: 0,
    workerInstance: spyWorker,
    env: makeTestEnv(),
  });

  try {
    const addr = server.address();
    assert.equal(addr.address, "127.0.0.1");
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const healthRes = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { host: "evil.attacker.example:9999" },
    });
    assert.equal(healthRes.status, 200);
    assert.equal(observedRequestUrl.startsWith("http://127.0.0.1:"), true);
    assert.equal(observedRequestUrl.includes("evil.attacker.example"), false);

    const unauthRes = await fetch(`${baseUrl}/api/v1/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: "No auth", url: "https://example.com" }),
    });
    assert.equal(unauthRes.status, 401);

    const oversizedRes = await fetch(`${baseUrl}/api/v1/tasks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ goal: "x".repeat(40_000), url: "https://example.com" }),
    });
    assert.equal(oversizedRes.status, 413);

    const taskRes = await fetch(`${baseUrl}/api/v1/tasks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({
        goal: "Retrieve synthetic JSON",
        url: "https://example.com/data.json",
      }),
    });
    assert.equal(taskRes.status, 200);
    const task = await taskRes.json();
    assert.equal(task.id, "task-node-0001");
    assert.equal(task.state, "succeeded");
    assert.equal(task.result.data.body, '{"ok":true}');
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});


test("POST /api/v1/tasks maps the Task-wide execution deadline to HTTP 504", async () => {
  const worker = createWorker({
    taskTimeoutMs: 15,
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    }),
  });
  const response = await worker.fetch(
    makeTaskRequest({ goal: "Wait for bounded deadline", url: "https://example.com/slow" }),
    makeTestEnv(),
  );

  assert.equal(response.status, 504);
  const task = await response.json();
  assert.equal(task.state, "failed");
  assert.equal(task.result.data.errorCode, "TASK_TIMEOUT");
  assert.equal(task.errors[0].code, "TASK_TIMEOUT");
});

test("POST /api/v1/tasks maps caller cancellation to HTTP 499 and cancelled lifecycle", async () => {
  const controller = new AbortController();
  const worker = createWorker({
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    }),
  });
  const request = new Request("https://api.exportflow.local/api/v1/tasks", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TEST_TOKEN}` },
    body: JSON.stringify({ goal: "Cancel active fetch", url: "https://example.com/slow" }),
    signal: controller.signal,
  });
  const pending = worker.fetch(request, makeTestEnv());
  await new Promise((resolve) => setTimeout(resolve, 10));
  controller.abort();

  const response = await pending;
  assert.equal(response.status, 499);
  const task = await response.json();
  assert.equal(task.state, "cancelled");
  assert.equal(task.errors[0].code, "TASK_CANCELLED");
});

test("REST reserves one persistent tenant request and returns plan quota headers", async () => {
  let fetchCalls = 0;
  const worker = createWorker({
    fetchImpl: async () => {
      fetchCalls++;
      return new Response("ok", { headers: { "content-type": "text/plain" } });
    },
  });
  const env = makeTestEnv({ requestLimit: 1 });

  const first = await worker.fetch(makeTaskRequest({ goal: "First request", url: "https://example.com/first" }), env);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("x-plan-limit"), "1");
  assert.equal(first.headers.get("x-plan-remaining"), "0");
  assert.ok(first.headers.get("x-plan-reset"));

  const second = await worker.fetch(makeTaskRequest({ goal: "Second request", url: "https://example.com/second" }), env);
  assert.equal(second.status, 429);
  assert.equal((await second.json()).error.code, "PLAN_QUOTA_EXCEEDED");
  assert.equal(second.headers.get("x-plan-limit"), "1");
  assert.equal(second.headers.get("x-plan-remaining"), "0");
  assert.ok(Number(second.headers.get("retry-after")) >= 1);
  assert.equal(fetchCalls, 1);
});

test("invalid task contracts do not consume the persistent tenant request quota", async () => {
  let fetchCalls = 0;
  const worker = createWorker({
    fetchImpl: async () => {
      fetchCalls++;
      return new Response("ok", { headers: { "content-type": "text/plain" } });
    },
  });
  const env = makeTestEnv({ requestLimit: 1 });

  const invalid = await worker.fetch(makeTaskRequest({ goal: "", url: "https://example.com/invalid" }), env);
  assert.equal(invalid.status, 400);

  const valid = await worker.fetch(makeTaskRequest({ goal: "Valid after invalid", url: "https://example.com/valid" }), env);
  assert.equal(valid.status, 200);
  assert.equal(fetchCalls, 1);
});

test("REST Search works with its own tenant scope and public OpenAlex source", async () => {
  const worker = createWorker({ fetchImpl: async (url) => {
    assert.equal(new URL(url).hostname, "api.openalex.org");
    return new Response(JSON.stringify({ results: [{
      id: "https://openalex.org/W42", title: "A public research result",
      primary_location: { landing_page_url: "https://papers.example.org/42" },
    }] }), { headers: { "content-type": "application/json" } });
  }});
  const response = await worker.fetch(makeTaskRequest({
    goal: "Search a public research dataset", operation: "search", query: "public data", source: "openalex", limit: 3,
  }), makeTestEnv({ scopes: ["tasks:search"] }));
  const task = await response.json();
  assert.equal(response.status, 200);
  assert.equal(task.state, "succeeded");
  assert.equal(task.execution.adapterId, "web.search.v1");
  assert.equal(task.result.data.results[0].title, "A public research result");
});

test("REST Search preserves an upstream 429 response as HTTP 429", async () => {
  const worker = createWorker({ fetchImpl: async (url) => {
    assert.equal(new URL(url).hostname, "api.openalex.org");
    return new Response("rate limited", { status: 429, headers: { "content-type": "text/plain" } });
  }});
  const response = await worker.fetch(makeTaskRequest({
    goal: "Search a public research dataset", operation: "search", query: "public data", source: "openalex",
  }), makeTestEnv({ scopes: ["tasks:search"] }));
  const task = await response.json();
  assert.equal(response.status, 429);
  assert.equal(task.state, "failed");
  assert.equal(task.result.data.errorCode, "SEARCH_RATE_LIMITED");
});

test("REST Map is enabled only with tasks:map and uses the bounded static mapper", async () => {
  const calls = [];
  const worker = createWorker({ fetchImpl: async (url) => {
    calls.push(url);
    if (url.endsWith("/robots.txt")) return new Response("", { headers: { "content-type": "text/plain" } });
    if (url.endsWith("/sitemap.xml")) return new Response("", { status: 404, headers: { "content-type": "text/plain" } });
    return new Response('<html><title>Map fixture</title><a href="/about">About</a></html>', { headers: { "content-type": "text/html" } });
  }});
  const response = await worker.fetch(makeTaskRequest({
    goal: "Map the site", operation: "map", url: "https://example.com/", maxUrls: 5,
  }), makeTestEnv({ scopes: ["tasks:map"] }));
  const task = await response.json();
  assert.equal(response.status, 200);
  assert.equal(task.state, "succeeded");
  assert.equal(task.execution.adapterId, "web.map.v1");
  assert.ok(task.result.data.urls.some((item) => item.url === "https://example.com/about"));
  assert.ok(calls.some((url) => url.endsWith("/robots.txt")));
});
