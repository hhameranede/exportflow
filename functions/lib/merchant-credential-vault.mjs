import {
  ALGERIAN_CARRIER_IDS,
  sanitizeAlgerianProviderCredentials
} from "./algerian-carrier-connectors.mjs";

const TABLE = "merchant_provider_credentials";
const MAX_CREDENTIAL_BYTES = 8 * 1024;
const IV_BYTES = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const UPSERT_SQL = `INSERT INTO ${TABLE}
  (merchant_id, provider, key_id, iv, ciphertext, scope, consented_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 'track', ?, ?, ?)
  ON CONFLICT(merchant_id, provider) DO UPDATE SET
    key_id = excluded.key_id,
    iv = excluded.iv,
    ciphertext = excluded.ciphertext,
    scope = excluded.scope,
    consented_at = excluded.consented_at,
    updated_at = excluded.updated_at`;

const SELECT_SQL = `SELECT key_id, iv, ciphertext, scope, consented_at
  FROM ${TABLE} WHERE merchant_id = ? AND provider = ? LIMIT 1`;

const DELETE_SQL = `DELETE FROM ${TABLE}
  WHERE merchant_id = ? AND provider = ?`;

export class MerchantCredentialVaultError extends Error {
  constructor(code, provider = null) {
    super(code);
    this.name = "MerchantCredentialVaultError";
    this.code = code;
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

function decodeBase64(value, code = "invalid_key_config") {
  if (
    typeof value !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) throw new MerchantCredentialVaultError(code);
  let binary;
  try { binary = atob(value); } catch { throw new MerchantCredentialVaultError(code); }
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function validateContext(merchantId, provider) {
  if (typeof merchantId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(merchantId)) {
    throw new MerchantCredentialVaultError("invalid_merchant_context");
  }
  if (typeof provider !== "string") throw new MerchantCredentialVaultError("unsupported_provider");
  const normalized = provider.trim().toLowerCase();
  if (!ALGERIAN_CARRIER_IDS.includes(normalized)) {
    throw new MerchantCredentialVaultError("unsupported_provider");
  }
  return { merchantId, provider: normalized };
}

function timestamp(clock) {
  let value;
  try { value = clock(); } catch { throw new MerchantCredentialVaultError("clock_unavailable"); }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new MerchantCredentialVaultError("clock_unavailable");
  return date.toISOString();
}

function createKeyRing(keys, activeKeyId) {
  if (!isPlainObject(keys) || typeof activeKeyId !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(activeKeyId)) {
    throw new TypeError("A key ring and valid activeKeyId are required");
  }
  const ring = new Map();
  for (const [id, encoded] of Object.entries(keys)) {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(id)) throw new TypeError("Invalid credential encryption key ID");
    const raw = decodeBase64(encoded);
    if (raw.byteLength !== 32) throw new TypeError("Credential encryption keys must be 32 bytes");
    ring.set(id, raw);
  }
  if (!ring.has(activeKeyId)) throw new TypeError("The active credential encryption key is missing");
  return ring;
}

function aad(context, keyId) {
  return encoder.encode(`exportflow:merchant-credentials:v1:${context.merchantId}:${context.provider}:track:${keyId}`);
}

/**
 * D1-backed envelope encryption for merchant carrier credentials.
 * The caller MUST derive merchantId from a verified server-side session.
 * The authorization callback must enforce connection ownership and operation scope.
 */
export function createMerchantCredentialVault({
  db,
  keys,
  activeKeyId,
  authorizeMerchantProvider,
  clock = () => new Date(),
  crypto: cryptoApi = globalThis.crypto
} = {}) {
  if (!db || typeof db.prepare !== "function") throw new TypeError("A Cloudflare D1-compatible binding is required");
  if (typeof authorizeMerchantProvider !== "function") throw new TypeError("authorizeMerchantProvider must be a function");
  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== "function") {
    throw new TypeError("Web Crypto AES-GCM support is required");
  }

  const keyRing = createKeyRing(keys, activeKeyId);
  const imported = new Map();

  async function cryptoKey(keyId, usage) {
    const raw = keyRing.get(keyId);
    if (!raw) throw new MerchantCredentialVaultError("encryption_key_unavailable");
    const cacheId = keyId + ":" + usage;
    if (!imported.has(cacheId)) {
      imported.set(cacheId, cryptoApi.subtle.importKey(
        "raw", raw, { name: "AES-GCM" }, false, [usage]
      ));
    }
    return imported.get(cacheId);
  }

  async function authorize(context, operation) {
    let permitted = false;
    try {
      permitted = await authorizeMerchantProvider({
        merchantId: context.merchantId,
        provider: context.provider,
        operation
      });
    } catch {
      throw new MerchantCredentialVaultError("authorization_unavailable", context.provider);
    }
    if (permitted !== true) throw new MerchantCredentialVaultError("forbidden", context.provider);
  }

  async function queryRow(context) {
    try {
      return await db.prepare(SELECT_SQL).bind(context.merchantId, context.provider).first();
    } catch {
      throw new MerchantCredentialVaultError("vault_unavailable", context.provider);
    }
  }

  async function encrypt(context, credentials, keyId) {
    const iv = cryptoApi.getRandomValues(new Uint8Array(IV_BYTES));
    const plaintext = encoder.encode(JSON.stringify(credentials));
    const key = await cryptoKey(keyId, "encrypt");
    const encrypted = await cryptoApi.subtle.encrypt({
      name: "AES-GCM", iv, additionalData: aad(context, keyId), tagLength: 128
    }, key, plaintext);
    return {
      keyId,
      iv: encodeBase64(iv),
      ciphertext: encodeBase64(new Uint8Array(encrypted))
    };
  }

  async function decrypt(context, row) {
    if (
      !row || row.scope !== "track" || typeof row.consented_at !== "string" || !row.consented_at ||
      typeof row.key_id !== "string" || typeof row.iv !== "string" || typeof row.ciphertext !== "string"
    ) throw new MerchantCredentialVaultError("invalid_vault_record", context.provider);

    const iv = decodeBase64(row.iv, "invalid_vault_record");
    const ciphertext = decodeBase64(row.ciphertext, "invalid_vault_record");
    if (iv.byteLength !== IV_BYTES || ciphertext.byteLength < 17 || ciphertext.byteLength > MAX_CREDENTIAL_BYTES + 64) {
      throw new MerchantCredentialVaultError("invalid_vault_record", context.provider);
    }

    try {
      const key = await cryptoKey(row.key_id, "decrypt");
      const plaintext = await cryptoApi.subtle.decrypt({
        name: "AES-GCM",
        iv,
        additionalData: aad(context, row.key_id),
        tagLength: 128
      }, key, ciphertext);
      return sanitizeAlgerianProviderCredentials(context.provider, JSON.parse(decoder.decode(plaintext)));
    } catch {
      throw new MerchantCredentialVaultError("credential_decryption_failed", context.provider);
    }
  }

  return Object.freeze({
    async save({ merchantId, provider, credentials, consent } = {}) {
      const context = validateContext(merchantId, provider);
      if (consent !== true) throw new MerchantCredentialVaultError("consent_required", context.provider);
      await authorize(context, "connect");

      let safe;
      try { safe = sanitizeAlgerianProviderCredentials(context.provider, credentials); }
      catch { throw new MerchantCredentialVaultError("invalid_credentials", context.provider); }

      if (encoder.encode(JSON.stringify(safe)).byteLength > MAX_CREDENTIAL_BYTES) {
        throw new MerchantCredentialVaultError("credentials_too_large", context.provider);
      }

      const now = timestamp(clock);
      const sealed = await encrypt(context, safe, activeKeyId);
      try {
        await db.prepare(UPSERT_SQL).bind(
          context.merchantId, context.provider, sealed.keyId, sealed.iv, sealed.ciphertext,
          now, now, now
        ).run();
      } catch {
        throw new MerchantCredentialVaultError("vault_unavailable", context.provider);
      }
      return { provider: context.provider, connected: true, scope: "track", consentedAt: now, updatedAt: now };
    },

    async resolveCredentials({ merchantId, provider } = {}) {
      const context = validateContext(merchantId, provider);
      await authorize(context, "track");
      const row = await queryRow(context);
      return row ? decrypt(context, row) : null;
    },

    async revoke({ merchantId, provider } = {}) {
      const context = validateContext(merchantId, provider);
      await authorize(context, "disconnect");
      try {
        const result = await db.prepare(DELETE_SQL).bind(context.merchantId, context.provider).run();
        return { provider: context.provider, revoked: Number(result?.meta?.changes || 0) > 0 };
      } catch {
        throw new MerchantCredentialVaultError("vault_unavailable", context.provider);
      }
    }
  });
}
