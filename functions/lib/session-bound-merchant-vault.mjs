import { resolveMerchantSession, MerchantIdentityError } from "./merchant-identity.mjs";
import {
  createMerchantCredentialVault,
  MerchantCredentialVaultError
} from "./merchant-credential-vault.mjs";

const ALLOWED_OPERATIONS = new Set(["connect", "track", "disconnect"]);
const ALLOWED_FIELDS = ["activeKeyId", "keys"];

export class SessionBoundMerchantVaultError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.name = "SessionBoundMerchantVaultError";
    this.code = code;
    this.status = status;
  }
}

function readKeyRing(env) {
  const serialized = env?.MERCHANT_CREDENTIAL_KEYRING_JSON;
  if (typeof serialized !== "string" || serialized.length > 16_384) {
    throw new SessionBoundMerchantVaultError("credential_vault_not_configured", 503);
  }

  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new SessionBoundMerchantVaultError("credential_vault_not_configured", 503);
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).sort().join(",") !== ALLOWED_FIELDS.slice().sort().join(",") ||
    !parsed.keys ||
    typeof parsed.keys !== "object" ||
    Array.isArray(parsed.keys) ||
    typeof parsed.activeKeyId !== "string"
  ) {
    throw new SessionBoundMerchantVaultError("credential_vault_not_configured", 503);
  }

  return { keys: parsed.keys, activeKeyId: parsed.activeKeyId };
}

/**
 * Bind every vault operation to the merchant resolved from a verified D1
 * session. The returned methods intentionally do not accept merchantId.
 *
 * Store MERCHANT_CREDENTIAL_KEYRING_JSON only as a Cloudflare encrypted
 * Pages secret. Its JSON shape is { "activeKeyId": "...", "keys": { "...": "<base64 32-byte key>" } }.
 */
export async function createSessionBoundMerchantCredentialVault(request, env, {
  cryptoApi = globalThis.crypto,
  now = () => Date.now()
} = {}) {
  if (!env?.MERCHANT_DB || typeof env.MERCHANT_DB.prepare !== "function") {
    throw new SessionBoundMerchantVaultError("merchant_auth_not_configured", 503);
  }

  let session;
  try {
    session = await resolveMerchantSession(request, env.MERCHANT_DB, { cryptoApi, now });
  } catch (error) {
    if (error instanceof MerchantIdentityError) {
      throw new SessionBoundMerchantVaultError(error.code, error.status);
    }
    throw new SessionBoundMerchantVaultError("merchant_auth_unavailable", 503);
  }

  if (!session) throw new SessionBoundMerchantVaultError("unauthenticated", 401);

  const { keys, activeKeyId } = readKeyRing(env);
  const trustedMerchantId = session.user.id;

  let vault;
  try {
    vault = createMerchantCredentialVault({
      db: env.MERCHANT_DB,
      keys,
      activeKeyId,
      crypto: cryptoApi,
      authorizeMerchantProvider: async ({ merchantId, operation }) =>
        merchantId === trustedMerchantId && ALLOWED_OPERATIONS.has(operation)
    });
  } catch {
    throw new SessionBoundMerchantVaultError("credential_vault_not_configured", 503);
  }

  return Object.freeze({
    user: Object.freeze({
      id: trustedMerchantId,
      email: session.user.email,
      displayName: session.user.displayName
    }),
    save({ provider, credentials, consent } = {}) {
      return vault.save({
        merchantId: trustedMerchantId,
        provider,
        credentials,
        consent
      });
    },
    resolveCredentials({ provider } = {}) {
      return vault.resolveCredentials({
        merchantId: trustedMerchantId,
        provider
      });
    },
    revoke({ provider } = {}) {
      return vault.revoke({
        merchantId: trustedMerchantId,
        provider
      });
    }
  });
}

export function sessionBoundVaultErrorResponse(error) {
  let status = 503;
  let code = "credential_vault_unavailable";

  if (error instanceof SessionBoundMerchantVaultError) {
    status = error.status;
    code = error.code;
  } else if (error instanceof MerchantCredentialVaultError) {
    const badRequest = new Set([
      "consent_required",
      "invalid_credentials",
      "credentials_too_large",
      "unsupported_provider",
      "unsupported_courier",
      "credentials_missing",
      "credentials_incomplete",
      "invalid_merchant_context"
    ]);
    status = badRequest.has(error.code) ? 400 : error.code === "forbidden" ? 403 : 503;
    code = error.code;
  }

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
