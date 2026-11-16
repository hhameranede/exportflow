import assert from "node:assert/strict";
import {
  createOfficialApiCredentialMutationHandlers,
  createOfficialApiCredentialStatusHandler
} from "../functions/api/merchant/carriers/[provider]/official-credentials.js";
import { OfficialApiCredentialVaultError } from "../functions/lib/official-api-credential-vault.mjs";

const origin = "https://exportflow.me";
const env = { MERCHANT_APP_ORIGIN: origin };
const getRequest = path => new Request(origin + path, { method: "GET" });
const postRequest = (path, body, requestOrigin = origin) => new Request(origin + path, {
  method: "POST",
  headers: { Origin: requestOrigin, "Content-Type": "application/json" },
  body: JSON.stringify(body)
});
const deleteRequest = (path, requestOrigin = origin) => new Request(origin + path, {
  method: "DELETE",
  headers: { Origin: requestOrigin }
});

const statusHandler = createOfficialApiCredentialStatusHandler({
  createVault: async () => ({
    getStatus: async ({ provider }) => ({
      provider,
      connected: true,
      scope: "sandbox_track",
      consentedAt: "2026-11-10T10:00:00.000Z",
      updatedAt: "2026-11-10T10:00:00.000Z"
    })
  })
});

const ok = await statusHandler({
  request: getRequest("/api/merchant/carriers/ups/official-credentials"),
  env,
  params: { provider: "ups" }
});
assert.equal(ok.status, 200);
assert.equal(ok.headers.get("Cache-Control"), "no-store, private");
assert.deepEqual(await ok.json(), {
  provider: "ups",
  connected: true,
  scope: "sandbox_track",
  consentedAt: "2026-11-10T10:00:00.000Z",
  updatedAt: "2026-11-10T10:00:00.000Z"
});
assert.equal(ok.headers.get("Content-Type"), "application/json; charset=utf-8");

const disconnected = createOfficialApiCredentialStatusHandler({
  createVault: async () => ({
    getStatus: async ({ provider }) => ({
      provider, connected: false, scope: null, consentedAt: null, updatedAt: null
    })
  })
});
const empty = await disconnected({
  request: getRequest("/api/merchant/carriers/fedex/official-credentials"),
  env,
  params: { provider: "fedex" }
});
assert.equal((await empty.json()).connected, false);

let mutationCalls = [];
const mutations = createOfficialApiCredentialMutationHandlers({
  createVault: async () => ({
    save: async input => {
      mutationCalls.push({ action: "save", input });
      return {
        provider: input.provider,
        connected: true,
        scope: "sandbox_track",
        consentedAt: "2026-11-16T16:00:00.000Z",
        updatedAt: "2026-11-16T16:00:00.000Z"
      };
    },
    revoke: async input => {
      mutationCalls.push({ action: "revoke", input });
      return { provider: input.provider, revoked: true };
    }
  })
});

const saved = await mutations.onRequestPost({
  request: postRequest("/api/merchant/carriers/fedex/official-credentials", {
    credentials: { apiKey: "fedex-preview-key", apiSecret: "fedex-preview-secret" },
    consent: true
  }),
  env,
  params: { provider: "fedex" }
});
assert.equal(saved.status, 201);
assert.equal(saved.headers.get("Cache-Control"), "no-store, private");
assert.deepEqual(await saved.json(), {
  provider: "fedex",
  connected: true,
  scope: "sandbox_track",
  consentedAt: "2026-11-16T16:00:00.000Z",
  updatedAt: "2026-11-16T16:00:00.000Z"
});
assert.deepEqual(mutationCalls[0], {
  action: "save",
  input: {
    provider: "fedex",
    credentials: { apiKey: "fedex-preview-key", apiSecret: "fedex-preview-secret" },
    consent: true
  }
});
assert.equal(JSON.stringify(await saved.clone().json()).includes("fedex-preview-secret"), false,
  "Credential mutation responses must never echo secret values");

const revoked = await mutations.onRequestDelete({
  request: deleteRequest("/api/merchant/carriers/fedex/official-credentials"),
  env,
  params: { provider: "fedex" }
});
assert.equal(revoked.status, 200);
assert.deepEqual(await revoked.json(), { provider: "fedex", revoked: true });
assert.deepEqual(mutationCalls[1], { action: "revoke", input: { provider: "fedex" } });

