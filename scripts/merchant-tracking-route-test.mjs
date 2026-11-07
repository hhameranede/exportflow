import assert from "node:assert/strict";
import {
  createMerchantTrackingHandler
} from "../functions/api/merchant/track.js";
import { SessionBoundMerchantVaultError } from "../functions/lib/session-bound-merchant-vault.mjs";

const origin = "https://exportflow.me";
const env = {
  MERCHANT_APP_ORIGIN: origin,
  ALGERIAN_ELOGISTIA_ENABLED: "false"
};

function request(body, extraHeaders = {}) {
  return new Request(origin + "/api/merchant/track", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  });
}

function vault(credentials = { apiId: "merchant-id", apiToken: "merchant-token" }) {
  return {
    user: { id: "merchant_001" },
    resolveCredentials: async ({ provider }) => {
      assert.equal(provider, "guepex");
      return credentials;
    }
  };
}

const successfulRateLimit = {
  allowed: true,
  limit: 12,
  remaining: 11,
  retryAfterSeconds: 0,
  resetAt: 1_800_000_060,
  resetAfterSeconds: 60
};

const calls = [];
const handler = createMerchantTrackingHandler({
  createVault: async () => vault(),
  consumeRateLimit: async () => successfulRateLimit,
  createClient: async (provider, config) => {
    calls.push({ type: "client", provider, config });
    return {
      track: async trackingNumber => ({
        parcel: { id: "private-parcel-id", trackingNumber, status: "in_transit" },
        events: [
          { status: "created", label: "Colis reçu", at: "2026-11-07T09:00:00+01:00" },
          { status: "in_transit", label: "Appelez 0550 123 456 ou help@example.com", at: "2026-11-07T10:00:00+01:00" }
        ],
        raw: { apiToken: "must-not-leak", address: "private address" }
      })
    };
  }
});

const response = await handler({
  request: request({ provider: "guepex", trackingNumber: "16-AAA111-ZR" }),
  env
});
assert.equal(response.status, 200);
assert.equal(response.headers.get("Cache-Control"), "no-store, private");
assert.equal(response.headers.get("RateLimit-Limit"), "12");
const payload = await response.json();
assert.deepEqual(payload, {
  provider: "guepex",
  trackingNumber: "16-AAA111-ZR",
  status: "in_transit",
  events: [
    { status: "created", label: "Colis reçu", at: "2026-11-07T09:00:00+01:00" },
    { status: "in_transit", label: "Appelez [redacted] ou [redacted]", at: "2026-11-07T10:00:00+01:00" }
  ]
});
assert.equal(JSON.stringify(payload).includes("merchant-token"), false);
assert.equal(JSON.stringify(payload).includes("private address"), false);
assert.equal(JSON.stringify(payload).includes("private-parcel-id"), false);
assert.equal(calls[0].provider, "yalidine");
assert.equal(calls[0].config.baseUrl, "https://api.guepex.app/v1");
assert.equal(calls[0].config.includeRaw, false);

const deniedCalls = [];
const denied = createMerchantTrackingHandler({
  createVault: async () => vault(),
  consumeRateLimit: async () => ({ ...successfulRateLimit, allowed: false, remaining: 0, retryAfterSeconds: 60 }),
  createClient: async () => {
    deniedCalls.push("client");
    throw new Error("must-not-run");
  }
});
const rateLimited = await denied({
  request: request({ provider: "guepex", trackingNumber: "16-AAA111-ZR" }),
  env
});
assert.equal(rateLimited.status, 429);
assert.equal(deniedCalls.length, 0);

const unavailable = createMerchantTrackingHandler({
  createVault: async () => vault(),
  consumeRateLimit: async () => null,
  createClient: async () => { throw new Error("must-not-run"); }
});
const unconfiguredLimiter = await unavailable({
  request: request({ provider: "guepex", trackingNumber: "16-AAA111-ZR" }),
  env
});
assert.equal(unconfiguredLimiter.status, 503);
assert.equal((await unconfiguredLimiter.json()).error, "global_rate_limiter_not_configured");

const noCredential = createMerchantTrackingHandler({
  createVault: async () => vault(null),
  consumeRateLimit: async () => successfulRateLimit,
  createClient: async () => ({
    track: async number => ({ parcel: { status: "in_transit" }, events: [] })
  })
});
const disconnected = await noCredential({
  request: request({ provider: "guepex", trackingNumber: "16-AAA111-ZR" }),
  env
});
assert.equal(disconnected.status, 409);
assert.equal((await disconnected.json()).error, "carrier_not_connected");

const deniedOrigin = await handler({
  request: request({ provider: "guepex", trackingNumber: "16-AAA111-ZR" }, { Origin: "https://attacker.invalid" }),
  env
});
assert.equal(deniedOrigin.status, 403);

const badContentType = await handler({
  request: new Request(origin + "/api/merchant/track", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "text/plain" },
    body: "not-json"
  }),
  env
});
assert.equal(badContentType.status, 415);

const extraMerchantId = await handler({
  request: request({ provider: "guepex", trackingNumber: "16-AAA111-ZR", merchantId: "other_merchant" }),
  env
});
assert.equal(extraMerchantId.status, 400);

const unsupported = await handler({
  request: request({ provider: "__proto__", trackingNumber: "16-AAA111-ZR" }),
  env
});
assert.equal(unsupported.status, 400);

const disabledElogistia = await handler({
  request: request({ provider: "elogistia", trackingNumber: "DZ-123456" }),
  env
});
assert.equal(disabledElogistia.status, 409);
assert.equal((await disabledElogistia.json()).error, "provider_temporarily_disabled");

const authFailure = createMerchantTrackingHandler({
  createVault: async () => { throw new SessionBoundMerchantVaultError("unauthenticated", 401); },
  consumeRateLimit: async () => successfulRateLimit,
  createClient: async () => { throw new Error("must-not-run"); }
});
const unauthenticated = await authFailure({
  request: request({ provider: "guepex", trackingNumber: "16-AAA111-ZR" }),
  env
});
assert.equal(unauthenticated.status, 401);
assert.equal((await unauthenticated.json()).error, "unauthenticated");

console.log("Merchant Algerian tracking route tests passed: session binding, origin guard, quota, credential isolation, SDK boundary and response redaction.");
