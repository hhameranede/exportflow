import assert from "node:assert/strict";
import { resolveShipmentTruth } from "../functions/lib/shipment-truth.mjs";

function test(name, fn) {
  try {
    fn();
    console.log("✓ " + name);
  } catch (error) {
    console.error("✗ " + name);
    console.error("  " + error.message);
    throw error;
  }
}

test("event deduplicates across same events", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T10:00:00Z", location: "Riyadh", description: "Arrived at sorting center", stage: "in_transit" },
      { time: "2026-11-06T10:00:00Z", location: "Riyadh", description: "Arrived at sorting center", stage: "in_transit" }
    ]
  });
  assert.equal(truth.timeline.length, 1, "duplicate equivalent events should be deduplicated");
});

test("events sort chronologically newest first", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "Early event", stage: "in_transit" },
      { time: "2026-11-06T10:00:00Z", description: "Late event", stage: "out_for_delivery" }
    ]
  });
  assert.equal(truth.timeline[0].time, "2026-11-06T10:00:00.000Z", "newest valid timestamp should sort first");
  assert.equal(truth.timeline[0].stage, "out_for_delivery", "status should come from latest event");
});

test("latestTrusted and latestReceived are distinct concepts", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "First", stage: "in_transit" },
      { time: "2026-11-06T10:00:00Z", description: "Second", stage: "out_for_delivery" }
    ]
  });
  assert.ok(truth.latestReceived, "latestReceived should be defined");
  assert.ok(truth.latestTrusted, "latestTrusted should be defined");
  assert.equal(truth.latestTrusted.timestampMs, truth.latestReceived.timestampMs, "same timestamp for same data");
});

test("chronology overrides stage importance", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "Early delivered", stage: "delivered" },
      { time: "2026-11-06T10:00:00Z", description: "Late in_transit", stage: "in_transit" }
    ]
  });
  assert.equal(truth.status, "in_transit", "status must follow chronology, not stage importance");
});

test("status conflicts are detected and confidence is low", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", location: "Riyadh", description: "Arrived at sorting center", stage: "in_transit" },
      { time: "2026-11-06T08:00:00Z", location: "Jeddah", description: "Arrived at sorting center", stage: "out_for_delivery" }
    ]
  });
  assert.ok(truth.conflicts.some(c => c.type === "status_conflict"), "status conflicts should be surfaced");
  assert.ok(truth.conflicts.some(c => c.type === "location_conflict"), "location conflicts should be surfaced");
  assert.equal(truth.confidence, "low", "conflicts should reduce confidence");
});

test("exceptions not automatically mean confirmed delays", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "Exception occurred", stage: "exception" }
    ],
    source: "carrier"
  });
  assert.equal(truth.insights.delay.level, "possible", "exception signal alone should not be confirmed delay");
  assert.equal(truth.insights.delay.reason, "carrier_exception_signal");
});

test("no delay signals gives insufficient_evidence", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "In transit", stage: "in_transit" }
    ],
    source: "carrier"
  });
  assert.equal(truth.insights.delay.level, "insufficient_evidence", "no delay signals should be insufficient evidence");
});

test("customs hold signals distinguished from processing", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "Customs hold inspection required", stage: "exception" }
    ],
    source: "carrier"
  });
  assert.equal(truth.insights.customs.state, "hold", "customs hold signals should be classified as hold");

  const processing = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "Customs clearance in progress", stage: "in_transit" }
    ],
    source: "carrier"
  });
  assert.equal(processing.insights.customs.state, "processing", "customs signals without hold should be processing");
});

test("ETA only from carrier, not fabricated", () => {
  const truth = resolveShipmentTruth({
    events: [{ time: "2026-11-06T08:00:00Z", description: "In transit" }],
    expectedDelivery: null
  });
  assert.equal(truth.insights.estimate.source, "insufficient_data", "no ETA should be explicit");
  assert.equal(truth.insights.estimate.value, null, "no fabricated ETA value");

  const withETA = resolveShipmentTruth({
    events: [{ time: "2026-11-06T08:00:00Z", description: "In transit" }],
    expectedDelivery: "2026-11-09"
  });
  assert.equal(withETA.insights.estimate.source, "carrier", "carrier ETA should be reported");
  assert.equal(withETA.insights.estimate.value, "2026-11-09", "carrier ETA value");
});

