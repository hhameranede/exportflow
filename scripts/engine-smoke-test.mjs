import assert from "node:assert/strict";
import { createTracker } from "universal-parcel-scraper/node";

const tracker = createTracker({ providers: [] });
assert.equal(typeof tracker.detect, "function", "tracking engine should expose offline detection");
assert.equal(typeof tracker.track, "function", "tracking engine should expose live tracking");

const detected = tracker.detect("1Z999AA10123456784");
assert.equal(detected.carrier, "ups", "known UPS example should be detected offline");
console.log("Universal Parcel Scraper engine smoke test passed.");
