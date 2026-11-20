
import assert from "node:assert/strict";
import test from "node:test";
import { createTenantAdminService } from "../src/core/tenant-admin.js";

function makeD1({ changes = [1, 1, 1, 1], changesByBatch = null, fail = false } = {}) {
  const calls = [];
  let batchIndex = 0;
  return {
    calls,
    prepare(sql) {
      let values = [];
      return {
        sql,
        bind(...params) {
          values = params;
          return { sql, params: values };
        },
      };
    },
    async batch(statements) {
      calls.push(statements.map((statement) => ({ sql: statement.sql, params: statement.params })));
      if (fail) throw new Error("synthetic storage failure");
      const selectedChanges = changesByBatch?.[batchIndex++] || changes;
      return statements.map((_statement, index) => ({ meta: { changes: selectedChanges[index] ?? 1 } }));
    },
  };
}

function makeService(options = {}) {
  const db = options.db || makeD1();
  const authorizations = [];
  const service = createTenantAdminService({
    db,
    now: () => "2026-11-20T12:00:00.000Z",
    authorizeAdmin: options.authorizeAdmin || (async (request) => {
      authorizations.push(request);
      return { allowed: true, actorId: "operator_123" };
    }),
  });
  return { service, db, authorizations };
}

test("tenant admin service cannot be constructed without D1 and a trusted authorizer", () => {
  assert.throws(() => createTenantAdminService({}), /Cloudflare D1 binding/);
  assert.throws(() => createTenantAdminService({ db: makeD1() }), /authorizeAdmin/);
});

test("every operation fails closed when the trusted admin authorizer denies access", async () => {
  const db = makeD1();
  const service = createTenantAdminService({
    db,
    authorizeAdmin: async () => ({ allowed: false }),
    now: () => "2026-11-20T12:00:00.000Z",
  });
  await assert.rejects(
    () => service.createPlanPolicy({ planCode: "free", quotaPeriod: "daily", requestLimit: 100, policyVersion: "v1" }),
    { code: "ADMIN_FORBIDDEN", httpStatus: 403 },
  );
  assert.equal(db.calls.length, 0);
});

test("plan policy writes and audit records are committed in one D1 batch", async () => {
  const { service, db, authorizations } = makeService();
  const result = await service.createPlanPolicy({
    planCode: "developer",
    quotaPeriod: "monthly",
    requestLimit: 2500,
    policyVersion: "2026-11-v1",
  });
  assert.deepEqual(result, {
    planCode: "developer",
    quotaPeriod: "monthly",
    requestLimit: 2500,
    policyVersion: "2026-11-v1",
    status: "active",
    updatedAt: "2026-11-20T12:00:00.000Z",
  });
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].length, 2);
  assert.match(db.calls[0][0].sql, /INSERT INTO plan_policies/);
  assert.match(db.calls[0][1].sql, /INSERT INTO tenant_admin_audit_log/);
  assert.deepEqual(authorizations[0], { action: "plans:write", resourceType: "plan", resourceId: "developer" });
});

test("tenant provisioning requires an active plan and records the operator atomically", async () => {
  const { service, db } = makeService();
  const result = await service.provisionTenant({ planCode: "free" });
  assert.match(result.tenantId, /^tenant_[0-9a-f]{32}$/);
  assert.equal(result.planCode, "free");
  assert.equal(result.status, "active");
  assert.match(db.calls[0][0].sql, /WHERE EXISTS[\s\S]*status = 'active'/);
  assert.match(db.calls[0][1].sql, /WHERE changes\(\) = 1/);
  assert.equal(db.calls[0][1].params[1], "operator_123");
});

test("API key issuance stores only the digest and audits metadata without the secret", async () => {
  const { service, db } = makeService();
  const result = await service.issueApiKey({
    tenantId: "tenant_alpha",
    scopes: ["tasks:fetch", "tasks:map"],
  });
  assert.match(result.token, /^ef_live_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}$/);
  assert.equal(result.revealOnce, true);
  assert.deepEqual(result.scopes, ["tasks:fetch", "tasks:map"]);
  const insert = db.calls[0][0];
  const audit = db.calls[0][1];
  assert.match(insert.sql, /INSERT INTO api_keys/);
  assert.equal(insert.params[2].length, 64);
  assert.notEqual(insert.params[2], result.token);
  assert.equal(audit.params[1], "operator_123");
  assert.equal(JSON.stringify(audit.params).includes(result.token), false);
  assert.equal(JSON.stringify(audit.params).includes(insert.params[2]), false);
});

test("API key issue rejects unknown and duplicate scopes before any D1 write", async () => {
  const { service, db } = makeService();
  await assert.rejects(
    () => service.issueApiKey({ tenantId: "tenant_alpha", scopes: ["tasks:fetch", "admin:*"] }),
    { code: "INVALID_API_KEY_SCOPES" },
  );
  await assert.rejects(
    () => service.issueApiKey({ tenantId: "tenant_alpha", scopes: ["tasks:fetch", "tasks:fetch"] }),
    { code: "INVALID_API_KEY_SCOPES" },
  );
  assert.equal(db.calls.length, 0);
});

test("revocation is scoped to the tenant and active key and writes an audit event", async () => {
  const { service, db } = makeService();
  const result = await service.revokeApiKey({ tenantId: "tenant_alpha", keyId: "0123456789abcdef" });
  assert.equal(result.status, "revoked");
  assert.match(db.calls[0][0].sql, /key_id = \?2 AND tenant_id = \?3 AND status = 'active'/);
  assert.match(db.calls[0][1].sql, /WHERE changes\(\) = 1/);
  assert.equal(db.calls[0][1].params[1], "operator_123");
});

