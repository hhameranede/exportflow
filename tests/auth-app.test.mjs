import test from "node:test";
import assert from "node:assert/strict";
import { authorizePlatformOwner, getAuthFeatureStatus, getAuthOptions, handleAuthRequest, guardOwnerTwoFactorEndpoint } from "../src/core/auth-app.js";
import { createWorker } from "../src/index.js";
import { getOAuthRuntimeConfig } from "../src/core/oauth-config.js";

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

test("verified platform owners cannot bypass step-up through Better Auth TOTP re-verification or disable", async () => {
  const db = {
    prepare(sql) {
      assert.match(sql, /twoFactor/);
      return {
        bind(userId) {
          assert.equal(userId, "owner_123");
          return {
            async first() { return { twoFactorEnabled: 1, factorVerified: 1 }; },
          };
        },
      };
    },
  };
  const getSession = async () => ({
    user: { id: "owner_123", emailVerified: true },
    session: { id: "session_123" },
  });
  const options = {
    ownerUserIds: new Set(["owner_123"]),
    authDb: db,
    getSession,
  };

  const verify = await guardOwnerTwoFactorEndpoint(
    new Request("https://exportflow.me/api/auth/two-factor/verify-totp", {
      method: "POST",
      headers: { origin: "https://exportflow.me" },
      body: JSON.stringify({ code: "123456" }),
    }),
    options,
  );
  assert.equal(verify.status, 403);
  assert.equal((await verify.json()).error, "OWNER_TWO_FACTOR_MANAGEMENT_BLOCKED");

  const disable = await guardOwnerTwoFactorEndpoint(
    new Request("https://exportflow.me/api/auth/two-factor/disable", {
      method: "POST",
      headers: { origin: "https://exportflow.me" },
      body: JSON.stringify({}),
    }),
    options,
  );
  assert.equal(disable.status, 403);
  assert.equal((await disable.json()).error, "OWNER_TWO_FACTOR_MANAGEMENT_BLOCKED");
});

test("direct TOTP re-verification remains available to non-owners but an allowlisted owner must finish bootstrap first", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return {
            async first() { return { twoFactorEnabled: 0, factorVerified: null }; },
          };
        },
      };
    },
  };
  const request = new Request("https://exportflow.me/api/auth/two-factor/verify-totp", {
    method: "POST",
    headers: { origin: "https://exportflow.me" },
    body: JSON.stringify({ code: "123456" }),
  });
  const nonOwner = await guardOwnerTwoFactorEndpoint(request, {
    ownerUserIds: new Set(["another_owner"]),
    authDb: db,
    getSession: async () => ({ user: { id: "ordinary_user" }, session: { id: "ordinary_session" } }),
  });
  assert.equal(nonOwner, null);

  const pendingOwner = await guardOwnerTwoFactorEndpoint(request, {
    ownerUserIds: new Set(["owner_123"]),
    authDb: db,
    getSession: async () => ({ user: { id: "owner_123" }, session: { id: "session_123" } }),
  });
  assert.equal(pendingOwner.status, 403);
  assert.equal((await pendingOwner.json()).error, "OWNER_TWO_FACTOR_BOOTSTRAP_REQUIRED");
});

test("owner TOTP endpoint guard fails closed when factor storage is unavailable", async () => {
  const response = await guardOwnerTwoFactorEndpoint(
    new Request("https://exportflow.me/api/auth/two-factor/disable", {
      method: "POST",
      headers: { origin: "https://exportflow.me" },
    }),
    {
      ownerUserIds: new Set(["owner_123"]),
      authDb: { prepare() { throw new Error("synthetic D1 outage"); } },
      getSession: async () => ({ user: { id: "owner_123" }, session: { id: "session_123" } }),
    },
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "OWNER_TWO_FACTOR_GUARD_UNAVAILABLE");
});


test("verified owners cannot retrieve TOTP secrets, regenerate backup codes, or use alternate re-verification routes", async () => {
  const db = {
    prepare(sql) {
      assert.match(sql, /twoFactor/);
      return {
        bind(userId) {
          assert.equal(userId, "owner_123");
          return {
            async first() { return { twoFactorEnabled: 1, factorVerified: 1 }; },
          };
        },
      };
    },
  };
  const options = {
    ownerUserIds: new Set(["owner_123"]),
    authDb: db,
    getSession: async () => ({
      user: { id: "owner_123", emailVerified: true },
      session: { id: "session_123" },
    }),
  };
  const paths = [
    "/api/auth/two-factor/get-totp-uri",
    "/api/auth/two-factor/generate-backup-codes",
    "/api/auth/two-factor/verify-backup-code",
    "/api/auth/two-factor/verify-otp",
    "/api/auth/two-factor/send-otp",
    "/api/auth/two-factor/enable",
  ];
  for (const path of paths) {
    const response = await guardOwnerTwoFactorEndpoint(
      new Request("https://exportflow.me" + path, {
        method: "POST",
        headers: { origin: "https://exportflow.me" },
        body: JSON.stringify({}),
      }),
      options,
    );
    assert.equal(response.status, 403, path);
    assert.equal((await response.json()).error, "OWNER_TWO_FACTOR_MANAGEMENT_BLOCKED", path);
  }
});

