const SESSION_COOKIE = "__Host-exportflow_session";
const OAUTH_STATE_COOKIE = "__Host-ef-oauth-state";
const OAUTH_NONCE_COOKIE = "__Host-ef-oauth-nonce";
const OAUTH_VERIFIER_COOKIE = "__Host-ef-oauth-verifier";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const OAUTH_TTL_SECONDS = 10 * 60;
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";
const encoder = new TextEncoder();
let cachedGoogleJwks = null;
let cachedGoogleJwksUntil = 0;

export class MerchantIdentityError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = "MerchantIdentityError";
    this.code = code;
    this.status = status;
  }
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new MerchantIdentityError("invalid_identity_token", 401);
  }
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  let binary;
  try { binary = atob(padded); } catch { throw new MerchantIdentityError("invalid_identity_token", 401); }
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function jsonSegment(segment) {
  if (typeof segment !== "string" || segment.length > 16_384) {
    throw new MerchantIdentityError("invalid_identity_token", 401);
  }
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(segment)));
  } catch {
    throw new MerchantIdentityError("invalid_identity_token", 401);
  }
}

function randomToken(cryptoApi, bytes = 32) {
  return base64UrlEncode(cryptoApi.getRandomValues(new Uint8Array(bytes)));
}

async function sha256(value, cryptoApi) {
  return new Uint8Array(await cryptoApi.subtle.digest("SHA-256", encoder.encode(value)));
}

async function sha256Hex(value, cryptoApi) {
  return Array.from(await sha256(value, cryptoApi), byte => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function cookieValue(header, name) {
  const prefix = name + "=";
  for (const part of String(header || "").split(";")) {
    const entry = part.trim();
    if (!entry.startsWith(prefix)) continue;
    try { return decodeURIComponent(entry.slice(prefix.length)); } catch { return ""; }
  }
  return "";
}

function cookie(name, value, maxAge) {
  return name + "=" + encodeURIComponent(value) + "; Path=/; Max-Age=" + maxAge + "; Secure; HttpOnly; SameSite=Lax";
}

function clearOAuthCookies(headers) {
  for (const name of [OAUTH_STATE_COOKIE, OAUTH_NONCE_COOKIE, OAUTH_VERIFIER_COOKIE]) {
    headers.append("Set-Cookie", cookie(name, "", 0));
  }
}

function noStoreHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store, private",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra
  };
}

function appOrigin(env) {
  if (typeof env?.MERCHANT_APP_ORIGIN !== "string") {
    throw new MerchantIdentityError("merchant_auth_not_configured", 503);
  }
  let parsed;
  try { parsed = new URL(env.MERCHANT_APP_ORIGIN); } catch {
    throw new MerchantIdentityError("merchant_auth_not_configured", 503);
  }
  const localDevelopment = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if ((parsed.protocol !== "https:" && !localDevelopment) || parsed.origin !== env.MERCHANT_APP_ORIGIN) {
    throw new MerchantIdentityError("merchant_auth_not_configured", 503);
  }
  return parsed.origin;
}

function redirectUri(origin, env) {
  const expected = origin + "/api/merchant/auth/google/callback";
  if (env.GOOGLE_REDIRECT_URI && env.GOOGLE_REDIRECT_URI !== expected) {
    throw new MerchantIdentityError("merchant_auth_not_configured", 503);
  }
  return expected;
}

function sameOriginRequest(request, origin) {
  return request.headers.get("Origin") === origin;
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: noStoreHeaders({ "Content-Type": "application/json; charset=utf-8", ...headers })
  });
}

function authRedirect(origin, result) {
  const target = new URL("/merchant/", origin);
  target.searchParams.set("auth", result);
  return new Response(null, {
    status: 303,
    headers: noStoreHeaders({ Location: target.toString() })
  });
}

function identityFailureCode(error) {
  const allowed = new Set([
    "account_link_required",
    "identity_not_verified",
    "oauth_state_invalid",
    "provider_unavailable",
    "merchant_auth_not_configured"
  ]);
  return allowed.has(error?.code) ? error.code : "provider_unavailable";
}

async function loadGoogleJwks(fetchImpl, now, forceRefresh = false) {
  if (!forceRefresh && cachedGoogleJwks && now() < cachedGoogleJwksUntil) return cachedGoogleJwks;
  const response = await fetchImpl(GOOGLE_JWKS_ENDPOINT, {
    method: "GET",
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 300 }
  });
  if (!response.ok) throw new MerchantIdentityError("provider_unavailable", 503);
  const payload = await response.json();
  if (!Array.isArray(payload?.keys) || payload.keys.length === 0) {
    throw new MerchantIdentityError("provider_unavailable", 503);
  }
  const cacheControl = response.headers.get("Cache-Control") || "";
  const seconds = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 300);
  cachedGoogleJwks = payload.keys;
  cachedGoogleJwksUntil = now() + Math.max(60, Math.min(seconds, 3600)) * 1000;
  return cachedGoogleJwks;
}

