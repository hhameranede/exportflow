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

const event = (time, stage, description = stage, extra = {}) => ({
  time,
  stage,
  description,
  ...extra
});

test("exact duplicate events merge source provenance", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T10:00:00Z", "in_transit", "Arrived at sorting center"),
      event("2026-11-06T10:00:00Z", "in_transit", "Arrived at sorting center", { source: "carrier-b" })
    ]
  });
  assert.equal(truth.timeline.length, 1);
  assert.deepEqual([...truth.timeline[0].sourceRefs].sort(), ["carrier-a", "carrier-b"]);
});

test("different scans within the same minute are not collapsed", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T10:00:05Z", "in_transit", "Facility scan"),
      event("2026-11-06T10:00:45Z", "in_transit", "Facility scan")
    ]
  });
  assert.equal(truth.timeline.length, 2);
});

test("timeline sorts valid event times newest first", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T08:00:00Z", "in_transit", "Early event"),
      event("2026-11-06T10:00:00Z", "out_for_delivery", "Late event")
    ]
  });
  assert.equal(truth.timeline[0].stage, "out_for_delivery");
  assert.equal(truth.status, "out_for_delivery");
});

test("latestReceived and latestTrusted represent different facts", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T10:00:00Z", "out_for_delivery", "Newer carrier scan"),
      event("2026-11-06T08:00:00Z", "in_transit", "Late-arriving older scan")
    ]
  });
  assert.equal(truth.latestReceived.description, "Late-arriving older scan");
  assert.equal(truth.latestTrusted.description, "Newer carrier scan");
  assert.notEqual(truth.latestReceived.timestampMs, truth.latestTrusted.timestampMs);
});

test("explicit receivedAt timestamps override ingestion order when complete", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T10:00:00Z", "out_for_delivery", "Newer scan", {
        receivedAt: "2026-11-06T10:04:00Z"
      }),
      event("2026-11-06T08:00:00Z", "in_transit", "Older scan received later", {
        receivedAt: "2026-11-06T10:05:00Z"
      })
    ]
  });
  assert.equal(truth.latestReceived.description, "Older scan received later");
  assert.equal(truth.latestTrusted.description, "Newer scan");
});

test("event-level source references are preserved", () => {
  const truth = resolveShipmentTruth({
    source: "fallback-source",
    events: [
      event("2026-11-06T10:00:00Z", "in_transit", "Carrier A scan", { source: "carrier-a" }),
      event("2026-11-06T09:00:00Z", "in_transit", "Carrier B scan", { source: "carrier-b" })
    ]
  });
  assert.deepEqual(truth.timeline.map(item => item.source), ["carrier-a", "carrier-b"]);
  assert.deepEqual(truth.timeline.map(item => item.sourceRefs[0]), ["carrier-a", "carrier-b"]);
});

test("timezone-less timestamps are retained but not trusted", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [event("2026-11-06T10:00:00", "delivered", "Ambiguous local timestamp")]
  });
  assert.equal(truth.timeline[0].time, null);
  assert.equal(truth.timeline[0].rawTime, "2026-11-06T10:00:00");
  assert.equal(truth.latestTrusted, null);
  assert.equal(truth.confidence, "low");
});

test("invalid calendar timestamps do not become trusted facts", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-02-30T10:00:00Z", "delivered", "Impossible calendar date"),
      event("2026-11-06T09:00:00+01:00", "in_transit", "Valid offset timestamp")
    ]
  });
  assert.equal(truth.latestTrusted.stage, "in_transit");
  assert.equal(truth.latestTrusted.time, "2026-11-06T08:00:00.000Z");
});

test("explicitly untrusted events are excluded from trusted chronology", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T10:00:00Z", "delivered", "Unverified imported scan", { trusted: false }),
      event("2026-11-06T09:00:00Z", "in_transit", "Validated scan")
    ]
  });
  assert.equal(truth.latestReceived.description, "Unverified imported scan");
  assert.equal(truth.latestTrusted.description, "Validated scan");
  assert.equal(truth.status, "in_transit");
});

test("single-source timestamp evidence is medium, not high confidence", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [event("2026-11-06T10:00:00Z", "delivered", "Delivered")]
  });
  assert.equal(truth.confidence, "medium");
});

test("same-time status and location conflicts reduce confidence", () => {
  const truth = resolveShipmentTruth({
    events: [
      event("2026-11-06T08:00:00Z", "in_transit", "Arrived at facility", { location: "Riyadh" }),
      event("2026-11-06T08:00:00Z", "out_for_delivery", "Out for delivery", {
        location: "Jeddah",
        source: "carrier-b"
      })
    ],
    source: "carrier-a"
  });
  assert.ok(truth.conflicts.some(conflict => conflict.type === "status_conflict"));
  assert.ok(truth.conflicts.some(conflict => conflict.type === "location_conflict"));
  assert.equal(truth.confidence, "low");
});

