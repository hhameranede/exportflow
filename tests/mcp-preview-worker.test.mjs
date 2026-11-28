import assert from "node:assert/strict";
import test from "node:test";
import { createAuthServiceJwksFetcher, createExportFlowPreviewWorker } from "../src/mcp/preview-worker.js";
import { hashApiKey } from "../src/core/tenant-auth.js";
import { createDurableTenantBurstTestNamespace } from "./helpers/durable-tenant-burst-test-namespace.js";
import { createDurableTaskD1 } from "./helpers/durable-task-d1.js";

const HOST = "mcp.exportflow.me";
const URL = "https://" + HOST + "/mcp";

function makeRequest(message, options = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  });
  if (options.origin) headers.set("origin", options.origin);
  if (options.protocol) headers.set("mcp-protocol-version", options.protocol);
  if (options.headers) {
    for (const [name, value] of Object.entries(options.headers)) headers.set(name, value);
  }
  return new Request(options.url || URL, {
    method: options.method || "POST",
    headers,
    body: options.body ?? (message === undefined ? undefined : JSON.stringify(message)),
  });
}

function jsonRpc(method, params = {}, id = 1) {
  return { jsonrpc: "2.0", id, method, params };
}

function makeWorker(options = {}) {
  const calls = { tasks: [], limits: [], auth: [], reservations: [] };
  const executeWebTask = async (input, taskOptions) => {
    calls.tasks.push({ input, taskOptions });
    return options.taskResult || { id: "task_test_123", state: "succeeded" };
  };
  const tenantTaskGateway = options.useRealGateway
    ? undefined
    : (options.tenantTaskGateway || {
        async authenticate(request, _env, { requiredScope } = {}) {
          calls.auth.push({ authorization: request.headers.get("authorization"), requiredScope });
          if (options.authResult) return options.authResult;
          if (!request.headers.has("authorization")) {
            return { ok: false, httpStatus: 401, code: "UNAUTHORIZED", message: "Bearer API key required." };
          }
          return {
            ok: true,
            identity: {
              tenantId: "tenant_test_001",
              planCode: "test",
              policyVersion: "test-v1",
              quotaPeriod: "daily",
              requestLimit: options.requestLimit ?? 10,
              scopes: ["tasks:fetch", "tasks:map", "tasks:crawl", "tasks:extract", "tasks:search", "tasks:research", "tasks:read"],
            },
          };
        },
        async reserve(_env, identity) {
          calls.reservations.push(identity);
          if (options.reservationResult) return options.reservationResult;
          return {
            ok: true,
            quota: { limit: 10, used: 1, remaining: 9, resetAt: "2026-11-21T00:00:00.000Z", windowId: "2026-11-20" },
          };
        },
      });
  const getAdapterCatalog = () => [{ id: "http.fetch.v1", capabilities: ["fetch"] }];
  const worker = createExportFlowPreviewWorker({
    executeWebTask,
    getAdapterCatalog,
    expectedHost: HOST,
    ...(tenantTaskGateway ? { tenantTaskGateway } : {}),
  });
  const taskFixture = options.useRealGateway
    ? null
    : createDurableTaskD1({ requestLimit: options.requestLimit ?? 10, tenantIds: ["tenant_test_001"], planCode: "test" });
  if (taskFixture) taskFixture.db.sqlite = taskFixture.sqlite;
  const env = options.env || {
    ...(taskFixture ? { EXPORTFLOW_AUTH_DB: taskFixture.db } : {}),
    MCP_RATE_LIMITER: {
      async limit(value) {
        calls.limits.push(value);
        return { success: options.rateAllowed !== false };
      },
    },
  };
  return { worker, env, calls };
}

