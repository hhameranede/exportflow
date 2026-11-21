import { authorizePlatformOwner } from "./auth-app.js";
import { readBoundedJsonBody, TaskContractError } from "./task-contract.js";
import { createTenantAdminService, TenantAdminError } from "./tenant-admin.js";
import { createRateLimiter } from "./auth.js";
import { getClientRateLimitKey } from "./client-rate-limit.js";

const ADMIN_PREFIX = "/api/v1/admin";
const MAX_ADMIN_BODY_BYTES = 16_384;
const ADMIN_RATE_LIMIT_WINDOW_MS = 60_000;
const ADMIN_RATE_LIMIT_MAX_REQUESTS = 10;
const REQUIRED_ADMIN_TABLES = Object.freeze([
  "plan_policies",
  "tenants",
  "api_keys",
  "tenant_request_usage",
  "tenant_admin_audit_log",
  "tenant_memberships",
]);
const REQUIRED_ADMIN_TRIGGERS = Object.freeze([
  "guard_tenant_request_usage_limit_insert",
  "guard_tenant_request_usage_limit_update",
  "prevent_mid_month_plan_quota_period_change",
  "prevent_mid_month_tenant_plan_period_change",
  "prevent_tenant_admin_audit_update",
  "prevent_tenant_admin_audit_delete",
  "guard_tenant_membership_last_owner",
  "prevent_tenant_membership_identity_update",
  "prevent_tenant_membership_delete",
]);
const REQUIRED_ADMIN_SCHEMA_OBJECTS = Object.freeze([
  ...REQUIRED_ADMIN_TABLES.map((name) => Object.freeze({ type: "table", name })),
  ...REQUIRED_ADMIN_TRIGGERS.map((name) => Object.freeze({ type: "trigger", name })),
]);

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "strict-transport-security": "max-age=63072000",
      ...extraHeaders,
    },
  });
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validatePayload(payload, allowed, required = []) {
  if (!plainObject(payload)) {
    throw new TaskContractError("INVALID_ADMIN_INPUT", "The request body must be a JSON object.");
  }
  const keys = Object.keys(payload);
  if (keys.some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(payload, key))) {
    throw new TaskContractError("INVALID_ADMIN_INPUT", "The request body contains unsupported or missing fields.");
  }
  return payload;
}

function routeFor(pathname) {
  if (pathname === ADMIN_PREFIX + "/plan-policies") {
    return { method: "createPlanPolicy", allowed: ["planCode", "quotaPeriod", "requestLimit", "policyVersion", "status"], required: ["planCode", "quotaPeriod", "requestLimit", "policyVersion"], status: 200 };
  }
  if (pathname === ADMIN_PREFIX + "/tenants") {
    return { method: "provisionTenant", allowed: ["tenantId", "planCode"], required: ["planCode"], status: 201 };
  }


  const membershipCollection = new RegExp("^" + ADMIN_PREFIX + "/tenants/([^/]+)/memberships$").exec(pathname);
  if (membershipCollection) {
    let tenantId;
    try { tenantId = decodeURIComponent(membershipCollection[1]); } catch { return null; }
    return {
      method: "assignTenantMembership",
      input: (body) => ({ tenantId, userId: body.userId, role: body.role }),
      allowed: ["userId", "role"],
      required: ["userId"],
      status: 201,
    };
  }

  const membershipRevoke = new RegExp("^" + ADMIN_PREFIX + "/tenants/([^/]+)/memberships/([^/]+)/revoke$").exec(pathname);
  if (membershipRevoke) {
    let tenantId;
    let userId;
    try {
      tenantId = decodeURIComponent(membershipRevoke[1]);
      userId = decodeURIComponent(membershipRevoke[2]);
    } catch { return null; }
    return {
      method: "revokeTenantMembership",
      input: () => ({ tenantId, userId }),
      allowed: [],
      required: [],
      status: 200,
    };
  }

  const match = new RegExp(
    "^" + ADMIN_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
    "/tenants/([^/]+)(?:/status|/plan|/api-keys(?:/([^/]+)/(revoke|rotate))?)?$",
  ).exec(pathname);
  if (!match) return null;

  let tenantId;
  let keyId;
  try {
    tenantId = decodeURIComponent(match[1]);
    keyId = match[2] ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }

  if (pathname.endsWith("/status")) {
    return { method: "setTenantStatus", input: (body) => ({ tenantId, status: body.status }), allowed: ["status"], required: ["status"], status: 200 };
  }
  if (pathname.endsWith("/plan")) {
    return { method: "assignTenantPlan", input: (body) => ({ tenantId, planCode: body.planCode }), allowed: ["planCode"], required: ["planCode"], status: 200 };
  }
  if (pathname.endsWith("/api-keys/" + keyId + "/revoke") && keyId) {
    return { method: "revokeApiKey", input: () => ({ tenantId, keyId }), allowed: [], required: [], status: 200 };
  }
  if (pathname.endsWith("/api-keys/" + keyId + "/rotate") && keyId) {
    return { method: "rotateApiKey", input: (body) => ({ tenantId, keyId, scopes: body.scopes, expiresAt: body.expiresAt }), allowed: ["scopes", "expiresAt"], required: ["scopes"], status: 200 };
  }
  if (pathname.endsWith("/api-keys")) {
    return { method: "issueApiKey", input: (body) => ({ tenantId, scopes: body.scopes, expiresAt: body.expiresAt }), allowed: ["scopes", "expiresAt"], required: ["scopes"], status: 201 };
  }
  return null;
}