async function verifyGoogleIdToken(idToken, {
  clientId,
  expectedNonce,
  cryptoApi,
  fetchImpl,
  now
}) {
  if (typeof idToken !== "string" || idToken.length > 16_384) {
    throw new MerchantIdentityError("invalid_identity_token", 401);
  }
  const segments = idToken.split(".");
  if (segments.length !== 3) throw new MerchantIdentityError("invalid_identity_token", 401);

  const header = jsonSegment(segments[0]);
  const claims = jsonSegment(segments[1]);
  if (header?.alg !== "RS256" || typeof header?.kid !== "string") {
    throw new MerchantIdentityError("invalid_identity_token", 401);
  }

  let jwks = await loadGoogleJwks(fetchImpl, now);
  let jwk = jwks.find(key => key.kid === header.kid && key.kty === "RSA" && (!key.alg || key.alg === "RS256"));
  if (!jwk) {
    jwks = await loadGoogleJwks(fetchImpl, now, true);
    jwk = jwks.find(key => key.kid === header.kid && key.kty === "RSA" && (!key.alg || key.alg === "RS256"));
  }
  if (!jwk) throw new MerchantIdentityError("invalid_identity_token", 401);

  let validSignature = false;
  try {
    const publicKey = await cryptoApi.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    validSignature = await cryptoApi.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      publicKey,
      base64UrlDecode(segments[2]),
      encoder.encode(segments[0] + "." + segments[1])
    );
  } catch {
    throw new MerchantIdentityError("invalid_identity_token", 401);
  }
  if (!validSignature) throw new MerchantIdentityError("invalid_identity_token", 401);

  const seconds = Math.floor(now() / 1000);
  const audienceMatches = claims.aud === clientId ||
    (Array.isArray(claims.aud) && claims.aud.includes(clientId));
  const issuerMatches = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const authorizedPartyMatches = !claims.azp || claims.azp === clientId;
  if (
    !issuerMatches ||
    !audienceMatches ||
    !authorizedPartyMatches ||
    typeof claims.sub !== "string" ||
    !/^[A-Za-z0-9_-]{1,255}$/.test(claims.sub) ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= seconds ||
    !Number.isFinite(claims.iat) ||
    claims.iat > seconds + 60 ||
    claims.iat < seconds - 600 ||
    !constantTimeEqual(claims.nonce, expectedNonce)
  ) {
    throw new MerchantIdentityError("invalid_identity_token", 401);
  }

  if (claims.email_verified !== true || typeof claims.email !== "string") {
    throw new MerchantIdentityError("identity_not_verified", 403);
  }
  const email = claims.email.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new MerchantIdentityError("identity_not_verified", 403);
  }
  const displayName = typeof claims.name === "string"
    ? claims.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120)
    : "";

  return {
    subject: claims.sub,
    email,
    displayName: displayName || email.split("@")[0]
  };
}

async function getOrCreateMerchant(db, identity, cryptoApi, timestamp) {
  const existing = await db.prepare(
    "SELECT id, email, display_name FROM merchant_users WHERE auth_provider = ? AND provider_subject = ? LIMIT 1"
  ).bind("google", identity.subject).first();

  if (existing) {
    await db.prepare(
      "UPDATE merchant_users SET display_name = ?, last_login_at = ?, updated_at = ? WHERE id = ?"
    ).bind(identity.displayName, timestamp, timestamp, existing.id).run();
    return { id: existing.id, email: existing.email, displayName: identity.displayName };
  }

  const emailOwner = await db.prepare(
    "SELECT id FROM merchant_users WHERE email_normalized = ? LIMIT 1"
  ).bind(identity.email).first();
  if (emailOwner) throw new MerchantIdentityError("account_link_required", 409);

  const userId = cryptoApi.randomUUID();
  try {
    await db.prepare(
      "INSERT INTO merchant_users (id, auth_provider, provider_subject, email, email_normalized, display_name, email_verified_at, created_at, updated_at, last_login_at, disabled_at) VALUES (?, 'google', ?, ?, ?, ?, ?, ?, ?, ?, NULL)"
    ).bind(
      userId,
      identity.subject,
      identity.email,
      identity.email,
      identity.displayName,
      timestamp,
      timestamp,
      timestamp,
      timestamp
    ).run();
    return { id: userId, email: identity.email, displayName: identity.displayName };
  } catch {
    // A concurrent first login may have inserted the same Google subject.
    const raced = await db.prepare(
      "SELECT id, email, display_name FROM merchant_users WHERE auth_provider = ? AND provider_subject = ? LIMIT 1"
    ).bind("google", identity.subject).first();
    if (raced) return { id: raced.id, email: raced.email, displayName: raced.display_name };
    throw new MerchantIdentityError("account_link_required", 409);
  }
}