test("Auth Service Binding supplies JWKS directly to the MCP verifier", async () => {
  const target = "https://auth-acceptance.hhameranede.workers.dev/api/auth/jwks";
  let requestSeen;
  const fetcher = createAuthServiceJwksFetcher({
    AUTH_SERVICE: {
      async fetch(request) {
        requestSeen = request;
        return new Response(JSON.stringify({ keys: [{ kid: "acceptance-key-1", kty: "OKP" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  }, target);

  assert.equal(typeof fetcher, "function");
  const jwks = await fetcher();
  assert.equal(requestSeen.url, target);
  assert.equal(requestSeen.method, "GET");
  assert.deepEqual(jwks.keys, [{ kid: "acceptance-key-1", kty: "OKP" }]);
});

test("Auth Service Binding JWKS fetch fails closed on upstream errors or malformed documents", async () => {
  const target = "https://auth-acceptance.hhameranede.workers.dev/api/auth/jwks";
  const unavailable = createAuthServiceJwksFetcher({
    AUTH_SERVICE: { async fetch() { return new Response("not found", { status: 404 }); } },
  }, target);
  await assert.rejects(unavailable(), /HTTP 404/);

  const malformed = createAuthServiceJwksFetcher({
    AUTH_SERVICE: { async fetch() { return Response.json({ keys: "not-an-array" }); } },
  }, target);
  await assert.rejects(malformed(), /invalid or empty JWKS document/);

  const empty = createAuthServiceJwksFetcher({
    AUTH_SERVICE: { async fetch() { return Response.json({ keys: [] }); } },
  }, target);
  await assert.rejects(empty(), /invalid or empty JWKS document/);
});

test("health route describes the read-only MCP preview", async () => {
  const { worker, env, calls } = makeWorker();
  const response = await worker.fetch(new Request("https://" + HOST + "/health"), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.endpoint, "/mcp");
  assert.deepEqual(body.tools, ["exportflow_capabilities", "web_task_status", "web_fetch", "web_map", "web_crawl", "web_extract", "web_search", "web_research"]);
  assert.equal(calls.tasks.length, 0);
});

test("host guard rejects requests addressed to another hostname", async () => {
  const { worker, env } = makeWorker();
  const response = await worker.fetch(makeRequest(jsonRpc("initialize"), { url: "https://other.example/mcp" }), env);
  assert.equal(response.status, 421);
  assert.deepEqual(await response.json(), { error: "host_not_allowed" });
});

test("origin guard rejects untrusted browser origins", async () => {
  const { worker, env } = makeWorker();
  const response = await worker.fetch(makeRequest(jsonRpc("initialize"), { origin: "https://attacker.example" }), env);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "origin_not_allowed" });
});

test("MCP initialize negotiates a supported protocol version", async () => {
  const { worker, env } = makeWorker();
  const response = await worker.fetch(makeRequest(jsonRpc("initialize", { protocolVersion: "2025-11-25" }), { protocol: "2025-11-25", origin: "https://chatgpt.com" }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.result.protocolVersion, "2025-11-25");
  assert.equal(body.result.serverInfo.name, "ExportFlow");
  assert.equal(body.result.serverInfo.version, "0.5.0-preview");
  assert.equal(response.headers.get("access-control-allow-origin"), "https://chatgpt.com");
});

test("tools/list exposes only the currently implemented read-only tools", async () => {
  const { worker, env } = makeWorker();
  const response = await worker.fetch(makeRequest(jsonRpc("tools/list")), env);
  const body = await response.json();
  const tools = body.result.tools;
  assert.equal(response.status, 200);
  assert.deepEqual(tools.map((tool) => tool.name), ["exportflow_capabilities", "web_task_status", "web_fetch", "web_map", "web_crawl", "web_extract", "web_search", "web_research"]);
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint === true));
  const capabilityTool = tools.find((tool) => tool.name === "exportflow_capabilities");
  assert.equal(capabilityTool._meta.securitySchemes[0].type, "noauth");
  for (const tool of tools.filter((item) => item.name !== "exportflow_capabilities")) {
    assert.equal(tool.securitySchemes[0].type, "oauth2");
    assert.deepEqual(tool.securitySchemes[0].scopes, [{
      web_fetch: "tasks:fetch",
      web_map: "tasks:map",
      web_crawl: "tasks:crawl",
      web_extract: "tasks:extract",
      web_search: "tasks:search",
      web_research: "tasks:research",
      web_task_status: "tasks:read",
    }[tool.name]]);
    assert.deepEqual(tool._meta.securitySchemes, tool.securitySchemes);
  }
});

test("web_fetch delegates to shared task execution and applies weighted rate limiting", async () => {
  const { worker, env, calls } = makeWorker({ taskResult: { id: "task_fetch_123", state: "succeeded" } });
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_fetch", arguments: { url: "https://example.com/" },
  }), { headers: {
    "cf-connecting-ip": "203.0.113.42",
    authorization: "Bearer " + TENANT_TOKEN,
  } }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.result.isError, undefined);
  assert.equal(calls.tasks.length, 1);
  assert.equal(calls.tasks[0].input.operation, "fetch");
  assert.equal(calls.tasks[0].input.url, "https://example.com/");
  assert.equal(calls.tasks[0].taskOptions.signal.aborted, false);
  assert.deepEqual(calls.limits, [{ key: "203.0.113.42", delta: 1 }]);
  assert.equal(calls.auth[0].requiredScope, "tasks:fetch");
  assert.equal(body.result.structuredContent.quota.limit, 10);
  assert.equal(body.result.structuredContent.quota.remaining, 9);
  assert.equal(calls.reservations.length, 0, "the D1 insert trigger now owns logical quota reservation");
  assert.equal(env.EXPORTFLOW_AUTH_DB.sqlite.prepare("SELECT requests_used FROM tenant_request_usage WHERE tenant_id = 'tenant_test_001'").get().requests_used, 1);
});

test("web_extract forwards CSV column mappings through the shared MCP task path", async () => {
  const { worker, env, calls } = makeWorker({ taskResult: { id: "task_csv_123", state: "succeeded" } });
  const schema = {
    type: "object",
    properties: {
      sku: { type: "array", items: { type: "string" }, "x-source": "csv:SKU" },
      notes: { type: "array", items: { type: "string" }, "x-source": "csv:Product Notes" },
    },
    required: ["sku"],
  };

  const listed = await worker.fetch(makeRequest(jsonRpc("tools/list")), env);
  const tools = (await listed.json()).result.tools;
  const extractTool = tools.find((tool) => tool.name === "web_extract");
  assert.match(extractTool.description, /bounded CSV/);
  assert.equal(extractTool.inputSchema.properties.schema.type, "object");

  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_extract",
    arguments: {
      url: "https://example.com/catalog.csv",
      schema,
    },
  }), { headers: {
    "cf-connecting-ip": "203.0.113.43",
    authorization: "Bearer " + TENANT_TOKEN,
  } }), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.result.isError, undefined);
  assert.equal(calls.tasks.length, 1);
  assert.equal(calls.tasks[0].input.operation, "extract");
  assert.equal(calls.tasks[0].input.url, "https://example.com/catalog.csv");
  assert.deepEqual(calls.tasks[0].input.schema, schema);
  assert.equal(calls.auth[0].requiredScope, "tasks:extract");
});

