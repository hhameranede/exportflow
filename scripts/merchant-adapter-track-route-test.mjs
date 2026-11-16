import assert from "node:assert/strict";
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

function request(provider, number, sessionToken = "merchant-alpha-session", origin = ORIGIN) {
  return new Request(ORIGIN + "/api/merchant/carriers/" + provider + "/track", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: "test-session=" + sessionToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ number })
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
  request: request("fedex", "999999999999", "merchant-beta-session"),
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

let trackerCallsAfterDenied = 0;
const denied = createMerchantAdapterTrackHandler({
  resolveSession: async () => null,
  consumeRateLimit: async () => quota,
  trackerFactory: () => { trackerCallsAfterDenied += 1; }
});
const unauthenticated = await denied({
  request: request("ups", "1ZTEST000000000000", "missing-session"),
  env,
  params: { provider: "ups" }
});
assert.equal(unauthenticated.status, 401);
assert.equal((await unauthenticated.json()).error, "unauthenticated");
assert.equal(trackerCallsAfterDenied, 0);

let limiterCalls = 0;
const wrongOrigin = createMerchantAdapterTrackHandler({
  resolveSession: async () => { throw new Error("must-not-run"); },
  consumeRateLimit: async () => { limiterCalls += 1; return quota; },
  trackerFactory: () => { trackerCallsAfterDenied += 1; }
});
const forbiddenOrigin = await wrongOrigin({
  request: request("ups", "1ZTEST000000000000", "merchant-alpha-session", "https://attacker.invalid"),
  env,
  params: { provider: "ups" }
});
assert.equal(forbiddenOrigin.status, 403);
assert.equal(limiterCalls, 0);
assert.equal(trackerCallsAfterDenied, 0);

const rateLimited = createMerchantAdapterTrackHandler({
  resolveSession: async () => sessions.get("merchant-alpha-session"),
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
  request: request("ups", "  " + String.fromCharCode(0) + "  "),
  env,
  params: { provider: "ups" }
});
assert.equal(invalidInput.status, 400);

const failedLookup = createMerchantAdapterTrackHandler({
  resolveSession: async () => sessions.get("merchant-alpha-session"),
  consumeRateLimit: async () => quota,
  trackerFactory: () => ({
    track: async () => {
      throw Object.assign(new Error("private upstream details"), {
        name: "ChallengeError",
        attempts: [{ source: "ups", kind: "challenge", durationMs: 14 }]
      });
    }
  })
});
const failed = await failedLookup({
  request: request("ups", "1ZTEST000000000000"),
  env,
  params: { provider: "ups" }
});
assert.equal(failed.status, 503);
const failedBody = await failed.json();
assert.equal(failedBody.error, "carrier_verification_required");
assert.equal(JSON.stringify(failedBody).includes("private upstream details"), false);

const noTrawlEnv = { MERCHANT_APP_ORIGIN: ORIGIN };
const noTrawlTracker = [];
const noTrawlHandler = createMerchantAdapterTrackHandler({
  resolveSession: async () => sessions.get("merchant-alpha-session"),
  consumeRateLimit: async () => quota,
  trackerFactory: options => {
    noTrawlTracker.push(options);
    return { track: async () => { throw Object.assign(new Error("challenge"), { name: "ChallengeError" }); } };
  },
  fetchFactory: () => async () => new Response("ok")
});
const noTrawlResult = await noTrawlHandler({
  request: request("fedex", "999999999999"),
  env: noTrawlEnv,
  params: { provider: "fedex" }
});
assert.equal(noTrawlResult.status, 503);
assert.equal("trawlUrl" in noTrawlTracker[0], false,
  "Do not invent or inject a Trawl endpoint when no server-side route is configured");

console.log("Merchant adapter route tests passed: app-configured built-in adapters, merchant session isolation, selected-carrier-only lookups, origin checks, global rate limits and safe errors.");
