import assert from "node:assert/strict";
import {
  adapterEnvironment,
  createMerchantAdapterTrackHandler
} from "../functions/api/merchant/carriers/[provider]/track.js";
import { OfficialApiCredentialVaultError } from "../functions/lib/official-api-credential-vault.mjs";

const ORIGIN = "https://merchant-preview.example.test";
const env = { MERCHANT_APP_ORIGIN: ORIGIN };
const quota = {
  allowed: true,
  limit: 12,
  remaining: 11,
  retryAfterSeconds: 0,
  resetAt: 1_800_000_060,
  resetAfterSeconds: 60
};

const merchantCredentials = {
  merchant_alpha: {
    ups: { clientId: "alpha-ups-id", clientSecret: "alpha-ups-secret" },
    fedex: { apiKey: "alpha-fedex-key", apiSecret: "alpha-fedex-secret" }
  },
  merchant_beta: {
    ups: { clientId: "beta-ups-id", clientSecret: "beta-ups-secret" },
    fedex: { apiKey: "beta-fedex-key", apiSecret: "beta-fedex-secret" }
  }
};
const trackerCalls = [];

function request(provider, number, merchantId = "merchant_alpha", origin = ORIGIN) {
  return new Request(ORIGIN + "/api/merchant/carriers/" + provider + "/track", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-Test-Merchant": merchantId
    },
    body: JSON.stringify({ number })
  });
}

function createTrackerFactory(options) {
  trackerCalls.push(options);
  return {
    track: async (input, context) => {
      trackerCalls.push({ input, context });
      return {
        carrier: input.carrier.toUpperCase(),
        source: input.carrier,
        result: {
          current_stage: "in_transit",
          expected_delivery: "2026-11-18",
          service_name: "Test service",
          events: [{
            time: "2026-11-16T15:00:00Z",
            location: "Test facility",
            description: "Shipment departed facility",
            stage: "in_transit"
          }]
        },
        attempts: [{ source: input.carrier, kind: "ok", durationMs: 12 }]
      };
    }
  };
}

const handler = createMerchantAdapterTrackHandler({
  createVault: async request => {
    const merchantId = request.headers.get("X-Test-Merchant");
    return {
      user: { id: merchantId },
      resolveCredentials: async ({ provider }) => merchantCredentials[merchantId]?.[provider] ?? null
    };
  },
  consumeRateLimit: async () => quota,
  trackerFactory: createTrackerFactory
});

const upsResponse = await handler({
  request: request("ups", "1ZTEST000000000000", "merchant_alpha"),
  env,
  params: { provider: "ups" }
});
assert.equal(upsResponse.status, 200);
assert.equal(upsResponse.headers.get("Cache-Control"), "no-store, private");
const upsBody = await upsResponse.json();
assert.equal(upsBody.provider, "ups");
assert.equal(upsBody.carrier, "UPS");
assert.equal(upsBody.status, "in_transit");
assert.equal(upsBody.events.length, 1);
assert.equal(JSON.stringify(upsBody).includes("alpha-ups-secret"), false);
assert.equal(trackerCalls[0].env.UPS_CLIENT_ID, "alpha-ups-id");
assert.equal(trackerCalls[0].env.UPS_CLIENT_SECRET, "alpha-ups-secret");
assert.equal(trackerCalls[0].env.UPS_API_URL, "https://wwwcie.ups.com");
assert.deepEqual(trackerCalls[0].providers, []);
assert.deepEqual(trackerCalls[1].input, {
  number: "1ZTEST000000000000",
  carrier: "ups"
});

const fedexResponse = await handler({
  request: request("fedex", "999999999999", "merchant_beta"),
  env,
  params: { provider: "fedex" }
});
assert.equal(fedexResponse.status, 200);
const fedexBody = await fedexResponse.json();
assert.equal(fedexBody.provider, "fedex");
assert.equal(trackerCalls[2].env.FEDEX_API_KEY, "beta-fedex-key");
assert.equal(trackerCalls[2].env.FEDEX_SECRET_KEY, "beta-fedex-secret");
assert.equal(trackerCalls[2].env.FEDEX_API_URL, "https://apis-sandbox.fedex.com");
assert.deepEqual(trackerCalls[2].providers, []);
assert.equal(JSON.stringify(fedexBody).includes("beta-fedex-secret"), false);

