import assert from "node:assert/strict";
import test from "node:test";
import { createExportFlowPreviewWorker } from "../src/mcp/preview-worker.js";
import { hashApiKey } from "../src/core/tenant-auth.js";

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
              requestLimit: 10,
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
  const env = options.env || {
    MCP_RATE_LIMITER: {
      async limit(value) {
        calls.limits.push(value);
        return { success: options.rateAllowed !== false };
      },
    },
  };
  return { worker, env, calls };
}

test("health route describes the read-only MCP preview", async () => {
  const { worker, env, calls } = makeWorker();
  const response = await worker.fetch(new Request("https://" + HOST + "/health"), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.endpoint, "/mcp");
  assert.deepEqual(body.tools, ["exportflow_capabilities", "web_fetch", "web_map", "web_crawl", "web_extract"]);
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
  assert.equal(body.result.serverInfo.version, "0.4.1-preview");
  assert.equal(response.headers.get("access-control-allow-origin"), "https://chatgpt.com");
});

test("tools/list exposes only the currently implemented read-only tools", async () => {
  const { worker, env } = makeWorker();
  const response = await worker.fetch(makeRequest(jsonRpc("tools/list")), env);
  const body = await response.json();
  const tools = body.result.tools;
  assert.equal(response.status, 200);
  assert.deepEqual(tools.map((tool) => tool.name), ["exportflow_capabilities", "web_fetch", "web_map", "web_crawl", "web_extract"]);
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint === true));
  const capabilityTool = tools.find((tool) => tool.name === "exportflow_capabilities");
  assert.equal(capabilityTool._meta.securitySchemes[0].type, "noauth");
  for (const tool of tools.filter((item) => item.name !== "exportflow_capabilities")) {
    assert.equal(tool._meta.securitySchemes[0].type, "http");
    assert.equal(tool._meta.securitySchemes[0].scheme, "bearer");
  }
});

test("web_fetch delegates to shared task execution and applies weighted rate limiting", async () => {
  const { worker, env, calls } = makeWorker({ taskResult: { id: "task_fetch_123", state: "succeeded" } });
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_fetch", arguments: { url: "https://example.com/" },
  }), { headers: {
    "cf-connecting-ip": "203.0.113.42",
    authorization: "Bearer synthetic-tenant-key",
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
  assert.equal(calls.reservations.length, 1);
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
  }), { headers: { authorization: "Bearer synthetic-tenant-key" } }), env);
  const body = await response.json();
  assert.equal(body.result.structuredContent.error, "INSUFFICIENT_SCOPE");
  assert.equal(calls.auth[0].requiredScope, "tasks:crawl");
  assert.equal(calls.reservations.length, 0);
  assert.equal(calls.tasks.length, 0);
});

test("MCP rejects exhausted tenant quotas before executing a task", async () => {
  const { worker, env, calls } = makeWorker({
    reservationResult: {
      ok: false,
      httpStatus: 429,
      code: "PLAN_QUOTA_EXCEEDED",
      message: "Quota exhausted.",
      retryAfterSec: 3600,
      quota: { limit: 5, remaining: 0, resetAt: "2026-11-21T00:00:00.000Z" },
    },
  });
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_fetch",
    arguments: { url: "https://example.com/" },
  }), { headers: { authorization: "Bearer synthetic-tenant-key" } }), env);
  const body = await response.json();
  assert.equal(body.result.isError, true);
  assert.equal(body.result.structuredContent.error, "PLAN_QUOTA_EXCEEDED");
  assert.equal(calls.tasks.length, 0);
});

const TENANT_KEY_ID = "0123456789abcdef";
const TENANT_TOKEN = "ef_live_" + TENANT_KEY_ID + "_" + "T".repeat(43);
const TENANT_KEY_HASH = await hashApiKey(TENANT_TOKEN);

function makeTenantD1({ requestLimit = 1, scopes = ["tasks:fetch"] } = {}) {
  const usage = new Map();
  const record = {
    key_id: TENANT_KEY_ID,
    tenant_id: "tenant_mcp_test",
    key_status: "active",
    expires_at: null,
    scopes_json: JSON.stringify(scopes),
    tenant_status: "active",
    plan_code: "test",
    plan_status: "active",
    quota_period: "daily",
    request_limit: requestLimit,
    policy_version: "test-v1",
  };
  return {
    usage,
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async first() {
          if (sql.includes("FROM api_keys")) {
            return params[0] === TENANT_KEY_ID && params[1] === TENANT_KEY_HASH ? { ...record } : null;
          }
          if (sql.includes("INSERT INTO tenant_request_usage")) {
            const [tenantId, windowId, planCode, policyVersion, limit, updatedAt] = params;
            const id = tenantId + ":" + windowId;
            const row = usage.get(id) || { tenant_id: tenantId, window_id: windowId, plan_code: planCode, policy_version: policyVersion, request_limit: limit, requests_used: 0 };
            if (row.requests_used >= row.request_limit) return null;
            row.requests_used += 1;
            row.updated_at = updatedAt;
            usage.set(id, row);
            return { requests_used: row.requests_used, request_limit: row.request_limit };
          }
          if (sql.includes("SELECT request_limit, requests_used")) {
            const [tenantId, windowId] = params;
            const row = usage.get(tenantId + ":" + windowId);
            return row ? { request_limit: row.request_limit, requests_used: row.requests_used } : null;
          }
          throw new Error("Unexpected D1 SQL in MCP tenant fixture.");
        },
      };
    },
  };
}

test("MCP real tenant gateway authorizes, reserves one D1-shaped quota unit, then blocks exhaustion", async () => {
  const db = makeTenantD1({ requestLimit: 1 });
  const { worker, calls } = makeWorker({
    useRealGateway: true,
    taskResult: { id: "task_mcp_tenant_01", state: "succeeded" },
    env: {
      EXPORTFLOW_AUTH_DB: db,
      MCP_RATE_LIMITER: { async limit() { return { success: true }; } },
    },
  });
  const makeCall = () => makeRequest(jsonRpc("tools/call", {
    name: "web_fetch",
    arguments: { url: "https://example.com/" },
  }), { headers: { authorization: "Bearer " + TENANT_TOKEN, "cf-connecting-ip": "203.0.113.55" } });

  const first = await worker.fetch(makeCall(), {
    EXPORTFLOW_AUTH_DB: db,
    MCP_RATE_LIMITER: { async limit() { return { success: true }; } },
  });
  const firstBody = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstBody.result.structuredContent.quota.limit, 1);
  assert.equal(firstBody.result.structuredContent.quota.remaining, 0);
  assert.equal(calls.tasks.length, 1);
  assert.equal([...db.usage.values()][0].requests_used, 1);

  const second = await worker.fetch(makeCall(), {
    EXPORTFLOW_AUTH_DB: db,
    MCP_RATE_LIMITER: { async limit() { return { success: true }; } },
  });
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
  assert.equal(db.usage.size, 0);
});
