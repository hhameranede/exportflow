import assert from "node:assert/strict";
import test from "node:test";
import { createTenantAdminHttpHandler } from "../src/core/tenant-admin-http.js";

const TABLES = [
  "plan_policies",
  "tenants",
  "api_keys",
  "tenant_request_usage",
  "tenant_admin_audit_log",
];
const REQUIRED_TRIGGERS = [
  "guard_tenant_request_usage_limit_insert",
  "guard_tenant_request_usage_limit_update",
  "prevent_mid_month_plan_quota_period_change",
  "prevent_mid_month_tenant_plan_period_change",
  "prevent_tenant_admin_audit_update",
  "prevent_tenant_admin_audit_delete",
];

function makeD1(tables = TABLES, triggers = REQUIRED_TRIGGERS) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            sql,
            params,
            async all() {
              return {
                results: [
                  ...tables.map((name) => ({ type: "table", name })),
                  ...triggers.map((name) => ({ type: "trigger", name })),
                ],
              };
            },
          };
        },
      };
    },
    async batch() { return []; },
  };
}

function jsonRequest(path, body = {}, method = "POST") {
  return new Request("https://exportflow.me" + path, {
    method,
    headers: {
      origin: "https://exportflow.me",
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.10",
    },
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body),
  });
}

function makeDurableLimiterNamespace({ fail = false } = {}) {
  const buckets = new Map();
  return {
    idFromName(name) { return { name }; },
    get(id) {
      return {
        async fetch(request) {
          if (fail) return new Response("unavailable", { status: 503 });
          const config = await request.json();
          const now = Date.now();
          let bucket = buckets.get(id.name);
          if (!bucket || bucket.resetAtMs <= now) {
            bucket = { requests: 0, resetAtMs: now + config.windowMs };
            buckets.set(id.name, bucket);
          }
          if (bucket.requests >= config.limit) {
            return Response.json({
              allowed: false, remaining: 0, resetAtMs: bucket.resetAtMs,
              retryAfterSec: Math.max(1, Math.ceil((bucket.resetAtMs - now) / 1000)),
            });
          }
          bucket.requests += 1;
          return Response.json({
            allowed: true, remaining: config.limit - bucket.requests, resetAtMs: bucket.resetAtMs,
          });
        },
      };
    },
  };
}

function setup({ owner = { allowed: true, actorId: "owner_123" }, tables = TABLES, triggers = REQUIRED_TRIGGERS } = {}) {
  const calls = { authorization: [], service: [], actions: [] };
  const handler = createTenantAdminHttpHandler({
    authorizeOwner: async (request, env) => {
      calls.authorization.push({ request, env });
      return owner;
    },
    serviceFactory: (options) => {
      calls.service.push(options);
      return Object.fromEntries([
        ["createPlanPolicy", async (input) => { calls.actions.push(["createPlanPolicy", input, await options.authorizeAdmin({ action: "plans:write" })]); return { planCode: input.planCode }; }],
        ["provisionTenant", async (input) => { calls.actions.push(["provisionTenant", input, await options.authorizeAdmin({ action: "tenants:create" })]); return { tenantId: input.tenantId || "tenant_created", planCode: input.planCode }; }],
        ["setTenantStatus", async (input) => { calls.actions.push(["setTenantStatus", input, await options.authorizeAdmin({ action: "tenants:status" })]); return { tenantId: input.tenantId, status: input.status }; }],
        ["assignTenantPlan", async (input) => { calls.actions.push(["assignTenantPlan", input, await options.authorizeAdmin({ action: "tenants:plan" })]); return { tenantId: input.tenantId, planCode: input.planCode }; }],
        ["issueApiKey", async (input) => { calls.actions.push(["issueApiKey", input, await options.authorizeAdmin({ action: "api_keys:issue" })]); return { tenantId: input.tenantId, keyId: "0123456789abcdef", token: "one-time-test-token", revealOnce: true }; }],
        ["revokeApiKey", async (input) => { calls.actions.push(["revokeApiKey", input, await options.authorizeAdmin({ action: "api_keys:revoke" })]); return { keyId: input.keyId, status: "revoked" }; }],
        ["rotateApiKey", async (input) => { calls.actions.push(["rotateApiKey", input, await options.authorizeAdmin({ action: "api_keys:rotate" })]); return { keyId: "fedcba9876543210", revealOnce: true }; }],
      ]);
    },
  });
  return { handler, calls, env: { EXPORTFLOW_AUTH_DB: makeD1(tables, triggers), TENANT_BURST_LIMITER: makeDurableLimiterNamespace() } };
}

