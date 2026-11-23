import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import {
  createOwnerStepUpService,
  OWNER_STEP_UP_COOKIE,
} from "../src/core/owner-step-up.js";

const OWNER = "owner_user_123";
const SESSION = "session_owner_123";
const SECRET = "test-only-owner-step-up-signing-secret-at-least-32";
const NOW = Date.parse("2026-11-22T18:00:00.000Z");

function request(cookie) {
  const headers = { origin: "https://exportflow.me" };
  if (cookie) headers.cookie = OWNER_STEP_UP_COOKIE + "=" + cookie;
  return new Request("https://exportflow.me/api/v1/admin/tenants", {
    method: "POST",
    headers,
  });
}

function makeAuthDb({ factor = { twoFactorEnabled: 1, factorVerified: 1 }, activeSession = true, batchFailAt = -1 } = {}) {
  const rows = [];
  const db = {
    rows,
    prepare(sql) {
      return {
        bind(...params) {
          const statement = {
            sql,
            params,
            async first() {
              if (sql.includes("FROM user AS u LEFT JOIN twoFactor")) return factor;
              throw new Error("Unexpected first() query: " + sql);
            },
            async run() {
              if (sql.startsWith("INSERT INTO verification") && sql.includes("SELECT ?1")) {
                const [id, identifier, value, expiresAt, nowIso, limit] = params;
                const active = rows.filter((row) => row.identifier === identifier && row.expiresAt > nowIso).length;
                if (active >= limit) return { meta: { changes: 0 } };
                rows.push({ id, identifier, value, expiresAt });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE verification SET value")) {
                const [value, _updatedAt, id, identifier] = params;
                const row = rows.find((entry) => entry.id === id && entry.identifier === identifier);
                if (!row) return { meta: { changes: 0 } };
                row.value = value;
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("DELETE FROM verification") && sql.includes("value LIKE 'failed:%'")) {
                const [identifier] = params;
                const before = rows.length;
                for (let index = rows.length - 1; index >= 0; index -= 1) {
                  if (rows[index].identifier === identifier && rows[index].value.startsWith("failed:")) rows.splice(index, 1);
                }
                return { meta: { changes: before - rows.length } };
              }
              if (sql.startsWith("DELETE FROM verification") && sql.includes("AND EXISTS (")) {
                const [identifier, value, nowIso, sessionId, userId] = params;
                const sessionStillActive = activeSession && sessionId === SESSION && userId === OWNER;
                const index = rows.findIndex((row) => row.identifier === identifier && row.value === value && row.expiresAt > nowIso);
                if (!sessionStillActive || index < 0) return { meta: { changes: 0 } };
                rows.splice(index, 1);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("DELETE FROM verification") && sql.includes("expiresAt > ?3")) {
                const [identifier, value, nowIso] = params;
                const index = rows.findIndex((row) => row.identifier === identifier && row.value === value && row.expiresAt > nowIso);
                if (index < 0) return { meta: { changes: 0 } };
                rows.splice(index, 1);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("DELETE FROM verification") && sql.includes("id = ?1")) {
                const [id, identifier] = params;
                const index = rows.findIndex((row) => row.id === id && row.identifier === identifier);
                if (index < 0) return { meta: { changes: 0 } };
                rows.splice(index, 1);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("INSERT INTO verification") && sql.includes("VALUES")) {
                const [id, identifier, value, expiresAt] = params;
                rows.push({ id, identifier, value, expiresAt });
                return { meta: { changes: 1 } };
              }
              throw new Error("Unexpected run() query: " + sql);
            },
          };
          return statement;
        },
      };
    },
    async batch(statements) {
      const snapshot = rows.map((row) => ({ ...row }));
      const results = [];
      try {
        for (let index = 0; index < statements.length; index += 1) {
          if (index === batchFailAt) throw new Error("synthetic D1 batch statement failure");
          results.push(await statements[index].run());
        }
        return results;
      } catch (error) {
        // Cloudflare D1 batch() is transactional: restore the pre-batch state.
        rows.splice(0, rows.length, ...snapshot);
        throw error;
      }
    },
  };
  return db;
}

function fixture({ factor, verify, now = NOW, activeSession = true, batchFailAt = -1 } = {}) {
  const db = makeAuthDb({ factor, activeSession, batchFailAt });
  let calls = 0;
  let currentNow = now;
  const service = createOwnerStepUpService({
    cryptoImpl: webcrypto,
    now: () => currentNow,
    authFactory: () => ({
      api: {
        async verifyTOTP(args) {
          calls += 1;
          assert.equal(args.body.trustDevice, false);
          assert.equal(args.headers.get("origin"), "https://exportflow.me");
          if (verify) return verify(args);
          if (args.body.code !== "123456") {
            throw Object.assign(new Error("Invalid authenticator code"), { body: { code: "INVALID_CODE" } });
          }
          return { token: "existing-session-token", user: { id: OWNER } };
        },
      },
    }),
  });
  return {
    db,
    service,
    calls: () => calls,
    setNow: (value) => { currentNow = value; },
    env: { AUTH_DB: db, BETTER_AUTH_SECRET: SECRET },
    owner: { allowed: true, actorId: OWNER, sessionId: SESSION },
  };
}

