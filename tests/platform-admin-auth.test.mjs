import assert from "node:assert/strict";
import test from "node:test";
import { authorizePlatformOwnerRequest, parsePlatformOwnerIds } from "../src/core/platform-admin-auth.js";

const NOW = Date.parse("2026-11-21T12:00:00.000Z");
const OWNER = "user_owner_123";
const EXPECTED_ORIGIN = "https://exportflow.me";

function ownerRequest(headers = {}) {
  return new Request("https://exportflow.me/api/v1/admin/tenants", {
    method: "POST",
    headers: { origin: EXPECTED_ORIGIN, ...headers },
  });
}

function validSession(overrides = {}) {
  return {
    user: {
      id: OWNER,
      emailVerified: true,
      ...(overrides.user || {}),
    },
    session: {
      createdAt: new Date(NOW - 60_000),
      expiresAt: new Date(NOW + 60 * 60_000),
      ...(overrides.session || {}),
    },
  };
}

function authorizer(session = validSession(), options = {}) {
  const calls = [];
  const getSession = async (args) => {
    calls.push(args);
    if (options.throw) throw new Error("synthetic auth provider failure");
    return session;
  };
  return {
    calls,
    run: (request = ownerRequest(), extras = {}) => authorizePlatformOwnerRequest(request, {
      ownerUserIds: new Set([OWNER]),
      expectedOrigin: EXPECTED_ORIGIN,
      getSession,
      now: () => NOW,
      ...extras,
    }),
  };
}

test("owner allowlist parser accepts bounded user IDs and rejects malformed configuration", () => {
  assert.deepEqual([...parsePlatformOwnerIds("owner-1, owner_2")], ["owner-1", "owner_2"]);
  assert.equal(parsePlatformOwnerIds("").size, 0);
  assert.equal(parsePlatformOwnerIds("owner-1,,owner-2").size, 0);
  assert.equal(parsePlatformOwnerIds("owner-1," + "x".repeat(129)).size, 0);
  assert.equal(parsePlatformOwnerIds(Array(21).fill("owner").join(",")).size, 0);
});

test("verified, allowlisted, fresh same-origin session is authorized and cache bypass is requested", async () => {
  const auth = authorizer();
  const result = await auth.run();
  assert.deepEqual(result, { allowed: true, actorId: OWNER });
  assert.equal(auth.calls.length, 1);
  assert.equal(auth.calls[0].headers.get("origin"), EXPECTED_ORIGIN);
  assert.deepEqual(auth.calls[0].query, { disableCookieCache: true });
});

test("missing owner allowlist or a non-allowlisted user fails closed", async () => {
  const auth = authorizer({ user: { id: "ordinary_user" } });
  assert.deepEqual(await auth.run(), { allowed: false });
  const noAllowlist = await authorizePlatformOwnerRequest(ownerRequest(), {
    ownerUserIds: new Set(),
    expectedOrigin: EXPECTED_ORIGIN,
    getSession: async () => validSession(),
    now: () => NOW,
  });
  assert.deepEqual(noAllowlist, { allowed: false });
});

test("unverified email, impersonated sessions, and old sessions are denied", async () => {
  const unverified = authorizer({ user: { emailVerified: false } });
  assert.deepEqual(await unverified.run(), { allowed: false });

  const impersonated = authorizer({ session: { impersonatedBy: "owner_admin" } });
  assert.deepEqual(await impersonated.run(), { allowed: false });

  const stale = authorizer({
    session: { createdAt: new Date(NOW - 10 * 60_000 - 1) },
  });
  assert.deepEqual(await stale.run(), { allowed: false });
});

test("expired or future-dated sessions fail closed", async () => {
  const expired = authorizer({ session: { expiresAt: new Date(NOW - 1) } });
  assert.deepEqual(await expired.run(), { allowed: false });

  const future = authorizer({ session: { createdAt: new Date(NOW + 2 * 60_000) } });
  assert.deepEqual(await future.run(), { allowed: false });
});

test("cross-origin, missing-Origin, non-POST and mismatched-host requests are denied", async () => {
  const auth = authorizer();
  const crossOrigin = ownerRequest({ origin: "https://attacker.example" });
  assert.deepEqual(await auth.run(crossOrigin), { allowed: false });

  const missingOrigin = new Request("https://exportflow.me/api/v1/admin/tenants", { method: "POST" });
  assert.deepEqual(await auth.run(missingOrigin), { allowed: false });

  const wrongHost = new Request("https://workers.dev/api/v1/admin/tenants", {
    method: "POST",
    headers: { origin: EXPECTED_ORIGIN },
  });
  assert.deepEqual(await auth.run(wrongHost), { allowed: false });

  const getRequest = new Request("https://exportflow.me/api/v1/admin/tenants", {
    method: "GET",
    headers: { origin: EXPECTED_ORIGIN },
  });
  assert.deepEqual(await auth.run(getRequest), { allowed: false });
});

test("cross-site Fetch Metadata and identity-provider failures are denied", async () => {
  const auth = authorizer();
  assert.deepEqual(await auth.run(ownerRequest({ "sec-fetch-site": "cross-site" })), { allowed: false });

  const broken = authorizer(validSession(), { throw: true });
  assert.deepEqual(await broken.run(), { allowed: false });
});

test("malformed or expired Better Auth session data is denied", async () => {
  const noSession = authorizer(null);
  assert.deepEqual(await noSession.run(), { allowed: false });

  const malformed = authorizer({ user: { id: OWNER, emailVerified: true }, session: {} });
  assert.deepEqual(await malformed.run(), { allowed: false });
});
