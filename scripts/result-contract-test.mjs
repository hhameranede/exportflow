import assert from "node:assert/strict";
import { projectResult } from "../functions/api/track.js";

const stages = [
  "registered",
  "pre_transit",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "available_for_pickup",
  "failed_attempt",
  "exception",
  "return_to_sender",
  "unknown"
];

for (const stage of stages) {
  const projected = projectResult({
    carrier: "test-carrier",
    source: "carrier",
    result: {
      current_stage: stage,
      events: [{
        time: "2026-11-06T10:30:00Z",
        location: "Test facility",
        description: `Fixture status: ${stage}`,
        stage
      }]
    }
  });

  assert.equal(projected.status, stage, `Status should survive projection: ${stage}`);
  assert.equal(projected.events.length, 1);
  assert.equal(projected.events[0].stage, stage);
}

const sanitized = projectResult({
  carrier: "UPS\nInjected",
  source: "carrier\u0000source",
  result: {
    current_stage: "delivered",
    expected_delivery: "2026-11-06\nforged",
    service_name: "Express\u0000Service",
    events: [{
      time: "2026-11-06T10:30:00Z\u0000",
      location: "Hub\nInjected",
      description: "Delivered\u007f<script>",
      stage: "delivered",
      privateRecipient: "must not escape"
    }]
  }
});

assert.equal(sanitized.carrier, "UPSInjected");
assert.equal(sanitized.source, "carriersource");
assert.equal(sanitized.expectedDelivery, "2026-11-06forged");
assert.equal(sanitized.service, "ExpressService");
assert.equal(sanitized.events[0].time, "2026-11-06T10:30:00Z");
assert.equal(sanitized.events[0].location, "HubInjected");
assert.equal(sanitized.events[0].description, "Delivered<script>");
assert.equal(Object.hasOwn(sanitized.events[0], "privateRecipient"), false);
assert.equal(projectResult({ result: { current_stage: "Delivered!" } }).status, "unknown");

const manyEvents = Array.from({ length: 75 }, (_, index) => ({
  time: `2026-11-06T10:${String(index % 60).padStart(2, "0")}:00Z`,
  description: `Event ${index}`,
  stage: "in_transit"
}));
assert.equal(projectResult({ result: { current_stage: "in_transit", events: manyEvents } }).events.length, 60);

console.log(JSON.stringify({
  resultContract: "passed",
  statusFixtures: stages.length,
  eventLimit: 60,
  controlCharacters: "sanitized",
  unknownFields: "dropped"
}, null, 2));
