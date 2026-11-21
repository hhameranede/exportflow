import { authenticateRequest as authenticateTenantApiKey } from "./tenant-auth.js";
import { reservePlanRequest } from "./plan-quota.js";
import { getClientRateLimitKey, PRE_AUTH_MAX_REQUESTS_PER_ISOLATE, PRE_AUTH_WINDOW_MS } from "./client-rate-limit.js";
import { createRateLimiter } from "./auth.js";

const TENANT_WINDOW_MS = 60_000;
const TENANT_MAX_REQUESTS = 60;

function failure(httpStatus, code, message, extra = {}) {
  return { ok: false, httpStatus, code, message, ...extra };
}

/**
 * Shared tenant authorization and request-quota boundary for REST and MCP.
 * The D1 identity is authoritative; no tenant, plan, scope, or limit is read
 * from caller-supplied request data. Both APIs must call authenticate() first,
 * validate their operation contract, then call reserve() exactly once.
 */
export function createTenantTaskGateway({
  now = () => new Date().toISOString(),
  preAuthRateLimiter,
  tenantRateLimiter,
  authenticateApiKey = authenticateTenantApiKey,
  reserveRequest = reservePlanRequest,
} = {}) {
  const preAuth = preAuthRateLimiter || createRateLimiter({
    windowMs: PRE_AUTH_WINDOW_MS,
    maxRequests: PRE_AUTH_MAX_REQUESTS_PER_ISOLATE,
  });
  const perTenant = tenantRateLimiter || createRateLimiter({
    windowMs: TENANT_WINDOW_MS,
    maxRequests: TENANT_MAX_REQUESTS,
  });

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

    const tenantRate = perTenant.check(identity.tenantId);
    if (!tenantRate.allowed) {
      return failure(429, "RATE_LIMITED", "Tenant burst limit reached; retry later.", {
        retryAfterSec: tenantRate.retryAfterSec,
      });
    }

    return { ok: true, identity };
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

  return Object.freeze({ authenticate, reserve });
}
