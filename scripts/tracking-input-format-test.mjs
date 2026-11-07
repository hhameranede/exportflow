import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/track.js";

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
  // An invalid language stops the request before rate limiting or any carrier
  // lookup. Receiving invalid_language proves the number passed the raw-input
  // gate without contacting an external carrier.
  const supportedFormats = [
    "99.34.123456.12345678",
    "P/1234/LABC/2026",
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

  console.log("Tracking input compatibility tests passed without carrier lookups.");
}

await main();