test("tenant admin handler ignores paths outside its namespace", async () => {
  const { handler, calls, env } = setup();
  assert.equal(await handler(jsonRequest("/api/v1/tasks", { goal: "x" }), env), null);
  assert.equal(calls.authorization.length, 0);
});

test("unknown admin paths are not routed to tenant service", async () => {
  const { handler, calls, env } = setup();
  const response = await handler(jsonRequest("/api/v1/admin/unknown"), env);
  assert.equal(response.status, 404);
  assert.equal(calls.authorization.length, 0);
  assert.equal(calls.service.length, 0);
});

test("admin routes accept only POST", async () => {
  const { handler, calls, env } = setup();
  const response = await handler(jsonRequest("/api/v1/admin/tenants", {}, "GET"), env);
  assert.equal(response.status, 405);
  assert.equal(calls.authorization.length, 0);
});

test("an unverified owner identity is rejected before D1 access", async () => {
  const { handler, calls, env } = setup({ owner: { allowed: false } });
  const response = await handler(jsonRequest("/api/v1/admin/tenants", { planCode: "free" }), env);
  assert.equal(response.status, 403);
  assert.equal(calls.service.length, 0);
  assert.equal(calls.actions.length, 0);
});

test("admin storage binding and migration readiness fail closed", async () => {
  const { handler } = setup();
  const noLimiterBinding = await handler(jsonRequest("/api/v1/admin/tenants", { planCode: "free" }), {
    EXPORTFLOW_AUTH_DB: makeD1(),
  });
  assert.equal(noLimiterBinding.status, 503);
  assert.equal((await noLimiterBinding.json()).error.code, "ADMIN_RATE_LIMIT_UNAVAILABLE");

  const noBinding = await handler(jsonRequest("/api/v1/admin/tenants", { planCode: "free" }), {
    TENANT_BURST_LIMITER: makeDurableLimiterNamespace(),
  });
  assert.equal(noBinding.status, 503);
  assert.equal((await noBinding.json()).error.code, "ADMIN_STORAGE_NOT_CONFIGURED");

  const missingAuditTable = await handler(
    jsonRequest("/api/v1/admin/tenants", { planCode: "free" }),
    { EXPORTFLOW_AUTH_DB: makeD1(TABLES.filter((name) => name !== "tenant_admin_audit_log")), TENANT_BURST_LIMITER: makeDurableLimiterNamespace() },
  );
  assert.equal(missingAuditTable.status, 503);
  assert.equal((await missingAuditTable.json()).error.code, "ADMIN_SCHEMA_NOT_READY");

  const missingDeleteGuard = await handler(
    jsonRequest("/api/v1/admin/tenants", { planCode: "free" }),
    { EXPORTFLOW_AUTH_DB: makeD1(TABLES, REQUIRED_TRIGGERS.filter((name) => name !== "prevent_tenant_admin_audit_delete")), TENANT_BURST_LIMITER: makeDurableLimiterNamespace() },
  );
  assert.equal(missingDeleteGuard.status, 503);
  assert.equal((await missingDeleteGuard.json()).error.code, "ADMIN_SCHEMA_NOT_READY");

  const missingUpdateGuard = await handler(
    jsonRequest("/api/v1/admin/tenants", { planCode: "free" }),
    { EXPORTFLOW_AUTH_DB: makeD1(TABLES, REQUIRED_TRIGGERS.filter((name) => name !== "prevent_tenant_admin_audit_update")), TENANT_BURST_LIMITER: makeDurableLimiterNamespace() },
  );
  assert.equal(missingUpdateGuard.status, 503);
  assert.equal((await missingUpdateGuard.json()).error.code, "ADMIN_SCHEMA_NOT_READY");

  for (const missingTrigger of [
    "guard_tenant_request_usage_limit_insert",
    "guard_tenant_request_usage_limit_update",
    "prevent_mid_month_plan_quota_period_change",
    "prevent_mid_month_tenant_plan_period_change",
  ]) {
    const missingProtection = await handler(
      jsonRequest("/api/v1/admin/tenants", { planCode: "free" }),
      { EXPORTFLOW_AUTH_DB: makeD1(TABLES, REQUIRED_TRIGGERS.filter((name) => name !== missingTrigger)), TENANT_BURST_LIMITER: makeDurableLimiterNamespace() },
    );
    assert.equal(missingProtection.status, 503, missingTrigger);
    assert.equal((await missingProtection.json()).error.code, "ADMIN_SCHEMA_NOT_READY", missingTrigger);
  }
});

