import test from "node:test";
import assert from "node:assert/strict";
import { authorizePlatformOwner, getAuthFeatureStatus, getAuthOptions, handleAuthRequest } from "../src/core/auth-app.js";
import { createWorker } from "../src/index.js";

function createD1BindingStub(tableNames = []) {
  return {
    prepare() {
      return {
        bind() { return this; },
        async all() {
          return { results: tableNames.map((name) => ({ name })) };
        },
      };
    },
    batch() {},
  };
}

test("authentication remains disabled without a dedicated D1 binding and server secret", () => {
  const status = getAuthFeatureStatus({});
  assert.deepEqual(status, {
    authConfigured: false,
    googleEnabled: false,
    emailPasswordEnabled: false,
  });
});


test("authentication fails closed when AUTH_DB is not a D1 binding", () => {
  const secret = "a-long-test-secret-that-is-not-a-real-credential";
  assert.equal(getAuthFeatureStatus({ AUTH_DB: {}, BETTER_AUTH_SECRET: secret }).authConfigured, false);
  assert.equal(getAuthFeatureStatus({ AUTH_DB: { prepare() {} }, BETTER_AUTH_SECRET: secret }).authConfigured, false);
  assert.equal(getAuthFeatureStatus({ AUTH_DB: { batch() {} }, BETTER_AUTH_SECRET: secret }).authConfigured, false);
});

test("Google OAuth is enabled only when D1, the Better Auth secret, and both Google credentials exist", () => {
  const binding = createD1BindingStub();
  const partial = getAuthFeatureStatus({
    AUTH_DB: binding,
    BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
    GOOGLE_CLIENT_ID: "test-client-id",
  });
  assert.equal(partial.authConfigured, true);
  assert.equal(partial.googleEnabled, false);

  const ready = getAuthFeatureStatus({
    AUTH_DB: binding,
    BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
    BETTER_AUTH_URL: "https://exportflow.me",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
  });
  assert.equal(ready.authConfigured, true);
  assert.equal(ready.googleEnabled, true);
  assert.equal(ready.emailPasswordEnabled, false);
});

test("Google OAuth requires a verified provider email and explicit account linking", () => {
  const options = getAuthOptions({
    AUTH_DB: createD1BindingStub(),
    BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
    BETTER_AUTH_URL: "https://exportflow.me",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
  });

  assert.equal(options.socialProviders.google.requireEmailVerification, true);
  assert.equal(options.account.accountLinking.enabled, true);
  assert.equal(options.account.accountLinking.disableImplicitLinking, true);
  assert.deepEqual(options.account.accountLinking.trustedProviders, ["google"]);
  assert.deepEqual(options.advanced.ipAddress.ipAddressHeaders, ["cf-connecting-ip"]);
});

test("email/password remains disabled until a Cloudflare Email binding and sender address exist", () => {
  const base = {
    AUTH_DB: createD1BindingStub(),
    BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
  };
  assert.equal(getAuthFeatureStatus(base).emailPasswordEnabled, false);
  assert.equal(getAuthFeatureStatus({
    ...base,
    EMAIL: { send() {} },
  }).emailPasswordEnabled, false);
  assert.equal(getAuthFeatureStatus({
    ...base,
    EMAIL: { send() {} },
    AUTH_EMAIL_FROM: "accounts@exportflow.me",
  }).emailPasswordEnabled, true);
  assert.equal(getAuthFeatureStatus({
    ...base,
    BETTER_AUTH_URL: "http://example.com",
  }).authConfigured, false);
  assert.equal(getAuthFeatureStatus({
    ...base,
    BETTER_AUTH_URL: "ftp://localhost/",
  }).authConfigured, false);
  assert.equal(getAuthFeatureStatus({
    ...base,
    BETTER_AUTH_URL: "https://user:pass@exportflow.me/",
  }).authConfigured, false);
  assert.equal(getAuthFeatureStatus({
    ...base,
    BETTER_AUTH_URL: "http://localhost:8787/",
  }).authConfigured, true);
});

test("public auth config returns capability booleans only and never returns credentials", async () => {
  const env = {
    AUTH_DB: createD1BindingStub(),
    BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    AUTH_MIGRATION_TOKEN: "test-migration-token",
  };
  const response = await handleAuthRequest(
    new Request("https://exportflow.me/api/auth/config"),
    env,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.authConfigured, true);
  assert.equal(body.authReady, false);
  assert.equal(body.googleEnabled, false);
  assert.equal(body.emailPasswordEnabled, false);
  assert.equal("migrationEnabled" in body, false);
  assert.equal(JSON.stringify(body).includes("test-client-secret"), false);
  assert.equal(JSON.stringify(body).includes("test-migration-token"), false);
});


