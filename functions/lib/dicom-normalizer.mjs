const MAX_EVENTS = 100;
const MAX_TEXT = 240;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, limit = MAX_TEXT) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

function safeInstant(value) {
  const raw = cleanText(value, 80);
  if (!raw) return null;
  const milliseconds = Date.parse(raw);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function normalizeStage(value) {
  const text = cleanText(value, 160)?.toLocaleLowerCase("en-US");
  if (!text) return "unknown";

  if (/\b(returned|return to sender|returning to sender)\b/.test(text)) return "returned";
  if (/\b(failed attempt|delivery failed|not delivered|undeliverable|damaged|lost|exception)\b/.test(text)) return "failed_attempt";
  if (/\b(ready for pickup|available for pickup|pickup point)\b/.test(text)) return "ready_for_pickup";
  if (/\b(out for delivery|with delivery driver|on vehicle for delivery)\b/.test(text)) return "out_for_delivery";
  if (/\b(delivered|dropped off|proof of delivery)\b/.test(text)) return "delivered";
  if (/\b(collected from sender|picked up|picked-up|accepted by carrier)\b/.test(text)) return "accepted";
  if (/\b(label created|shipment created|information received|pre.?advice|registered)\b/.test(text)) return "registered";
  if (/\b(in transit|transit|departed|arrived at|received at|processed at|shipment moving)\b/.test(text)) return "in_transit";
  return "unknown";
}

function summaryStatus(stage) {
  if (stage === "delivered") return "delivered";
  if (stage === "out_for_delivery") return "out_for_delivery";
  if (["failed_attempt", "returned"].includes(stage)) return "exception";
  if (["registered", "pending"].includes(stage)) return "pending";
  if (["accepted", "in_transit", "customs", "ready_for_pickup"].includes(stage)) return "in_transit";
  return "unknown";
}

function shipmentRecords(payload) {
  const candidates = Array.isArray(payload) ? payload : [payload];
  const result = [];

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    if (Object.hasOwn(candidate, "returnCode")) {
      if (!String(candidate.returnCode).startsWith("20") || !isRecord(candidate.shipment)) continue;
      result.push(candidate.shipment);
    } else if (isRecord(candidate.shipment)) {
      result.push(candidate.shipment);
    } else {
      result.push(candidate);
    }
  }
  return result;
}

/**
 * Convert a Dicom tracking response into ExportFlow's small, privacy-filtered shape.
 * This prototype performs no HTTP calls and accepts synthetic fixtures only.
 * Account authentication and carrier display authorization are outside this module.
 */
export function normalizeDicomTrackingResponse(payload, { requestedTrackingNumber } = {}) {
  const records = shipmentRecords(payload);
  const expected = cleanText(requestedTrackingNumber, 80);
  const shipment = records.find((record) => {
    const trackingNumber = cleanText(record.trackingNumber, 80);
    return trackingNumber && (!expected || trackingNumber === expected);
  });

  if (!shipment) {
    throw new TypeError(expected
      ? "Dicom response did not match the requested tracking number"
      : "Dicom response did not contain a usable shipment record");
  }
  if (!Array.isArray(shipment.activities)) {
    throw new TypeError("Dicom response did not contain an activity list");
  }

  const events = shipment.activities
    .filter(isRecord)
    .map((activity) => {
      const time = safeInstant(activity.activityDate);
      if (!time) return null;

      const statusText = cleanText(activity.status, 120);
      const detail = cleanText(activity.statusDetail, MAX_TEXT);
      const description = detail || statusText;
      const stage = normalizeStage(statusText || detail);
      const location = cleanText(activity.terminal, 120);
      const code = cleanText(activity.code, 40);

      return {
        time,
        ...(location ? { location } : {}),
        ...(description ? { description } : {}),
        ...(code ? { code } : {}),
        stage,
      };
    })
    .filter(Boolean)
    .sort((left, right) => Date.parse(right.time) - Date.parse(left.time));

  const uniqueEvents = [];
  const seen = new Set();
  for (const event of events) {
    const key = [event.time, event.code || "", event.description || "", event.location || ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueEvents.push(event);
    if (uniqueEvents.length >= MAX_EVENTS) break;
  }

  const currentStage = uniqueEvents[0]?.stage || "unknown";
  return {
    carrier: "dicom",
    tracking_number: cleanText(shipment.trackingNumber, 80),
    status: summaryStatus(currentStage),
    current_stage: currentStage,
    events: uniqueEvents,
  };
}
