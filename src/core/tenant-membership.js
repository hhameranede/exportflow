const LIST_ACTIVE_MEMBERSHIPS_SQL = `
SELECT
  m.membership_id, m.user_id, m.tenant_id, m.role,
  t.plan_code, p.quota_period, p.request_limit, p.policy_version
FROM tenant_memberships AS m
JOIN tenants AS t ON t.tenant_id = m.tenant_id
JOIN plan_policies AS p ON p.plan_code = t.plan_code
WHERE m.user_id = ?1 AND m.status = 'active'
  AND t.status = 'active' AND p.status = 'active'
ORDER BY m.created_at ASC, m.tenant_id ASC
`;

const GET_ACTIVE_MEMBERSHIP_SQL = `
SELECT
  m.membership_id, m.user_id, m.tenant_id, m.role,
  t.plan_code, p.quota_period, p.request_limit, p.policy_version
FROM tenant_memberships AS m
JOIN tenants AS t ON t.tenant_id = m.tenant_id
JOIN plan_policies AS p ON p.plan_code = t.plan_code
WHERE m.user_id = ?1 AND m.tenant_id = ?2
  AND m.status = 'active' AND t.status = 'active' AND p.status = 'active'
LIMIT 1
`;

function requireDb(db) {
  if (!db || typeof db.prepare !== "function") throw new TypeError("A Tenant D1 database binding is required.");
  return db;
}

function requireIdentity(value, field, max = 128) {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > max) throw new TypeError(field + " is invalid.");
  return value.trim();
}

function mapMembership(row) {
  if (!row || typeof row !== "object") return null;
  const requestLimit = Number(row.request_limit);
  if (!Number.isSafeInteger(requestLimit) || requestLimit < 1 ||
      !["daily", "monthly"].includes(row.quota_period) ||
      typeof row.user_id !== "string" || typeof row.tenant_id !== "string" ||
      typeof row.membership_id !== "string" || typeof row.role !== "string" ||
      typeof row.plan_code !== "string" || typeof row.policy_version !== "string") {
    throw new Error("Tenant membership storage returned an invalid record.");
  }
  return Object.freeze({
    membershipId: row.membership_id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    role: row.role,
    planCode: row.plan_code,
    quotaPeriod: row.quota_period,
    requestLimit,
    policyVersion: row.policy_version,
  });
}

export async function listActiveTenantMemberships(db, userId) {
  db = requireDb(db);
  userId = requireIdentity(userId, "userId");
  try {
    const result = await db.prepare(LIST_ACTIVE_MEMBERSHIPS_SQL).bind(userId).all();
    return (result?.results || []).map(mapMembership);
  } catch {
    throw new Error("Tenant membership storage is unavailable.");
  }
}

export async function getActiveTenantMembership(db, userId, tenantId) {
  db = requireDb(db);
  userId = requireIdentity(userId, "userId");
  tenantId = requireIdentity(tenantId, "tenantId", 64);
  try {
    return mapMembership(await db.prepare(GET_ACTIVE_MEMBERSHIP_SQL).bind(userId, tenantId).first());
  } catch {
    throw new Error("Tenant membership storage is unavailable.");
  }
}

export async function storeOAuthTenantSelection(db, {
  sessionId, userId, tenantId, now = () => new Date().toISOString(), sessionExpiresAt,
} = {}) {
  db = requireDb(db);
  sessionId = requireIdentity(sessionId, "sessionId");
  userId = requireIdentity(userId, "userId");
  tenantId = requireIdentity(tenantId, "tenantId", 64);
  let timestamp;
  let sessionExpiry;
  try {
    const current = now();
    timestamp = current instanceof Date ? current.toISOString() : new Date(current).toISOString();
    sessionExpiry = new Date(sessionExpiresAt).toISOString();
  } catch {
    throw new TypeError("A valid current time and session expiry are required.");
  }
  if (Date.parse(sessionExpiry) <= Date.parse(timestamp)) throw new TypeError("The Better Auth session is expired.");
  const membership = await getActiveTenantMembership(db, userId, tenantId);
  if (!membership) return null;
  const maxSelectionExpiry = new Date(Date.parse(timestamp) + 10 * 60 * 1000).toISOString();
  const expiresAt = Date.parse(sessionExpiry) < Date.parse(maxSelectionExpiry) ? sessionExpiry : maxSelectionExpiry;
  try {
    await db.prepare(
      "INSERT INTO tenant_oauth_selections (session_id, user_id, tenant_id, selected_at, expires_at) " +
      "VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(session_id) DO UPDATE SET " +
      "user_id = excluded.user_id, tenant_id = excluded.tenant_id, selected_at = excluded.selected_at, expires_at = excluded.expires_at"
    ).bind(sessionId, userId, tenantId, timestamp, expiresAt).run();
  } catch {
    throw new Error("Tenant OAuth selection storage is unavailable.");
  }
  return Object.freeze({ ...membership, selectedAt: timestamp, expiresAt });
}

export async function getSelectedOAuthTenant(db, {
  sessionId, userId, now = () => new Date().toISOString(),
} = {}) {
  db = requireDb(db);
  sessionId = requireIdentity(sessionId, "sessionId");
  userId = requireIdentity(userId, "userId");
  let timestamp;
  try {
    const current = now();
    timestamp = current instanceof Date ? current.toISOString() : new Date(current).toISOString();
  } catch {
    throw new TypeError("The tenant selection clock is invalid.");
  }
  let selection;
  try {
    selection = await db.prepare(
      "SELECT tenant_id FROM tenant_oauth_selections WHERE session_id = ?1 AND user_id = ?2 AND expires_at > ?3 LIMIT 1"
    ).bind(sessionId, userId, timestamp).first();
  } catch {
    throw new Error("Tenant OAuth selection storage is unavailable.");
  }
  if (!selection?.tenant_id) return null;
  return await getActiveTenantMembership(db, userId, selection.tenant_id);
}

export async function createTenantOAuthAccessTokenClaims(db, { user, referenceId } = {}) {
  const userId = user?.id;
  if (typeof userId !== "string" || userId.length < 1 || userId.length > 128) {
    throw new Error("An authenticated user subject is required for tenant OAuth access.");
  }
  const tenantId = requireIdentity(referenceId, "tenant reference", 64);
  const membership = await getActiveTenantMembership(db, userId, tenantId);
  if (!membership) throw new Error("An active tenant membership and plan are required.");
  return Object.freeze({
    tenant_id: membership.tenantId,
    tenant_role: membership.role,
    tenant_membership_id: membership.membershipId,
  });
}
