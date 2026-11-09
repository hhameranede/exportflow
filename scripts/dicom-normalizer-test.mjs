import assert from "node:assert/strict";
import { normalizeDicomTrackingResponse } from "../functions/lib/dicom-normalizer.mjs";

const delivered = {
  trackingNumber: "DICOM-SYNTH-0001",
  activities: [
    {
      activityDate: "2026-10-14T09:10:00Z",
      status: "Delivered",
      statusDetail: "Synthetic parcel delivered",
      code: "DL",
      terminal: "SYNTHETIC-TERM-A",
    },
    {
      activityDate: "2026-10-13T15:40:00Z",
      status: "In Transit",
      statusDetail: "Synthetic parcel in transit",
      code: "IT",
      terminal: "SYNTHETIC-TERM-B",
    },
  ],
  sender: { name: "PRIVATE-SENDER-NAME" },
  consignee: { address: "PRIVATE-RECIPIENT-ADDRESS" },
  activityImages: [{ url: "https://private.invalid/pod" }],
  note: "PRIVATE-DELIVERY-NOTE",
};

const result = normalizeDicomTrackingResponse(delivered, {
  requestedTrackingNumber: "DICOM-SYNTH-0001",
});
assert.equal(result.carrier, "dicom");
assert.equal(result.status, "delivered");
assert.equal(result.current_stage, "delivered");
assert.equal(result.events.length, 2);
assert.equal(result.events[0].time, "2026-10-14T09:10:00.000Z");
assert.equal(result.events[0].stage, "delivered");
assert.equal(result.events[1].stage, "in_transit");
assert.equal(JSON.stringify(result).includes("PRIVATE"), false, "private shipment fields must not be projected");

const wrapped = normalizeDicomTrackingResponse([
  { returnCode: "400", shipment: { trackingNumber: "IGNORED", activities: [] } },
  { returnCode: "200", shipment: delivered },
], { requestedTrackingNumber: "DICOM-SYNTH-0001" });
assert.equal(wrapped.status, "delivered", "only successful matching response envelopes should be selected");

const pickup = normalizeDicomTrackingResponse({
  trackingNumber: "DICOM-SYNTH-0002",
  activities: [{ activityDate: "2026-10-14T09:10:00Z", status: "Ready for Pickup" }],
});
assert.equal(pickup.current_stage, "ready_for_pickup");
assert.equal(pickup.status, "in_transit", "pickup readiness remains distinct from recipient delivery");

const failure = normalizeDicomTrackingResponse({
  trackingNumber: "DICOM-SYNTH-0003",
  activities: [{ activityDate: "2026-10-14T09:10:00Z", status: "Delivery Failed" }],
});
assert.equal(failure.current_stage, "failed_attempt");
assert.equal(failure.status, "exception");

assert.throws(
  () => normalizeDicomTrackingResponse(delivered, { requestedTrackingNumber: "OTHER-SYNTHETIC-ID" }),
  /did not match/,
);
assert.throws(() => normalizeDicomTrackingResponse({ trackingNumber: "X", activities: "invalid" }), /activity list/);
assert.throws(() => normalizeDicomTrackingResponse({ returnCode: "401", message: "Unauthorized" }), /usable shipment record/);

const capped = normalizeDicomTrackingResponse({
  trackingNumber: "DICOM-SYNTH-0004",
  activities: Array.from({ length: 150 }, (_, index) => ({
    activityDate: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    status: "In Transit",
    code: String(index),
  })),
});
assert.equal(capped.events.length, 100, "event output must stay bounded");

console.log("Dicom normalizer prototype tests passed (synthetic fixtures only; no network calls).");
