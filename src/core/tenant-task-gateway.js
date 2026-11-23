import { authenticateRequest as authenticateTenantApiKey } from "./tenant-auth.js";
import { reservePlanRequest } from "./plan-quota.js";
import { getClientRateLimitKey, PRE_AUTH_MAX_REQUESTS_PER_ISOLATE, PRE_AUTH_WINDOW_MS } from "./client-rate-limit.js";
import { createRateLimiter } from "./auth.js";
import { createDurableTenantBurstLimiter, DEFAULT_TENANT_BURST_LIMIT, DEFAULT_TENANT_BURST_WINDOW_MS } from "./durable-tenant-burst-limiter.js";

function failure(httpStatus, code, message, extra = {}) {
  return { ok: false, httpStatus, code, message, ...extra };
}

function validIdentity(identity) {
  return Boolean(
    identity && typeof identity.tenantId === "string" &&
    typeof identity.planCode === "string" &&
    typeof identity.policyVersion === "string" &&
    Number.isSafeInteger(identity.requestLimit) && identity.requestLimit >= 1 &&
    ["daily", "monthly"].includes(identity.quotaPeriod) &&
    Array.isArray(identity.scopes) &&
    identity.scopes.every((scope) => typeof scope === "string")
  );
}

function authorizeScope(identity, requiredScope) {
  if (!validIdentity(identity)) {
    return failure(503, "AUTH_BACKEND_INVALID_RECORD", "Authenticated tenant identity is invalid.");
  }
  if (typeof requiredScope !== "string" || !requiredScope.trim()) {
    return failure(500, "INVALID_REQUIRED_SCOPE", "An operation scope is required.");
  }
  if (!identity.scopes.includes(requiredScope) &&
      !identity.scopes.includes("tasks:*") &&
      !identity.scopes.includes("*")) {
    return failure(403, "INSUFFICIENT_SCOPE", "The credential does not have permission for this operation.");
  }
  return { ok: true, identity };
}

/**
 * Shared tenant authorization and quota boundary for API-key and OAuth principals.
 * The D1 identity is authoritative; no tenant, plan, scope or quota is read from
 * caller-supplied request data. Both transports use the same tenant DO and D1 quota.
 */
export function createTenantTaskGateway({
  now = () => new Date().toISOString(),
  preAuthRateLimiter,
  tenantRateLimiter,
  tenantBurstLimit = DEFAULT_TENANT_BURST_LIMIT,
  tenantBurstWindowMs = DEFAULT_TENANT_BURST_WINDOW_MS,
  authenticateApiKey = authenticateTenantApiKey,
  reserveRequest = reservePlanRequest,
} = {}) {
  const preAuth = preAuthRateLimiter || createRateLimiter({
    windowMs: PRE_AUTH_WINDOW_MS,
    maxRequests: PRE_AUTH_MAX_REQUESTS_PER_ISOLATE,
  });

  async function applyTenantBurstLimit(identity, env = {}) {
    let decision;
    try {
      const limiter = tenantRateLimiter || createDurableTenantBurstLimiter(
        env?.TENANT_BURST_LIMITER,
        { limit: tenantBurstLimit, windowMs: tenantBurstWindowMs },
      );
      decision = await limiter.check(identity.tenantId);
      if (!decision || typeof decision.allowed !== "boolean") {
        throw new TypeError("Tenant burst limiter returned an invalid decision.");
      }
    } catch {
      return failure(503, "TENANT_RATE_LIMITER_UNAVAILABLE", "Tenant burst limiting is temporarily unavailable.");
    }
    if (!decision.allowed) {
      return failure(429, "RATE_LIMITED", "Tenant burst limit reached; retry later.", {
        retryAfterSec: decision.retryAfterSec,
      });
    }
    return null;
  }

  async function authorizeIdentity(request, identity, {
    requiredScope = "tasks:fetch",
    preAuthChecked = false,
  } = {}, env = {}) {
    if (!preAuthChecked) {
      const ipRate = preAuth.check(getClientRateLimitKey(request));
      if (!ipRate.allowed) {
        return failure(429, "RATE_LIMITED", "Too many requests; retry later.", {
          retryAfterSec: ipRate.retryAfterSec,
        });
      }
    }

    if (requiredScope !== null) {
      const scopeResult = authorizeScope(identity, requiredScope);
      if (!scopeResult.ok) return scopeResult;
    } else if (!validIdentity(identity)) {
      return failure(503, "AUTH_BACKEND_INVALID_RECORD", "Authenticated tenant identity is invalid.");
    }

    const limitFailure = await applyTenantBurstLimit(identity, env);
    if (limitFailure) return limitFailure;
    return { ok: true, identity };
  }

  async function authenticate(request, env = {}, { requiredScope = "tasks:fetch" } = {}) {
    const ipRate = preAuth.check(getClientRateLimitKey(request));
    if (!ipRate.allowed) {
      return failure(429, "RATE_LIMITED", "Too many requests; retry later.", {
        retryAfterSec: ipRate.retryAfterSec,
      });
    }

    let identity;
    try {
      identity = await authenticateApiKey(request, env, { requiredScope, now });
    } catch {
      return failure(503, "AUTH_BACKEND_UNAVAILABLE", "Tenant authentication storage is temporarily unavailable.");
    }
    if (!identity?.ok) return identity || failure(503, "AUTH_BACKEND_UNAVAILABLE", "Tenant authentication failed.");

    return authorizeIdentity(request, identity, { requiredScope, preAuthChecked: true }, env);
  }

  async function reserve(env = {}, identity) {
    let quota;
    try {
      quota = await reserveRequest({
        db: env?.EXPORTFLOW_AUTH_DB,
        identity,
        now,
      });
    } catch {
      return failure(503, "QUOTA_BACKEND_UNAVAILABLE", "Plan quota storage is temporarily unavailable.");
    }

    if (!quota?.allowed) {
      return failure(429, "PLAN_QUOTA_EXCEEDED", "The plan request allowance for this window has been exhausted.", {
        retryAfterSec: quota?.retryAfterSec,
        quota: quota ? {
          limit: quota.limit,
          remaining: quota.remaining,
          used: quota.used,
          resetAt: quota.resetAt,
          windowId: quota.windowId,
        } : undefined,
      });
    }
    return { ok: true, quota };
  }

  return Object.freeze({ authenticate, authorizeIdentity, authorizeScope, reserve });
}
