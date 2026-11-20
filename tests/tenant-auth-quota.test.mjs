import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateRequest,
  generateTenantApiKey,
  hashApiKey,
} from "../src/core/tenant-auth.js";
import { getQuotaWindow, reservePlanRequest } from "../src/core/plan-quota.js";

const KEY_ID = "0123456789abcdef";
const TOKEN = `ef_live_${KEY_ID}_${"C".repeat(43)}`;
const HASH = await hashApiKey(TOKEN);

function makeD1({
  keyId = KEY_ID,
  keyHash = HASH,
  keyStatus = "active",
  tenantStatus = "active",
  planStatus = "active",
  scopes = ["tasks:fetch"],
  expiresAt = null,
  requestLimit = 3,
  throwOnSql = null,
} = {}) {
  const usage = new Map();
  const record = {
    key_id: keyId,
    tenant_id: "tenant_alpha",
    key_status: keyStatus,
    tenant_status: tenantStatus,
    plan_status: planStatus,
    plan_code: "free",
    quota_period: "daily",
    request_limit: requestLimit,
    policy_version: "v1",
    scopes_json: JSON.stringify(scopes),
    expires_at: expiresAt,
  };
  return {
    usage,
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async first() {
          if (throwOnSql && sql.includes(throwOnSql)) throw new Error("synthetic D1 failure");
          if (sql.includes("FROM api_keys")) {
            const [requestedKeyId, requestedHash] = params;
            return requestedKeyId === keyId && requestedHash === keyHash ? { ...record } : null;
          }
          if (sql.includes("SELECT request_limit, requests_used")) {
            const [tenantId, windowId] = params;
            const row = usage.get(tenantId + ":" + windowId);
            return row ? { request_limit: row.request_limit, requests_used: row.requests_used } : null;
          }
          if (sql.includes("INSERT INTO tenant_request_usage")) {
            const [tenantId, windowId, planCode, policyVersion, limit, updatedAt] = params;
            const id = tenantId + ":" + windowId;
            const row = usage.get(id) || {
              tenant_id: tenantId,
              window_id: windowId,
              plan_code: planCode,
              policy_version: policyVersion,
              request_limit: limit,
              requests_used: 0,
            };
            if (row.requests_used >= row.request_limit) return null;
            row.requests_used += 1;
            row.updated_at = updatedAt;
            usage.set(id, row);
            return { requests_used: row.requests_used, request_limit: row.request_limit };
          }
          throw new Error("Unexpected SQL in test fixture.");
        },
      };
    },
  };
}

test("API key generation creates high-entropy, one-time token material and stores only a digest", async () => {
  const generated = await generateTenantApiKey();
  assert.match(generated.token, /^ef_live_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}$/);
  assert.equal(generated.keyId.length, 16);
  assert.equal(generated.keyHash.length, 64);
  assert.match(generated.keyHash, /^[a-f0-9]{64}$/);
  assert.equal(await hashApiKey(generated.token), generated.keyHash);
  assert.notEqual(generated.keyHash, generated.token);
});