test("revocation reports a missing or already revoked key without adding an audit event", async () => {
  const db = makeD1({ changes: [0, 0] });
  const { service } = makeService({ db });
  await assert.rejects(
    () => service.revokeApiKey({ tenantId: "tenant_alpha", keyId: "0123456789abcdef" }),
    { code: "ACTIVE_API_KEY_NOT_FOUND", httpStatus: 404 },
  );
  assert.equal(db.calls[0][1].params[2], "0123456789abcdef");
});

test("tenant suspension and plan reassignment are privileged and auditable", async () => {
  const { service, db, authorizations } = makeService();
  const suspended = await service.setTenantStatus({ tenantId: "tenant_alpha", status: "suspended" });
  const reassigned = await service.assignTenantPlan({ tenantId: "tenant_alpha", planCode: "pro" });
  assert.equal(suspended.status, "suspended");
  assert.equal(reassigned.planCode, "pro");
  assert.deepEqual(authorizations.map((item) => item.action), ["tenants:status", "tenants:plan"]);
  assert.equal(db.calls.length, 2);
  assert.equal(db.calls[0].length, 2);
  assert.equal(db.calls[1].length, 2);
});

test("closed tenants cannot be reactivated or have plans reassigned", async () => {
  const { service, db } = makeService({ db: makeD1({ changes: [0, 0] }) });
  await assert.rejects(
    () => service.setTenantStatus({ tenantId: "tenant_alpha", status: "active" }),
    { code: "TENANT_NOT_UPDATABLE" },
  );
  await assert.rejects(
    () => service.assignTenantPlan({ tenantId: "tenant_alpha", planCode: "pro" }),
    { code: "TENANT_OR_ACTIVE_PLAN_NOT_FOUND" },
  );
  assert.equal(db.calls.length, 2);
});

test("rotation revokes the old active key and inserts a replacement in one D1 batch", async () => {
  const { service, db } = makeService();
  const oldKeyId = "0123456789abcdef";
  const rotated = await service.rotateApiKey({ tenantId: "tenant_alpha", keyId: oldKeyId, scopes: ["tasks:fetch"] });
  assert.notEqual(rotated.keyId, oldKeyId);
  assert.match(rotated.token, /^ef_live_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}$/);
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].length, 4);
  assert.match(db.calls[0][0].sql, /UPDATE api_keys/);
  assert.match(db.calls[0][2].sql, /INSERT INTO api_keys/);
  assert.match(db.calls[0][2].sql, /status = 'active'/);
  assert.equal(JSON.stringify(db.calls[0]).includes(rotated.token), false);
});

test("invalid or expired API key expiry values are rejected", async () => {
  const { service, db } = makeService();
  await assert.rejects(
    () => service.issueApiKey({ tenantId: "tenant_alpha", scopes: ["tasks:fetch"], expiresAt: "not-a-date" }),
    { code: "INVALID_API_KEY_EXPIRY" },
  );
  await assert.rejects(
    () => service.issueApiKey({ tenantId: "tenant_alpha", scopes: ["tasks:fetch"], expiresAt: "2026-11-20T11:59:00.000Z" }),
    { code: "INVALID_API_KEY_EXPIRY" },
  );
  assert.equal(db.calls.length, 0);
});

test("D1 batch failure returns a sanitized service error", async () => {
  const { service } = makeService({ db: makeD1({ fail: true }) });
  await assert.rejects(
    () => service.provisionTenant({ planCode: "free" }),
    { code: "TENANT_ADMIN_STORAGE_UNAVAILABLE", httpStatus: 503 },
  );
});

test("tenant status updates are repeatable but a closed tenant remains terminal", async () => {
  const db = makeD1({ changesByBatch: [[1, 1], [1, 1], [1, 1], [0, 0]] });
  const { service } = makeService({ db });
  const first = await service.setTenantStatus({ tenantId: "tenant_alpha", status: "suspended" });
  const repeated = await service.setTenantStatus({ tenantId: "tenant_alpha", status: "suspended" });
  const closed = await service.setTenantStatus({ tenantId: "tenant_alpha", status: "closed" });
  assert.equal(first.status, "suspended");
  assert.equal(repeated.status, "suspended");
  assert.equal(closed.status, "closed");
  assert.ok(db.calls[0][0].sql.includes("status <> 'closed' OR ?1 = 'closed'"));
  await assert.rejects(
    () => service.setTenantStatus({ tenantId: "tenant_alpha", status: "active" }),
    { code: "TENANT_NOT_UPDATABLE" },
  );
  assert.equal(db.calls.length, 4);
});

test("administrative methods reject null or array inputs with a controlled error", async () => {
  const { service, db } = makeService();
  await assert.rejects(
    () => service.provisionTenant(null),
    { code: "INVALID_ADMIN_INPUT" },
  );
  await assert.rejects(
    () => service.createPlanPolicy([]),
    { code: "INVALID_ADMIN_INPUT" },
  );
  assert.equal(db.calls.length, 0);
});

test("authorizer infrastructure failures fail closed without writing to D1", async () => {
  const db = makeD1();
  const service = createTenantAdminService({
    db,
    authorizeAdmin: async () => { throw new Error("synthetic identity provider failure"); },
    now: () => "2026-11-20T12:00:00.000Z",
  });
  await assert.rejects(
    () => service.revokeApiKey({ tenantId: "tenant_alpha", keyId: "0123456789abcdef" }),
    { code: "ADMIN_FORBIDDEN", httpStatus: 403 },
  );
  assert.equal(db.calls.length, 0);
});