test("invalid tool arguments are rejected before rate limiting or task execution", async () => {
  const { worker, env, calls } = makeWorker();
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_fetch", arguments: { url: "file:///etc/passwd" },
  })), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.result.isError, true);
  assert.equal(body.result.structuredContent.error, "invalid_arguments");
  assert.equal(calls.limits.length, 0);
  assert.equal(calls.tasks.length, 0);
});

test("weighted rate-limit denial returns a tool error and skips execution", async () => {
  const { worker, env, calls } = makeWorker({ rateAllowed: false });
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_crawl", arguments: { url: "https://example.com/" },
  })), env);
  const body = await response.json();
  assert.equal(body.result.isError, true);
  assert.equal(body.result.structuredContent.error, "rate_limited");
  assert.deepEqual(calls.limits, [{ key: "unknown", delta: 6 }]);
  assert.equal(calls.tasks.length, 0);
});

test("tool calls fail closed when the rate-limit binding is missing", async () => {
  const { worker, calls } = makeWorker();
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_fetch", arguments: { url: "https://example.com/" },
  })), {});
  const body = await response.json();
  assert.equal(body.result.isError, true);
  assert.equal(body.result.structuredContent.error, "rate_limiter_not_configured");
  assert.equal(calls.tasks.length, 0);
});

