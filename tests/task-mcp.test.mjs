import assert from "node:assert/strict";
import test from "node:test";
import { createExportFlowPreviewWorker } from "../src/mcp/preview-worker.js";
import { createDurableTaskD1 } from "./helpers/durable-task-d1.js";

const identity = Object.freeze({
  tenantId: "tenant_alpha",
  planCode: "developer",
  policyVersion: "test-v1",
  quotaPeriod: "daily",
  requestLimit: 10,
  scopes: ["tasks:fetch", "tasks:read"],
});
const authorization = "Bearer ef_live_abcdefghijklmnop_" + "a".repeat(43);

function makeGateway() {
  return {
    async authenticate(_request, _env, { requiredScope } = {}) {
      if (requiredScope && !identity.scopes.includes(requiredScope)) {
        return { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "scope denied" };
      }
      return { ok: true, identity };
    },
    authorizeIdentity: async (_request, value, { requiredScope } = {}) => (
      requiredScope && !value.scopes.includes(requiredScope)
        ? { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "scope denied" }
        : { ok: true, identity: value }
    ),
  };
}

async function callTool(worker, env, id, name, args) {
  const request = new Request("https://mcp.exportflow.me/mcp", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const response = await worker.fetch(request, env);
  return { response, body: await response.json() };
}

test("web_task_status requires tasks:read independently of task execution scopes", async () => {
  const fixture = createDurableTaskD1();
  const fetchOnlyGateway = {
    async authenticate(_request, _env, { requiredScope } = {}) {
      const value = { ...identity, scopes: ["tasks:fetch"] };
      if (requiredScope && !value.scopes.includes(requiredScope)) {
        return { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "scope denied" };
      }
      return { ok: true, identity: value };
    },
    authorizeIdentity: async (_request, value, { requiredScope } = {}) => (
      requiredScope && !value.scopes.includes(requiredScope)
        ? { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "scope denied" }
        : { ok: true, identity: value }
    ),
  };
  const worker = createExportFlowPreviewWorker({
    expectedHost: "mcp.exportflow.me",
    tenantTaskGateway: fetchOnlyGateway,
    getAdapterCatalog: () => [],
    executeWebTask: async () => { throw new Error("This status-only test must not execute tasks."); },
  });
  const env = {
    EXPORTFLOW_AUTH_DB: fixture.db,
    MCP_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  try {
    const denied = await callTool(worker, env, 1, "web_task_status", { taskId: "task_missing_01" });
    assert.equal(denied.response.status, 200);
    assert.equal(denied.body.result.isError, true);
    assert.equal(denied.body.result.structuredContent.error, "INSUFFICIENT_SCOPE");
  } finally {
    fixture.close();
  }
});

test("MCP task execution and web_task_status share one durable tenant task record", async () => {
  const fixture = createDurableTaskD1();
  let executeCalls = 0;
  const worker = createExportFlowPreviewWorker({
    expectedHost: "mcp.exportflow.me",
    tenantTaskGateway: makeGateway(),
    getAdapterCatalog: () => [],
    executeWebTask: async (input, options) => {
      executeCalls += 1;
      return {
        id: options.idFactory(),
        goal: input.goal,
        requestedUrl: input.url,
        state: "succeeded",
        execution: { path: "request", operation: input.operation, adapterId: "http.fetch.v1" },
        timestamps: {
          createdAt: "2026-11-24T10:00:00.000Z",
          startedAt: "2026-11-24T10:00:00.000Z",
          completedAt: "2026-11-24T10:00:00.000Z",
        },
        usage: { durationMs: 4, requestsAttempted: 1, responseBytes: 2, cost: null },
        events: [],
        errors: [],
        result: { status: "succeeded", data: { body: "mcp durable result" }, sources: [], warnings: [] },
      };
    },
  });
  const env = {
    EXPORTFLOW_AUTH_DB: fixture.db,
    MCP_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  try {
    const created = await callTool(worker, env, 1, "web_fetch", {
      url: "https://example.com/",
      idempotencyKey: "mcp-task-key-0001",
    });
    assert.equal(created.response.status, 200);
    const task = created.body.result.structuredContent;
    assert.equal(task.state, "succeeded");
    assert.ok(task.id);
    assert.equal(executeCalls, 1);

    const retry = await callTool(worker, env, 2, "web_fetch", {
      url: "https://example.com/",
      idempotencyKey: "mcp-task-key-0001",
    });
    assert.equal(retry.body.result.structuredContent.id, task.id);
    assert.equal(executeCalls, 1);

    const status = await callTool(worker, env, 3, "web_task_status", { taskId: task.id });
    assert.equal(status.response.status, 200);
    assert.equal(status.body.result.structuredContent.id, task.id);
    assert.equal(status.body.result.structuredContent.result.data.body, "mcp durable result");

    const quota = fixture.sqlite.prepare(
      "SELECT requests_used FROM tenant_request_usage WHERE tenant_id = 'tenant_alpha'",
    ).get();
    assert.equal(quota.requests_used, 1);

    const listing = await worker.fetch(new Request("https://mcp.exportflow.me/mcp", {
      method: "POST",
      headers: {
        authorization,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/list", params: {} }),
    }), env);
    const listed = await listing.json();
    assert.ok(listed.result.tools.some((tool) => tool.name === "web_task_status"));
  } finally {
    fixture.close();
  }
});
