import assert from "node:assert/strict";
import {
  ALGERIAN_CARRIER_IDS,
  AlgerianConnectorError,
  createAlgerianCarrierConnector
} from "../functions/lib/algerian-carrier-connectors.mjs";

const expectedProviders = [
  "yalidine",
  "guepex",
  "zrexpress",
  "maystro",
  "ecotrack",
  "noest",
  "ecom",
  "mdm",
  "elogistia"
];

assert.deepEqual(ALGERIAN_CARRIER_IDS, expectedProviders);

const calls = [];
const connector = createAlgerianCarrierConnector({
  authorizeMerchantProvider: async context => {
    calls.push({ type: "authorize", context });
    return true;
  },
  resolveCredentials: async context => {
    calls.push({ type: "resolve", context });
    return {
      apiId: "merchant-api-id",
      apiToken: "merchant-api-token",
      fromWilayaId: 16,
      baseUrl: "https://attacker.invalid",
      fetch: () => {
        throw new Error("A stored credential must not inject a fetch implementation");
      },
      includeRaw: true
    };
  },
  createClient: (provider, config) => {
    calls.push({ type: "client", provider, config });
    return {
      track: async number => ({
        parcel: {
          trackingNumber: number,
          status: "in_transit",
          raw: { phone: "0550123456", address: "private address" }
        },
        events: [
          {
            status: "created",
            label: "Colis créé",
            at: "2026-11-07T09:00:00+01:00",
            raw: { apiToken: "must-not-leak" }
          },
          {
            status: "in_transit",
            label: "Contact 0550 123 456 or help@example.com",
            at: "2026-11-07T10:00:00+01:00"
          },
          {
            status: "unexpected-carrier-state",
            label: "Status mapping fallback"
          }
        ]
      })
    };
  }
});

const response = await connector.track({
  merchantId: "merchant_001",
  provider: "guepex",
  trackingNumber: "16-AAA111-ZR"
});

assert.deepEqual(response, {
  provider: "guepex",
  trackingNumber: "16-AAA111-ZR",
  status: "in_transit",
  events: [
    {
      status: "created",
      label: "Colis créé",
      at: "2026-11-07T09:00:00+01:00"
    },
    {
      status: "in_transit",
      label: "Contact [redacted] or [redacted]",
      at: "2026-11-07T10:00:00+01:00"
    },
    {
      status: "unknown",
      label: "Status mapping fallback"
    }
  ]
});

const authorization = calls.find(call => call.type === "authorize");
const credentialLookup = calls.find(call => call.type === "resolve");
const clientCall = calls.find(call => call.type === "client");

assert.deepEqual(authorization.context, {
  merchantId: "merchant_001",
  provider: "guepex",
  operation: "track"
});
assert.deepEqual(credentialLookup.context, {
  merchantId: "merchant_001",
  provider: "guepex"
});
assert.equal(clientCall.provider, "yalidine", "GuepEx must reuse the upstream Yalidine provider");
assert.equal(clientCall.config.baseUrl, "https://api.guepex.app/v1", "GuepEx must use only its fixed upstream endpoint");
assert.equal(clientCall.config.timeoutMs, 10_000);
assert.equal(clientCall.config.includeRaw, false);
assert.equal(clientCall.config.apiId, "merchant-api-id");
assert.equal(clientCall.config.apiToken, "merchant-api-token");
assert.equal(clientCall.config.fromWilayaId, 16);
assert.equal("fetch" in clientCall.config, false, "Stored credentials must not inject a fetch implementation");
assert.equal("raw" in response, false, "Raw provider payloads must not be returned");
assert.equal(JSON.stringify(response).includes("merchant-api-token"), false);
assert.equal(JSON.stringify(response).includes("private address"), false);
assert.equal(JSON.stringify(response).includes("help@example.com"), false);

let credentialLookupsAfterDeniedRequest = 0;
const denied = createAlgerianCarrierConnector({
  authorizeMerchantProvider: async () => false,
  resolveCredentials: async () => {
    credentialLookupsAfterDeniedRequest += 1;
    return { apiKey: "never-read" };
  },
  createClient: () => {
    throw new Error("The SDK must not be initialized for an unauthorized merchant");
  }
});

await assert.rejects(
  () => denied.track({
    merchantId: "merchant_001",
    provider: "zrexpress",
    trackingNumber: "16-AAA111-ZR"
  }),
  error => error instanceof AlgerianConnectorError && error.code === "forbidden"
);
assert.equal(credentialLookupsAfterDeniedRequest, 0, "Authorization must happen before secret retrieval");

await assert.rejects(
  () => connector.track({
    merchantId: "merchant_001",
    provider: "unknown-carrier",
    trackingNumber: "16-AAA111-ZR"
  }),
  error => error instanceof AlgerianConnectorError && error.code === "unsupported_provider"
);

await assert.rejects(
  () => connector.track({
    merchantId: "merchant_001",
    provider: "yalidine",
    trackingNumber: "../not-a-tracking-number"
  }),
  error => error instanceof AlgerianConnectorError && error.code === "invalid_tracking_number"
);

const noCredentials = createAlgerianCarrierConnector({
  authorizeMerchantProvider: async () => true,
  resolveCredentials: async () => ({ apiToken: "missing-required-field" }),
  createClient: () => {
    throw new Error("The SDK must not be initialized without all required credentials");
  }
});

await assert.rejects(
  () => noCredentials.track({
    merchantId: "merchant_001",
    provider: "zrexpress",
    trackingNumber: "16-AAA111-ZR"
  }),
  error => error instanceof AlgerianConnectorError && error.code === "credentials_incomplete"
);

const invalidEcotrackCourier = createAlgerianCarrierConnector({
  authorizeMerchantProvider: async () => true,
  resolveCredentials: async () => ({ token: "secret", courier: "https://attacker.invalid" }),
  createClient: () => {
    throw new Error("An arbitrary Ecotrack host must never reach the SDK");
  }
});

await assert.rejects(
  () => invalidEcotrackCourier.track({
    merchantId: "merchant_001",
    provider: "ecotrack",
    trackingNumber: "16-AAA111-ZR"
  }),
  error => error instanceof AlgerianConnectorError && error.code === "unsupported_courier"
);

const failedUpstream = createAlgerianCarrierConnector({
  authorizeMerchantProvider: async () => true,
  resolveCredentials: async () => ({ apiKey: "secret-key", tenant: "tenant-1" }),
  createClient: () => ({
    track: async () => {
      const error = new Error("Do not expose this error or any credential-like detail");
      error.code = "AUTH_FAILED";
      throw error;
    }
  })
});

await assert.rejects(
  () => failedUpstream.track({
    merchantId: "merchant_001",
    provider: "zrexpress",
    trackingNumber: "16-AAA111-ZR"
  }),
  error => error instanceof AlgerianConnectorError &&
    error.code === "upstream_auth_failed" &&
    !error.message.includes("credential-like")
);

console.log("Algerian connector boundary tests passed.");