test("oversized MCP request bodies are rejected", async () => {
  const { worker, env } = makeWorker();
  const response = await worker.fetch(makeRequest(undefined, { body: "x".repeat(65_537), headers: { "content-length": "65537" } }), env);
  assert.equal(response.status, 413);
});

test("chunked request bodies are bounded while streaming even without Content-Length", async () => {
  const { worker, env, calls } = makeWorker();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(65_537)));
      controller.close();
    },
  });
  const request = new Request(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: stream,
    duplex: "half",
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "request_too_large" });
  assert.equal(calls.tasks.length, 0);
});

test("MCP request bodies also bound empty stream chunks", async () => {
  const { worker, env, calls } = makeWorker();
  const stream = new ReadableStream({
    start(controller) {
      for (let index = 0; index < 8_193; index += 1) {
        controller.enqueue(new Uint8Array(0));
      }
      controller.close();
    },
  });
  const request = new Request(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: stream,
    duplex: "half",
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "request_too_large" });
  assert.equal(calls.tasks.length, 0);
});

test("stream cancellation errors do not mask the oversized-body response", async () => {
  const { worker, env, calls } = makeWorker();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(65_537)));
    },
    cancel() {
      return Promise.reject(new Error("synthetic stream cancellation failure"));
    },
  });
  const request = new Request(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: stream,
    duplex: "half",
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "request_too_large" });
  assert.equal(calls.tasks.length, 0);
});

test("oversized-body rejection does not wait for a stalled stream cancellation", async () => {
  const { worker, env, calls } = makeWorker();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(65_537)));
    },
    cancel() {
      return new Promise(() => {});
    },
  });
  const request = new Request(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: stream,
    duplex: "half",
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "request_too_large" });
  assert.equal(calls.tasks.length, 0);
});

test("malformed Content-Length is rejected before JSON-RPC dispatch", async () => {
  const { worker, env, calls } = makeWorker();
  const malformedLengths = ["1.5", "1e3", "-1", "+1", "NaN"];

  for (const contentLength of malformedLengths) {
    const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
      name: "web_fetch", arguments: { url: "https://example.com/" },
    }), { headers: { "content-length": contentLength } }), env);

    assert.equal(response.status, 400, `Content-Length ${contentLength} must be rejected.`);
    assert.deepEqual(await response.json(), { error: "invalid_content_length" });
  }

  assert.equal(calls.limits.length, 0);
  assert.equal(calls.tasks.length, 0);
});

test("MCP endpoint enforces JSON content type and required response media types", async () => {
  const { worker, env } = makeWorker();
  const wrongContentType = await worker.fetch(new Request(URL, {
    method: "POST",
    headers: { "content-type": "text/plain", accept: "application/json, text/event-stream" },
    body: JSON.stringify(jsonRpc("ping")),
  }), env);
  assert.equal(wrongContentType.status, 415);
  const wrongAccept = await worker.fetch(new Request(URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(jsonRpc("ping")),
  }), env);
  assert.equal(wrongAccept.status, 406);
});

test("unknown JSON-RPC methods return method-not-found", async () => {
  const { worker, env } = makeWorker();
  const response = await worker.fetch(makeRequest(jsonRpc("tools/delete")), env);
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.error.code, -32601);
});

test("execution tools fail closed when the tenant D1 binding is missing", async () => {
  const { worker, env } = makeWorker({ useRealGateway: true });
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_fetch",
    arguments: { url: "https://example.com/" },
  }), { headers: { authorization: "Bearer ef_live_0123456789abcdef_" + "A".repeat(43) } }), env);
  const body = await response.json();
  assert.equal(body.result.isError, true);
  assert.equal(body.result.structuredContent.error, "AUTH_NOT_CONFIGURED");
});