let vaultCalls = 0;
const wrongOriginMutations = createOfficialApiCredentialMutationHandlers({
  createVault: async () => { vaultCalls += 1; throw new Error("must-not-run"); }
});
const forbiddenPost = await wrongOriginMutations.onRequestPost({
  request: postRequest("/api/merchant/carriers/ups/official-credentials", {
    credentials: { clientId: "x", clientSecret: "y" }, consent: true
  }, "https://attacker.invalid"),
  env,
  params: { provider: "ups" }
});
assert.equal(forbiddenPost.status, 403);
const forbiddenDelete = await wrongOriginMutations.onRequestDelete({
  request: deleteRequest("/api/merchant/carriers/ups/official-credentials", "https://attacker.invalid"),
  env,
  params: { provider: "ups" }
});
assert.equal(forbiddenDelete.status, 403);
assert.equal(vaultCalls, 0, "Cross-origin mutation requests must not reach the merchant vault");

const unsupportedPost = await mutations.onRequestPost({
  request: postRequest("/api/merchant/carriers/dhl/official-credentials", {
    credentials: { apiKey: "x", apiSecret: "y" }, consent: true
  }),
  env,
  params: { provider: "dhl" }
});
assert.equal(unsupportedPost.status, 400);

const noConsent = createOfficialApiCredentialMutationHandlers({
  createVault: async () => ({
    save: async () => { throw new OfficialApiCredentialVaultError("consent_required", 400); }
  })
});
const consentRejected = await noConsent.onRequestPost({
  request: postRequest("/api/merchant/carriers/ups/official-credentials", {
    credentials: { clientId: "ups-id", clientSecret: "ups-secret" }, consent: false
  }),
  env,
  params: { provider: "ups" }
});
assert.equal(consentRejected.status, 400);
assert.deepEqual(await consentRejected.json(), { error: "consent_required" });

const unauthenticatedMutations = createOfficialApiCredentialMutationHandlers({
  createVault: async () => { throw new OfficialApiCredentialVaultError("unauthenticated", 401); }
});
const noSession = await unauthenticatedMutations.onRequestPost({
  request: postRequest("/api/merchant/carriers/ups/official-credentials", {
    credentials: { clientId: "ups-id", clientSecret: "ups-secret" }, consent: true
  }),
  env,
  params: { provider: "ups" }
});
assert.equal(noSession.status, 401);
assert.deepEqual(await noSession.json(), { error: "unauthenticated" });

const wrongMethod = await mutations.onRequestPost({
  request: getRequest("/api/merchant/carriers/ups/official-credentials"),
  env,
  params: { provider: "ups" }
});
assert.equal(wrongMethod.status, 405);

const forbiddenStatus = createOfficialApiCredentialStatusHandler({
  createVault: async () => { vaultCalls += 1; throw new Error("must-not-run"); }
});
const wrongOriginStatus = await forbiddenStatus({
  request: new Request("https://attacker.invalid/api/merchant/carriers/ups/official-credentials", { method: "GET" }),
  env,
  params: { provider: "ups" }
});
assert.equal(wrongOriginStatus.status, 403);
assert.equal(vaultCalls, 0, "Cross-origin status requests must not reach the merchant vault");

const unsupported = await statusHandler({
  request: getRequest("/api/merchant/carriers/dhl/official-credentials"),
  env,
  params: { provider: "dhl" }
});
assert.equal(unsupported.status, 400);

const unauthenticated = createOfficialApiCredentialStatusHandler({
  createVault: async () => { throw new OfficialApiCredentialVaultError("unauthenticated", 401); }
});
const noSessionStatus = await unauthenticated({
  request: getRequest("/api/merchant/carriers/ups/official-credentials"),
  env,
  params: { provider: "ups" }
});
assert.equal(noSessionStatus.status, 401);
assert.deepEqual(await noSessionStatus.json(), { error: "unauthenticated" });

console.log("Official API credential routes passed: metadata-only status, authenticated save/disconnect, consent, origin, provider allowlist and secret redaction.");
