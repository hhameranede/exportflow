import assert from "node:assert/strict";
import test from "node:test";
import { createTenantTaskGateway } from "../src/core/tenant-task-gateway.js";
import { createDurableTenantBurstTestNamespace } from "./helpers/durable-tenant-burst-test-namespace.js";

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

test("shared gateway authenticates before parsing then checks operation scope without a second burst count", async () => {
  let requestedScope;
  let burstChecks = 0;
  const gateway = createTenantTaskGateway({
    authenticateApiKey: async (_request, _env, options) => {
      requestedScope = options.requiredScope;
      return { ok: true, ...identity };
    },
    preAuthRateLimiter: { check: () => ({ allowed: true }) },
    tenantRateLimiter: { check: (tenantId) => {
      burstChecks += 1;
      return { allowed: tenantId === "tenant_alpha" };
    } },
  });
  const authenticated = await gateway.authenticate(makeRequest({ authorization: "Bearer valid" }), {}, { requiredScope: null });
  assert.equal(authenticated.ok, true);
  assert.equal(requestedScope, null);
  assert.equal(burstChecks, 1);
  assert.equal(gateway.authorizeScope(authenticated.identity, "tasks:crawl").ok, true);
  const denied = gateway.authorizeScope(authenticated.identity, "tasks:search");
  assert.equal(denied.ok, false);
  assert.equal(denied.httpStatus, 403);
  assert.equal(denied.code, "INSUFFICIENT_SCOPE");
  assert.equal(burstChecks, 1);
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


test("separate REST and MCP gateway instances share one Durable Object tenant burst counter", async () => {
  const namespace = createDurableTenantBurstTestNamespace();
  const allowIp = { check: () => ({ allowed: true }) };
  const authenticateApiKey = async () => ({ ok: true, ...identity });
  const makeGateway = () => createTenantTaskGateway({
    preAuthRateLimiter: allowIp,
    authenticateApiKey,
    tenantBurstLimit: 1,
    tenantBurstWindowMs: 60_000,
  });
  const restGateway = makeGateway();
  const mcpGateway = makeGateway();
  const env = { TENANT_BURST_LIMITER: namespace };
  const request = makeRequest({ authorization: "Bearer synthetic-shared-tenant-key" });
  const restDecision = await restGateway.authenticate(request, env, { requiredScope: "tasks:fetch" });
  const mcpDecision = await mcpGateway.authenticate(request, env, { requiredScope: "tasks:fetch" });
  assert.equal(restDecision.ok, true);
  assert.equal(mcpDecision.ok, false);
  assert.equal(mcpDecision.code, "RATE_LIMITED");
  assert.equal(mcpDecision.httpStatus, 429);
});

test("the shared gateway fails closed when the Durable Object binding is missing or unavailable", async () => {
  const gateway = createTenantTaskGateway({
    preAuthRateLimiter: { check: () => ({ allowed: true }) },
    authenticateApiKey: async () => ({ ok: true, ...identity }),
  });
  const result = await gateway.authenticate(makeRequest({ authorization: "Bearer synthetic" }), {});
  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 503);
  assert.equal(result.code, "TENANT_RATE_LIMITER_UNAVAILABLE");
});


test("OAuth-resolved identities use the same shared Durable Object tenant burst counter", async () => {
  const namespace = createDurableTenantBurstTestNamespace();
  const gateway = createTenantTaskGateway({
    preAuthRateLimiter: { check: () => ({ allowed: true }) },
    tenantBurstLimit: 1,
    tenantBurstWindowMs: 60_000,
  });
  const identity = {
    tenantId: "tenant_oauth_shared",
    planCode: "developer",
    policyVersion: "v1",
    quotaPeriod: "daily",
    requestLimit: 50,
    scopes: ["tasks:fetch"],
    userId: "oauth-user-1",
    authMethod: "oauth2",
  };
  const env = { TENANT_BURST_LIMITER: namespace };
  const request = makeRequest({ authorization: "Bearer OAuth-access-token" });
  const first = await gateway.authorizeIdentity(request, identity, { requiredScope: "tasks:fetch" }, env);
  const second = await gateway.authorizeIdentity(request, identity, { requiredScope: "tasks:fetch" }, env);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.code, "RATE_LIMITED");
  assert.equal(second.httpStatus, 429);
});
