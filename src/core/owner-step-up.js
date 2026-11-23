import { authorizePlatformOwner, getAuthInstance } from "./auth-app.js";
import { createRateLimiter } from "./auth.js";
import { getClientRateLimitKey } from "./client-rate-limit.js";
import { readBoundedJsonBody, TaskContractError } from "./task-contract.js";

export const OWNER_STEP_UP_PATH = "/api/v1/admin/step-up";
export const OWNER_STEP_UP_COOKIE = "__Host-exportflow-owner-step-up";

const PROOF_TTL_MS = 5 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 5;
const MAX_BODY_BYTES = 2_048;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const ATTEMPT_PREFIX = "exportflow:owner-step-up-attempt:";
const PROOF_PREFIX = "exportflow:owner-step-up-proof:";
const KEY_PURPOSE = "ExportFlow owner step-up proof signing key v1";
const encoder = new TextEncoder();

function resultResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "strict-transport-security": "max-age=63072000",
      ...headers,
    },
  });
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 4096 ||
      !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function getSigningKey(secret, cryptoImpl) {
  if (typeof secret !== "string" || secret.length < 32 ||
      !cryptoImpl?.subtle || typeof cryptoImpl.subtle.importKey !== "function") {
    throw new Error("Owner step-up signing is not configured.");
  }
  const root = await cryptoImpl.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const derived = await cryptoImpl.subtle.sign("HMAC", root, encoder.encode(KEY_PURPOSE));
  return cryptoImpl.subtle.importKey(
    "raw",
    derived,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signProof(payload, secret, cryptoImpl) {
  const key = await getSigningKey(secret, cryptoImpl);
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await cryptoImpl.subtle.sign("HMAC", key, encoder.encode(body));
  return body + "." + base64UrlEncode(new Uint8Array(signature));
}

async function verifyProof(token, secret, cryptoImpl, nowMs) {
  if (typeof token !== "string" || token.length > 4096) return null;
  const pieces = token.split(".");
  if (pieces.length !== 2) return null;
  const signature = base64UrlDecode(pieces[1]);
  const payloadBytes = base64UrlDecode(pieces[0]);
  if (!signature || !payloadBytes) return null;
  // Reject non-canonical Base64URL spellings. The last character can contain
  // unused padding bits; alternate spellings must not alias the same proof.
  if (base64UrlEncode(signature) !== pieces[1] ||
      base64UrlEncode(payloadBytes) !== pieces[0]) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }

  if (!payload || payload.v !== 1 ||
      typeof payload.sub !== "string" || payload.sub.length < 1 || payload.sub.length > 128 ||
      typeof payload.sid !== "string" || payload.sid.length < 1 || payload.sid.length > 128 ||
      typeof payload.jti !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.jti) ||
      !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) ||
      payload.exp <= nowMs || payload.iat > nowMs + 60_000 ||
      payload.exp <= payload.iat || payload.exp - payload.iat > PROOF_TTL_MS) {
    return null;
  }

  try {
    const key = await getSigningKey(secret, cryptoImpl);
    const valid = await cryptoImpl.subtle.verify("HMAC", key, signature, encoder.encode(pieces[0]));
    return valid ? payload : null;
  } catch {
    return null;
  }
}

function readStepUpCookie(request) {
  const cookieHeader = request?.headers?.get("cookie");
  if (typeof cookieHeader !== "string" || cookieHeader.length > 8192) return null;
  const prefix = OWNER_STEP_UP_COOKIE + "=";
  const matches = cookieHeader.split(";").map((part) => part.trim()).filter((part) => part.startsWith(prefix));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(prefix.length);
  return value.length > 0 && value.length <= 4096 ? value : null;
}