test("an allowlisted owner with no verified TOTP is stopped from using two-factor management endpoints", async () => {
  const response = await guardOwnerTwoFactorEndpoint(
    new Request("https://exportflow.me/api/auth/two-factor/get-totp-uri", {
      method: "POST",
      headers: { origin: "https://exportflow.me" },
      body: JSON.stringify({}),
    }),
    {
      ownerUserIds: new Set(["owner_123"]),
      authDb: {
        prepare() {
          return {
            bind() {
              return {
                async first() { return { twoFactorEnabled: 0, factorVerified: null }; },
              };
            },
          };
        },
      },
      getSession: async () => ({ user: { id: "owner_123" }, session: { id: "session_123" } }),
    },
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "OWNER_TWO_FACTOR_BOOTSTRAP_REQUIRED");
});

test("sessionless owner 2FA challenge is not blocked so normal sign-in remains possible", async () => {
  const request = new Request("https://exportflow.me/api/auth/two-factor/verify-backup-code", {
    method: "POST",
    headers: { origin: "https://exportflow.me" },
    body: JSON.stringify({ code: "backup-code" }),
  });
  const result = await guardOwnerTwoFactorEndpoint(request, {
    ownerUserIds: new Set(["owner_123"]),
    authDb: { prepare() { throw new Error("must not query account without a session"); } },
    getSession: async () => null,
  });
  assert.equal(result, null);
});

