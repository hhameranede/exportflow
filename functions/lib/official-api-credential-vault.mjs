import { resolveMerchantSession, MerchantIdentityError } from "./merchant-identity.mjs";

const TABLE = "merchant_official_api_credentials";
const MAX_CREDENTIAL_BYTES = 8 * 1024;
const IV_BYTES = 12;
const ALLOWED_OPERATIONS = new Set(["connect", "sandbox_track", "disconnect"]);
const PROVIDERS = Object.freeze({
  fedex: Object.freeze(["apiKey", "apiSecret"]),
  ups: Object.freeze(["clientId", "clientSecret"])
});
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const UPSERT_SQL = `INSERT INTO ${TABLE}
  (merchant_id, provider, key_id, iv, ciphertext, scope, consented_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 'sandbox_track', ?, ?, ?)
  ON CONFLICT(merchant_id, provider) DO UPDATE SET
    key_id = excluded.key_id, iv = excluded.iv, ciphertext = excluded.ciphertext,
    scope = excluded.scope, consented_at = excluded.consented_at, updated_at = excluded.updated_at`;
const SELECT_SQL = `SELECT key_id, iv, ciphertext, scope, consented_at
  FROM ${TABLE} WHERE merchant_id = ? AND provider = ? LIMIT 1`;
const DELETE_SQL = `DELETE FROM ${TABLE} WHERE merchant_id = ? AND provider = ?`;

export class OfficialApiCredentialVaultError extends Error {
  constructor(code, status = 503, provider = null) {
    super(code);
    this.name = "OfficialApiCredentialVaultError";
    this.code = code;
    this.status = status;
    this.provider = provider;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function encodeBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value) {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new OfficialApiCredentialVaultError("invalid_vault_record");
  }
  let binary;
  try { binary = atob(value); } catch { throw new OfficialApiCredentialVaultError("invalid_vault_record"); }
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function contextOf(merchantId, provider) {
  if (typeof merchantId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(merchantId)) {
    throw new OfficialApiCredentialVaultError("invalid_merchant_context", 400);
  }
  if (typeof provider !== "string" || !Object.hasOwn(PROVIDERS, provider.trim().toLowerCase())) {
    throw new OfficialApiCredentialVaultError("unsupported_provider", 400);
  }
  return { merchantId, provider: provider.trim().toLowerCase() };
}

export function sanitizeOfficialApiCredentials(provider, source) {
  const id = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  if (!Object.hasOwn(PROVIDERS, id)) throw new OfficialApiCredentialVaultError("unsupported_provider", 400);
  if (!isPlainObject(source)) throw new OfficialApiCredentialVaultError("invalid_credentials", 400, id);

  const output = {};
  for (const field of PROVIDERS[id]) {
    const descriptor = Object.getOwnPropertyDescriptor(source, field);
    if (!descriptor || !Object.hasOwn(descriptor, "value") || typeof descriptor.value !== "string") {
      throw new OfficialApiCredentialVaultError("invalid_credentials", 400, id);
    }
    const value = descriptor.value.trim();
    if (!value || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new OfficialApiCredentialVaultError("invalid_credentials", 400, id);
    }
    output[field] = value;
  }
  return Object.freeze(output);
}

function readKeyRing(env) {
  const serialized = env?.MERCHANT_CREDENTIAL_KEYRING_JSON;
  if (typeof serialized !== "string" || serialized.length > 16_384) {
    throw new OfficialApiCredentialVaultError("credential_vault_not_configured");
  }
  let parsed;
  try { parsed = JSON.parse(serialized); } catch {
    throw new OfficialApiCredentialVaultError("credential_vault_not_configured");
  }
  if (!isPlainObject(parsed) ||
      Object.keys(parsed).sort().join(",") !== "activeKeyId,keys" ||
      !isPlainObject(parsed.keys) ||
      typeof parsed.activeKeyId !== "string") {
    throw new OfficialApiCredentialVaultError("credential_vault_not_configured");
  }
  return { keys: parsed.keys, activeKeyId: parsed.activeKeyId };
}

function createKeyRing(keys, activeKeyId) {
  if (!isPlainObject(keys) || typeof activeKeyId !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(activeKeyId)) {
    throw new OfficialApiCredentialVaultError("credential_vault_not_configured");
  }
  const ring = new Map();
  for (const [id, encoded] of Object.entries(keys)) {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(id)) throw new OfficialApiCredentialVaultError("credential_vault_not_configured");
    const raw = decodeBase64(encoded);
    if (raw.byteLength !== 32) throw new OfficialApiCredentialVaultError("credential_vault_not_configured");
    ring.set(id, raw);
  }
  if (!ring.has(activeKeyId)) throw new OfficialApiCredentialVaultError("credential_vault_not_configured");
  return ring;
}

