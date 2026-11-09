import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/track.js";
import {
  filterPublicCarrierIds,
  isPublicCarrierQuarantined
} from "../functions/lib/public-carrier-policy.mjs";

assert.equal(isPublicCarrierQuarantined("USPS"), true);
assert.equal(isPublicCarrierQuarantined("ups"), false);
assert.deepEqual(
  filterPublicCarrierIds(["ups", "usps", "fedex", "yunexpress"]),
  ["ups", "fedex"]
);

const originalFetch = globalThis.fetch;
let upstreamCalls = 0;
globalThis.fetch = async () => {
  upstreamCalls += 1;
  throw new Error("The restricted route must not make an upstream request");
};

try {
  const request = new Request("https://exportflow.me/api/track", {
    method: "POST",
    headers: {
      Origin: "https://exportflow.me",
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      number: "TEST-TRACKING-0001",
      carrier: "usps"
    })
  });
  const response = await onRequestPost({ request, env: {} });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "carrier_authorization_required"
  });
  assert.equal(upstreamCalls, 0, "A blocked public route must not contact the carrier");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Public carrier policy tests passed: USPS is blocked before network access and other carrier IDs remain available.");