test("tool calls enforce operation-specific scopes before quota reservation", async () => {
  const { worker, env, calls } = makeWorker({
    authResult: { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "Scope missing." },
  });
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_crawl",
    arguments: { url: "https://example.com/" },
  }), { headers: { authorization: "Bearer " + TENANT_TOKEN } }), env);
  const body = await response.json();
  assert.equal(body.result.structuredContent.error, "INSUFFICIENT_SCOPE");
  assert.equal(calls.auth[0].requiredScope, "tasks:crawl");
  assert.equal(calls.reservations.length, 0);
  assert.equal(calls.tasks.length, 0);
});

test("MCP rejects exhausted durable task quotas before a second execution", async () => {
  const fixture = createDurableTaskD1({ requestLimit: 1, tenantIds: ["tenant_test_001"], planCode: "test" });
  const mcpEnv = {
    EXPORTFLOW_AUTH_DB: fixture.db,
    MCP_RATE_LIMITER: { async limit() { return { success: true }; } },
  };
  const { worker, calls } = makeWorker({ env: mcpEnv, requestLimit: 1 });
  const call = () => makeRequest(jsonRpc("tools/call", {
    name: "web_fetch",
    arguments: { url: "https://example.com/" },
  }), { headers: { authorization: "Bearer " + TENANT_TOKEN } });
  try {
    const first = await worker.fetch(call(), mcpEnv);
    assert.equal((await first.json()).result.isError, undefined);
    const second = await worker.fetch(call(), mcpEnv);
    const body = await second.json();
    assert.equal(body.result.isError, true);
    assert.equal(body.result.structuredContent.error, "PLAN_QUOTA_EXCEEDED");
    assert.equal(calls.tasks.length, 1);
  } finally {
    fixture.close();
  }
});

const TENANT_KEY_ID = "0123456789abcdef";
const TENANT_TOKEN = "ef_live_" + TENANT_KEY_ID + "_" + "T".repeat(43);
const TENANT_KEY_HASH = await hashApiKey(TENANT_TOKEN);

function makeTenantD1({ requestLimit = 1, scopes = ["tasks:fetch"] } = {}) {
  const fixture = createDurableTaskD1({
    requestLimit,
    tenantIds: ["tenant_mcp_test"],
    planCode: "test",
  });
  fixture.sqlite.prepare(
    "INSERT INTO api_keys (key_id, tenant_id, key_hash, status, scopes_json, expires_at, created_at) " +
    "VALUES (?1, ?2, ?3, 'active', ?4, NULL, ?5)",
  ).run(
    TENANT_KEY_ID,
    "tenant_mcp_test",
    TENANT_KEY_HASH,
    JSON.stringify(scopes),
    "2026-11-24T10:00:00.000Z",
  );
  fixture.db.sqlite = fixture.sqlite;
  return fixture.db;
}

test("MCP real tenant gateway authorizes, reserves one D1-shaped quota unit, then blocks exhaustion", async () => {
  const db = makeTenantD1({ requestLimit: 1 });
  const env = {
    EXPORTFLOW_AUTH_DB: db,
    TENANT_BURST_LIMITER: createDurableTenantBurstTestNamespace(),
    MCP_RATE_LIMITER: { async limit() { return { success: true }; } },
  };
  const { worker, calls } = makeWorker({
    useRealGateway: true,
    taskResult: { id: "task_mcp_tenant_01", state: "succeeded" },
    env,
  });
  const makeCall = () => makeRequest(jsonRpc("tools/call", {
    name: "web_fetch",
    arguments: { url: "https://example.com/" },
  }), { headers: { authorization: "Bearer " + TENANT_TOKEN, "cf-connecting-ip": "203.0.113.55" } });

  const first = await worker.fetch(makeCall(), env);
  const firstBody = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstBody.result.structuredContent.quota.limit, 1);
  assert.equal(firstBody.result.structuredContent.quota.remaining, 0);
  assert.equal(calls.tasks.length, 1);
  assert.equal(db.sqlite.prepare("SELECT requests_used FROM tenant_request_usage WHERE tenant_id = 'tenant_mcp_test'").get().requests_used, 1);

  const second = await worker.fetch(makeCall(), env);
  const secondBody = await second.json();
  assert.equal(secondBody.result.isError, true);
  assert.equal(secondBody.result.structuredContent.error, "PLAN_QUOTA_EXCEEDED");
  assert.equal(calls.tasks.length, 1);
});