function timestamp(clock) {
  let value;
  try { value = clock(); } catch { throw new OfficialApiCredentialVaultError("clock_unavailable"); }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new OfficialApiCredentialVaultError("clock_unavailable");
  return date.toISOString();
}

function aad(context, keyId) {
  return encoder.encode(`exportflow:merchant-official-api-credentials:v1:${context.merchantId}:${context.provider}:sandbox_track:${keyId}`);
}

export function createOfficialApiCredentialVault({
  db, keys, activeKeyId, authorizeMerchantProvider,
  clock = () => new Date(), crypto: cryptoApi = globalThis.crypto
} = {}) {
  if (!db || typeof db.prepare !== "function") throw new TypeError("A D1-compatible binding is required");
  if (typeof authorizeMerchantProvider !== "function") throw new TypeError("An authorization callback is required");
  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== "function") throw new TypeError("Web Crypto AES-GCM is required");

  const keyRing = createKeyRing(keys, activeKeyId);
  const imported = new Map();

  async function cryptoKey(keyId, usage) {
    const raw = keyRing.get(keyId);
    if (!raw) throw new OfficialApiCredentialVaultError("encryption_key_unavailable");
    const cacheKey = keyId + ":" + usage;
    if (!imported.has(cacheKey)) {
      imported.set(cacheKey, cryptoApi.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [usage]));
    }
    return imported.get(cacheKey);
  }

  async function authorize(context, operation) {
    let allowed = false;
    try {
      allowed = await authorizeMerchantProvider({ merchantId: context.merchantId, provider: context.provider, operation });
    } catch {
      throw new OfficialApiCredentialVaultError("authorization_unavailable", 503, context.provider);
    }
    if (allowed !== true) throw new OfficialApiCredentialVaultError("forbidden", 403, context.provider);
  }

  async function encrypt(context, credentials) {
    const iv = cryptoApi.getRandomValues(new Uint8Array(IV_BYTES));
    const keyId = activeKeyId;
    const plaintext = encoder.encode(JSON.stringify(credentials));
    const key = await cryptoKey(keyId, "encrypt");
    const ciphertext = await cryptoApi.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad(context, keyId), tagLength: 128 },
      key, plaintext
    );
    return { keyId, iv: encodeBase64(iv), ciphertext: encodeBase64(new Uint8Array(ciphertext)) };
  }

  async function decrypt(context, row) {
    if (!row || row.scope !== "sandbox_track" || !row.consented_at ||
        typeof row.key_id !== "string" || typeof row.iv !== "string" || typeof row.ciphertext !== "string") {
      throw new OfficialApiCredentialVaultError("invalid_vault_record", 503, context.provider);
    }
    const iv = decodeBase64(row.iv);
    const ciphertext = decodeBase64(row.ciphertext);
    if (iv.length !== IV_BYTES || ciphertext.length < 17 || ciphertext.length > MAX_CREDENTIAL_BYTES + 64) {
      throw new OfficialApiCredentialVaultError("invalid_vault_record", 503, context.provider);
    }
    try {
      const key = await cryptoKey(row.key_id, "decrypt");
      const plaintext = await cryptoApi.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: aad(context, row.key_id), tagLength: 128 },
        key, ciphertext
      );
      return sanitizeOfficialApiCredentials(context.provider, JSON.parse(decoder.decode(plaintext)));
    } catch {
      throw new OfficialApiCredentialVaultError("credential_decryption_failed", 503, context.provider);
    }
  }

  return Object.freeze({
    async save({ merchantId, provider, credentials, consent } = {}) {
      const context = contextOf(merchantId, provider);
      if (consent !== true) throw new OfficialApiCredentialVaultError("consent_required", 400, context.provider);
      await authorize(context, "connect");
      const safe = sanitizeOfficialApiCredentials(context.provider, credentials);
      if (encoder.encode(JSON.stringify(safe)).length > MAX_CREDENTIAL_BYTES) {
        throw new OfficialApiCredentialVaultError("credentials_too_large", 400, context.provider);
      }
      const now = timestamp(clock);
      const sealed = await encrypt(context, safe);
      try {
        await db.prepare(UPSERT_SQL).bind(
          context.merchantId, context.provider, sealed.keyId, sealed.iv, sealed.ciphertext, now, now, now
        ).run();
      } catch {
        throw new OfficialApiCredentialVaultError("vault_unavailable", 503, context.provider);
      }
      return { provider: context.provider, connected: true, scope: "sandbox_track", consentedAt: now, updatedAt: now };
    },

    async resolveCredentials({ merchantId, provider } = {}) {
      const context = contextOf(merchantId, provider);
      await authorize(context, "sandbox_track");
      let row;
      try { row = await db.prepare(SELECT_SQL).bind(context.merchantId, context.provider).first(); }
      catch { throw new OfficialApiCredentialVaultError("vault_unavailable", 503, context.provider); }
      return row ? decrypt(context, row) : null;
    },

    async revoke({ merchantId, provider } = {}) {
      const context = contextOf(merchantId, provider);
      await authorize(context, "disconnect");
      try {
        const result = await db.prepare(DELETE_SQL).bind(context.merchantId, context.provider).run();
        return { provider: context.provider, revoked: Number(result?.meta?.changes || 0) > 0 };
      } catch {
        throw new OfficialApiCredentialVaultError("vault_unavailable", 503, context.provider);
      }
    }
  });
}