test("public auth capabilities stay disabled until all required Better Auth D1 tables exist", async () => {
  const requiredTables = ["user", "session", "account", "verification"];
  const response = await handleAuthRequest(
    new Request("https://exportflow.me/api/auth/config"),
    {
      AUTH_DB: createD1BindingStub(requiredTables),
      BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
    },
  );
  const body = await response.json();
  assert.equal(body.authConfigured, true);
  assert.equal(body.authReady, true);
  assert.equal(body.googleEnabled, true);

  const incomplete = await handleAuthRequest(
    new Request("https://exportflow.me/api/auth/config"),
    {
      AUTH_DB: createD1BindingStub(["user", "session", "account"]),
      BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
    },
  );
  const incompleteBody = await incomplete.json();
  assert.equal(incompleteBody.authConfigured, true);
  assert.equal(incompleteBody.authReady, false);
  assert.equal(incompleteBody.googleEnabled, false);
});

test("public auth config fails closed when the D1 schema readiness query fails", async () => {
  const response = await handleAuthRequest(
    new Request("https://exportflow.me/api/auth/config"),
    {
      AUTH_DB: {
        prepare() {
          return {
            bind() { return this; },
            async all() { throw new Error("synthetic schema access failure"); },
          };
        },
        batch() {},
      },
      BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
    },
  );
  const body = await response.json();
  assert.equal(body.authConfigured, true);
  assert.equal(body.authReady, false);
  assert.equal(body.googleEnabled, false);
});

test("auth configuration endpoint rejects non-GET methods", async () => {
  const response = await handleAuthRequest(
    new Request("https://exportflow.me/api/auth/config", { method: "POST" }),
    {},
  );
  assert.equal(response.status, 405);
});

test("Worker routes /api/auth before its generic GET-only fallback", async () => {
  const worker = createWorker();
  const config = await worker.fetch(new Request("https://exportflow.me/api/auth/config"));
  assert.equal(config.status, 200);
  const configBody = await config.json();
  assert.equal(configBody.authConfigured, false);

  const session = await worker.fetch(new Request("https://exportflow.me/api/auth/get-session"));
  assert.equal(session.status, 503);
  const sessionBody = await session.json();
  assert.equal(sessionBody.error, "AUTH_NOT_CONFIGURED");

  const admin = await worker.fetch(new Request("https://exportflow.me/api/v1/admin/tenants", {
    method: "POST",
    headers: { origin: "https://exportflow.me", "content-type": "application/json" },
    body: JSON.stringify({ planCode: "free" }),
  }));
  assert.equal(admin.status, 403);
  const adminBody = await admin.json();
  assert.equal(adminBody.error.code, "ADMIN_FORBIDDEN");
});

test("account API requests return 503 until the Better Auth schema is migrated", async () => {
  const response = await handleAuthRequest(
    new Request("https://exportflow.me/api/auth/get-session"),
    {
      AUTH_DB: createD1BindingStub(["user", "session", "account"]),
      BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
    },
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error, "AUTH_SCHEMA_NOT_READY");
});

test("weak migration secrets do not expose the schema migration route", async () => {
  const response = await handleAuthRequest(
    new Request("https://exportflow.me/api/auth/_ops/migrate", { method: "POST" }),
    {
      AUTH_DB: createD1BindingStub(),
      BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
      AUTH_MIGRATION_TOKEN: "short",
    },
  );
  assert.equal(response.status, 404);
});

test("schema migration route stays hidden unless dedicated auth storage and migration secret are configured", async () => {
  const response = await handleAuthRequest(
    new Request("https://exportflow.me/api/auth/_ops/migrate", { method: "POST" }),
    {},
  );
  assert.equal(response.status, 404);
});


test("platform owner authorization fails closed when owner allowlist is absent", async () => {
  const response = await authorizePlatformOwner(
    new Request("https://exportflow.me/api/v1/admin/tenants", {
      method: "POST",
      headers: { origin: "https://exportflow.me" },
    }),
    {
      AUTH_DB: createD1BindingStub(["user", "session", "account", "verification"]),
      BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
    },
  );
  assert.deepEqual(response, { allowed: false });
});

test("platform owner authorization fails closed when auth schema is incomplete", async () => {
  const response = await authorizePlatformOwner(
    new Request("https://exportflow.me/api/v1/admin/tenants", {
      method: "POST",
      headers: { origin: "https://exportflow.me" },
    }),
    {
      AUTH_DB: createD1BindingStub(["user", "session", "account"]),
      BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
      EXPORTFLOW_OWNER_USER_IDS: "owner_user_id",
    },
  );
  assert.deepEqual(response, { allowed: false });
});
