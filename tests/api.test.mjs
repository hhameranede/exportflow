import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { authenticateRequest, createRateLimiter } from "../src/core/auth.js";
import { TaskContractError, validateTaskRequest } from "../src/core/task-contract.js";
import { fetchPublicResource, FetchAdapterError } from "../src/core/http-fetch.js";
import { startServer } from "../src/server.js";

const TEST_TOKEN = "ef_test_token_synthetic_1234567890";

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

test("auth fails closed with 503 when EXPORTFLOW_API_TOKEN is missing or whitespace-only", async () => {
  const worker = createWorker();
  const missingRes = await worker.fetch(makeTaskRequest({ goal: "Fetch page", url: "https://example.com" }), {});
  assert.equal(missingRes.status, 503);
  assert.equal((await missingRes.json()).error.code, "AUTH_NOT_CONFIGURED");

  const blankRes = await worker.fetch(
    makeTaskRequest({ goal: "Fetch page", url: "https://example.com" }),
    { EXPORTFLOW_API_TOKEN: "   \n  " },
  );
  assert.equal(blankRes.status, 503);
  assert.equal((await blankRes.json()).error.code, "AUTH_NOT_CONFIGURED");
});

test("auth rejects missing, empty, oversized, malformed, and invalid Bearer tokens with 401", async () => {
  const worker = createWorker();
  const env = { EXPORTFLOW_API_TOKEN: TEST_TOKEN };

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

  const invalid = await worker.fetch(makeTaskRequest({ goal: "Fetch", url: "https://example.com" }, { token: "wrong-token" }), env);
  assert.equal(invalid.status, 401);
  assert.equal((await invalid.json()).error.code, "INVALID_TOKEN");
});

test("authenticateRequest uses fixed-length SHA-256 comparison safely", async () => {
  const req = new Request("https://api.exportflow.local/api/v1/tasks", {
    headers: { authorization: `Bearer ${TEST_TOKEN}` },
  });
  const ok = await authenticateRequest(req, { EXPORTFLOW_API_TOKEN: TEST_TOKEN });
  assert.equal(ok.ok, true);

  const sameLenBad = new Request("https://api.exportflow.local/api/v1/tasks", {
    headers: { authorization: `Bearer ${"x".repeat(TEST_TOKEN.length)}` },
  });
  const bad = await authenticateRequest(sameLenBad, { EXPORTFLOW_API_TOKEN: TEST_TOKEN });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "INVALID_TOKEN");
});

test("POST /api/v1/tasks enforces content-type, empty/invalid UTF-8/malformed JSON, oversized payloads, and unknown fields", async () => {
  const worker = createWorker();
  const env = { EXPORTFLOW_API_TOKEN: TEST_TOKEN };

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

test("validateTaskRequest enforces strict numeric limit bounds and disables non-fetch operations", () => {
  assert.throws(
    () => validateTaskRequest({ goal: "Crawl", url: "https://example.com", operation: "crawl" }),
    (err) => err instanceof TaskContractError && err.code === "OPERATION_NOT_ENABLED" && err.httpStatus === 501,
  );

  for (const badLimits of [
    null,
    [],
    "fast",
    { timeoutMs: 0 },
    { timeoutMs: -1 },
    { timeoutMs: 1.5 },
    { timeoutMs: "1000" },
    { timeoutMs: 99_999 },
    { maxBytes: 0 },
    { maxBytes: 2_000_000 },
    { maxRedirects: -1 },
    { maxRedirects: 4 },
    { unknownLimit: 10 },
  ]) {
    assert.throws(
      () => validateTaskRequest({ goal: "Fetch", url: "https://example.com", limits: badLimits }),
      (err) => err instanceof TaskContractError && err.code === "INVALID_LIMIT",
    );
  }

  const valid = validateTaskRequest({
    goal: "Fetch docs",
    url: "https://example.com/docs#section",
    limits: { timeoutMs: 2500, maxBytes: 4096, maxRedirects: 1 },
  });
  assert.equal(valid.url, "https://example.com/docs");
  assert.equal(valid.operation, "fetch");
  assert.deepEqual(valid.limits, { timeoutMs: 2500, maxBytes: 4096, maxRedirects: 1 });
});

test("POST /api/v1/tasks rejects private, loopback, metadata, and invalid URLs before outbound fetch", async () => {
  let fetchCalls = 0;
  const worker = createWorker({
    fetchImpl: async () => {
      fetchCalls++;
      return new Response("should not execute");
    },
  });
  const env = { EXPORTFLOW_API_TOKEN: TEST_TOKEN };

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
  const env = { EXPORTFLOW_API_TOKEN: TEST_TOKEN };

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
    { EXPORTFLOW_API_TOKEN: TEST_TOKEN },
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

test("POST /api/v1/tasks handles upstream 404, 500, and network failures without leaking secrets", async () => {
  const env = { EXPORTFLOW_API_TOKEN: TEST_TOKEN };

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

test("POST /api/v1/tasks returns 501 unsupported for browser JS or interaction tasks without outbound calls", async () => {
  let fetchCalls = 0;
  const worker = createWorker({
    idFactory: () => "task-js-0001",
    fetchImpl: async () => {
      fetchCalls++;
      return new Response("unexpected");
    },
  });
  const env = { EXPORTFLOW_API_TOKEN: TEST_TOKEN };

  const jsRes = await worker.fetch(
    makeTaskRequest({ goal: "Render SPA", url: "https://example.com/app", requiresJavascript: true }),
    env,
  );
  assert.equal(jsRes.status, 501);
  assert.equal((await jsRes.json()).state, "unsupported");

  const interactRes = await worker.fetch(
    makeTaskRequest({ goal: "Click button", url: "https://example.com/app", requiresInteraction: true }),
    env,
  );
  assert.equal(interactRes.status, 501);
  assert.equal((await interactRes.json()).state, "unsupported");
  assert.equal(fetchCalls, 0);
});

test("rate limiter enforces boundary, concurrent burst, window reset, auth isolation, and invalid-request accounting", async () => {
  let currentMs = 1_000;
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3, now: () => currentMs });
  const worker = createWorker({
    rateLimiter: limiter,
    fetchImpl: async () => new Response("ok", { headers: { "content-type": "text/plain" } }),
  });
  const env = { EXPORTFLOW_API_TOKEN: TEST_TOKEN };

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
    new Request("https://exportflow.local/api/v1/platform"),
    { EXPORTFLOW_API_TOKEN: TEST_TOKEN },
  );
  const platformData = await configuredPlatform.json();
  assert.deepEqual(platformData.liveCapabilities, ["http.fetch.v1"]);
  assert.equal(platformData.endpoints.tasks, "/api/v1/tasks");

  const preview = await worker.fetch(new Request("https://exportflow.local/api/v1/router-preview?javascript=true"), {});
  assert.equal((await preview.json()).decision.path, "browser");

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
    env: { EXPORTFLOW_API_TOKEN: TEST_TOKEN },
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
    fetchImpl: async () => new Promise(() => {}),
  });
  const response = await worker.fetch(
    makeTaskRequest({ goal: "Wait for bounded deadline", url: "https://example.com/slow" }),
    { EXPORTFLOW_API_TOKEN: TEST_TOKEN },
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
  const pending = worker.fetch(request, { EXPORTFLOW_API_TOKEN: TEST_TOKEN });
  await new Promise((resolve) => setTimeout(resolve, 10));
  controller.abort();

  const response = await pending;
  assert.equal(response.status, 499);
  const task = await response.json();
  assert.equal(task.state, "cancelled");
  assert.equal(task.errors[0].code, "TASK_CANCELLED");
});
