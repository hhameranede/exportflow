import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createOfficialApiMockHandler } from "../functions/api/merchant/carriers/[provider]/mock.js";

const ORIGIN = "https://merchant-preview.example.test";
const FIXED_TIME = new Date("2026-11-12T10:00:00.000Z");
const authenticatedSession = { user: { id: "merchant-test-001" } };

function request(provider, { method = "POST", origin = ORIGIN } = {}) {
  return new Request(`${ORIGIN}/api/merchant/carriers/${provider}/mock`, {
    method,
    headers: origin ? { Origin: origin } : {}
  });
}

const handler = createOfficialApiMockHandler({
  resolveSession: async () => authenticatedSession,
  now: () => FIXED_TIME
});

for (const provider of ["ups", "fedex"]) {
  const response = await handler({
    request: request(provider),
    env: { MERCHANT_APP_ORIGIN: ORIGIN },
    params: { provider }
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, provider);
  assert.equal(payload.environment, "simulated");
  assert.equal(payload.source, "exportflow_fixture");
  assert.equal(payload.result, "passed");
  assert.equal(payload.fixture, "deterministic_mock");
  assert.equal(payload.outboundRequests, 0);
  assert.equal(payload.realShipmentLookup, false);
  assert.equal(payload.checkedAt, FIXED_TIME.toISOString());
  assert.equal(payload.events.length, 3);
  assert.ok(payload.events.every(event => event.label.includes("(simulated)")));
}

const unauthenticated = createOfficialApiMockHandler({
  resolveSession: async () => null,
  now: () => FIXED_TIME
});
const unauthenticatedResponse = await unauthenticated({
  request: request("ups"),
  env: { MERCHANT_APP_ORIGIN: ORIGIN },
  params: { provider: "ups" }
});
assert.equal(unauthenticatedResponse.status, 401);
assert.equal((await unauthenticatedResponse.json()).error, "merchant_session_invalid");

const forbiddenResponse = await handler({
  request: request("fedex", { origin: "https://attacker.invalid" }),
  env: { MERCHANT_APP_ORIGIN: ORIGIN },
  params: { provider: "fedex" }
});
assert.equal(forbiddenResponse.status, 403);

const wrongMethod = await handler({
  request: request("ups", { method: "GET" }),
  env: { MERCHANT_APP_ORIGIN: ORIGIN },
  params: { provider: "ups" }
});
assert.equal(wrongMethod.status, 405);
assert.equal(wrongMethod.headers.get("Allow"), "POST");

const unsupportedProvider = await handler({
  request: request("not-a-carrier"),
  env: { MERCHANT_APP_ORIGIN: ORIGIN },
  params: { provider: "not-a-carrier" }
});
assert.equal(unsupportedProvider.status, 400);

const [routeSource] = await Promise.all([
  readFile("functions/api/merchant/carriers/[provider]/mock.js", "utf8")
]);
assert.ok(!routeSource.includes("UPSApiClient"));
assert.ok(!routeSource.includes("FedExApiClient"));
assert.ok(!routeSource.includes("fetch("),
  "Mock mode must not contain a network request path.");

console.log("Merchant mock API tests passed: UPS/FedEx deterministic fixtures, authenticated same-origin access, and zero outbound requests.");
