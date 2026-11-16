import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/track.js";
import { parseTrackingInput } from "universal-parcel-scraper";
import {
  filterPublicCarrierIds,
  isPublicCarrierQuarantined
} from "../functions/lib/public-carrier-policy.mjs";

const formerlyQuarantined = [
  "china-post",
  "india-post",
  "singapore-post",
  "usps",
  "yunexpress"
];

for (const carrier of formerlyQuarantined) {
  assert.equal(
    isPublicCarrierQuarantined(carrier),
    false,
    carrier + " must not be blocked by ExportFlow's local policy"
  );
}

assert.equal(isPublicCarrierQuarantined("UPS"), false);
assert.deepEqual(
  filterPublicCarrierIds(["ups", ...formerlyQuarantined, "fedex"]),
  ["ups", ...formerlyQuarantined, "fedex"]
);

// Detection stays offline and a candidate appearing in an ambiguous match
// must not be treated as a selected carrier.
const ambiguous = parseTrackingInput("9361289722660264016923");
assert.equal(ambiguous.carrier, "unknown");
assert.ok(ambiguous.candidates.includes("usps"));
assert.equal(isPublicCarrierQuarantined(ambiguous.carrier), false);

const samples = [
  ["LX123456789CN", "china-post"],
  ["RR999999987IN", "india-post"],
  ["RR123456789SG", "singapore-post"],
  ["9361289722660264016923", "usps"],
  ["YT1234567890123456", "yunexpress"]
];

const originalFetch = globalThis.fetch;
let upstreamCalls = 0;
globalThis.fetch = async () => {
  upstreamCalls += 1;
  throw new Error("Offline carrier fixture: no network access is permitted in this test");
};

try {
  for (const [number, carrier] of samples) {
    const request = new Request("https://exportflow.me/api/track", {
      method: "POST",
      headers: {
        Origin: "https://exportflow.me",
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ number, carrier, language: "en" })
    });
    const response = await onRequestPost({ request, env: {} });
    assert.notEqual(
      response.status,
      403,
      carrier + " must pass the ExportFlow-local quarantine gate"
    );
  }
  assert.ok(upstreamCalls > 0, "At least one former local hold must reach the mocked adapter fetch");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Public carrier policy tests passed: no carrier IDs are locally quarantined; outbound fetches remained mocked.");
