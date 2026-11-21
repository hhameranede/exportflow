
import { generateTenantApiKey } from "./tenant-auth.js";

const PLAN_CODE_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;
const POLICY_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const TENANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
const ALLOWED_SCOPES = new Set(["tasks:fetch", "tasks:map", "tasks:crawl", "tasks:extract", "tasks:*", "*"]);
const TENANT_STATES = new Set(["active", "suspended", "closed"]);
const PLAN_STATES = new Set(["active", "retired"]);
const MAX_REQUEST_LIMIT = 1_000_000_000;

export class TenantAdminError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.name = "TenantAdminError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function requireText(value, field, maxLength = 128) {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > maxLength) {
    throw new TenantAdminError("INVALID_ADMIN_INPUT", field + " is invalid.");
  }
  return value.trim();
}

function requireInputObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TenantAdminError("INVALID_ADMIN_INPUT", "The administrative request must be an object.");
  }
  return value;
}

function requirePlanCode(value) {
  const planCode = requireText(value, "planCode", 32);
  if (!PLAN_CODE_PATTERN.test(planCode)) {
    throw new TenantAdminError("INVALID_PLAN_CODE", "planCode must use lowercase letters, numbers, hyphens or underscores.");
  }
  return planCode;
}

function timestampFrom(now) {
  let value;
  try {
    value = now();
  } catch {
    throw new TenantAdminError("TENANT_ADMIN_CLOCK_UNAVAILABLE", "The tenant administration clock is unavailable.", 503);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TenantAdminError("TENANT_ADMIN_CLOCK_INVALID", "The tenant administration clock returned an invalid timestamp.", 503);
  }
  return date.toISOString();
}

function safeChanges(result) {
  const changes = Number(result?.meta?.changes);
  return Number.isSafeInteger(changes) && changes >= 0 ? changes : 0;
}

function validateScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length < 1 || scopes.length > ALLOWED_SCOPES.size ||
      scopes.some((scope) => typeof scope !== "string" || !ALLOWED_SCOPES.has(scope)) ||
      new Set(scopes).size !== scopes.length) {
    throw new TenantAdminError("INVALID_API_KEY_SCOPES", "scopes must be a non-empty list of supported, unique task scopes.");
  }
  return [...scopes];
}

function normalizeExpiry(value, createdAt) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new TenantAdminError("INVALID_API_KEY_EXPIRY", "expiresAt must be a future ISO date string.");
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= Date.parse(createdAt)) {
    throw new TenantAdminError("INVALID_API_KEY_EXPIRY", "expiresAt must be a future ISO date string.");
  }
  return new Date(parsed).toISOString();
}

function auditStatement(db, cryptoImpl, {
  actorId,
  action,
  resourceType,
  resourceId,
  details,
  createdAt,
}) {
  return db.prepare(
    "INSERT INTO tenant_admin_audit_log (event_id, actor_id, action, resource_type, resource_id, details_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
  ).bind(
    cryptoImpl.randomUUID(),
    actorId,
    action,
    resourceType,
    resourceId,
    JSON.stringify(details || {}),
    createdAt,
  );
}

/**
 * Internal tenant lifecycle service.
 *
 * This module intentionally exposes no HTTP route. A trusted server integration
 * must construct it with an authorizeAdmin closure that derives the operator
 * from a verified session/role and returns { allowed: true, actorId }.
 * Never implement authorizeAdmin using request-body fields or caller headers.
 */