function sessionCookie(token) {
  return cookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS);
}

export async function startGoogleOAuth(request, env, {
  cryptoApi = globalThis.crypto
} = {}) {
  const origin = appOrigin(env);
  if (!sameOriginRequest(request, origin)) throw new MerchantIdentityError("origin_forbidden", 403);
  if (request.method !== "POST") throw new MerchantIdentityError("method_not_allowed", 405);
  if (!env.GOOGLE_OAUTH_CLIENT_ID) throw new MerchantIdentityError("merchant_auth_not_configured", 503);

  const state = randomToken(cryptoApi);
  const nonce = randomToken(cryptoApi);
  const verifier = randomToken(cryptoApi, 48);
  const challenge = base64UrlEncode(await sha256(verifier, cryptoApi));
  const callback = redirectUri(origin, env);

  const authorization = new URL(GOOGLE_AUTH_ENDPOINT);
  authorization.searchParams.set("client_id", env.GOOGLE_OAUTH_CLIENT_ID);
  authorization.searchParams.set("redirect_uri", callback);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", "openid email profile");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("nonce", nonce);
  authorization.searchParams.set("code_challenge", challenge);
  authorization.searchParams.set("code_challenge_method", "S256");
  authorization.searchParams.set("prompt", "select_account");

  const headers = new Headers(noStoreHeaders({
    "Content-Type": "application/json; charset=utf-8"
  }));
  headers.append("Set-Cookie", cookie(OAUTH_STATE_COOKIE, state, OAUTH_TTL_SECONDS));
  headers.append("Set-Cookie", cookie(OAUTH_NONCE_COOKIE, nonce, OAUTH_TTL_SECONDS));
  headers.append("Set-Cookie", cookie(OAUTH_VERIFIER_COOKIE, verifier, OAUTH_TTL_SECONDS));
  return new Response(JSON.stringify({ authorizationUrl: authorization.toString() }), { status: 200, headers });
}

export async function finishGoogleOAuth(request, env, {
  cryptoApi = globalThis.crypto,
  fetchImpl = fetch,
  now = () => Date.now()
} = {}) {
  let origin;
  try { origin = appOrigin(env); } catch {
    return authRedirect("https://exportflow.me", "failed");
  }
  const fail = error => {
    const failureHeaders = new Headers(noStoreHeaders());
    clearOAuthCookies(failureHeaders);
    failureHeaders.set("Location", new URL("/merchant/?auth=failed-" + identityFailureCode(error), origin).toString());
    return new Response(null, { status: 303, headers: failureHeaders });
  };

  try {
    if (!env.MERCHANT_DB || typeof env.MERCHANT_DB.prepare !== "function" || typeof env.MERCHANT_DB.batch !== "function") {
      throw new MerchantIdentityError("merchant_auth_not_configured", 503);
    }
    if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
      throw new MerchantIdentityError("merchant_auth_not_configured", 503);
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const savedState = cookieValue(request.headers.get("Cookie"), OAUTH_STATE_COOKIE);
    const nonce = cookieValue(request.headers.get("Cookie"), OAUTH_NONCE_COOKIE);
    const verifier = cookieValue(request.headers.get("Cookie"), OAUTH_VERIFIER_COOKIE);
    if (
      url.searchParams.has("error") ||
      !code || code.length > 2048 ||
      !state || !constantTimeEqual(state, savedState) ||
      !nonce || !verifier
    ) {
      throw new MerchantIdentityError("oauth_state_invalid", 401);
    }

    const callback = redirectUri(origin, env);
    const tokenResponse = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        redirect_uri: callback,
        grant_type: "authorization_code",
        code_verifier: verifier
      })
    });
    if (!tokenResponse.ok) throw new MerchantIdentityError("provider_unavailable", 503);
    const tokenPayload = await tokenResponse.json();
    if (typeof tokenPayload?.id_token !== "string") {
      throw new MerchantIdentityError("provider_unavailable", 503);
    }

    const identity = await verifyGoogleIdToken(tokenPayload.id_token, {
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      expectedNonce: nonce,
      cryptoApi,
      fetchImpl,
      now
    });
    const timestamp = new Date(now()).toISOString();
    const user = await getOrCreateMerchant(env.MERCHANT_DB, identity, cryptoApi, timestamp);

    const token = randomToken(cryptoApi, 32);
    const tokenHash = await sha256Hex(token, cryptoApi);
    const sessionId = cryptoApi.randomUUID();
    const expiresAt = new Date(now() + SESSION_TTL_SECONDS * 1000).toISOString();
    const metadata = JSON.stringify({ provider: "google" });
    await env.MERCHANT_DB.batch([
      env.MERCHANT_DB.prepare(
        "INSERT INTO merchant_sessions (id, merchant_user_id, token_hash, created_at, expires_at, last_seen_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)"
      ).bind(sessionId, user.id, tokenHash, timestamp, expiresAt, timestamp),
      env.MERCHANT_DB.prepare(
        "INSERT INTO merchant_security_events (id, merchant_user_id, event_type, created_at, metadata_json) VALUES (?, ?, 'merchant.session.created', ?, ?)"
      ).bind(cryptoApi.randomUUID(), user.id, timestamp, metadata)
    ]);

    const successHeaders = new Headers(noStoreHeaders());
    successHeaders.append("Set-Cookie", sessionCookie(token));
    clearOAuthCookies(successHeaders);
    const target = new URL("/merchant/", origin);
    target.searchParams.set("auth", "success");
    successHeaders.set("Location", target.toString());
    return new Response(null, { status: 303, headers: successHeaders });
  } catch (error) {
    return fail(error);
  }
}

