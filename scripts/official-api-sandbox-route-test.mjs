import assert from "node:assert/strict";
import {
  createOfficialApiSandboxHandler,
  createSandboxClient
} from "../functions/api/merchant/carriers/[provider]/sandbox.js";
import { OfficialApiCredentialVaultError } from "../functions/lib/official-api-credential-vault.mjs";

const origin = "https://exportflow.me";
const env = { MERCHANT_APP_ORIGIN: origin };

function request(extraHeaders = {}) {
  return new Request(origin + "/api/merchant/carriers/fedex/sandbox", {
    method: "POST",
    headers: { Origin: origin, ...extraHeaders }
  });
}

const allowedQuota = {
  allowed: true,
  limit: 12,
  remaining: 11,
  retryAfterSeconds: 0,
  resetAt: 1_800_000_060,
  resetAfterSeconds: 60
};

const calls = [];
const handler = createOfficialApiSandboxHandler({
  createVault: async () => ({
    user: { id: "merchant_001" },
    resolveCredentials: async ({ provider }) => {
      calls.push(["credentials", provider]);
      return provider === "fedex"
        ? { apiKey: "merchant-fedex-key", apiSecret: "merchant-fedex-secret" }
        : { clientId: "merchant-ups-id", clientSecret: "merchant-ups-secret" };
    }
  }),
  consumeRateLimit: async () => allowedQuota,
  createClient: async (provider, credentials) => {
    calls.push(["client", provider, credentials]);
    return {
      track: async number => {
        calls.push(["synthetic-reference", provider, number]);
        return provider === "fedex"
          ? { output: { completeTrackResults: [] } }
          : { trackResponse: { shipment: [] } };
      }
    };
  },
  now: () => new Date("2026-11-09T13:10:00.000Z")
});

const fedex = await handler({ request: request(), env, params: { provider: "fedex" } });
assert.equal(fedex.status, 200);
assert.equal(fedex.headers.get("Cache-Control"), "no-store, private");
assert.deepEqual(await fedex.json(), {
  provider: "fedex",
  environment: "official_sandbox",
  result: "passed",
  fixture: "synthetic",
  checkedAt: "2026-11-09T13:10:00.000Z"
});
assert.deepEqual(calls.find(call => call[0] === "synthetic-reference"), [
  "synthetic-reference", "fedex", "999999999999"
]);
assert.equal(JSON.stringify(await (async () => {
  const response = await handler({ request: request(), env, params: { provider: "ups" } });
  return response.json();
})()).includes("merchant-ups-secret"), false);

const upsHandler = createOfficialApiSandboxHandler({
  createVault: async () => ({
    user: { id: "merchant_001" },
    resolveCredentials: async () => ({ clientId: "id", clientSecret: "secret" })
  }),
  consumeRateLimit: async () => allowedQuota,
  createClient: async () => ({
    track: async number => {
      assert.equal(number, "1Z999AA10123456784");
      throw Object.assign(new Error("synthetic tracking record not found"), {
        name: "NotFoundError",
        code: "not_found"
      });
    }
  })
});
const ups = await upsHandler({ request: request(), env, params: { provider: "ups" } });
assert.equal(ups.status, 200, "UPS may report its documented synthetic reference as not found after an authenticated call");
assert.equal((await ups.json()).result, "passed");

let callsAfterDenied = 0;
const throttled = createOfficialApiSandboxHandler({
  createVault: async () => ({
    user: { id: "merchant_001" },
    resolveCredentials: async () => ({ apiKey: "key", apiSecret: "secret" })
  }),
  consumeRateLimit: async () => ({ ...allowedQuota, allowed: false }),
  createClient: async () => { callsAfterDenied += 1; throw new Error("must-not-run"); }
});
const rateLimited = await throttled({ request: request(), env, params: { provider: "fedex" } });
assert.equal(rateLimited.status, 429);
assert.equal(callsAfterDenied, 0);

const noConnection = createOfficialApiSandboxHandler({
  createVault: async () => ({
    user: { id: "merchant_001" },
    resolveCredentials: async () => null
  }),
  consumeRateLimit: async () => allowedQuota
});
const disconnected = await noConnection({ request: request(), env, params: { provider: "fedex" } });
assert.equal(disconnected.status, 409);

const deniedOrigin = await handler({
  request: new Request(origin + "/api/merchant/carriers/fedex/sandbox", {
    method: "POST", headers: { Origin: "https://attacker.invalid" }
  }),
  env,
  params: { provider: "fedex" }
});
assert.equal(deniedOrigin.status, 403);

const unsupported = await handler({ request: request(), env, params: { provider: "dhl-express" } });
assert.equal(unsupported.status, 400);

const unauthorized = createOfficialApiSandboxHandler({
  createVault: async () => { throw new OfficialApiCredentialVaultError("unauthenticated", 401); },
  consumeRateLimit: async () => allowedQuota
});
const noSession = await unauthorized({ request: request(), env, params: { provider: "ups" } });
assert.equal(noSession.status, 401);

// Exercise the real pinned clients with mocked fetch: the sandbox hosts are fixed
// by code and cannot be selected by request body or stored credential fields.
const fedexRequests = [];
const fedexFetch = async (input, init = {}) => {
  const url = new URL(String(input));
  fedexRequests.push({ url: url.toString(), method: init.method || "GET" });
  if (url.origin !== "https://apis-sandbox.fedex.com") throw new Error("non-sandbox FedEx host");
  if (url.pathname === "/oauth/token") {
    return new Response(JSON.stringify({ access_token: "mock-fedex-token", expires_in: 3600 }), { status: 200 });
  }
  if (url.pathname === "/track/v1/trackingnumbers") {
    return new Response(JSON.stringify({ output: { completeTrackResults: [] } }), { status: 200 });
  }
  throw new Error("unexpected FedEx sandbox path");
};
const fedexClient = createSandboxClient("fedex", {
  apiKey: "key", apiSecret: "secret", baseUrl: "https://attacker.invalid"
}, fedexFetch);
const fedexReply = await fedexClient.track("999999999999", AbortSignal.timeout(5_000), 5_000);
assert.ok(Array.isArray(fedexReply.output.completeTrackResults));
assert.equal(fedexRequests.length, 2);
assert.ok(fedexRequests.every(call => call.url.startsWith("https://apis-sandbox.fedex.com/")));

const upsRequests = [];
const upsFetch = async (input, init = {}) => {
  const url = new URL(String(input));
  upsRequests.push({ url: url.toString(), method: init.method || "GET" });
  if (url.origin !== "https://wwwcie.ups.com") throw new Error("non-sandbox UPS host");
  if (url.pathname === "/security/v1/oauth/token") {
    return new Response(JSON.stringify({ access_token: "mock-ups-token", expires_in: "3600" }), { status: 200 });
  }
  if (url.pathname.startsWith("/api/track/v1/details/")) {
    return new Response(JSON.stringify({ trackResponse: { shipment: [] } }), { status: 200 });
  }
  throw new Error("unexpected UPS sandbox path");
};
const upsClient = createSandboxClient("ups", {
  clientId: "id", clientSecret: "secret", baseUrl: "https://attacker.invalid"
}, upsFetch);
const upsReply = await upsClient.track("1Z999AA10123456784", AbortSignal.timeout(5_000), 5_000);
assert.ok(Array.isArray(upsReply.trackResponse.shipment));
assert.equal(upsRequests.length, 2);
assert.ok(upsRequests.every(call => call.url.startsWith("https://wwwcie.ups.com/")));

console.log("Official API sandbox route tests passed: merchant scope, fixed synthetic fixtures, quotas and sandbox-only FedEx/UPS hosts.");