test("authentication remains disabled without a dedicated D1 binding and server secret", () => {
  const status = getAuthFeatureStatus({});
  assert.deepEqual(status, {
    authConfigured: false,
    tenantOAuthConfigured: false,
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

  assert.deepEqual(options.disabledPaths, ["/token"]);
  assert.equal(options.socialProviders.google.requireEmailVerification, true);
  assert.equal(options.account.accountLinking.enabled, true);
  assert.equal(options.account.accountLinking.disableImplicitLinking, true);
  assert.deepEqual(options.account.accountLinking.trustedProviders, ["google"]);
  assert.deepEqual(options.advanced.ipAddress.ipAddressHeaders, ["cf-connecting-ip"]);
  assert.equal(options.plugins.some((plugin) => plugin.id === "two-factor"), true);
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
  const requiredTables = ["user", "session", "account", "verification", "twoFactor"];
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
    headers: { origin: "https://exportflow.me", "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
    body: JSON.stringify({ planCode: "free" }),
  }));
  assert.equal(admin.status, 503);
  const adminBody = await admin.json();
  assert.equal(adminBody.error.code, "ADMIN_RATE_LIMIT_UNAVAILABLE");
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
      AUTH_DB: createD1BindingStub(["user", "session", "account", "verification", "twoFactor"]),
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
test("Tenant OAuth remains unavailable until all required D1 tables and triggers exist", async () => {
  const authTables = [
    "user", "session", "account", "verification", "twoFactor",
    "jwks", "oauthClient", "oauthResource", "oauthClientResource",
    "oauthRefreshToken", "oauthAccessToken", "oauthConsent", "oauthClientAssertion",
  ];
  const tenantTables = [
    "tenants", "plan_policies", "tenant_request_usage",
    "tenant_memberships", "tenant_oauth_selections",
  ];
  const tenantTriggers = [
    "guard_tenant_membership_last_owner",
    "prevent_tenant_membership_identity_update",
    "prevent_tenant_membership_delete",
    "bump_tenant_membership_version_on_tenant_state_change",
  ];
  const env = {
    AUTH_DB: createD1BindingStub(authTables),
    EXPORTFLOW_AUTH_DB: createD1BindingStub([...tenantTables, ...tenantTriggers.slice(0, -1)]),
    BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
    BETTER_AUTH_URL: "https://auth-acceptance.hhameranede.workers.dev",
    MCP_RESOURCE_URL: "https://mcp-acceptance.hhameranede.workers.dev/mcp",
  };

  const configResponse = await handleAuthRequest(
    new Request(env.BETTER_AUTH_URL + "/api/auth/config"),
    env,
  );
  const config = await configResponse.json();
  assert.equal(config.authReady, true);
  assert.equal(config.tenantOAuthConfigured, false);
  assert.equal(config.oauthReady, false);

  const oauthResponse = await handleAuthRequest(
    new Request(env.BETTER_AUTH_URL + "/api/auth/oauth2/register", { method: "POST" }),
    env,
  );
  assert.equal(oauthResponse.status, 503);
  const body = await oauthResponse.json();
  assert.equal(body.error, "TENANT_OAUTH_SCHEMA_NOT_READY");
});

test("OAuth endpoints derive from the configured Auth and MCP origins", () => {
  const endpoints = getOAuthRuntimeConfig({
    BETTER_AUTH_URL: "https://auth-acceptance.hhameranede.workers.dev",
    MCP_RESOURCE_URL: "https://mcp-acceptance.hhameranede.workers.dev/mcp",
  });
  assert.equal(endpoints.issuer, "https://auth-acceptance.hhameranede.workers.dev/api/auth");
  assert.equal(endpoints.jwksUrl, "https://auth-acceptance.hhameranede.workers.dev/api/auth/jwks");
  assert.equal(endpoints.resource, "https://mcp-acceptance.hhameranede.workers.dev/mcp");
  assert.equal(endpoints.resourceMetadataUrl, "https://mcp-acceptance.hhameranede.workers.dev/.well-known/oauth-protected-resource/mcp");
});

test("OAuth endpoints reject non-HTTPS, credential-bearing, or unexpected paths", () => {
  assert.throws(() => getOAuthRuntimeConfig({ BETTER_AUTH_URL: "http://auth.example.test" }));
  assert.throws(() => getOAuthRuntimeConfig({ BETTER_AUTH_URL: "https://user:pass@auth.example.test" }));
  assert.throws(() => getOAuthRuntimeConfig({ MCP_RESOURCE_URL: "https://mcp.example.test/other" }));
});

test("email/password is enabled without email delivery only on the isolated acceptance Worker", () => {
  const env = {
    AUTH_DB: createD1BindingStub(),
    BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
    BETTER_AUTH_URL: "https://exportflow-auth-acceptance-20261122.hhameranede.workers.dev",
    MCP_RESOURCE_URL: "https://exportflow-mcp-acceptance-20261122.hhameranede.workers.dev/mcp",
    EXPORTFLOW_ACCEPTANCE_MODE: "true",
  };
  const status = getAuthFeatureStatus(env);
  assert.equal(status.authConfigured, true);
  assert.equal(status.emailPasswordEnabled, true);
  const options = getAuthOptions(env);
  assert.equal(options.emailAndPassword.enabled, true);
  assert.equal(options.emailAndPassword.requireEmailVerification, false);
  assert.equal(options.emailVerification, undefined);

  const productionLike = getAuthFeatureStatus({
    ...env,
    BETTER_AUTH_URL: "https://exportflow.me",
  });
  assert.equal(productionLike.emailPasswordEnabled, false);

  const untrustedWorkerOrigin = getAuthFeatureStatus({
    ...env,
    BETTER_AUTH_URL: "https://another-worker.hhameranede.workers.dev",
  });
  assert.equal(untrustedWorkerOrigin.emailPasswordEnabled, false);

  const mismatchedMcpResource = getAuthFeatureStatus({
    ...env,
    MCP_RESOURCE_URL: "https://other-mcp.hhameranede.workers.dev/mcp",
  });
  assert.equal(mismatchedMcpResource.emailPasswordEnabled, false);
});


test("Google OAuth and email/password can be enabled together with real Cloudflare Email delivery", async () => {
  const sent = [];
  const env = {
    AUTH_DB: createD1BindingStub(),
    BETTER_AUTH_SECRET: "a-long-test-secret-that-is-not-a-real-credential",
    BETTER_AUTH_URL: "https://exportflow.me",
    GOOGLE_CLIENT_ID: "synthetic-google-client-id",
    GOOGLE_CLIENT_SECRET: "synthetic-google-client-secret",
    EMAIL: {
      async send(message) {
        sent.push(message);
        return { messageId: "synthetic-message-" + sent.length };
      },
    },
    AUTH_EMAIL_FROM: "accounts@exportflow.me",
  };

  const status = getAuthFeatureStatus(env);
  assert.equal(status.authConfigured, true);
  assert.equal(status.googleEnabled, true);
  assert.equal(status.emailPasswordEnabled, true);

  const options = getAuthOptions(env);
  assert.equal(options.socialProviders.google.clientId, env.GOOGLE_CLIENT_ID);
  assert.equal(options.socialProviders.google.clientSecret, env.GOOGLE_CLIENT_SECRET);
  assert.equal(options.socialProviders.google.requireEmailVerification, true);
  assert.equal(options.emailAndPassword.enabled, true);
  assert.equal(options.emailAndPassword.requireEmailVerification, true);
  assert.equal(typeof options.emailAndPassword.sendResetPassword, "function");
  assert.equal(typeof options.emailVerification.sendVerificationEmail, "function");

  const user = { email: "synthetic-user@example.test" };
  await options.emailVerification.sendVerificationEmail({
    user,
    url: "https://exportflow.me/api/auth/verify-email?token=synthetic-verification-token",
  });
  await options.emailAndPassword.sendResetPassword({
    user,
    url: "https://exportflow.me/reset-password?token=synthetic-reset-token",
  });

  assert.equal(sent.length, 2);
  assert.deepEqual(sent.map((message) => ({
    from: message.from,
    to: message.to,
    subject: message.subject,
  })), [
    {
      from: "accounts@exportflow.me",
      to: "synthetic-user@example.test",
      subject: "Verify your ExportFlow email",
    },
    {
      from: "accounts@exportflow.me",
      to: "synthetic-user@example.test",
      subject: "Reset your ExportFlow password",
    },
  ]);
  assert.match(sent[0].html, /synthetic-verification-token/);
  assert.match(sent[1].text, /synthetic-reset-token/);
});
