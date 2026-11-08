import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestPost, trackingFailure } from "../functions/api/track.js";
import { TrackingError } from "../node_modules/universal-parcel-scraper/dist/facade/index.js";

function requestFor(number, language = "xx") {
  return new Request("https://exportflow.me/api/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://exportflow.me"
    },
    body: JSON.stringify({ number, language })
  });
}

async function main() {
  // A carrier challenge plus a fallback no-result must not be presented as
  // proof that the shipment does not exist. These are pure local error tests.
  const mixedFailure = new TrackingError([
    { source: "USPS", kind: "challenge", durationMs: 12 },
    { source: "UPU", kind: "not_found", durationMs: 4 }
  ], { kind: "not_found" });
  const mixedResponse = trackingFailure(mixedFailure);
  assert.equal(mixedResponse.status, 503);
  assert.equal((await mixedResponse.json()).error, "verification_required");

  const confirmedNoResult = new TrackingError([
    { source: "UPU", kind: "not_found", durationMs: 4 }
  ], { kind: "not_found" });
  const notFoundResponse = trackingFailure(confirmedNoResult);
  assert.equal(notFoundResponse.status, 404);
  assert.equal((await notFoundResponse.json()).error, "not_found");

  // An invalid language stops the request before rate limiting or any carrier
  // lookup. Receiving invalid_language proves the number passed the raw-input
  // gate without contacting an external carrier.
  const supportedFormats = [
    "99.34.123456.12345678",
    "1234/12345678",
    "(00) 3 7012345 678901234 7",
    "AB_123456789",
    "AB1".repeat(21) + "A"
  ];

  for (const number of supportedFormats) {
    const response = await onRequestPost({
      request: requestFor(number),
      env: {}
    });
    assert.equal(response.status, 400, "Expected input to pass the number gate: " + number);
    assert.equal((await response.json()).error, "invalid_language");
  }

  const overlong = await onRequestPost({
    request: requestFor("A1".repeat(33)),
    env: {}
  });
  assert.equal(overlong.status, 400);
  assert.equal((await overlong.json()).error, "invalid_tracking_number");

  const unsafePunctuation = await onRequestPost({
    request: requestFor("AB12;1234"),
    env: {}
  });
  assert.equal(unsafePunctuation.status, 400);
  assert.equal((await unsafePunctuation.json()).error, "invalid_tracking_number");

  // Exercise the exact sanitizer expression used by the browser application.
  // This catches accidental double escaping that would strip ordinary characters.
  const appSource = await readFile("app.js", "utf8");
  const sanitizerMatch = appSource.match(/const number = \(value \|\| ""\)\.replace\((\/\[.*?\/g), ""\)\.trim\(\);/);
  assert.ok(sanitizerMatch, "Browser tracking sanitizer must remain discoverable for regression testing");

  const regexLiteral = sanitizerMatch[1];
  const finalSlash = regexLiteral.lastIndexOf("/");
  const sanitizerRegex = new RegExp(regexLiteral.slice(1, finalSlash), regexLiteral.slice(finalSlash + 1));
  const normalizeBrowserInput = value => (value || "").replace(sanitizerRegex, "").trim();

  const unchangedTrackingReferences = [
    "1Z999AA10123456784",
    "1234/12345678",
    "99.34.123456.12345678",
    "(00) 3 7012345 678901234 7",
    "AB_123456789"
  ];
  for (const value of unchangedTrackingReferences) {
    assert.equal(
      normalizeBrowserInput(value),
      value,
      "Browser sanitization must not alter ordinary tracking characters"
    );
  }
  assert.equal(
    normalizeBrowserInput("\u200B1Z999AA10123456784\u200D\uFEFF"),
    "1Z999AA10123456784",
    "Browser sanitization must remove zero-width formatting characters only"
  );

  console.log("Tracking input compatibility and browser sanitizer tests passed without carrier lookups.");
}

await main();
