const READ_USAGE_SQL = `
SELECT request_limit, requests_used
FROM tenant_request_usage
WHERE tenant_id = ?1 AND window_id = ?2
LIMIT 1
`;

const RESERVE_REQUEST_SQL = `
INSERT INTO tenant_request_usage (
  tenant_id,
  window_id,
  plan_code,
  policy_version,
  request_limit,
  requests_used,
  updated_at
)
VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)
ON CONFLICT (tenant_id, window_id)
DO UPDATE SET
  requests_used = tenant_request_usage.requests_used + 1,
  updated_at = excluded.updated_at
WHERE tenant_request_usage.requests_used < tenant_request_usage.request_limit
RETURNING requests_used, request_limit
`;

export class PlanQuotaError extends Error {
  constructor(message = "Plan quota storage is unavailable.") {
    super(message);
    this.name = "PlanQuotaError";
    this.code = "QUOTA_BACKEND_UNAVAILABLE";
  }
}

export function getQuotaWindow(nowValue, period) {
  const now = nowValue instanceof Date ? new Date(nowValue.getTime()) : new Date(nowValue);
  if (!Number.isFinite(now.getTime())) throw new TypeError("Quota timestamp must be a valid date.");
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  if (period === "daily") {
    const start = new Date(Date.UTC(year, month, now.getUTCDate()));
    const end = new Date(Date.UTC(year, month, now.getUTCDate() + 1));
    return {
      windowId: start.toISOString().slice(0, 10),
      resetAt: end.toISOString(),
    };
  }
  if (period === "monthly") {
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1));
    return {
      windowId: start.toISOString().slice(0, 7),
      resetAt: end.toISOString(),
    };
  }
  throw new TypeError("Quota period must be daily or monthly.");
}

/**
 * Atomically consumes one valid task unit for the authenticated tenant.
 * The SQL UPSERT increments only while the stored window has capacity.
 * Accepted tasks count even when an upstream website later fails.
 */
export async function reservePlanRequest({ db, identity, now = () => new Date().toISOString() } = {}) {
  if (!db || typeof db.prepare !== "function") throw new PlanQuotaError();
  if (!identity || typeof identity.tenantId !== "string" ||
      typeof identity.planCode !== "string" || typeof identity.policyVersion !== "string" ||
      !Number.isSafeInteger(identity.requestLimit) || identity.requestLimit < 1) {
    throw new TypeError("Authenticated tenant plan identity is invalid.");
  }

  const timestamp = now();
  const bounds = getQuotaWindow(timestamp, identity.quotaPeriod);
  let row;
  try {
    row = await db.prepare(RESERVE_REQUEST_SQL).bind(
      identity.tenantId,
      bounds.windowId,
      identity.planCode,
      identity.policyVersion,
      identity.requestLimit,
      timestamp,
    ).first();
  } catch {
    throw new PlanQuotaError();
  }

  if (!row) {
    let currentUsage;
    try {
      currentUsage = await db.prepare(READ_USAGE_SQL).bind(
        identity.tenantId,
        bounds.windowId,
      ).first();
    } catch {
      throw new PlanQuotaError();
    }
    const limit = Number(currentUsage?.request_limit);
    const used = Number(currentUsage?.requests_used);
    if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(used) || used < limit) {
      throw new PlanQuotaError("Plan quota storage returned an invalid exhausted-window record.");
    }
    return {
      allowed: false,
      limit,
      remaining: 0,
      used,
      windowId: bounds.windowId,
      resetAt: bounds.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((Date.parse(bounds.resetAt) - Date.parse(timestamp)) / 1000)),
    };
  }

  const limit = Number(row.request_limit);
  const used = Number(row.requests_used);
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(used) || used < 1 || used > limit) {
    throw new PlanQuotaError("Plan quota storage returned an invalid usage record.");
  }
  return {
    allowed: true,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    windowId: bounds.windowId,
    resetAt: bounds.resetAt,
  };
}
