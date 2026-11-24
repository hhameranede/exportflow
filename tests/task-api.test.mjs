import assert from "node:assert/strict";
import test from "node:test";
import { createWorker } from "../src/index.js";
import { createDurableTaskD1 } from "./helpers/durable-task-d1.js";

const identityA = Object.freeze({
  tenantId: "tenant_alpha",
  planCode: "developer",
  policyVersion: "test-v1",
  quotaPeriod: "daily",
  requestLimit: 10,
  scopes: ["tasks:fetch", "tasks:read"],
});
const identityB = Object.freeze({ ...identityA, tenantId: "tenant_beta" });

function makeGateway() {
  const authorizeScope = (identity, scope) => identity.scopes.includes(scope)
    ? { ok: true, identity }
    : { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "scope denied" };
  return {
    async authenticate(request, _env, { requiredScope } = {}) {
      const identity = request.headers.get("authorization") === "Bearer beta" ? identityB : identityA;
      if (requiredScope && !identity.scopes.includes(requiredScope)) {
        return { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "scope denied" };
      }
      return { ok: true, identity };
    },
    authorizeScope,
  };
}

function postTask(idempotencyKey, url = "https://example.com/") {
  return new Request("https://exportflow.me/api/v1/tasks", {
    method: "POST",
    headers: {
      authorization: "Bearer alpha",
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({ goal: "Fetch a public test page", operation: "fetch", url }),
  });
}

test("REST task execution is persisted and an idempotent retry returns the original task", async () => {
  const fixture = createDurableTaskD1({ tenantIds: ["tenant_alpha", "tenant_beta"] });
  let fetchCalls = 0;
  const worker = createWorker({
    tenantTaskGateway: makeGateway(),
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response("ExportFlow durable task test", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    },
  });
  try {
    const firstResponse = await worker.fetch(postTask("rest-task-key-0001"), {
      EXPORTFLOW_AUTH_DB: fixture.db,
    });
    const first = await firstResponse.json();
    assert.equal(firstResponse.status, 200);
    assert.equal(first.state, "succeeded");
    assert.ok(first.id);
    assert.equal(fetchCalls, 1);

    const retryResponse = await worker.fetch(postTask("rest-task-key-0001"), {
      EXPORTFLOW_AUTH_DB: fixture.db,
    });
    const retry = await retryResponse.json();
    assert.equal(retryResponse.status, 200);
    assert.equal(retryResponse.headers.get("idempotency-replayed"), "true");
    assert.equal(retry.id, first.id);
    assert.equal(fetchCalls, 1);

    const statusResponse = await worker.fetch(new Request(
      "https://exportflow.me/api/v1/tasks/" + first.id,
      { headers: { authorization: "Bearer alpha" } },
    ), { EXPORTFLOW_AUTH_DB: fixture.db });
    const status = await statusResponse.json();
    assert.equal(statusResponse.status, 200);
    assert.equal(status.id, first.id);
    assert.equal(status.state, "succeeded");
    assert.match(status.result.data.body, /durable task test/);

    const otherTenantResponse = await worker.fetch(new Request(
      "https://exportflow.me/api/v1/tasks/" + first.id,
      { headers: { authorization: "Bearer beta" } },
    ), { EXPORTFLOW_AUTH_DB: fixture.db });
    assert.equal(otherTenantResponse.status, 404);

    const quota = fixture.sqlite.prepare(
      "SELECT requests_used FROM tenant_request_usage WHERE tenant_id = 'tenant_alpha'",
    ).get();
    assert.equal(quota.requests_used, 1);
  } finally {
    fixture.close();
  }
});

test("REST rejects an idempotency key reused for another request", async () => {
  const fixture = createDurableTaskD1();
  let fetchCalls = 0;
  const worker = createWorker({
    tenantTaskGateway: makeGateway(),
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    },
  });
  try {
    const first = await worker.fetch(postTask("rest-task-key-0002"), { EXPORTFLOW_AUTH_DB: fixture.db });
    assert.equal(first.status, 200);
    const conflict = await worker.fetch(postTask("rest-task-key-0002", "https://www.iana.org/"), { EXPORTFLOW_AUTH_DB: fixture.db });
    const body = await conflict.json();
    assert.equal(conflict.status, 409);
    assert.equal(body.error.code, "IDEMPOTENCY_KEY_REUSED");
    assert.equal(fetchCalls, 1);
  } finally {
    fixture.close();
  }
});
