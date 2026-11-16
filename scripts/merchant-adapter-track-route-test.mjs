import assert from "node:assert/strict";
import { CARRIERS, carrierAdapter } from "universal-parcel-scraper";
import { createMerchantAdapterTrackHandler } from "../functions/api/merchant/carriers/[provider]/track.js";

const ORIGIN = "https://merchant-preview.example.test";
const env = {
  MERCHANT_APP_ORIGIN: ORIGIN,
  EXPORTFLOW_TRAWL_URL: "https://private-trawl.example.test",
  UPS_CLIENT_ID: "owner-ups-app-id",
  UPS_CLIENT_SECRET: "owner-ups-app-secret",
  FEDEX_API_KEY: "owner-fedex-app-key",
  FEDEX_SECRET_KEY: "owner-fedex-app-secret"
};
const quota = {
  allowed: true,
  limit: 12,
  remaining: 11,
  retryAfterSeconds: 0,
  resetAt: 1_800_000_060,
  resetAfterSeconds: 60
};
const sessions = new Map([
  ["merchant-alpha-session", { user: { id: "merchant_alpha" } }],
  ["merchant-beta-session", { user: { id: "merchant_beta" } }]
]);
const trackerCalls = [];

function request(provider, number, {
  sessionToken = "merchant-alpha-session",
  origin = ORIGIN,
  extra = {}
} = {}) {
  return new Request(ORIGIN + "/api/merchant/carriers/" + provider + "/track", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: "test-session=" + sessionToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ number, ...extra })
  });
}

function trackerFactory(options) {
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
  resolveSession: async request => {
    const token = request.headers.get("Cookie")?.split("=").at(-1);
    return sessions.get(token) ?? null;
  },
  consumeRateLimit: async () => quota,
  trackerFactory,
  fetchFactory: () => async () => new Response("ok")
});

const upsResponse = await handler({
  request: request("ups", "1ZTEST000000000000"),
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

assert.equal(trackerCalls[0].env, env, "Use ExportFlow's app-level adapter environment unchanged");
assert.equal(typeof trackerCalls[0].fetcher, "function");
assert.equal(trackerCalls[0].trawlUrl, env.EXPORTFLOW_TRAWL_URL);
assert.deepEqual(trackerCalls[0].providers, [], "Do not forward merchant parcel IDs to universal providers");
assert.equal(trackerCalls[0].userAgent, "ExportFlow-Merchant/1.0");
assert.deepEqual(trackerCalls[1].input, {
  number: "1ZTEST000000000000",
  carrier: "ups"
});
assert.equal(trackerCalls[1].context.budgetMs, 25_000);

const fedexResponse = await handler({
  request: request("fedex", "999999999999", { sessionToken: "merchant-beta-session" }),
  env,
  params: { provider: "fedex" }
});
assert.equal(fedexResponse.status, 200);
assert.equal((await fedexResponse.json()).provider, "fedex");
assert.equal(trackerCalls[2].env, env);
assert.equal(trackerCalls[2].providers.length, 0);
assert.deepEqual(trackerCalls[3].input, {
  number: "999999999999",
  carrier: "fedex"
});

const widerDirectCarrier = "algerie-poste";
assert.ok(typeof carrierAdapter(widerDirectCarrier) === "string" &&
  carrierAdapter(widerDirectCarrier) !== "universal",
  "A non-UPS/FedEx ExportFlow direct adapter must be present in the catalog");
const widerResponse = await handler({
  request: request(widerDirectCarrier, "EF-TEST-0001", { extra: { postcode: "16000" } }),
  env,
  params: { provider: widerDirectCarrier }
});
assert.equal(widerResponse.status, 200);
assert.equal(trackerCalls[4].env, env);
assert.deepEqual(trackerCalls[4].providers, []);
assert.deepEqual(trackerCalls[5].input, {
  number: "EF-TEST-0001",
  postcode: "16000",
  carrier: widerDirectCarrier
});

const universalCarrier = Object.values(CARRIERS).find(carrier =>
  carrier.capabilities?.selectable === true &&
  carrier.capabilities?.tracking?.mode === "automatic" &&
  carrier.capabilities?.tracking?.adapter === "universal"
);
assert.ok(universalCarrier, "The upstream catalog must have a universal-only carrier for rejection coverage");
const universalResponse = await handler({
  request: request(universalCarrier.id, "UNIVERSAL-TEST-0001"),
  env,
  params: { provider: universalCarrier.id }
});
assert.equal(universalResponse.status, 400);
assert.equal((await universalResponse.json()).error, "unsupported_direct_carrier");


const quarantinedCalls = [];
const quarantinedHandler = createMerchantAdapterTrackHandler({
  resolveSession: async () => sessions.get("merchant-alpha-session"),
  consumeRateLimit: async () => quota,
  isCarrierQuarantined: carrierId => carrierId === "ups",
  trackerFactory: () => { quarantinedCalls.push("tracker"); throw new Error("Quarantined carrier must not reach adapter"); }
});
const quarantined = await quarantinedHandler({
  request: request("ups", "1ZTEST000000000000"),
  env,
  params: { provider: "ups" }
});
assert.equal(quarantined.status, 400);
assert.equal((await quarantined.json()).error, "unsupported_direct_carrier");
assert.deepEqual(quarantinedCalls, [], "Locally quarantined carriers must be stopped before adapter creation");

const wrongOrigin = await handler({
  request: request("ups", "1ZTEST000000000000", { origin: "https://attacker.invalid" }),
  env,
  params: { provider: "ups" }
});
assert.equal(wrongOrigin.status, 403);

const unauthenticated = await handler({
  request: request("ups", "1ZTEST000000000000", { sessionToken: "missing-session" }),
  env,
  params: { provider: "ups" }
});
assert.equal(unauthenticated.status, 401);
assert.equal((await unauthenticated.json()).error, "unauthenticated");

const rateLimited = createMerchantAdapterTrackHandler({
  resolveSession: async () => sessions.get("merchant-alpha-session"),
  consumeRateLimit: async () => ({ ...quota, allowed: false }),
  trackerFactory: () => { throw new Error("Tracker must not run when rate limited"); }
});
const throttled = await rateLimited({
  request: request("ups", "1ZTEST000000000000"),
  env,
  params: { provider: "ups" }
});
assert.equal(throttled.status, 429);

const invalidInput = await handler({
  request: request("ups", "  " + String.fromCharCode(0) + "  "),
  env,
  params: { provider: "ups" }
});
assert.equal(invalidInput.status, 400);

const unknownCarrier = await handler({
  request: request("carrier-does-not-exist", "TEST-123"),
  env,
  params: { provider: "carrier-does-not-exist" }
});
assert.equal(unknownCarrier.status, 400);

console.log("Merchant adapter route tests passed: all selectable direct adapters, no universal fallback, app config reuse, extra carrier inputs, auth, origin and global rate limits.");