test("generic exception alone is insufficient evidence of delay", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [event("2026-11-06T08:00:00Z", "exception", "Exception occurred")]
  });
  assert.equal(truth.insights.delay.level, "insufficient_evidence");
});

test("two ordinary scans alone do not imply a delay", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T08:00:00Z", "in_transit", "Departed facility"),
      event("2026-11-06T10:00:00Z", "in_transit", "Arrived at facility")
    ]
  });
  assert.equal(truth.insights.delay.level, "insufficient_evidence");
});

test("explicit current carrier delay evidence is classified as possible, not confirmed", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [event("2026-11-06T08:00:00Z", "delayed", "Shipment delayed due to operational disruption")]
  });
  assert.equal(truth.insights.delay.level, "possible");
  assert.equal(truth.insights.delay.reason, "explicit_carrier_delay_signal");
});

test("a later normal or delivered scan clears an older possible delay signal", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T08:00:00Z", "delayed", "Shipment delayed due to weather"),
      event("2026-11-06T10:00:00Z", "delivered", "Delivered to recipient")
    ]
  });
  assert.equal(truth.insights.delay.level, "insufficient_evidence");
  assert.equal(truth.insights.delay.reason, "shipment_delivered");
});

test("latest customs event supersedes an older hold", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T08:00:00Z", "customs_hold", "Customs hold: inspection required"),
      event("2026-11-06T10:00:00Z", "customs_released", "Released by customs")
    ]
  });
  assert.equal(truth.insights.customs.state, "released");
});

test("customs hold and active processing are distinguished", () => {
  const hold = resolveShipmentTruth({
    source: "carrier-a",
    events: [event("2026-11-06T08:00:00Z", "exception", "Customs hold: inspection required")]
  });
  assert.equal(hold.insights.customs.state, "hold");

  const processing = resolveShipmentTruth({
    source: "carrier-a",
    events: [event("2026-11-06T08:00:00Z", "customs_processing", "Customs clearance in progress")]
  });
  assert.equal(processing.insights.customs.state, "processing");
});

test("ETA is reported only when supplied as a valid carrier date or zoned timestamp", () => {
  const noEta = resolveShipmentTruth({
    source: "carrier-a",
    events: [event("2026-11-06T08:00:00Z", "in_transit")]
  });
  assert.equal(noEta.insights.estimate.source, "insufficient_data");
  assert.equal(noEta.insights.estimate.value, null);

  const reportedEta = resolveShipmentTruth({
    source: "carrier-a",
    events: [event("2026-11-06T08:00:00Z", "in_transit")],
    expectedDelivery: "2026-11-09"
  });
  assert.equal(reportedEta.insights.estimate.source, "carrier");
  assert.equal(reportedEta.insights.estimate.value, "2026-11-09");

  const invalidEta = resolveShipmentTruth({
    source: "carrier-a",
    events: [event("2026-11-06T08:00:00Z", "in_transit")],
    expectedDelivery: "2026-02-30"
  });
  assert.equal(invalidEta.insights.estimate.source, "insufficient_data");
});

test("chronology overrides stage importance", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T08:00:00Z", "delivered", "Earlier delivered event"),
      event("2026-11-06T10:00:00Z", "in_transit", "Newer in-transit event")
    ]
  });
  assert.equal(truth.status, "in_transit");
});

test("unknown stages are normalized safely", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [event("2026-11-06T08:00:00Z", "SOME-UNCLEAN-STAGE!!", "Unknown event")]
  });
  assert.equal(truth.timeline[0].stage, "unknown");
  assert.equal(truth.status, "unknown");
});

test("empty event lists fall back to supplied status without inventing evidence", () => {
  const truth = resolveShipmentTruth({ events: [], status: "in_transit" });
  assert.equal(truth.status, "in_transit");
  assert.equal(truth.confidence, "low");
  assert.equal(truth.latestReceived, null);
  assert.equal(truth.latestTrusted, null);
  assert.equal(truth.timeline.length, 0);
});


test("invalid timezone offsets are retained but excluded from trusted chronology", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T10:00:00+25:00", "delivered", "Impossible UTC offset"),
      event("2026-11-06T11:00:00-00:00", "delivered", "Unknown local offset")
    ]
  });
  assert.equal(truth.latestTrusted, null);
  assert.equal(truth.confidence, "low");
  assert.equal(truth.timeline.length, 2);
});

test("trusted and explicitly untrusted duplicates are not merged", () => {
  const truth = resolveShipmentTruth({
    source: "carrier-a",
    events: [
      event("2026-11-06T10:00:00Z", "in_transit", "Same provider scan", { source: "carrier-a" }),
      event("2026-11-06T10:00:00Z", "in_transit", "Same provider scan", {
        trusted: false,
        source: "carrier-b"
      })
    ]
  });
  assert.equal(truth.timeline.length, 2);
  assert.equal(truth.latestReceived.source, "carrier-b");
  assert.equal(truth.latestTrusted.source, "carrier-a");
});

console.log("All shipment truth tests passed.");
