import assert from "node:assert/strict";
import test from "node:test";
import { createTenantTaskGateway } from "../src/core/tenant-task-gateway.js";

const identity = {
  keyId: "0123456789abcdef",
  tenantId: "tenant_alpha",
  planCode: "developer",
  policyVersion: "v3",
  quotaPeriod: "daily",
  requestLimit: 100,
  scopes: ["tasks:fetch", "tasks:crawl"],
};

function makeRequest(headers = {}) {
  return new Request("https://exportflow.local/api/v1/tasks", { headers });
}

test("shared gateway checks the Cloudflare client IP before API-key verification", async () => {
  let authCalls = 0;
  let seenIp = null;
  const gateway = createTenantTaskGateway({
    preAuthRateLimiter: {
      check(key) {
        seenIp = key;
        return { allowed: false, retryAfterSec: 8 };
      },
    },
    authenticateApiKey: async () => {
      authCalls++;
      return { ok: true, ...identity };
    },
  });
  const result = await gateway.authenticate(makeRequest({
    authorization: "Bearer synthetic",
    "cf-connecting-ip": "203.0.113.9",
    "x-forwarded-for": "198.51.100.22",
  }), { EXPORTFLOW_AUTH_DB: { prepare() {} } }, { requiredScope: "tasks:crawl" });

  assert.equal(result.ok, false);
  assert.equal(result.code, "RATE_LIMITED");
  assert.equal(result.retryAfterSec, 8);
  assert.equal(seenIp, "ip:203.0.113.9");
  assert.equal(authCalls, 0);
});

test("shared gateway passes operation scope and only trusts database-derived tenant identity", async () => {
  let requestedScope = null;
  const gateway = createTenantTaskGateway({
    authenticateApiKey: async (_request, env, options) => {
      requestedScope = options.requiredScope;
      assert.equal(env.EXPORTFLOW_AUTH_DB.marker, "tenant-db");
      return { ok: true, ...identity };
    },
    preAuthRateLimiter: { check: () => ({ allowed: true }) },
    tenantRateLimiter: { check: (tenantId) => ({ allowed: tenantId === "tenant_alpha" }) },
  });
  const result = await gateway.authenticate(makeRequest({ authorization: "Bearer ef_live_key" }), {
    EXPORTFLOW_AUTH_DB: { marker: "tenant-db" },
  }, { requiredScope: "tasks:crawl" });

  assert.equal(result.ok, true);
  assert.equal(requestedScope, "tasks:crawl");
  assert.equal(result.identity.tenantId, "tenant_alpha");
  assert.equal(result.identity.planCode, "developer");
});

test("tenant burst limiter blocks after authentication and before quota reservation", async () => {
  const gateway = createTenantTaskGateway({
    authenticateApiKey: async () => ({ ok: true, ...identity }),
    preAuthRateLimiter: { check: () => ({ allowed: true }) },
    tenantRateLimiter: { check: () => ({ allowed: false, retryAfterSec: 13 }) },
  });
  const result = await gateway.authenticate(makeRequest({ authorization: "Bearer valid" }), {});
  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 429);
  assert.equal(result.retryAfterSec, 13);
});

test("quota reservation returns the persistent policy snapshot", async () => {
  let observed = null;
  const gateway = createTenantTaskGateway({
    now: () => "2026-11-20T12:00:00.000Z",
    reserveRequest: async (args) => {
      observed = args;
      return { allowed: true, limit: 100, used: 1, remaining: 99, resetAt: "2026-11-21T00:00:00.000Z", windowId: "2026-11-20" };
    },
  });
  const result = await gateway.reserve({ EXPORTFLOW_AUTH_DB: { prepare() {} } }, identity);
  assert.equal(result.ok, true);
  assert.equal(result.quota.remaining, 99);
  assert.equal(observed.identity, identity);
  assert.equal(observed.db.prepare instanceof Function, true);
  assert.equal(observed.now(), "2026-11-20T12:00:00.000Z");
});

test("exhausted quota fails closed and preserves retry metadata", async () => {
  const gateway = createTenantTaskGateway({
    reserveRequest: async () => ({ allowed: false, limit: 5, used: 5, remaining: 0, resetAt: "2026-11-21T00:00:00.000Z", windowId: "2026-11-20", retryAfterSec: 3600 }),
  });
  const result = await gateway.reserve({}, identity);
  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 429);
  assert.equal(result.code, "PLAN_QUOTA_EXCEEDED");
  assert.equal(result.retryAfterSec, 3600);
  assert.equal(result.quota.limit, 5);
});

test("quota backend failures fail closed", async () => {
  const gateway = createTenantTaskGateway({
    reserveRequest: async () => { throw new Error("synthetic database failure"); },
  });
  const result = await gateway.reserve({}, identity);
  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 503);
  assert.equal(result.code, "QUOTA_BACKEND_UNAVAILABLE");
});