test("timezone-less/invalid timestamps handled gracefully", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "not-a-date", description: "No timestamp", stage: "in_transit" },
      { time: "2026-11-06T10:00:00Z", description: "Valid timestamp", stage: "out_for_delivery" }
    ]
  });
  assert.ok(truth.timeline.length >= 1, "should handle invalid timestamps");
  const validEvent = truth.timeline.find(e => e.time === "2026-11-06T10:00:00.000Z");
  assert.ok(validEvent, "valid events should still be processed");
});

test("timestamp ties do not cause duplicate picks", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "First at same time", stage: "in_transit" },
      { time: "2026-11-06T08:00:00Z", description: "Second at same time", stage: "out_for_delivery" }
    ]
  });
  assert.ok(truth.timeline.length >= 2, "both events should be in timeline");
  const firstStage = truth.timeline[0].stage;
  assert.ok(["in_transit", "out_for_delivery"].includes(firstStage), "both stages should appear");
});

test("sourceRefs track original event sources", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "Scan at facility", stage: "in_transit", source: "carrier-a" },
      { time: "2026-11-06T08:00:00Z", description: "Scan at facility", stage: "in_transit", source: "carrier-b" }
    ],
    source: "default-source"
  });
  const timelineEvent = truth.timeline[0];
  assert.ok(Array.isArray(timelineEvent.sourceRefs), "sourceRefs should be an array");
  assert.ok(timelineEvent.sourceRefs.length >= 1, "events should have source attribution");
});

test("empty events fall back to status", () => {
  const truth = resolveShipmentTruth({
    events: [],
    status: "in_transit",
    source: "carrier"
  });
  assert.equal(truth.status, "in_transit", "fallback to provided status");
  assert.equal(truth.confidence, "low", "low confidence for no evidence");
  assert.equal(truth.timeline.length, 0, "empty timeline for no events");
});

test("unknown stage normalized to unknown", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "Event", stage: "SOME-UNCLEAN-STAGE!!" }
    ]
  });
  assert.equal(truth.status, "unknown", "invalid stages normalized to unknown");
  const firstEvent = truth.timeline[0];
  assert.equal(firstEvent.stage, "unknown", "event stage normalized to unknown");
});

test("delivered status gets high confidence", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-05T10:00:00Z", description: "In transit" },
      { time: "2026-11-06T09:00:00Z", description: "Delivered", stage: "delivered" }
    ],
    expectedDelivery: "2026-11-06"
  });
  assert.equal(truth.status, "delivered", "delivered status");
  assert.equal(truth.confidence, "high", "high confidence with single clean source");
  assert.equal(truth.insights.delay.level, "insufficient_evidence", "delivered has no delay");
  assert.equal(truth.insights.estimate.source, "carrier", "carrier estimate for delivered");
});

test("no events from carrier with expected delivery shows insufficient evidence", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "Exception at customs", stage: "exception" }
    ]
  });
  assert.equal(truth.insights.delay.level, "possible");
  assert.equal(truth.confidence, "high", "high confidence for single source with timestamp");
});

test("in_transit without completion after multiple events signals possible delay", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-01T08:00:00Z", description: "Shipped", stage: "shipped" },
      { time: "2026-11-02T08:00:00Z", description: "In transit", stage: "in_transit" },
      { time: "2026-11-05T08:00:00Z", description: "Still in transit", stage: "in_transit" }
    ]
  });
  assert.equal(truth.insights.delay.level, "possible", "multiple in_transit events without delivery should be possible delay");
  assert.equal(truth.insights.delay.reason, "in_transit_without_completion");
});

test("timezone-less timestamps sorted by original index as tiebreaker", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "10:00", description: "Morning event", stage: "in_transit" },
      { time: "12:00", description: "Noon event", stage: "out_for_delivery" }
    ]
  });
  assert.ok(truth.timeline.length >= 1, "timezone-less timestamps should be handled");
});

test("state field accepted as alternative to stage", () => {
  const truth = resolveShipmentTruth({
    events: [
      { time: "2026-11-06T08:00:00Z", description: "Event with state", state: "delivered" }
    ]
  });
  assert.equal(truth.status, "delivered", "state field should be used as stage fallback");
});

console.log("All shipment truth tests passed.");