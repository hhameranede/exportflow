import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  startGoogleOAuth,
  finishGoogleOAuth,
  resolveMerchantSession,
  merchantSessionResponse,
  revokeMerchantSession
} from "../functions/lib/merchant-identity.mjs";

const encoder = new TextEncoder();
const CLIENT_ID = "exportflow-test-client.apps.googleusercontent.com";
const ORIGIN = "https://exportflow.me";
const NOW = Date.parse("2026-11-07T12:30:00.000Z");

function b64url(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return Buffer.from(bytes).toString("base64url");
}

function cookiesFrom(response) {
  if (typeof response.headers.getSetCookie === "function") return response.headers.getSetCookie();
  const header = response.headers.get("set-cookie") || "";
  return header.split(/, (?=__Host-)/);
}

function cookiePairs(headers) {
  return headers.map(header => {
    const [pair] = header.split(";");
    const index = pair.indexOf("=");
    return [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))];
  });
}

function cookieHeader(pairs) {
  return pairs.map(([name, value]) => name + "=" + encodeURIComponent(value)).join("; ");
}

function createFakeD1() {
  const users = new Map();
  const usersBySubject = new Map();
  const usersByEmail = new Map();
  const sessions = new Map();
  const events = [];

  function statement(sql, values = []) {
    return {
      bind(...bound) { return statement(sql, bound); },
      async first() {
        if (sql.includes("FROM merchant_users") && sql.includes("auth_provider = ?")) {
          const id = usersBySubject.get(values[0] + ":" + values[1]);
          return id ? users.get(id) : null;
        }
        if (sql.includes("FROM merchant_users") && sql.includes("email_normalized = ?")) {
          const id = usersByEmail.get(values[0]);
          return id ? { id } : null;
        }
        if (sql.includes("FROM merchant_sessions")) {
          const row = [...sessions.values()].find(session =>
            session.token_hash === values[0] &&
            session.expires_at > values[1] &&
            session.revoked_at === null
          );
          if (!row) return null;
          const user = users.get(row.merchant_user_id);
          if (!user || user.disabled_at !== null) return null;
          return {
            session_id: row.id,
            merchant_id: user.id,
            email: user.email,
            display_name: user.display_name
          };
        }
        throw new Error("Unexpected D1 first query: " + sql);
      },
      async run() {
        if (sql.startsWith("INSERT INTO merchant_users")) {
          const [id, subject, email, normalizedEmail, displayName, verifiedAt, createdAt, updatedAt, lastLoginAt] = values;
          const row = {
            id, auth_provider: "google", provider_subject: subject,
            email, email_normalized: normalizedEmail, display_name: displayName,
            email_verified_at: verifiedAt, created_at: createdAt,
            updated_at: updatedAt, last_login_at: lastLoginAt, disabled_at: null
          };
          users.set(id, row);
          usersBySubject.set("google:" + subject, id);
          usersByEmail.set(normalizedEmail, id);
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.startsWith("UPDATE merchant_users")) {
          const [displayName, lastLoginAt, updatedAt, id] = values;
          const row = users.get(id);
          if (!row) return { success: true, meta: { changes: 0 } };
          row.display_name = displayName;
          row.last_login_at = lastLoginAt;
          row.updated_at = updatedAt;
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.startsWith("INSERT INTO merchant_sessions")) {
          const [id, merchantUserId, tokenHash, createdAt, expiresAt, lastSeenAt] = values;
          sessions.set(id, {
            id, merchant_user_id: merchantUserId, token_hash: tokenHash,
            created_at: createdAt, expires_at: expiresAt,
            last_seen_at: lastSeenAt, revoked_at: null
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.startsWith("INSERT INTO merchant_security_events")) {
          const [id, merchantUserId, createdAt, metadataJson] = values;
          const eventType = sql.includes("'merchant.session.created'")
            ? "merchant.session.created"
            : "merchant.session.revoked";
          events.push({ id, merchant_user_id: merchantUserId, event_type: eventType, created_at: createdAt, metadata_json: metadataJson });
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.startsWith("UPDATE merchant_sessions")) {
          const [revokedAt, id] = values;
          const session = sessions.get(id);
          if (session && session.revoked_at === null) session.revoked_at = revokedAt;
          return { success: true, meta: { changes: session ? 1 : 0 } };
        }
        throw new Error("Unexpected D1 run query: " + sql);
      }
    };
  }

  return {
    users, sessions, events,
    prepare(sql) { return statement(sql); },
    async batch(statements) {
      const results = [];
      for (const item of statements) results.push(await item.run());
      return results;
    }
  };
}

async function signedGoogleIdToken(privateKey, nonce, overrides = {}) {
  const seconds = Math.floor(NOW / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: "exportflow-test-key" };
  const claims = {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    azp: CLIENT_ID,
    sub: "google-subject-001",
    email: "merchant@example.test",
    email_verified: true,
    name: "ExportFlow Merchant",
    nonce,
    iat: seconds,
    exp: seconds + 300,
    ...overrides
  };
  const encodedHeader = b64url(JSON.stringify(header));
  const encodedClaims = b64url(JSON.stringify(claims));
  const input = encodedHeader + "." + encodedClaims;
  const signature = await webcrypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    encoder.encode(input)
  );
  return input + "." + b64url(new Uint8Array(signature));
}

async function main() {
  const pair = await webcrypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["sign", "verify"]
  );
  const publicJwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  publicJwk.kid = "exportflow-test-key";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  const db = createFakeD1();
  const env = {
    MERCHANT_DB: db,
    MERCHANT_APP_ORIGIN: ORIGIN,
    GOOGLE_OAUTH_CLIENT_ID: CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: "test-only-oauth-secret"
  };
  const fetchImpl = async url => {
    const target = String(url);
    if (target === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ id_token: await signedGoogleIdToken(pair.privateKey, expectedNonce) }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (target === "https://www.googleapis.com/oauth2/v3/certs") {
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
      });
    }
    throw new Error("Unexpected outbound request");
  };

  let expectedNonce = "";
  const startRequest = new Request(ORIGIN + "/api/merchant/auth/google/start", {
    method: "POST",
    headers: { Origin: ORIGIN }
  });
  const startResponse = await startGoogleOAuth(startRequest, env, { cryptoApi: webcrypto });
  assert.equal(startResponse.status, 200);
  const startPayload = await startResponse.json();
  const authorizationUrl = new URL(startPayload.authorizationUrl);
  assert.equal(authorizationUrl.origin, "https://accounts.google.com");
  assert.equal(authorizationUrl.searchParams.get("client_id"), CLIENT_ID);
  assert.equal(authorizationUrl.searchParams.get("redirect_uri"), ORIGIN + "/api/merchant/auth/google/callback");
  assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorizationUrl.searchParams.get("response_type"), "code");

  const flowCookies = cookiePairs(cookiesFrom(startResponse));
  expectedNonce = flowCookies.find(([name]) => name === "__Host-ef-oauth-nonce")?.[1] || "";
  assert.ok(expectedNonce.length >= 40);
  for (const header of cookiesFrom(startResponse)) {
    assert.match(header, /Secure/);
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Lax/);
  }

  await assert.rejects(
    () => startGoogleOAuth(new Request(ORIGIN + "/api/merchant/auth/google/start", {
      method: "POST", headers: { Origin: "https://attacker.invalid" }
    }), env, { cryptoApi: webcrypto }),
    error => error.code === "origin_forbidden"
  );

  const state = flowCookies.find(([name]) => name === "__Host-ef-oauth-state")?.[1];
  const callbackRequest = new Request(
    ORIGIN + "/api/merchant/auth/google/callback?code=mock-auth-code&state=" + encodeURIComponent(state),
    { headers: { Cookie: cookieHeader(flowCookies) } }
  );
  const callbackResponse = await finishGoogleOAuth(callbackRequest, env, {
    cryptoApi: webcrypto,
    fetchImpl,
    now: () => NOW
  });
  assert.equal(callbackResponse.status, 303);
  assert.equal(callbackResponse.headers.get("location"), ORIGIN + "/merchant/?auth=success");
  const callbackCookies = cookiesFrom(callbackResponse);
  const sessionCookieHeader = callbackCookies.find(header => header.startsWith("__Host-exportflow_session="));
  assert.ok(sessionCookieHeader, "A new HttpOnly merchant session cookie must be issued");
  assert.match(sessionCookieHeader, /HttpOnly/);
  assert.match(sessionCookieHeader, /Secure/);
  assert.match(sessionCookieHeader, /SameSite=Lax/);
  const [sessionCookiePair] = cookiePairs([sessionCookieHeader]);
  const sessionToken = sessionCookiePair[1];
  assert.ok(sessionToken.length >= 40);

  assert.equal(db.users.size, 1);
  assert.equal(db.sessions.size, 1);
  assert.equal(db.events.length, 1);
  const savedSession = [...db.sessions.values()][0];
  assert.notEqual(savedSession.token_hash, sessionToken);
  assert.equal(savedSession.token_hash.length, 64);
  assert.equal(JSON.stringify(db.sessions).includes(sessionToken), false);
  assert.equal(JSON.stringify(db.users).includes("test-only-oauth-secret"), false);

  const sessionRequest = new Request(ORIGIN + "/api/merchant/session", {
    headers: { Cookie: cookieHeader([sessionCookiePair]) }
  });
  const resolved = await resolveMerchantSession(sessionRequest, db, {
    cryptoApi: webcrypto,
    now: () => NOW
  });
  assert.equal(resolved.user.email, "merchant@example.test");
  assert.equal(resolved.user.displayName, "ExportFlow Merchant");

  const sessionResponse = await merchantSessionResponse(sessionRequest, { MERCHANT_DB: db }, {
    cryptoApi: webcrypto,
    now: () => NOW
  });
  assert.equal(sessionResponse.status, 200);
  const sessionPayload = await sessionResponse.json();
  assert.equal(sessionPayload.authenticated, true);
  assert.equal(sessionPayload.user.id, resolved.user.id);

  const noSessionResponse = await merchantSessionResponse(
    new Request(ORIGIN + "/api/merchant/session"),
    { MERCHANT_DB: db },
    { cryptoApi: webcrypto, now: () => NOW }
  );
  assert.equal(noSessionResponse.status, 401);

  const logoutResponse = await revokeMerchantSession(
    new Request(ORIGIN + "/api/merchant/session", {
      method: "DELETE",
      headers: { Origin: ORIGIN, Cookie: cookieHeader([sessionCookiePair]) }
    }),
    { MERCHANT_DB: db },
    { cryptoApi: webcrypto, now: () => NOW + 1000 }
  );
  assert.equal(logoutResponse.status, 200);
  assert.equal(logoutResponse.headers.get("set-cookie").includes("Max-Age=0"), true);
  assert.equal((await logoutResponse.json()).authenticated, false);
  assert.equal(db.events.length, 2);
  assert.equal(db.events[1].event_type, "merchant.session.revoked");

  const afterLogout = await resolveMerchantSession(sessionRequest, db, {
    cryptoApi: webcrypto,
    now: () => NOW + 1000
  });
  assert.equal(afterLogout, null, "Revoked sessions must no longer resolve");

  console.log("D1 merchant identity and session tests passed.");
}

await main();