function changesFrom(result) {
  const value = Number(result?.meta?.changes ?? result?.changes);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function errorCode(error) {
  const values = [error?.body?.code, error?.code, error?.cause?.code, error?.message];
  return values.find((value) => typeof value === "string" && value.length > 0) || "";
}

function cookieHeader(token) {
  return OWNER_STEP_UP_COOKIE + "=" + token +
    "; Path=/; Max-Age=" + Math.floor(PROOF_TTL_MS / 1000) +
    "; Secure; HttpOnly; SameSite=Strict";
}

function clearCookieHeader() {
  return OWNER_STEP_UP_COOKIE + "=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict";
}

/**
 * Owner step-up uses Better Auth's TOTP verifier, but adds its own durable
 * per-account attempt budget because Better Auth's existing-session TOTP
 * re-verification path does not apply its sign-in brute-force lockout.
 *
 * The one-use proof is signed with a domain-separated key derived from
 * BETTER_AUTH_SECRET and backed by a row in Better Auth's verification table.
 */
export function createOwnerStepUpService({
  authFactory = getAuthInstance,
  cryptoImpl = globalThis.crypto,
  now = () => Date.now(),
} = {}) {
  if (typeof authFactory !== "function" || typeof now !== "function" ||
      typeof cryptoImpl?.randomUUID !== "function" || typeof cryptoImpl?.subtle?.sign !== "function") {
    throw new TypeError("Owner step-up requires an auth factory, clock and Web Crypto implementation.");
  }

  async function removeAttempt(authDb, attemptId, identifier) {
    await authDb.prepare(
      "DELETE FROM verification WHERE id = ?1 AND identifier = ?2",
    ).bind(attemptId, identifier).run();
  }

  async function verifyCode(request, env, owner, code) {
    if (!owner || owner.allowed !== true || typeof owner.actorId !== "string" ||
        typeof owner.sessionId !== "string" || owner.sessionId.length < 1) {
      return { allowed: false, error: "OWNER_SESSION_REQUIRED", status: 403 };
    }
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return { allowed: false, error: "INVALID_TOTP_CODE", status: 400 };
    }

    const authDb = env?.AUTH_DB;
    if (!authDb || typeof authDb.prepare !== "function" || typeof authDb.batch !== "function") {
      return { allowed: false, error: "OWNER_MFA_STORAGE_UNAVAILABLE", status: 503 };
    }

    const nowMs = Number(now());
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
      return { allowed: false, error: "OWNER_MFA_CLOCK_UNAVAILABLE", status: 503 };
    }
    const nowIso = new Date(nowMs).toISOString();
    const attemptExpiry = new Date(nowMs + ATTEMPT_WINDOW_MS).toISOString();
    const attemptIdentifier = ATTEMPT_PREFIX + owner.actorId;
    const proofIdentifier = PROOF_PREFIX + owner.actorId;
    const attemptNonce = cryptoImpl.randomUUID();
    const attemptId = "ef-owner-step-up-attempt-" + attemptNonce;

    let factor;
    try {
      factor = await authDb.prepare(
        "SELECT u.twoFactorEnabled AS twoFactorEnabled, tf.verified AS factorVerified " +
        "FROM user AS u LEFT JOIN twoFactor AS tf ON tf.userId = u.id " +
        "WHERE u.id = ?1 AND u.emailVerified = 1 LIMIT 1",
      ).bind(owner.actorId).first();
    } catch {
      return { allowed: false, error: "OWNER_MFA_STORAGE_UNAVAILABLE", status: 503 };
    }
    if (!factor || Number(factor.twoFactorEnabled) !== 1 || Number(factor.factorVerified) !== 1) {
      return { allowed: false, error: "OWNER_MFA_REQUIRED", status: 403 };
    }

    let reservation;
    try {
      reservation = await authDb.prepare(
        "INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt) " +
        "SELECT ?1, ?2, ?3, ?4, ?5, ?5 " +
        "WHERE (SELECT COUNT(*) FROM verification WHERE identifier = ?2 AND expiresAt > ?5) < ?6",
      ).bind(
        attemptId,
        attemptIdentifier,
        "pending:" + attemptNonce,
        attemptExpiry,
        nowIso,
        MAX_ATTEMPTS_PER_WINDOW,
      ).run();
    } catch {
      return { allowed: false, error: "OWNER_MFA_STORAGE_UNAVAILABLE", status: 503 };
    }
    if (changesFrom(reservation) !== 1) {
      return { allowed: false, error: "OWNER_MFA_RATE_LIMITED", status: 429 };
    }

    let verified;
    try {
      const auth = authFactory(env);
      if (typeof auth?.api?.verifyTOTP !== "function") {
        await removeAttempt(authDb, attemptId, attemptIdentifier);
        return { allowed: false, error: "OWNER_MFA_NOT_CONFIGURED", status: 503 };
      }
      verified = await auth.api.verifyTOTP({
        headers: request.headers,
        body: { code, trustDevice: false },
      });
    } catch (error) {
      const codeFromAuth = errorCode(error);
      if (codeFromAuth === "INVALID_CODE" || codeFromAuth.includes("INVALID_CODE")) {
        try {
          const updated = await authDb.prepare(
            "UPDATE verification SET value = ?1, updatedAt = ?2 WHERE id = ?3 AND identifier = ?4",
          ).bind("failed:" + attemptNonce, nowIso, attemptId, attemptIdentifier).run();
          if (changesFrom(updated) !== 1) {
            return { allowed: false, error: "OWNER_MFA_STORAGE_UNAVAILABLE", status: 503 };
          }
        } catch {
          return { allowed: false, error: "OWNER_MFA_STORAGE_UNAVAILABLE", status: 503 };
        }
        return { allowed: false, error: "INVALID_TOTP_CODE", status: 401 };
      }
      try { await removeAttempt(authDb, attemptId, attemptIdentifier); } catch {}
      return { allowed: false, error: "OWNER_MFA_VERIFICATION_UNAVAILABLE", status: 503 };
    }

    if (verified?.user?.id !== owner.actorId ||
        typeof verified?.token !== "string" || verified.token.length < 1) {
      try { await removeAttempt(authDb, attemptId, attemptIdentifier); } catch {}
      return { allowed: false, error: "OWNER_MFA_VERIFICATION_UNAVAILABLE", status: 503 };
    }

    const proofNonce = cryptoImpl.randomUUID();
    const proofExpiryMs = nowMs + PROOF_TTL_MS;
    const proofExpiry = new Date(proofExpiryMs).toISOString();
    let token;
    try {
      token = await signProof({
        v: 1,
        sub: owner.actorId,
        sid: owner.sessionId,
        jti: proofNonce,
        iat: nowMs,
        exp: proofExpiryMs,
      }, env.BETTER_AUTH_SECRET, cryptoImpl);
    } catch {
      try { await removeAttempt(authDb, attemptId, attemptIdentifier); } catch {}
      return { allowed: false, error: "OWNER_MFA_SIGNING_UNAVAILABLE", status: 503 };
    }

    try {
      await authDb.batch([
        authDb.prepare(
          "DELETE FROM verification WHERE identifier = ?1 AND value LIKE 'failed:%'",
        ).bind(attemptIdentifier),
        authDb.prepare(
          "DELETE FROM verification WHERE id = ?1 AND identifier = ?2",
        ).bind(attemptId, attemptIdentifier),
        authDb.prepare(
          "INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt) " +
          "VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        ).bind(
          "ef-owner-step-up-proof-" + proofNonce,
          proofIdentifier,
          proofNonce,
          proofExpiry,
          nowIso,
        ),
      ]);
    } catch {
      // D1 batch() rolls back every statement when any statement fails. That
      // rollback restores this request's pending reservation, so remove it
      // separately to avoid consuming an attempt for an infrastructure error.
      try { await removeAttempt(authDb, attemptId, attemptIdentifier); } catch {}
      return { allowed: false, error: "OWNER_MFA_STORAGE_UNAVAILABLE", status: 503 };
    }

    return { allowed: true, token, expiresAt: proofExpiry };
  }

  async function consumeProof(request, env, owner) {
    if (!owner || owner.allowed !== true || typeof owner.actorId !== "string" ||
        typeof owner.sessionId !== "string" || owner.sessionId.length < 1) {
      return { allowed: false };
    }
    const token = readStepUpCookie(request);
    if (!token || typeof env?.BETTER_AUTH_SECRET !== "string") return { allowed: false };

    const nowMs = Number(now());
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) return { allowed: false, unavailable: true };

    const payload = await verifyProof(token, env.BETTER_AUTH_SECRET, cryptoImpl, nowMs);
    if (!payload || payload.sub !== owner.actorId || payload.sid !== owner.sessionId) {
      return { allowed: false };
    }
    const authDb = env.AUTH_DB;
    if (!authDb || typeof authDb.prepare !== "function") {
      return { allowed: false, unavailable: true };
    }
    try {
      const deleted = await authDb.prepare(
        "DELETE FROM verification " +
        "WHERE identifier = ?1 AND value = ?2 AND expiresAt > ?3 " +
        "AND EXISTS (" +
        "SELECT 1 FROM session WHERE id = ?4 AND userId = ?5 AND expiresAt > ?3" +
        ")",
      ).bind(
        PROOF_PREFIX + owner.actorId,
        payload.jti,
        new Date(nowMs).toISOString(),
        owner.sessionId,
        owner.actorId,
      ).run();
      return { allowed: changesFrom(deleted) === 1 };
    } catch {
      return { allowed: false, unavailable: true };
    }
  }

  return Object.freeze({ verifyCode, consumeProof });
}

