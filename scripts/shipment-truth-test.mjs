import assert from "node:assert/strict";
import { resolveShipmentTruth } from "../functions/lib/shipment-truth.mjs";

const truth = resolveShipmentTruth({
  source: "carrier",
  status: "in_transit",
  events: [
    {
      time: "2026-11-06T10:00:00+02:00",
      location: "Riyadh",
      description: "Arrived at sorting center",
      stage: "in_transit"
    },
    {
      time: "2026-11-06T08:00:00Z",
      location: "Riyadh",
      description: "Arrived at sorting center",
      stage: "in_transit"
    },
    {
      time: "2026-11-06T08:00:00Z",
      location: "Jeddah",
      description: "Arrived at sorting center",
      stage: "out_for_delivery"
    },
    {
      time: "not-a-date",
      location: "Jeddah",
      description: "Customs inspection required",
      stage: "exception"
    }
  ]
});

assert.equal(truth.timeline.length, 3, "duplicate equivalent events should be deduplicated");
assert.equal(truth.timeline[0].time, "2026-11-06T08:00:00.000Z", "latest valid timestamp should sort first");
assert.equal(truth.status, "out_for_delivery", "selected status should prefer specific recent event");
assert.equal(truth.confidence, "low", "conflicts should reduce confidence");
assert.ok(truth.conflicts.some(conflict => conflict.type === "status_conflict"), "status conflicts should be surfaced");
assert.ok(truth.conflicts.some(conflict => conflict.type === "location_conflict"), "location conflicts should be surfaced");
assert.equal(truth.insights.customs.state, "hold", "customs hold signals should be classified");
assert.equal(truth.insights.delay.level, "confirmed", "delay/exception signals should be classified as confirmed delay");
assert.equal(truth.insights.estimate.source, "insufficient_data", "missing ETA should be explicit");

const delivered = resolveShipmentTruth({
  source: "carrier",
  status: "in_transit",
  expectedDelivery: "2026-11-09",
  events: [
    {
      time: "2026-11-06T09:00:00Z",
      location: "Dubai",
      description: "Delivered to recipient",
      stage: "delivered"
    }
  ]
});

assert.equal(delivered.status, "delivered");
assert.equal(delivered.confidence, "high");
assert.equal(delivered.insights.delay.level, "insufficient_evidence");
assert.equal(delivered.insights.estimate.source, "carrier");
assert.equal(delivered.insights.estimate.value, "2026-11-09");

console.log("Shipment truth normalization and insight tests passed.");