test("plan policy and tenant provisioning routes pass strict validated bodies", async () => {
  const { handler, calls, env } = setup();
  const planResponse = await handler(jsonRequest("/api/v1/admin/plan-policies", {
    planCode: "developer",
    quotaPeriod: "monthly",
    requestLimit: 500,
    policyVersion: "v1",
  }), env);
  assert.equal(planResponse.status, 200);
  assert.deepEqual(calls.actions[0][0], "createPlanPolicy");
  assert.deepEqual(calls.actions[0][1], {
    planCode: "developer",
    quotaPeriod: "monthly",
    requestLimit: 500,
    policyVersion: "v1",
  });

  const tenantResponse = await handler(jsonRequest("/api/v1/admin/tenants", { planCode: "developer" }), env);
  assert.equal(tenantResponse.status, 201);
  assert.equal(calls.actions[1][0], "provisionTenant");
  assert.deepEqual(calls.actions[1][1], { planCode: "developer" });
});

test("tenant status and plan routes bind identifiers from the URL, not the body", async () => {
  const { handler, calls, env } = setup();
  const statusResponse = await handler(jsonRequest("/api/v1/admin/tenants/tenant_alpha/status", { status: "suspended" }), env);
  assert.equal(statusResponse.status, 200);
  assert.deepEqual(calls.actions[0][1], { tenantId: "tenant_alpha", status: "suspended" });

  const planResponse = await handler(jsonRequest("/api/v1/admin/tenants/tenant_alpha/plan", { planCode: "pro" }), env);
  assert.equal(planResponse.status, 200);
  assert.deepEqual(calls.actions[1][1], { tenantId: "tenant_alpha", planCode: "pro" });
});

test("API key issue, rotate and revoke routes bind tenant and key identifiers safely", async () => {
  const { handler, calls, env } = setup();
  const issue = await handler(jsonRequest("/api/v1/admin/tenants/tenant_alpha/api-keys", { scopes: ["tasks:fetch"] }), env);
  assert.equal(issue.status, 201);
  assert.equal((await issue.json()).data.revealOnce, true);
  assert.deepEqual(calls.actions[0][1], { tenantId: "tenant_alpha", scopes: ["tasks:fetch"], expiresAt: undefined });

  const rotate = await handler(jsonRequest("/api/v1/admin/tenants/tenant_alpha/api-keys/0123456789abcdef/rotate", { scopes: ["tasks:map"] }), env);
  assert.equal(rotate.status, 200);
  assert.deepEqual(calls.actions[1][1], { tenantId: "tenant_alpha", keyId: "0123456789abcdef", scopes: ["tasks:map"], expiresAt: undefined });

  const revoke = await handler(jsonRequest("/api/v1/admin/tenants/tenant_alpha/api-keys/0123456789abcdef/revoke", {}), env);
  assert.equal(revoke.status, 200);
  assert.deepEqual(calls.actions[2][1], { tenantId: "tenant_alpha", keyId: "0123456789abcdef" });
});

test("admin payloads reject unexpected fields and never reach the service", async () => {
  const { handler, calls, env } = setup();
  const response = await handler(jsonRequest("/api/v1/admin/tenants", {
    planCode: "free",
    status: "active",
    actorId: "attacker",
  }), env);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_ADMIN_INPUT");
  assert.equal(calls.service.length, 0);
});

test("each request gets a new service bound to that request's verified owner identity", async () => {
  let nextActor = "owner_A";
  const calls = [];
  const handler = createTenantAdminHttpHandler({
    authorizeOwner: async () => ({ allowed: true, actorId: nextActor }),
    serviceFactory: (options) => {
      calls.push(options);
      return { async provisionTenant(input) {
        return await options.authorizeAdmin({ action: "tenants:create" }).then((identity) => ({ tenantId: input.tenantId || "created", actorId: identity.actorId }));
      } };
    },
  });
  const env = { EXPORTFLOW_AUTH_DB: makeD1(), TENANT_BURST_LIMITER: makeDurableLimiterNamespace() };
  const first = await handler(jsonRequest("/api/v1/admin/tenants", { planCode: "free" }), env);
  nextActor = "owner_B";
  const second = await handler(jsonRequest("/api/v1/admin/tenants", { planCode: "free" }), env);
  assert.equal((await first.json()).data.actorId, "owner_A");
  assert.equal((await second.json()).data.actorId, "owner_B");
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0], calls[1]);
});