export async function createSessionBoundOfficialApiCredentialVault(request, env, {
  cryptoApi = globalThis.crypto, now = () => Date.now()
} = {}) {
  if (!env?.MERCHANT_DB || typeof env.MERCHANT_DB.prepare !== "function") {
    throw new OfficialApiCredentialVaultError("merchant_auth_not_configured", 503);
  }
  let session;
  try {
    session = await resolveMerchantSession(request, env.MERCHANT_DB, { cryptoApi, now });
  } catch (error) {
    if (error instanceof MerchantIdentityError) {
      throw new OfficialApiCredentialVaultError(error.code, error.status);
    }
    throw new OfficialApiCredentialVaultError("merchant_auth_unavailable", 503);
  }
  if (!session) throw new OfficialApiCredentialVaultError("unauthenticated", 401);

  const { keys, activeKeyId } = readKeyRing(env);
  const merchantId = session.user.id;
  const vault = createOfficialApiCredentialVault({
    db: env.MERCHANT_DB, keys, activeKeyId, crypto: cryptoApi,
    authorizeMerchantProvider: async ({ merchantId: requested, operation }) =>
      requested === merchantId && ALLOWED_OPERATIONS.has(operation)
  });
  return Object.freeze({
    user: Object.freeze({ id: merchantId, email: session.user.email, displayName: session.user.displayName }),
    save: ({ provider, credentials, consent } = {}) => vault.save({ merchantId, provider, credentials, consent }),
    resolveCredentials: ({ provider } = {}) => vault.resolveCredentials({ merchantId, provider }),
    revoke: ({ provider } = {}) => vault.revoke({ merchantId, provider })
  });
}

export function officialApiCredentialVaultErrorResponse(error) {
  const recognized = error instanceof OfficialApiCredentialVaultError;
  const status = recognized ? error.status : 503;
  const code = recognized ? error.code : "credential_vault_unavailable";
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Pragma": "no-cache",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}