const defaultService = createOwnerStepUpService();

export function createOwnerStepUpHttpHandler({
  authorizeOwner = authorizePlatformOwner,
  verifyCode = defaultService.verifyCode,
  rateLimiter = createRateLimiter({
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
  }),
} = {}) {
  if (typeof authorizeOwner !== "function" || typeof verifyCode !== "function" ||
      !rateLimiter || typeof rateLimiter.check !== "function") {
    throw new TypeError("Owner step-up handler dependencies are invalid.");
  }

  return async function handleOwnerStepUpRequest(request, env = {}) {
    const url = new URL(request.url);
    if (url.pathname !== OWNER_STEP_UP_PATH) return null;
    if (request.method !== "POST") {
      return resultResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "POST is required." } }, 405);
    }

    let rate;
    try {
      rate = rateLimiter.check(getClientRateLimitKey(request));
    } catch {
      return resultResponse({ error: { code: "OWNER_MFA_RATE_LIMIT_UNAVAILABLE", message: "Owner verification protection is temporarily unavailable." } }, 503);
    }
    if (!rate?.allowed) {
      return resultResponse(
        { error: { code: "OWNER_MFA_RATE_LIMITED", message: "Too many verification requests; retry later." } },
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
        owner.actorId.trim().length < 1 || owner.actorId.length > 128 ||
        typeof owner.sessionId !== "string" || owner.sessionId.length < 1 || owner.sessionId.length > 128) {
      return resultResponse({ error: { code: "ADMIN_FORBIDDEN", message: "A fresh verified platform owner session is required." } }, 403);
    }

    let payload;
    try {
      payload = await readBoundedJsonBody(request, MAX_BODY_BYTES);
      if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
          Object.keys(payload).length !== 1 || Object.keys(payload)[0] !== "code" ||
          typeof payload.code !== "string" || !/^\d{6}$/.test(payload.code)) {
        return resultResponse({ error: { code: "INVALID_TOTP_CODE", message: "Enter the six-digit authenticator code." } }, 400);
      }
    } catch (error) {
      if (error instanceof TaskContractError) {
        return resultResponse({ error: { code: error.code, message: error.message } }, error.httpStatus);
      }
      return resultResponse({ error: { code: "INVALID_ADMIN_INPUT", message: "The verification request is invalid." } }, 400);
    }

    let outcome;
    try {
      outcome = await verifyCode(request, env, owner, payload.code);
    } catch {
      outcome = { allowed: false, error: "OWNER_MFA_VERIFICATION_UNAVAILABLE", status: 503 };
    }
    if (outcome?.allowed !== true || typeof outcome.token !== "string" || typeof outcome.expiresAt !== "string") {
      const status = [400, 401, 403, 429, 503].includes(outcome?.status) ? outcome.status : 503;
      const code = typeof outcome?.error === "string" ? outcome.error : "OWNER_MFA_VERIFICATION_UNAVAILABLE";
      return resultResponse(
        { error: { code, message: status === 401 ? "The authenticator code is invalid." : status === 429 ? "Too many verification attempts; try again later." : status === 403 ? "Enable and verify an authenticator app before using platform administration." : "Owner verification is temporarily unavailable." } },
        status,
        { "set-cookie": clearCookieHeader() },
      );
    }

    return resultResponse(
      { ok: true, expiresAt: outcome.expiresAt, singleUse: true },
      200,
      { "set-cookie": cookieHeader(outcome.token) },
    );
  };
}

export { clearCookieHeader as clearOwnerStepUpCookie };