test("MCP real tenant gateway enforces D1-derived operation scope before quota reservation", async () => {
  const db = makeTenantD1({ requestLimit: 5, scopes: ["tasks:fetch"] });
  const { worker, calls } = makeWorker({ useRealGateway: true });
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_crawl",
    arguments: { url: "https://example.com/" },
  }), { headers: { authorization: "Bearer " + TENANT_TOKEN, "cf-connecting-ip": "203.0.113.56" } }), {
    EXPORTFLOW_AUTH_DB: db,
    MCP_RATE_LIMITER: { async limit() { return { success: true }; } },
  });
  const body = await response.json();
  assert.equal(body.result.isError, true);
  assert.equal(body.result.structuredContent.error, "INSUFFICIENT_SCOPE");
  assert.equal(calls.tasks.length, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS total FROM tenant_request_usage").get().total, 0);
});


test("MCP protected-resource metadata uses configured Auth and MCP origins", async () => {
  const env = {
    AUTH_ISSUER_URL: "https://auth-acceptance.hhameranede.workers.dev/api/auth",
    MCP_RESOURCE_URL: "https://mcp-acceptance.hhameranede.workers.dev/mcp",
    MCP_RATE_LIMITER: { async limit() { return { success: true }; } },
  };
  const { worker } = makeWorker({ env });
  const response = await worker.fetch(new Request("https://" + HOST + "/.well-known/oauth-protected-resource/mcp"), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.resource, "https://mcp-acceptance.hhameranede.workers.dev/mcp");
  assert.deepEqual(body.authorization_servers, ["https://auth-acceptance.hhameranede.workers.dev/api/auth"]);
  assert.deepEqual(body.scopes_supported, ["tasks:fetch", "tasks:map", "tasks:crawl", "tasks:extract", "tasks:search", "tasks:research", "tasks:read"]);
});

test("MCP responses include baseline security headers on JSON, empty, and preflight paths", async () => {
  const { worker, env } = makeWorker();
  const required = {
    "strict-transport-security": "max-age=63072000",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
  const cases = [
    ["health", await worker.fetch(new Request("https://" + HOST + "/health"), env), 200],
    ["RPC", await worker.fetch(makeRequest(jsonRpc("ping")), env), 200],
    ["initialized notification", await worker.fetch(makeRequest({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }), env), 202],
    ["method-not-allowed", await worker.fetch(new Request(URL, { method: "GET" }), env), 405],
    ["preflight", await worker.fetch(makeRequest(undefined, {
      method: "OPTIONS",
      origin: "https://chatgpt.com",
    }), env), 204],
  ];

  for (const [name, response, expectedStatus] of cases) {
    assert.equal(response.status, expectedStatus, name + " status");
    for (const [header, value] of Object.entries(required)) {
      assert.equal(response.headers.get(header), value, name + " " + header);
    }
  }
});

test("MCP preflight keeps the allowed ChatGPT origin and Vary header while adding security headers", async () => {
  const { worker, env } = makeWorker();
  const response = await worker.fetch(makeRequest(undefined, {
    method: "OPTIONS",
    origin: "https://chatgpt.com",
  }), env);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://chatgpt.com");
  assert.equal(response.headers.get("vary"), "Origin");
  assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
});

test("protected tool calls return an OAuth challenge scoped to the configured MCP resource", async () => {
  const env = {
    AUTH_ISSUER_URL: "https://auth-acceptance.hhameranede.workers.dev/api/auth",
    MCP_RESOURCE_URL: "https://mcp-acceptance.hhameranede.workers.dev/mcp",
    MCP_RATE_LIMITER: { async limit() { return { success: true }; } },
  };
  const { worker, calls } = makeWorker({ env });
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_fetch",
    arguments: { url: "https://example.com/" },
  })), env);
  const body = await response.json();
  const result = body.result;
  const challenge = result?._meta?.["mcp/www_authenticate"]?.[0] || "";
  assert.equal(response.status, 200);
  assert.equal(result.isError, true);
  assert.match(challenge, /resource_metadata="https:\/\/mcp-acceptance\.hhameranede\.workers\.dev\/\.well-known\/oauth-protected-resource\/mcp"/);
  assert.match(challenge, /error="invalid_token"/);
  assert.match(challenge, /error_description="/);
  assert.equal(calls.tasks.length, 0);
});