assert.deepEqual(adapterEnvironment("ups", merchantCredentials.merchant_beta.ups), {
  UPS_CLIENT_ID: "beta-ups-id",
  UPS_CLIENT_SECRET: "beta-ups-secret",
  UPS_API_URL: "https://wwwcie.ups.com"
});
assert.deepEqual(adapterEnvironment("fedex", merchantCredentials.merchant_alpha.fedex), {
  FEDEX_API_KEY: "alpha-fedex-key",
  FEDEX_SECRET_KEY: "alpha-fedex-secret",
  FEDEX_API_URL: "https://apis-sandbox.fedex.com"
});

let vaultCalls = 0;
let trackerCallsAfterDenied = 0;
const forbidden = createMerchantAdapterTrackHandler({
  createVault: async () => { vaultCalls += 1; throw new Error("must-not-run"); },
  consumeRateLimit: async () => quota,
  trackerFactory: () => { trackerCallsAfterDenied += 1; }
});
const wrongOrigin = await forbidden({
  request: request("ups", "1ZTEST000000000000", "merchant_alpha", "https://attacker.invalid"),
  env,
  params: { provider: "ups" }
});
assert.equal(wrongOrigin.status, 403);
assert.equal(vaultCalls, 0);
assert.equal(trackerCallsAfterDenied, 0);

const noSession = createMerchantAdapterTrackHandler({
  createVault: async () => { throw new OfficialApiCredentialVaultError("unauthenticated", 401); },
  consumeRateLimit: async () => quota
});
const unauthenticated = await noSession({
  request: request("ups", "1ZTEST000000000000"),
  env,
  params: { provider: "ups" }
});
assert.equal(unauthenticated.status, 401);

const noCredentials = createMerchantAdapterTrackHandler({
  createVault: async () => ({
    user: { id: "merchant_empty" },
    resolveCredentials: async () => null
  }),
  consumeRateLimit: async () => quota
});
const disconnected = await noCredentials({
  request: request("fedex", "999999999999"),
  env,
  params: { provider: "fedex" }
});
assert.equal(disconnected.status, 409);
assert.equal((await disconnected.json()).error, "carrier_not_connected");

const rateLimited = createMerchantAdapterTrackHandler({
  createVault: async () => ({
    user: { id: "merchant_alpha" },
    resolveCredentials: async () => merchantCredentials.merchant_alpha.ups
  }),
  consumeRateLimit: async () => ({ ...quota, allowed: false }),
  trackerFactory: () => { trackerCallsAfterDenied += 1; }
});
const throttled = await rateLimited({
  request: request("ups", "1ZTEST000000000000"),
  env,
  params: { provider: "ups" }
});
assert.equal(throttled.status, 429);
assert.equal(trackerCallsAfterDenied, 0);

const unsupported = await handler({
  request: request("dhl", "123456789"),
  env,
  params: { provider: "dhl" }
});
assert.equal(unsupported.status, 400);

const invalidInput = await handler({
  request: request("ups", "  \u0000  "),
  env,
  params: { provider: "ups" }
});
assert.equal(invalidInput.status, 400);

const failedLookup = createMerchantAdapterTrackHandler({
  createVault: async () => ({
    user: { id: "merchant_alpha" },
    resolveCredentials: async () => merchantCredentials.merchant_alpha.ups
  }),
  consumeRateLimit: async () => quota,
  trackerFactory: () => ({
    track: async () => {
      throw Object.assign(new Error("private upstream details"), {
        name: "TrackingError",
        attempts: [{ source: "ups", kind: "transport", durationMs: 14 }]
      });
    }
  })
});
const failed = await failedLookup({
  request: request("ups", "1ZTEST000000000000"),
  env,
  params: { provider: "ups" }
});
assert.equal(failed.status, 502);
const failedBody = await failed.json();
assert.equal(failedBody.error, "carrier_lookup_failed");
assert.equal(JSON.stringify(failedBody).includes("private upstream details"), false);
assert.equal(JSON.stringify(failedBody).includes("alpha-ups-secret"), false);

console.log("Merchant adapter route tests passed: UPS/FedEx existing-adapter configuration, per-tenant credentials, selected-carrier-only lookups, auth, origin, rate limits and redacted errors.");