export async function isTenantAdminSchemaReady(db) {
  if (!db || typeof db.prepare !== "function") return false;
  try {
    const clauses = REQUIRED_ADMIN_SCHEMA_OBJECTS.map(() => "(type = ? AND name = ?)").join(" OR ");
    const params = REQUIRED_ADMIN_SCHEMA_OBJECTS.flatMap(({ type, name }) => [type, name]);
    const result = await db.prepare(
      "SELECT type, name FROM sqlite_master WHERE " + clauses,
    ).bind(...params).all();
    const found = new Set((result?.results || []).map((row) => row.type + ":" + row.name));
    return REQUIRED_ADMIN_SCHEMA_OBJECTS.every(({ type, name }) => found.has(type + ":" + name));
  } catch {
    return false;
  }
}

export function createTenantAdminHttpHandler({
  authorizeOwner = authorizePlatformOwner,
  serviceFactory = createTenantAdminService,
  adminRateLimiter = createRateLimiter({
    windowMs: ADMIN_RATE_LIMIT_WINDOW_MS,
    maxRequests: ADMIN_RATE_LIMIT_MAX_REQUESTS,
  }),
} = {}) {
  if (typeof authorizeOwner !== "function" || typeof serviceFactory !== "function" ||
      !adminRateLimiter || typeof adminRateLimiter.check !== "function") {
    throw new TypeError("authorizeOwner, serviceFactory and adminRateLimiter must be valid.");
  }

  return async function handleTenantAdminRequest(request, env = {}) {
    const url = new URL(request.url);
    if (url.pathname !== ADMIN_PREFIX && !url.pathname.startsWith(ADMIN_PREFIX + "/")) return null;

    const route = routeFor(url.pathname);
    if (!route) return jsonResponse({ error: { code: "NOT_FOUND", message: "Not found." } }, 404);
    if (request.method !== "POST") {
      return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "POST is required." } }, 405);
    }

    let rate;
    try {
      rate = adminRateLimiter.check(getClientRateLimitKey(request));
    } catch {
      return jsonResponse({ error: { code: "ADMIN_RATE_LIMIT_UNAVAILABLE", message: "Administrative request protection is temporarily unavailable." } }, 503);
    }
    if (!rate?.allowed) {
      return jsonResponse(
        { error: { code: "ADMIN_RATE_LIMITED", message: "Too many administrative requests; retry later." } },
        429,
        { "retry-after": String(Number.isInteger(rate?.retryAfterSec) && rate.retryAfterSec > 0 ? rate.retryAfterSec : 60) },
      );
    }

    let owner;
    try {
      owner = await authorizeOwner(request, env);
    } catch {
      owner = null;
    }
    if (owner?.allowed !== true || typeof owner.actorId !== "string" ||
        owner.actorId.trim().length < 1 || owner.actorId.length > 128) {
      return jsonResponse({ error: { code: "ADMIN_FORBIDDEN", message: "A verified platform owner session is required." } }, 403);
    }

    const db = env.EXPORTFLOW_AUTH_DB;
    if (!db || typeof db.prepare !== "function" || typeof db.batch !== "function") {
      return jsonResponse({ error: { code: "ADMIN_STORAGE_NOT_CONFIGURED", message: "Tenant administration storage is not configured." } }, 503);
    }
    if (!(await isTenantAdminSchemaReady(db))) {
      return jsonResponse({ error: { code: "ADMIN_SCHEMA_NOT_READY", message: "Tenant administration storage is not ready." } }, 503);
    }

    let payload;
    try {
      payload = await readBoundedJsonBody(request, MAX_ADMIN_BODY_BYTES);
      validatePayload(payload, route.allowed, route.required);
    } catch (error) {
      if (error instanceof TaskContractError) {
        return jsonResponse({ error: { code: error.code, message: error.message } }, error.httpStatus);
      }
      return jsonResponse({ error: { code: "INVALID_ADMIN_INPUT", message: "The administrative request is invalid." } }, 400);
    }

    let service;
    try {
      // Bind the verified owner identity to this one request only. Never cache
      // this service instance across requests or users.
      service = serviceFactory({
        db,
        authorizeAdmin: async () => ({ allowed: true, actorId: owner.actorId }),
      });
      const input = route.input ? route.input(payload) : payload;
      const result = await service[route.method](input);
      return jsonResponse({ ok: true, data: result }, route.status);
    } catch (error) {
      if (error instanceof TenantAdminError) {
        return jsonResponse({ error: { code: error.code, message: error.message } }, error.httpStatus);
      }
      return jsonResponse({ error: { code: "ADMIN_REQUEST_FAILED", message: "The administrative request could not be completed." } }, 500);
    }
  };
}
