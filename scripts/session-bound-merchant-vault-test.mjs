import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  onRequestPost,
  onRequestDelete
} from "../functions/api/merchant/carriers/[provider]/credentials.js";

const ORIGIN = "https://exportflow.me";
const NOW = Date.parse("2026-11-07T12:40:00.000Z");
const TRUSTED_MERCHANT_ID = "merchant-trusted-001";
const token = Buffer.from(webcrypto.getRandomValues(new Uint8Array(48))).toString("base64url");
const key = Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString("base64");
const encoder = new TextEncoder();

async function sha256Hex(value) {
  const digest = new Uint8Array(await webcrypto.subtle.digest("SHA-256", encoder.encode(value)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

function createD1() {
  const credentials = new Map();
  const calls = [];
  const sessions = new Map();

  function statement(sql, values = []) {
    return {
      bind(...bound) {
        return statement(sql, bound);
      },
      async first() {
        calls.push({ kind: "read", sql });
        if (sql.includes("FROM merchant_sessions s")) {
          const row = sessions.get(values[0]);
          if (
            !row ||
            row.expires_at <= values[1] ||
            row.revoked_at !== null ||
            row.disabled_at !== null
          ) return null;
          return {
            session_id: row.session_id,
            merchant_id: row.merchant_id,
            email: row.email,
            display_name: row.display_name
          };
        }
        if (sql.includes("FROM merchant_provider_credentials")) {
          return credentials.get(values[0] + ":" + values[1]) || null;
        }
        throw new Error("Unexpected fake D1 SELECT: " + sql);
      },
      async run() {
        if (sql.startsWith("INSERT INTO merchant_provider_credentials")) {
          calls.push({ kind: "write", sql });
          const [merchantId, provider, keyId, iv, ciphertext, consentedAt, createdAt, updatedAt] = values;
          credentials.set(merchantId + ":" + provider, {
            merchant_id: merchantId,
            provider,
            key_id: keyId,
            iv,
            ciphertext,
            scope: "track",
            consented_at: consentedAt,
            created_at: createdAt,
            updated_at: updatedAt
          });
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("DELETE FROM merchant_provider_credentials")) {
          calls.push({ kind: "delete", sql });
          const removed = credentials.delete(values[0] + ":" + values[1]);
          return { meta: { changes: removed ? 1 : 0 } };
        }
        throw new Error("Unexpected fake D1 mutation: " + sql);
      }
    };
  }

  return {
    credentials,
    calls,
    sessions,
    prepare(sql) { return statement(sql); }
  };
}

function sessionCookieHeader(value = token) {
  return "__Host-exportflow_session=" + encodeURIComponent(value);
}

function request(path, {
  method = "POST",
  origin = ORIGIN,
  cookie = sessionCookieHeader(),
  body,
  contentType = "application/json"
} = {}) {
  const headers = {};
  if (origin !== null) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  if (contentType) headers["Content-Type"] = contentType;
  return new Request(ORIGIN + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body })
  });
}

async function main() {
  const db = createD1();
  db.sessions.set(await sha256Hex(token), {
    session_id: "session-verified",
    merchant_id: TRUSTED_MERCHANT_ID,
    email: "merchant@example.test",
    display_name: "Verified Merchant",
    expires_at: new Date(NOW + 60_000).toISOString(),
    revoked_at: null,
    disabled_at: null
  });

  const env = {
    MERCHANT_DB: db,
    MERCHANT_APP_ORIGIN: ORIGIN,
    MERCHANT_CREDENTIAL_KEYRING_JSON: JSON.stringify({
      activeKeyId: "test-v1",
      keys: { "test-v1": key }
    })
  };
  const params = { provider: "yalidine" };

  const response = await onRequestPost({
    request: request("/api/merchant/carriers/yalidine/credentials", {
      body: JSON.stringify({
        credentials: { apiId: "merchant-account", apiToken: "synthetic-test-secret" },
        consent: true
      })
    }),
    env,
    params
  });
  assert.equal(response.status, 201);
  const responsePayload = await response.json();
  assert.equal(responsePayload.provider, "yalidine");
  assert.equal(responsePayload.connected, true);
  assert.equal(JSON.stringify(responsePayload).includes("synthetic-test-secret"), false);

  const stored = db.credentials.get(TRUSTED_MERCHANT_ID + ":yalidine");
  assert.ok(stored, "Credential record must be scoped to the verified D1 session");
  assert.equal(stored.merchant_id, TRUSTED_MERCHANT_ID);
  assert.equal(JSON.stringify(stored).includes("synthetic-test-secret"), false);
  assert.equal(JSON.stringify(stored).includes("merchant-account"), false);

  // A caller-supplied merchant ID is rejected rather than used for tenant selection.
  const spoofed = await onRequestPost({
    request: request("/api/merchant/carriers/yalidine/credentials", {
      body: JSON.stringify({
        merchantId: "merchant-victim",
        credentials: { apiId: "attacker", apiToken: "attacker-secret" },
        consent: true
      })
    }),
    env,
    params
  });
  assert.equal(spoofed.status, 400);
  assert.equal(db.credentials.has("merchant-victim:yalidine"), false);

  const wrongOrigin = await onRequestPost({
    request: request("/api/merchant/carriers/yalidine/credentials", {
      origin: "https://attacker.invalid",
      body: JSON.stringify({
        credentials: { apiId: "acct", apiToken: "not-stored" },
        consent: true
      })
    }),
    env,
    params
  });
  assert.equal(wrongOrigin.status, 403);

  const noSession = await onRequestPost({
    request: request("/api/merchant/carriers/yalidine/credentials", {
      cookie: "",
      body: JSON.stringify({
        credentials: { apiId: "acct", apiToken: "not-stored" },
        consent: true
      })
    }),
    env,
    params
  });
  assert.equal(noSession.status, 401);

  const largeBody = await onRequestPost({
    request: request("/api/merchant/carriers/yalidine/credentials", {
      body: JSON.stringify({
        credentials: { apiId: "acct", apiToken: "x".repeat(13 * 1024) },
        consent: true
      })
    }),
    env,
    params
  });
  assert.equal(largeBody.status, 413);

  const wrongContentType = await onRequestPost({
    request: request("/api/merchant/carriers/yalidine/credentials", {
      contentType: "text/plain",
      body: "not-json"
    }),
    env,
    params
  });
  assert.equal(wrongContentType.status, 415);

  const noConsent = await onRequestPost({
    request: request("/api/merchant/carriers/yalidine/credentials", {
      body: JSON.stringify({
        credentials: { apiId: "acct", apiToken: "not-stored" },
        consent: false
      })
    }),
    env,
    params
  });
  assert.equal(noConsent.status, 400);

  const badProvider = await onRequestPost({
    request: request("/api/merchant/carriers/unknown/credentials", {
      body: JSON.stringify({
        credentials: { apiId: "acct", apiToken: "not-stored" },
        consent: true
      })
    }),
    env,
    params: { provider: "unknown" }
  });
  assert.equal(badProvider.status, 400);

  const logout = await onRequestDelete({
    request: request("/api/merchant/carriers/yalidine/credentials", { method: "DELETE" }),
    env,
    params
  });
  assert.equal(logout.status, 200);
  assert.equal((await logout.json()).revoked, true);
  assert.equal(db.credentials.has(TRUSTED_MERCHANT_ID + ":yalidine"), false);

  console.log("Session-bound merchant credential route tests passed.");
}

await main();