test("responses are private and never cache one-time API keys", async () => {
  const { handler, env } = setup();
  const response = await handler(jsonRequest("/api/v1/admin/tenants/tenant_alpha/api-keys", { scopes: ["tasks:fetch"] }), env);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("strict-transport-security"), "max-age=63072000");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("admin body size and content type are enforced before service execution", async () => {
  const { handler, calls, env } = setup();
  const oversized = JSON.stringify({ planCode: "free", note: "x".repeat(17_000) });
  const largeRequest = new Request("https://exportflow.me/api/v1/admin/tenants", {
    method: "POST",
    headers: { origin: "https://exportflow.me", "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
    body: oversized,
  });
  const tooLarge = await handler(largeRequest, env);
  assert.equal(tooLarge.status, 413);
  assert.equal((await tooLarge.json()).error.code, "PAYLOAD_TOO_LARGE");

  const wrongType = await handler(new Request("https://exportflow.me/api/v1/admin/tenants", {
    method: "POST",
    headers: { origin: "https://exportflow.me", "content-type": "text/plain", "cf-connecting-ip": "203.0.113.10" },
    body: "{}",
  }), env);
  assert.equal(wrongType.status, 415);
  assert.equal((await wrongType.json()).error.code, "UNSUPPORTED_MEDIA_TYPE");
  assert.equal(calls.service.length, 0);
});


test("admin pre-auth rate limit rejects excess requests before loading the owner session", async () => {
  let authorizationCalls = 0;
  const handler = createTenantAdminHttpHandler({
    authorizeOwner: async () => {
      authorizationCalls += 1;
      return { allowed: false };
    },
    adminRateLimiter: {
      check: () => ({ allowed: false, retryAfterSec: 17 }),
    },
  });
  const response = await handler(jsonRequest("/api/v1/admin/tenants", { planCode: "free" }), {});
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "17");
  assert.equal((await response.json()).error.code, "ADMIN_RATE_LIMITED");
  assert.equal(authorizationCalls, 0);
});

test("default admin burst limiter is shared across handler instances for the same Cloudflare IP", async () => {
  let authorizationCalls = 0;
  const sharedNamespace = makeDurableLimiterNamespace();
  const createHandler = () => createTenantAdminHttpHandler({
    authorizeOwner: async () => {
      authorizationCalls += 1;
      return { allowed: false };
    },
  });
  const firstHandler = createHandler();
  const secondHandler = createHandler();
  const env = { TENANT_BURST_LIMITER: sharedNamespace };
  const makeRequest = (ip) => new Request("https://exportflow.me/api/v1/admin/tenants", {
    method: "POST",
    headers: {
      origin: "https://exportflow.me",
      "content-type": "application/json",
      "cf-connecting-ip": ip,
    },
    body: JSON.stringify({ planCode: "free" }),
  });

  for (let index = 0; index < 10; index += 1) {
    const handler = index % 2 === 0 ? firstHandler : secondHandler;
    const response = await handler(makeRequest("203.0.113.10"), env);
    assert.equal(response.status, 403);
  }
  const limited = await secondHandler(makeRequest("203.0.113.10"), env);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) >= 1);
  assert.equal(authorizationCalls, 10);

  const otherIp = await firstHandler(makeRequest("203.0.113.11"), env);
  assert.equal(otherIp.status, 403);
  assert.equal(authorizationCalls, 11);
});

test("admin rate limit fails closed when the Cloudflare IP or Durable Object binding is unavailable", async () => {
  let authorizationCalls = 0;
  const handler = createTenantAdminHttpHandler({
    authorizeOwner: async () => {
      authorizationCalls += 1;
      return { allowed: false };
    },
  });
  const missingIp = new Request("https://exportflow.me/api/v1/admin/tenants", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.20" },
    body: JSON.stringify({ planCode: "free" }),
  });
  const noIpResponse = await handler(missingIp, { TENANT_BURST_LIMITER: makeDurableLimiterNamespace() });
  assert.equal(noIpResponse.status, 503);
  assert.equal((await noIpResponse.json()).error.code, "ADMIN_RATE_LIMIT_UNAVAILABLE");

  const noBindingResponse = await handler(jsonRequest("/api/v1/admin/tenants", { planCode: "free" }), {});
  assert.equal(noBindingResponse.status, 503);
  assert.equal((await noBindingResponse.json()).error.code, "ADMIN_RATE_LIMIT_UNAVAILABLE");
  assert.equal(authorizationCalls, 0);
});

test("admin rate limit fails closed when the Durable Object backend returns an error", async () => {
  const handler = createTenantAdminHttpHandler({
    authorizeOwner: async () => ({ allowed: false }),
  });
  const response = await handler(jsonRequest("/api/v1/admin/tenants", { planCode: "free" }), {
    TENANT_BURST_LIMITER: makeDurableLimiterNamespace({ fail: true }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "ADMIN_RATE_LIMIT_UNAVAILABLE");
});