test("web_search maps the selected public source to shared task execution with its own scope", async () => {
  const { worker, env, calls } = makeWorker({ taskResult: { id: "task_search_123", state: "succeeded" } });
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_search", arguments: { query: "public APIs", source: "openalex", limit: 4, cacheMode: "bypass" },
  }), { headers: { "cf-connecting-ip": "203.0.113.47", authorization: "Bearer " + TENANT_TOKEN } }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.result.isError, undefined);
  assert.equal(calls.tasks[0].input.operation, "search");
  assert.equal(calls.tasks[0].input.source, "openalex");
  assert.equal(calls.tasks[0].input.query, "public APIs");
  assert.equal(calls.tasks[0].input.cacheMode, "bypass");
  assert.equal(calls.auth[0].requiredScope, "tasks:search");
  assert.deepEqual(calls.limits, [{ key: "203.0.113.47", delta: 2 }]);
});

test("web_research requires its own scope and passes source and schema", async () => {
  const { worker, env, calls } = makeWorker({ taskResult: { id: "task_research_123", state: "succeeded" } });
  const schema = { type: "object", properties: { title: { type: "string" } } };
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_research", arguments: { query: "public APIs", source: "crossref", schema, candidateLimit: 2, cacheMode: "default" },
  }), { headers: { "cf-connecting-ip": "203.0.113.48", authorization: "Bearer " + TENANT_TOKEN } }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.result.isError, undefined);
  assert.equal(calls.tasks[0].input.operation, "research");
  assert.equal(calls.tasks[0].input.source, "crossref");
  assert.deepEqual(calls.tasks[0].input.schema, schema);
  assert.equal(calls.tasks[0].input.cacheMode, "default");
  assert.equal(calls.auth[0].requiredScope, "tasks:research");
  assert.deepEqual(calls.limits, [{ key: "203.0.113.48", delta: 5 }]);
});


test("web_extract publishes and forwards the optional Readability article switch", async () => {
+  const { worker, env, calls } = makeWorker({ taskResult: { id: "task_article_123", state: "succeeded" } });
+  const listed = await worker.fetch(makeRequest(jsonRpc("tools/list")), env);
+  const tools = (await listed.json()).result.tools;
+  const extractTool = tools.find((tool) => tool.name === "web_extract");
+  assert.equal(extractTool.inputSchema.properties.includeArticle.type, "boolean");
+
+  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
+    name: "web_extract",
+    arguments: {
+      url: "https://example.com/article",
+      schema: { type: "object", properties: { title: { type: "string" } } },
+      includeArticle: true,
+    },
+  }), { headers: { authorization: "Bearer " + TENANT_TOKEN } }), env);
+  const body = await response.json();
+  assert.equal(response.status, 200);
+  assert.equal(body.result.isError, undefined);
+  assert.equal(calls.tasks.length, 1);
+  assert.equal(calls.tasks[0].input.operation, "extract");
+  assert.equal(calls.tasks[0].input.includeArticle, true);
+  assert.equal(calls.auth.at(-1).requiredScope, "tasks:extract");
+});
+
+test("web_extract rejects a non-boolean article switch before rate limiting or execution", async () => {
+  const { worker, env, calls } = makeWorker();
+  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
+    name: "web_extract",
+    arguments: {
+      url: "https://example.com/article",
+      schema: { type: "object", properties: { title: { type: "string" } } },
+      includeArticle: "yes",
+    },
+  })), env);
+  const body = await response.json();
+  assert.equal(response.status, 200);
+  assert.equal(body.result.isError, true);
+  assert.equal(body.result.structuredContent.error, "invalid_arguments");
+  assert.equal(calls.limits.length, 0);
+  assert.equal(calls.tasks.length, 0);
+});