export async function resolveMerchantSession(request, db, {
  cryptoApi = globalThis.crypto,
  now = () => Date.now()
} = {}) {
  if (!db || typeof db.prepare !== "function") {
    throw new MerchantIdentityError("merchant_auth_not_configured", 503);
  }
  const token = cookieValue(request.headers.get("Cookie"), SESSION_COOKIE);
  if (!token || token.length < 32 || token.length > 128) return null;
  const tokenHash = await sha256Hex(token, cryptoApi);
  const timestamp = new Date(now()).toISOString();
  const row = await db.prepare(
    "SELECT s.id AS session_id, u.id AS merchant_id, u.email, u.display_name FROM merchant_sessions s INNER JOIN merchant_users u ON u.id = s.merchant_user_id WHERE s.token_hash = ? AND s.expires_at > ? AND s.revoked_at IS NULL AND u.disabled_at IS NULL LIMIT 1"
  ).bind(tokenHash, timestamp).first();
  if (!row) return null;
  return {
    sessionId: row.session_id,
    user: { id: row.merchant_id, email: row.email, displayName: row.display_name }
  };
}

export async function merchantSessionResponse(request, env, dependencies = {}) {
  try {
    const session = await resolveMerchantSession(request, env.MERCHANT_DB, dependencies);
    if (!session) return jsonResponse({ authenticated: false }, 401);
    return jsonResponse({ authenticated: true, user: session.user });
  } catch (error) {
    const status = error instanceof MerchantIdentityError ? error.status : 503;
    const code = error instanceof MerchantIdentityError ? error.code : "merchant_auth_unavailable";
    return jsonResponse({ error: code }, status);
  }
}

export async function revokeMerchantSession(request, env, {
  cryptoApi = globalThis.crypto,
  now = () => Date.now()
} = {}) {
  let origin;
  try { origin = appOrigin(env); } catch {
    return jsonResponse({ error: "merchant_auth_not_configured" }, 503);
  }
  if (!sameOriginRequest(request, origin)) return jsonResponse({ error: "origin_forbidden" }, 403);

  const headers = new Headers(noStoreHeaders({ "Content-Type": "application/json; charset=utf-8" }));
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
  try {
    const session = await resolveMerchantSession(request, env.MERCHANT_DB, { cryptoApi, now });
    if (session) {
      const timestamp = new Date(now()).toISOString();
      await env.MERCHANT_DB.batch([
        env.MERCHANT_DB.prepare(
          "UPDATE merchant_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL"
        ).bind(timestamp, session.sessionId),
        env.MERCHANT_DB.prepare(
          "INSERT INTO merchant_security_events (id, merchant_user_id, event_type, created_at, metadata_json) VALUES (?, ?, 'merchant.session.revoked', ?, ?)"
        ).bind(cryptoApi.randomUUID(), session.user.id, timestamp, JSON.stringify({ reason: "user_logout" }))
      ]);
    }
    return new Response(JSON.stringify({ authenticated: false }), { status: 200, headers });
  } catch {
    return jsonResponse({ error: "merchant_auth_unavailable" }, 503);
  }
}

export function merchantIdentityErrorResponse(error) {
  const status = error instanceof MerchantIdentityError ? error.status : 500;
  const code = error instanceof MerchantIdentityError ? error.code : "merchant_auth_unavailable";
  return jsonResponse({ error: code }, status);
}

export const MERCHANT_SESSION_COOKIE_NAME = SESSION_COOKIE;
