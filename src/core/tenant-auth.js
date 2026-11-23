const API_KEY_PATTERN = /^ef_live_([A-Za-z0-9_-]{16})_([A-Za-z0-9_-]{43})$/;
const AUTH_QUERY = `
SELECT
  k.key_id,
  k.tenant_id,
  k.status AS key_status,
  k.expires_at,
  k.scopes_json,
  t.status AS tenant_status,
  t.plan_code,
  p.status AS plan_status,
  p.quota_period,
  p.request_limit,
  p.policy_version
FROM api_keys AS k
JOIN tenants AS t ON t.tenant_id = k.tenant_id
JOIN plan_policies AS p ON p.plan_code = t.plan_code
WHERE k.key_id = ?1 AND k.key_hash = ?2
LIMIT 1
`;

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function isD1Database(value) {
  return Boolean(value && typeof value.prepare === "function");
}

export async function hashApiKey(apiKey, cryptoImpl = globalThis.crypto) {
  if (typeof apiKey !== "string" || !API_KEY_PATTERN.test(apiKey)) {
    throw new TypeError("API key format is invalid.");
  }
  if (!cryptoImpl?.subtle?.digest) {
    throw new Error("Web Crypto SHA-256 is unavailable.");
  }
  const material = new TextEncoder().encode("exportflow-api-key-v1:" + apiKey);
  const digest = await cryptoImpl.subtle.digest("SHA-256", material);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates one-time API key material for a trusted provisioning workflow.
 * The returned token must be shown to the customer once and never persisted.
 */
export async function generateTenantApiKey(cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.getRandomValues || !cryptoImpl?.subtle?.digest) {
    throw new Error("Secure Web Crypto is unavailable.");
  }
  const keyIdBytes = cryptoImpl.getRandomValues(new Uint8Array(12));
  const secretBytes = cryptoImpl.getRandomValues(new Uint8Array(32));
  const keyId = bytesToBase64Url(keyIdBytes);
  const secret = bytesToBase64Url(secretBytes);
  const token = `ef_live_${keyId}_${secret}`;
  return {
    keyId,
    token,
    keyHash: await hashApiKey(token, cryptoImpl),
  };
}

function failure(httpStatus, code, message, headers) {
  return { ok: false, httpStatus, code, message, ...(headers ? { headers } : {}) };
}

export async function authenticateRequest(
  request,
  env = {},
  { requiredScope = "tasks:fetch", now = () => new Date().toISOString() } = {},
) {
  const db = env?.EXPORTFLOW_AUTH_DB;
  if (!isD1Database(db)) {
    return failure(503, "AUTH_NOT_CONFIGURED", "Tenant API authentication is not configured.");
  }

  const header = request.headers.get("authorization");
  if (!header) {
    return failure(
      401,
      "UNAUTHORIZED",
      "Authorization Bearer token is required.",
      { "www-authenticate": 'Bearer realm="exportflow"' },
    );
  }
  if (header.length > 180) {
    return failure(
      401,
      "UNAUTHORIZED",
      "Authorization header exceeds the maximum supported length.",
      { "www-authenticate": 'Bearer realm="exportflow", error="invalid_request"' },
    );
  }

  const match = /^Bearer[ ]+([^ ]+)$/i.exec(header.trim());
  const token = match?.[1] || "";
  const parsed = API_KEY_PATTERN.exec(token);
  if (!parsed) {
    return failure(
      401,
      "UNAUTHORIZED",
      "A valid ExportFlow API key is required.",
      { "www-authenticate": 'Bearer realm="exportflow", error="invalid_token"' },
    );
  }

  let row;
  try {
    const keyHash = await hashApiKey(token);
    row = await db.prepare(AUTH_QUERY).bind(parsed[1], keyHash).first();
  } catch {
    return failure(503, "AUTH_BACKEND_UNAVAILABLE", "Tenant authentication storage is temporarily unavailable.");
  }

  if (!row || row.key_status !== "active") {
    return failure(
      401,
      "INVALID_TOKEN",
      "The provided API key is invalid or revoked.",
      { "www-authenticate": 'Bearer realm="exportflow", error="invalid_token"' },
    );
  }

  const currentTime = Date.parse(now());
  if (row.expires_at !== null && row.expires_at !== undefined) {
    const expiresAt = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresAt) || !Number.isFinite(currentTime) || expiresAt <= currentTime) {
      return failure(401, "API_KEY_EXPIRED", "The provided API key has expired.");
    }
  }

  if (row.tenant_status !== "active") {
    return failure(403, "TENANT_INACTIVE", "This tenant is not active.");
  }
  if (row.plan_status !== "active") {
    return failure(403, "PLAN_UNAVAILABLE", "The tenant's plan is not active.");
  }

  let scopes;
  try {
    scopes = JSON.parse(row.scopes_json);
  } catch {
    return failure(503, "AUTH_BACKEND_INVALID_RECORD", "Tenant authentication data is invalid.");
  }
  if (!Array.isArray(scopes) || scopes.some((scope) => typeof scope !== "string")) {
    return failure(503, "AUTH_BACKEND_INVALID_RECORD", "Tenant authentication data is invalid.");
  }
  if (requiredScope !== null && !scopes.includes(requiredScope) && !scopes.includes("tasks:*") && !scopes.includes("*")) {
    return failure(403, "INSUFFICIENT_SCOPE", "The API key does not have permission for this operation.");
  }

  const requestLimit = Number(row.request_limit);
  if (!Number.isSafeInteger(requestLimit) || requestLimit < 1 ||
      !["daily", "monthly"].includes(row.quota_period) ||
      typeof row.tenant_id !== "string" || typeof row.plan_code !== "string" ||
      typeof row.policy_version !== "string") {
    return failure(503, "AUTH_BACKEND_INVALID_RECORD", "The tenant plan configuration is invalid.");
  }

  return {
    ok: true,
    keyId: row.key_id,
    tenantId: row.tenant_id,
    planCode: row.plan_code,
    policyVersion: row.policy_version,
    quotaPeriod: row.quota_period,
    requestLimit,
    scopes,
  };
}
