import assert from "node:assert/strict";
import test from "node:test";
import { createExportFlowPreviewWorker } from "../src/mcp/preview-worker.js";

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
  const calls = { tasks: [], limits: [] };
  const executeWebTask = async (input, taskOptions) => {
    calls.tasks.push({ input, taskOptions });
    return options.taskResult || { id: "task_test_123", state: "succeeded" };
  };
  const getAdapterCatalog = () => [{ id: "http.fetch.v1", capabilities: ["fetch"] }];
  const worker = createExportFlowPreviewWorker({ executeWebTask, getAdapterCatalog, expectedHost: HOST });
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
  assert.ok(tools.every((tool) => tool._meta.securitySchemes[0].type === "noauth"));
});

test("web_fetch delegates to shared task execution and applies weighted rate limiting", async () => {
  const { worker, env, calls } = makeWorker({ taskResult: { id: "task_fetch_123", state: "succeeded" } });
  const response = await worker.fetch(makeRequest(jsonRpc("tools/call", {
    name: "web_fetch", arguments: { url: "https://example.com/" },
  }), { headers: { "cf-connecting-ip": "203.0.113.42" } }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.result.isError, undefined);
  assert.equal(calls.tasks.length, 1);
  assert.equal(calls.tasks[0].input.operation, "fetch");
  assert.equal(calls.tasks[0].input.url, "https://example.com/");
  assert.equal(calls.tasks[0].taskOptions.signal.aborted, false);
  assert.deepEqual(calls.limits, [{ key: "203.0.113.42", delta: 1 }]);
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
