import assert from "node:assert/strict";
import {
  createOfficialApiCredentialStatusHandler
} from "../functions/api/merchant/carriers/[provider]/official-credentials.js";
import { OfficialApiCredentialVaultError } from "../functions/lib/official-api-credential-vault.mjs";

const origin = "https://exportflow.me";
const env = { MERCHANT_APP_ORIGIN: origin };
const sameOriginGet = path => new Request(origin + path, { method: "GET" });

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
  request: sameOriginGet("/api/merchant/carriers/ups/official-credentials"),
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
  request: sameOriginGet("/api/merchant/carriers/fedex/official-credentials"),
  env,
  params: { provider: "fedex" }
});
assert.equal((await empty.json()).connected, false);

let vaultCalls = 0;
const wrongOrigin = createOfficialApiCredentialStatusHandler({
  createVault: async () => { vaultCalls += 1; throw new Error("must-not-run"); }
});
const forbiddenOrigin = await wrongOrigin({
  request: new Request("https://attacker.invalid/api/merchant/carriers/ups/official-credentials", { method: "GET" }),
  env,
  params: { provider: "ups" }
});
assert.equal(forbiddenOrigin.status, 403);
assert.equal(vaultCalls, 0, "Cross-origin status requests must not reach the merchant vault");

const unsupported = await statusHandler({
  request: sameOriginGet("/api/merchant/carriers/dhl/official-credentials"),
  env,
  params: { provider: "dhl" }
});
assert.equal(unsupported.status, 400);

const unauthenticated = createOfficialApiCredentialStatusHandler({
  createVault: async () => { throw new OfficialApiCredentialVaultError("unauthenticated", 401); }
});
const noSession = await unauthenticated({
  request: sameOriginGet("/api/merchant/carriers/ups/official-credentials"),
  env,
  params: { provider: "ups" }
});
assert.equal(noSession.status, 401);
assert.deepEqual(await noSession.json(), { error: "unauthenticated" });

console.log("Official API credential status route tests passed: same-origin, authenticated metadata-only status and provider allowlist.");