export function createTenantAdminService({
  db,
  authorizeAdmin,
  now = () => new Date().toISOString(),
  cryptoImpl = globalThis.crypto,
} = {}) {
  if (!db || typeof db.prepare !== "function" || typeof db.batch !== "function") {
    throw new TypeError("A Cloudflare D1 binding with prepare() and batch() is required.");
  }
  if (typeof authorizeAdmin !== "function") {
    throw new TypeError("A trusted authorizeAdmin function is required.");
  }
  if (typeof cryptoImpl?.randomUUID !== "function" || typeof cryptoImpl?.getRandomValues !== "function") {
    throw new TypeError("Secure Web Crypto is required.");
  }

  async function requireAdmin(action, resourceType, resourceId) {
    let decision;
    try {
      decision = await authorizeAdmin(Object.freeze({ action, resourceType, resourceId }));
    } catch {
      decision = null;
    }
    const actorId = decision?.actorId;
    if (decision?.allowed !== true || typeof actorId !== "string" ||
        actorId.trim().length < 1 || actorId.length > 128) {
      throw new TenantAdminError("ADMIN_FORBIDDEN", "A verified ExportFlow administrator is required.", 403);
    }
    return actorId.trim();
  }

  async function commit(statements) {
    try {
      return await db.batch(statements);
    } catch {
      throw new TenantAdminError("TENANT_ADMIN_STORAGE_UNAVAILABLE", "Tenant administration storage is temporarily unavailable.", 503);
    }
  }

  async function generateKeyRecord(input, createdAt) {
    const scopes = validateScopes(input.scopes);
    const expiresAt = normalizeExpiry(input.expiresAt, createdAt);
    let generated;
    try {
      generated = await generateTenantApiKey(cryptoImpl);
    } catch {
      throw new TenantAdminError("TENANT_API_KEY_GENERATION_FAILED", "A secure API key could not be generated.", 503);
    }
    if (!KEY_ID_PATTERN.test(generated.keyId)) {
      throw new TenantAdminError("TENANT_API_KEY_GENERATION_FAILED", "A secure API key could not be generated.", 503);
    }
    return { scopes, expiresAt, generated };
  }

  return Object.freeze({
    async createPlanPolicy(input = {}) {
      input = requireInputObject(input);
      const planCode = requirePlanCode(input.planCode);
      const actorId = await requireAdmin("plans:write", "plan", planCode);
      const quotaPeriod = input.quotaPeriod;
      const requestLimit = input.requestLimit;
      const policyVersion = requireText(input.policyVersion, "policyVersion", 64);
      const status = input.status === undefined ? "active" : input.status;
      if (!["daily", "monthly"].includes(quotaPeriod)) {
        throw new TenantAdminError("INVALID_QUOTA_PERIOD", "quotaPeriod must be daily or monthly.");
      }
      if (!Number.isSafeInteger(requestLimit) || requestLimit < 1 || requestLimit > MAX_REQUEST_LIMIT) {
        throw new TenantAdminError("INVALID_REQUEST_LIMIT", "requestLimit must be a positive safe integer within the supported database range.");
      }
      if (!POLICY_VERSION_PATTERN.test(policyVersion)) {
        throw new TenantAdminError("INVALID_POLICY_VERSION", "policyVersion contains unsupported characters.");
      }
      if (!PLAN_STATES.has(status)) {
        throw new TenantAdminError("INVALID_PLAN_STATUS", "Plan status must be active or retired.");
      }
      const updatedAt = timestampFrom(now);
      const results = await commit([
        db.prepare(
          "INSERT INTO plan_policies (plan_code, quota_period, request_limit, policy_version, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6) ON CONFLICT(plan_code) DO UPDATE SET quota_period = excluded.quota_period, request_limit = excluded.request_limit, policy_version = excluded.policy_version, status = excluded.status, updated_at = excluded.updated_at"
        ).bind(planCode, quotaPeriod, requestLimit, policyVersion, status, updatedAt),
        auditStatement(db, cryptoImpl, {
          actorId, action: "plans:write", resourceType: "plan", resourceId: planCode,
          details: { quotaPeriod, requestLimit, policyVersion, status }, createdAt: updatedAt,
        }),
      ]);
      if (safeChanges(results[0]) !== 1) {
        throw new TenantAdminError("PLAN_POLICY_NOT_SAVED", "The plan policy was not saved.", 503);
      }
      return Object.freeze({ planCode, quotaPeriod, requestLimit, policyVersion, status, updatedAt });
    },

    async provisionTenant(input = {}) {
      input = requireInputObject(input);
      const tenantId = input.tenantId === undefined
        ? "tenant_" + cryptoImpl.randomUUID().replaceAll("-", "")
        : requireText(input.tenantId, "tenantId", 64);
      if (!TENANT_ID_PATTERN.test(tenantId)) {
        throw new TenantAdminError("INVALID_TENANT_ID", "tenantId has an invalid format.");
      }
      const planCode = requirePlanCode(input.planCode);
      const actorId = await requireAdmin("tenants:create", "tenant", tenantId);
      const createdAt = timestampFrom(now);
      const results = await commit([
        db.prepare(
          "INSERT INTO tenants (tenant_id, plan_code, status, created_at, updated_at) SELECT ?1, ?2, 'active', ?3, ?3 WHERE EXISTS (SELECT 1 FROM plan_policies WHERE plan_code = ?2 AND status = 'active')"
        ).bind(tenantId, planCode, createdAt),
        db.prepare(
          "INSERT INTO tenant_admin_audit_log (event_id, actor_id, action, resource_type, resource_id, details_json, created_at) SELECT ?1, ?2, 'tenants:create', 'tenant', ?3, ?4, ?5 WHERE changes() = 1"
        ).bind(cryptoImpl.randomUUID(), actorId, tenantId, JSON.stringify({ planCode, status: "active" }), createdAt),
      ]);
      if (safeChanges(results[0]) !== 1) {
        throw new TenantAdminError("ACTIVE_PLAN_NOT_FOUND", "An active plan policy is required before provisioning a tenant.", 409);
      }
      return Object.freeze({ tenantId, planCode, status: "active", createdAt });
    },

    async issueApiKey(input = {}) {
      input = requireInputObject(input);
      const tenantId = requireText(input.tenantId, "tenantId", 64);
      if (!TENANT_ID_PATTERN.test(tenantId)) {
        throw new TenantAdminError("INVALID_TENANT_ID", "tenantId has an invalid format.");
      }
      const actorId = await requireAdmin("api_keys:issue", "tenant", tenantId);
      const createdAt = timestampFrom(now);
      const { scopes, expiresAt, generated } = await generateKeyRecord(input, createdAt);
      const results = await commit([
        db.prepare(
          "INSERT INTO api_keys (key_id, tenant_id, key_hash, status, scopes_json, expires_at, created_at) SELECT ?1, ?2, ?3, 'active', ?4, ?5, ?6 FROM tenants AS t JOIN plan_policies AS p ON p.plan_code = t.plan_code WHERE t.tenant_id = ?2 AND t.status = 'active' AND p.status = 'active'"
        ).bind(generated.keyId, tenantId, generated.keyHash, JSON.stringify(scopes), expiresAt, createdAt),
        db.prepare(
          "INSERT INTO tenant_admin_audit_log (event_id, actor_id, action, resource_type, resource_id, details_json, created_at) SELECT ?1, ?2, 'api_keys:issue', 'api_key', ?3, ?4, ?5 WHERE changes() = 1"
        ).bind(cryptoImpl.randomUUID(), actorId, generated.keyId, JSON.stringify({ tenantId, scopes, expiresAt }), createdAt),
      ]);
      if (safeChanges(results[0]) !== 1) {
        throw new TenantAdminError("ACTIVE_TENANT_NOT_FOUND", "An active tenant and plan are required before issuing an API key.", 409);
      }
      return Object.freeze({
        keyId: generated.keyId, tenantId, token: generated.token, scopes: [...scopes],
        expiresAt, createdAt, revealOnce: true,
      });
    },

    async rotateApiKey(input = {}) {
      input = requireInputObject(input);
      const tenantId = requireText(input.tenantId, "tenantId", 64);
      const oldKeyId = requireText(input.keyId, "keyId", 16);
      if (!TENANT_ID_PATTERN.test(tenantId) || !KEY_ID_PATTERN.test(oldKeyId)) {
        throw new TenantAdminError("INVALID_API_KEY_REFERENCE", "tenantId or keyId is invalid.");
      }
      const actorId = await requireAdmin("api_keys:rotate", "api_key", oldKeyId);
      const createdAt = timestampFrom(now);
      const { scopes, expiresAt, generated } = await generateKeyRecord(input, createdAt);
      const results = await commit([
        db.prepare(
          "UPDATE api_keys SET status = 'revoked', revoked_at = ?1 WHERE key_id = ?2 AND tenant_id = ?3 AND status = 'active' AND EXISTS (SELECT 1 FROM tenants AS t JOIN plan_policies AS p ON p.plan_code = t.plan_code WHERE t.tenant_id = ?3 AND t.status = 'active' AND p.status = 'active')"
        ).bind(createdAt, oldKeyId, tenantId),
        db.prepare(
          "INSERT INTO tenant_admin_audit_log (event_id, actor_id, action, resource_type, resource_id, details_json, created_at) SELECT ?1, ?2, 'api_keys:revoke', 'api_key', ?3, ?4, ?5 WHERE changes() = 1"
        ).bind(cryptoImpl.randomUUID(), actorId, oldKeyId, JSON.stringify({ tenantId, replacedBy: generated.keyId }), createdAt),
        db.prepare(
          "INSERT INTO api_keys (key_id, tenant_id, key_hash, status, scopes_json, expires_at, created_at) SELECT ?1, ?2, ?3, 'active', ?4, ?5, ?6 FROM tenants AS t JOIN plan_policies AS p ON p.plan_code = t.plan_code WHERE t.tenant_id = ?2 AND t.status = 'active' AND p.status = 'active' AND EXISTS (SELECT 1 FROM api_keys WHERE key_id = ?7 AND tenant_id = ?2 AND status = 'revoked' AND revoked_at = ?8)"
        ).bind(generated.keyId, tenantId, generated.keyHash, JSON.stringify(scopes), expiresAt, createdAt, oldKeyId, createdAt),
        db.prepare(
          "INSERT INTO tenant_admin_audit_log (event_id, actor_id, action, resource_type, resource_id, details_json, created_at) SELECT ?1, ?2, 'api_keys:issue', 'api_key', ?3, ?4, ?5 WHERE changes() = 1"
        ).bind(cryptoImpl.randomUUID(), actorId, generated.keyId, JSON.stringify({ tenantId, scopes, expiresAt, rotatedFrom: oldKeyId }), createdAt),
      ]);
      if (safeChanges(results[0]) !== 1 || safeChanges(results[2]) !== 1) {
        throw new TenantAdminError("ACTIVE_API_KEY_NOT_FOUND", "The active API key or tenant was not found for rotation.", 409);
      }
      return Object.freeze({
        oldKeyId, keyId: generated.keyId, tenantId, token: generated.token,
        scopes: [...scopes], expiresAt, createdAt, revealOnce: true,
      });
    },

    async revokeApiKey(input = {}) {
      input = requireInputObject(input);
      const tenantId = requireText(input.tenantId, "tenantId", 64);
      const keyId = requireText(input.keyId, "keyId", 16);
      if (!TENANT_ID_PATTERN.test(tenantId) || !KEY_ID_PATTERN.test(keyId)) {
        throw new TenantAdminError("INVALID_API_KEY_REFERENCE", "tenantId or keyId is invalid.");
      }
      const actorId = await requireAdmin("api_keys:revoke", "api_key", keyId);
      const revokedAt = timestampFrom(now);
      const results = await commit([
        db.prepare(
          "UPDATE api_keys SET status = 'revoked', revoked_at = ?1 WHERE key_id = ?2 AND tenant_id = ?3 AND status = 'active'"
        ).bind(revokedAt, keyId, tenantId),
        db.prepare(
          "INSERT INTO tenant_admin_audit_log (event_id, actor_id, action, resource_type, resource_id, details_json, created_at) SELECT ?1, ?2, 'api_keys:revoke', 'api_key', ?3, ?4, ?5 WHERE changes() = 1"
        ).bind(cryptoImpl.randomUUID(), actorId, keyId, JSON.stringify({ tenantId }), revokedAt),
      ]);
      if (safeChanges(results[0]) !== 1) {
        throw new TenantAdminError("ACTIVE_API_KEY_NOT_FOUND", "The active API key was not found for this tenant.", 404);
      }
      return Object.freeze({ keyId, tenantId, status: "revoked", revokedAt });
    },

    async setTenantStatus(input = {}) {
      input = requireInputObject(input);
      const tenantId = requireText(input.tenantId, "tenantId", 64);
      const status = input.status;
      if (!TENANT_ID_PATTERN.test(tenantId) || !TENANT_STATES.has(status)) {
        throw new TenantAdminError("INVALID_TENANT_STATUS", "tenantId or tenant status is invalid.");
      }
      const actorId = await requireAdmin("tenants:status", "tenant", tenantId);
      const updatedAt = timestampFrom(now);
      const results = await commit([
        db.prepare(
          "UPDATE tenants SET status = ?1, updated_at = ?2 WHERE tenant_id = ?3 AND (status <> 'closed' OR ?1 = 'closed')"
        ).bind(status, updatedAt, tenantId),
        db.prepare(
          "INSERT INTO tenant_admin_audit_log (event_id, actor_id, action, resource_type, resource_id, details_json, created_at) SELECT ?1, ?2, 'tenants:status', 'tenant', ?3, ?4, ?5 WHERE changes() = 1"
        ).bind(cryptoImpl.randomUUID(), actorId, tenantId, JSON.stringify({ status }), updatedAt),
      ]);
      if (safeChanges(results[0]) !== 1) {
        throw new TenantAdminError("TENANT_NOT_UPDATABLE", "The tenant was not found or is already closed.", 404);
      }
      return Object.freeze({ tenantId, status, updatedAt });
    },

    async assignTenantPlan(input = {}) {
      input = requireInputObject(input);
      const tenantId = requireText(input.tenantId, "tenantId", 64);
      const planCode = requirePlanCode(input.planCode);
      if (!TENANT_ID_PATTERN.test(tenantId)) {
        throw new TenantAdminError("INVALID_TENANT_ID", "tenantId has an invalid format.");
      }
      const actorId = await requireAdmin("tenants:plan", "tenant", tenantId);
      const updatedAt = timestampFrom(now);
      const results = await commit([
        db.prepare(
          "UPDATE tenants SET plan_code = ?1, updated_at = ?2 WHERE tenant_id = ?3 AND status <> 'closed' AND EXISTS (SELECT 1 FROM plan_policies WHERE plan_code = ?1 AND status = 'active')"
        ).bind(planCode, updatedAt, tenantId),
        db.prepare(
          "INSERT INTO tenant_admin_audit_log (event_id, actor_id, action, resource_type, resource_id, details_json, created_at) SELECT ?1, ?2, 'tenants:plan', 'tenant', ?3, ?4, ?5 WHERE changes() = 1"
        ).bind(cryptoImpl.randomUUID(), actorId, tenantId, JSON.stringify({ planCode }), updatedAt),
      ]);
      if (safeChanges(results[0]) !== 1) {
        throw new TenantAdminError("TENANT_OR_ACTIVE_PLAN_NOT_FOUND", "The tenant or active target plan was not found.", 404);
      }
      return Object.freeze({ tenantId, planCode, updatedAt, quotaWindowNote: "An existing UTC usage window keeps its original policy snapshot." });
    },

    async assignTenantMembership(input = {}) {
      input = requireInputObject(input);
      const tenantId = requireText(input.tenantId, "tenantId", 64);
      const userId = requireText(input.userId, "userId", 128);
      const role = input.role === undefined ? "member" : input.role;
      if (!TENANT_ID_PATTERN.test(tenantId) || !["owner", "admin", "member"].includes(role) ||
          !/^[A-Za-z0-9_:@.-]{1,128}$/.test(userId)) {
        throw new TenantAdminError("INVALID_TENANT_MEMBERSHIP", "Tenant membership reference or role is invalid.");
      }
      const actorId = await requireAdmin("tenant_memberships:assign", "tenant_membership", tenantId + "/" + userId);
      const updatedAt = timestampFrom(now);
      const membershipId = cryptoImpl.randomUUID();
      const results = await commit([
        db.prepare(
          "INSERT INTO tenant_memberships (membership_id, user_id, tenant_id, role, status, created_by, created_at, updated_at, revoked_at) " +
          "SELECT ?1, ?2, ?3, ?4, 'active', ?5, ?6, ?6, NULL FROM tenants AS t " +
          "JOIN plan_policies AS p ON p.plan_code = t.plan_code " +
          "WHERE t.tenant_id = ?3 AND t.status = 'active' AND p.status = 'active' " +
          "ON CONFLICT(user_id, tenant_id) DO UPDATE SET role = excluded.role, status = 'active', updated_at = excluded.updated_at, revoked_at = NULL"
        ).bind(membershipId, userId, tenantId, role, actorId, updatedAt),
        db.prepare(
          "INSERT INTO tenant_admin_audit_log (event_id, actor_id, action, resource_type, resource_id, details_json, created_at) " +
          "SELECT ?1, ?2, 'tenant_memberships:assign', 'tenant_membership', ?3, ?4, ?5 WHERE changes() = 1"
        ).bind(cryptoImpl.randomUUID(), actorId, tenantId + "/" + userId, JSON.stringify({ tenantId, userId, role, status: "active" }), updatedAt),
      ]);
      if (safeChanges(results[0]) !== 1) {
        throw new TenantAdminError("ACTIVE_TENANT_NOT_FOUND", "An active tenant and plan are required before assigning a member.", 409);
      }
      return Object.freeze({ tenantId, userId, role, status: "active", updatedAt });
    },

    async revokeTenantMembership(input = {}) {
      input = requireInputObject(input);
      const tenantId = requireText(input.tenantId, "tenantId", 64);
      const userId = requireText(input.userId, "userId", 128);
      if (!TENANT_ID_PATTERN.test(tenantId) || !/^[A-Za-z0-9_:@.-]{1,128}$/.test(userId)) {
        throw new TenantAdminError("INVALID_TENANT_MEMBERSHIP", "Tenant membership reference is invalid.");
      }
      const actorId = await requireAdmin("tenant_memberships:revoke", "tenant_membership", tenantId + "/" + userId);
      const updatedAt = timestampFrom(now);
      const results = await commit([
        db.prepare(
          "UPDATE tenant_memberships SET status = 'revoked', updated_at = ?1, revoked_at = ?1 " +
          "WHERE tenant_id = ?2 AND user_id = ?3 AND status = 'active' " +
          "AND (role <> 'owner' OR EXISTS (" +
          "SELECT 1 FROM tenant_memberships AS other WHERE other.tenant_id = ?2 AND other.status = 'active' " +
          "AND other.role = 'owner' AND other.user_id <> ?3))"
        ).bind(updatedAt, tenantId, userId),
        db.prepare(
          "INSERT INTO tenant_admin_audit_log (event_id, actor_id, action, resource_type, resource_id, details_json, created_at) " +
          "SELECT ?1, ?2, 'tenant_memberships:revoke', 'tenant_membership', ?3, ?4, ?5 WHERE changes() = 1"
        ).bind(cryptoImpl.randomUUID(), actorId, tenantId + "/" + userId, JSON.stringify({ tenantId, userId, status: "revoked" }), updatedAt),
      ]);
      if (safeChanges(results[0]) !== 1) {
        let current = null;
        try {
          current = await db.prepare(
            "SELECT role, status FROM tenant_memberships WHERE tenant_id = ?1 AND user_id = ?2 LIMIT 1"
          ).bind(tenantId, userId).first();
        } catch {
          throw new TenantAdminError("TENANT_ADMIN_STORAGE_UNAVAILABLE", "Tenant administration storage is temporarily unavailable.", 503);
        }
        if (current?.role === "owner" && current.status === "active") {
          throw new TenantAdminError("LAST_TENANT_OWNER_REQUIRED", "A tenant must retain at least one active owner.", 409);
        }
        throw new TenantAdminError("TENANT_MEMBERSHIP_NOT_FOUND", "The active tenant membership was not found.", 404);
      }
      return Object.freeze({ tenantId, userId, status: "revoked", revokedAt: updatedAt });
    },

  });
}