test("a verified TOTP creates a five-minute, session-bound, one-use proof", async () => {
  const f = fixture();
  const outcome = await f.service.verifyCode(request(), f.env, f.owner, "123456");
  assert.equal(outcome.allowed, true);
  assert.equal(typeof outcome.token, "string");
  assert.equal(outcome.expiresAt, new Date(NOW + 5 * 60_000).toISOString());
  assert.equal(f.db.rows.length, 1);
  assert.equal(f.db.rows[0].identifier, "exportflow:owner-step-up-proof:" + OWNER);

  const firstUse = await f.service.consumeProof(request(outcome.token), f.env, f.owner);
  assert.deepEqual(firstUse, { allowed: true });
  const replay = await f.service.consumeProof(request(outcome.token), f.env, f.owner);
  assert.deepEqual(replay, { allowed: false });
});

test("a proof cannot be moved to another owner or another Better Auth session", async () => {
  const f = fixture();
  const outcome = await f.service.verifyCode(request(), f.env, f.owner, "123456");
  const otherActor = await f.service.consumeProof(request(outcome.token), f.env, {
    ...f.owner,
    actorId: "different_owner",
  });
  assert.deepEqual(otherActor, { allowed: false });

  const otherSession = await f.service.consumeProof(request(outcome.token), f.env, {
    ...f.owner,
    sessionId: "different_session",
  });
  assert.deepEqual(otherSession, { allowed: false });

  const original = await f.service.consumeProof(request(outcome.token), f.env, f.owner);
  assert.deepEqual(original, { allowed: true });
});

test("tampered and expired proofs fail closed", async () => {
  const f = fixture();
  const outcome = await f.service.verifyCode(request(), f.env, f.owner, "123456");
  const tampered = outcome.token.slice(0, -1) + (outcome.token.endsWith("a") ? "b" : "a");
  assert.deepEqual(await f.service.consumeProof(request(tampered), f.env, f.owner), { allowed: false });
  f.setNow(NOW + 5 * 60_000 + 1);
  assert.deepEqual(await f.service.consumeProof(request(outcome.token), f.env, f.owner), { allowed: false });
});

test("revoked or expired Better Auth session cannot consume a valid one-time proof", async () => {
  const f = fixture({ activeSession: false });
  const outcome = await f.service.verifyCode(request(), f.env, f.owner, "123456");
  assert.equal(outcome.allowed, true);
  const result = await f.service.consumeProof(request(outcome.token), f.env, f.owner);
  assert.deepEqual(result, { allowed: false });
  assert.equal(f.db.rows.some((row) => row.identifier === "exportflow:owner-step-up-proof:" + OWNER), true);
});

test("unconfigured or unverified TOTP enrollment is rejected before code verification", async () => {
  const f = fixture({ factor: { twoFactorEnabled: 0, factorVerified: null } });
  const outcome = await f.service.verifyCode(request(), f.env, f.owner, "123456");
  assert.deepEqual(outcome, { allowed: false, error: "OWNER_MFA_REQUIRED", status: 403 });
  assert.equal(f.calls(), 0);
  assert.equal(f.db.rows.length, 0);
});

test("five failed TOTP attempts lock the owner for the rolling fifteen-minute window", async () => {
  const f = fixture();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const outcome = await f.service.verifyCode(request(), f.env, f.owner, "000000");
    assert.deepEqual(outcome, { allowed: false, error: "INVALID_TOTP_CODE", status: 401 });
  }
  const limited = await f.service.verifyCode(request(), f.env, f.owner, "123456");
  assert.deepEqual(limited, { allowed: false, error: "OWNER_MFA_RATE_LIMITED", status: 429 });
  assert.equal(f.calls(), 5);
});

test("a successful TOTP clears prior failed attempts without deleting concurrent pending reservations", async () => {
  const f = fixture({
    verify: async ({ body }) => {
      if (body.code !== "123456") {
        throw Object.assign(new Error("Invalid code"), { body: { code: "INVALID_CODE" } });
      }
      return { token: "existing-session-token", user: { id: OWNER } };
    },
  });
  await f.service.verifyCode(request(), f.env, f.owner, "000000");
  assert.equal(f.db.rows.some((row) => row.value.startsWith("failed:")), true);
  const success = await f.service.verifyCode(request(), f.env, f.owner, "123456");
  assert.equal(success.allowed, true);
  assert.equal(f.db.rows.some((row) => row.value.startsWith("failed:")), false);
});

test("verification infrastructure failures release the pending reservation", async () => {
  const f = fixture({
    verify: async () => { throw new Error("synthetic Better Auth database failure"); },
  });
  const outcome = await f.service.verifyCode(request(), f.env, f.owner, "123456");
  assert.deepEqual(outcome, {
    allowed: false,
    error: "OWNER_MFA_VERIFICATION_UNAVAILABLE",
    status: 503,
  });
  assert.equal(f.db.rows.length, 0);
});

test("failed proof persistence rolls back and releases the pending attempt reservation", async () => {
  const f = fixture({ batchFailAt: 2 });
  const outcome = await f.service.verifyCode(request(), f.env, f.owner, "123456");
  assert.deepEqual(outcome, {
    allowed: false,
    error: "OWNER_MFA_STORAGE_UNAVAILABLE",
    status: 503,
  });
  assert.equal(f.db.rows.length, 0);
});
