import assert from "node:assert/strict";
import { TrackingError } from "../node_modules/universal-parcel-scraper/dist/facade/index.js";
import { trackingFailure } from "../functions/api/track.js";

async function classify(error, env = {}) {
  const response = trackingFailure(error, env);
  return { status: response.status, body: await response.json() };
}

const noFedExConnection = await classify(new TrackingError(
  [{ source: "fedex", kind: "challenge", durationMs: 3 }],
  { kind: "challenge" }
));
assert.equal(noFedExConnection.status, 503);
assert.equal(noFedExConnection.body.error, "carrier_connection_not_configured");
assert.deepEqual(noFedExConnection.body.attempts, [
  { source: "fedex", kind: "challenge", durationMs: 3 }
]);

const officialApiConfigured = await classify(new TrackingError(
  [{ source: "fedex", kind: "challenge", durationMs: 4 }],
  { kind: "challenge" }
), { FEDEX_API_KEY: "test-key", FEDEX_SECRET_KEY: "test-secret" });
assert.equal(officialApiConfigured.body.error, "verification_required");

const browserRouteConfigured = await classify(new TrackingError(
  [{ source: "FedEx", kind: "challenge", durationMs: 4 }],
  { kind: "challenge" }
), { EXPORTFLOW_TRAWL_URL: "https://browser-route.example.test" });
assert.equal(browserRouteConfigured.body.error, "verification_required");

const otherCarrierChallenge = await classify(new TrackingError(
  [{ source: "dhl-express", kind: "challenge", durationMs: 2 }],
  { kind: "challenge" }
));
assert.equal(otherCarrierChallenge.body.error, "verification_required");

const networkFailure = await classify(new TrackingError(
  [{ source: "fedex", kind: "transport", durationMs: 12 }],
  { kind: "transport" }
), { FEDEX_API_KEY: "test-key", FEDEX_SECRET_KEY: "test-secret" });
assert.equal(networkFailure.status, 502);
assert.equal(networkFailure.body.error, "carrier_unavailable");

const maintenance = await classify(new TrackingError(
  [{ source: "fedex", kind: "maintenance", durationMs: 6 }],
  { kind: "maintenance" }
));
assert.equal(maintenance.status, 503);
assert.equal(maintenance.body.error, "carrier_maintenance");

const invalidCarrierReply = await classify(new TrackingError(
  [{ source: "fedex", kind: "schema", durationMs: 5 }],
  { kind: "schema" }
));
assert.equal(invalidCarrierReply.status, 502);
assert.equal(invalidCarrierReply.body.error, "carrier_response_invalid");

const timedOut = await classify(new TrackingError(
  [{ source: "fedex", kind: "budget", durationMs: 25_000 }],
  { kind: "budget" }
));
assert.equal(timedOut.status, 504);
assert.equal(timedOut.body.error, "tracking_timeout");

const notFound = await classify(new TrackingError(
  [{ source: "ups", kind: "not_found", durationMs: 8 }],
  { kind: "not_found" }
));
assert.equal(notFound.status, 404);
assert.equal(notFound.body.error, "not_found");

const invalidInput = await classify(new TypeError("Invalid tracking number"));
assert.equal(invalidInput.status, 400);
assert.equal(invalidInput.body.error, "invalid_input");

const malformedPayload = await classify(new SyntaxError("private carrier payload"));
assert.equal(malformedPayload.status, 502);
assert.equal(malformedPayload.body.error, "carrier_response_invalid");

const unexpected = await classify(new Error("private upstream response"));
assert.equal(unexpected.status, 502);
assert.equal(unexpected.body.error, "tracking_unavailable");
assert.equal(JSON.stringify(unexpected.body).includes("private upstream response"), false);
assert.equal(JSON.stringify(noFedExConnection.body).includes("test-secret"), false);

console.log("Tracking error classification tests passed.");
