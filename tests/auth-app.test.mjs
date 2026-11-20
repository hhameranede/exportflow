import test from "node:test";
import assert from "node:assert/strict";
import { getAuthFeatureStatus, handleAuthRequest } from "../src/core/auth-app.js";

test("authentication remains disabled without a dedicated D1 binding and server secret", () => {
  const status = getAuthFeatureStatus({});
  assert.deepEqual(status, {
    authConfigured: false,
    googleEnabled: false,
    emailPasswordEnabled: false,
  });
});

test("Google OAuth is enabled only when D1, the Better Auth secret, and both Google credentials exist", () => {
  const binding = {};
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

test("email/password remains disabled until a Cloudflare Email binding and sender address exist", () => {
  const base = {
    AUTH_DB: {},
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
});

test("public auth config returns capability booleans only and never returns credentials", async () => {
  const env = {
    AUTH_DB: {},
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
  assert.equal(body.googleEnabled, true);
  assert.equal(body.emailPasswordEnabled, false);
  assert.equal("migrationEnabled" in body, false);
  assert.equal(JSON.stringify(body).includes("test-client-secret"), false);
  assert.equal(JSON.stringify(body).includes("test-migration-token"), false);
});

test("auth configuration endpoint rejects non-GET methods", async () => {
  const response = await handleAuthRequest(
    new Request("https://exportflow.me/api/auth/config", { method: "POST" }),
    {},
  );
  assert.equal(response.status, 405);
});

test("schema migration route stays hidden unless dedicated auth storage and migration secret are configured", async () => {
  const response = await handleAuthRequest(
    new Request("https://exportflow.me/api/auth/_ops/migrate", { method: "POST" }),
    {},
  );
  assert.equal(response.status, 404);
});