test("tenant authentication derives tenant and plan from the D1 record", async () => {
  const db = makeD1();
  const request = new Request("https://api.exportflow.local/api/v1/tasks", {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  const result = await authenticateRequest(request, { EXPORTFLOW_AUTH_DB: db });
  assert.equal(result.ok, true);
  assert.equal(result.tenantId, "tenant_alpha");
  assert.equal(result.planCode, "free");
  assert.deepEqual(result.scopes, ["tasks:fetch"]);
});

test("tenant authentication rejects missing, malformed, wrong, revoked and expired keys", async () => {
  const db = makeD1();
  const missing = await authenticateRequest(new Request("https://api.exportflow.local/api/v1/tasks"), { EXPORTFLOW_AUTH_DB: db });
  assert.equal(missing.code, "UNAUTHORIZED");

  const malformed = await authenticateRequest(new Request("https://api.exportflow.local/api/v1/tasks", {
    headers: { authorization: "Bearer not-an-exportflow-key" },
  }), { EXPORTFLOW_AUTH_DB: db });
  assert.equal(malformed.code, "UNAUTHORIZED");

  const wrong = `ef_live_${KEY_ID}_${"D".repeat(43)}`;
  const invalid = await authenticateRequest(new Request("https://api.exportflow.local/api/v1/tasks", {
    headers: { authorization: `Bearer ${wrong}` },
  }), { EXPORTFLOW_AUTH_DB: db });
  assert.equal(invalid.code, "INVALID_TOKEN");

  const revoked = await authenticateRequest(new Request("https://api.exportflow.local/api/v1/tasks", {
    headers: { authorization: `Bearer ${TOKEN}` },
  }), { EXPORTFLOW_AUTH_DB: makeD1({ keyStatus: "revoked" }) });
  assert.equal(revoked.code, "INVALID_TOKEN");

  const expired = await authenticateRequest(new Request("https://api.exportflow.local/api/v1/tasks", {
    headers: { authorization: `Bearer ${TOKEN}` },
  }), { EXPORTFLOW_AUTH_DB: makeD1({ expiresAt: "2026-11-19T00:00:00.000Z" }) }, {
    now: () => "2026-11-20T00:00:00.000Z",
  });
  assert.equal(expired.code, "API_KEY_EXPIRED");
});

test("tenant authentication enforces tenant state and least-privilege scopes", async () => {
  const request = new Request("https://api.exportflow.local/api/v1/tasks", {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  const suspended = await authenticateRequest(request, { EXPORTFLOW_AUTH_DB: makeD1({ tenantStatus: "suspended" }) });
  assert.equal(suspended.code, "TENANT_INACTIVE");

  const noScope = await authenticateRequest(request, { EXPORTFLOW_AUTH_DB: makeD1({ scopes: ["tasks:read"] }) });
  assert.equal(noScope.code, "INSUFFICIENT_SCOPE");
});

test("missing or failing D1 auth binding fails closed", async () => {
  const request = new Request("https://api.exportflow.local/api/v1/tasks", {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  assert.equal((await authenticateRequest(request, {})).code, "AUTH_NOT_CONFIGURED");
  assert.equal((await authenticateRequest(request, { EXPORTFLOW_AUTH_DB: makeD1({ throwOnSql: "FROM api_keys" }) })).code,
    "AUTH_BACKEND_UNAVAILABLE");
});

test("daily and monthly quota windows are aligned to UTC", () => {
  assert.deepEqual(getQuotaWindow("2026-11-20T23:59:59.000Z", "daily"), {
    windowId: "2026-11-20",
    resetAt: "2026-11-21T00:00:00.000Z",
  });
  assert.deepEqual(getQuotaWindow("2026-11-30T23:59:59.000Z", "monthly"), {
    windowId: "2026-11",
    resetAt: "2026-12-01T00:00:00.000Z",
  });
});

test("D1 request quota enforces a persistent per-window hard limit", async () => {
  const db = makeD1({ requestLimit: 2 });
  const identity = {
    tenantId: "tenant_alpha",
    planCode: "free",
    policyVersion: "v1",
    quotaPeriod: "daily",
    requestLimit: 2,
  };
  const now = () => "2026-11-20T12:00:00.000Z";
  const first = await reservePlanRequest({ db, identity, now });
  const second = await reservePlanRequest({ db, identity, now });
  const third = await reservePlanRequest({ db, identity, now });
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
  assert.equal(third.retryAfterSec, 43_200);
});

test("concurrent D1 quota reservations never exceed the plan limit", async () => {
  const db = makeD1({ requestLimit: 4 });
  const identity = {
    tenantId: "tenant_alpha",
    planCode: "free",
    policyVersion: "v1",
    quotaPeriod: "daily",
    requestLimit: 4,
  };
  const results = await Promise.all(Array.from({ length: 20 }, () => reservePlanRequest({
    db,
    identity,
    now: () => "2026-11-20T12:00:00.000Z",
  })));
  assert.equal(results.filter((item) => item.allowed).length, 4);
  assert.equal(results.filter((item) => !item.allowed).length, 16);
  const row = [...db.usage.values()][0];
  assert.equal(row.requests_used, 4);
});

test("quota storage errors fail closed and do not grant a request", async () => {
  const db = makeD1({ throwOnSql: "INSERT INTO tenant_request_usage" });
  await assert.rejects(() => reservePlanRequest({
    db,
    identity: {
      tenantId: "tenant_alpha",
      planCode: "free",
      policyVersion: "v1",
      quotaPeriod: "daily",
      requestLimit: 2,
    },
    now: () => "2026-11-20T12:00:00.000Z",
  }), { code: "QUOTA_BACKEND_UNAVAILABLE" });
});

test("an in-window plan policy change does not retroactively alter the snapshotted quota", async () => {
  const db = makeD1({ requestLimit: 2 });
  const base = {
    tenantId: "tenant_alpha",
    planCode: "free",
    policyVersion: "v1",
    quotaPeriod: "daily",
    requestLimit: 2,
  };
  const now = () => "2026-11-20T12:00:00.000Z";
  await reservePlanRequest({ db, identity: base, now });
  await reservePlanRequest({ db, identity: base, now });
  const afterPolicyIncrease = await reservePlanRequest({
    db,
    identity: { ...base, requestLimit: 100, policyVersion: "v2" },
    now,
  });
  assert.equal(afterPolicyIncrease.allowed, false);
  assert.equal(afterPolicyIncrease.limit, 2);
  assert.equal(afterPolicyIncrease.used, 2);
});
