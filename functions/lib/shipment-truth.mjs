const STAGE_ORDER = {
  information_received: 1,
  pending: 1,
  in_transit: 2,
  out_for_delivery: 3,
  available_for_pickup: 3,
  delivered: 4,
  exception: 2,
  failed_attempt: 2,
  returned: 2,
  unknown: 1
};

const DELAY_SIGNALS = ["delay", "delayed", "exception", "held", "failed", "attempt", "weather", "backlog"];
const CUSTOMS_SIGNALS = ["custom", "clearance", "border", "import", "export", "duty", "inspection"];
const CUSTOMS_HOLD_SIGNALS = ["hold", "detained", "inspection required", "awaiting documents"];

const normalizeText = (value, max = 320) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";

const normalizeStage = value => {
  if (typeof value !== "string") return "unknown";
  const stage = value.trim().toLowerCase();
  return /^[a-z_]{2,40}$/.test(stage) ? stage : "unknown";
};

const parseEventTime = value => {
  if (typeof value !== "string" || !value.trim()) return { iso: null, timestampMs: null };
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return { iso: null, timestampMs: null };
  return { iso: new Date(parsed).toISOString(), timestampMs: parsed };
};

function dedupeEvents(events) {
  const deduped = [];
  const indexByKey = new Map();
  for (const event of events) {
    const minuteBucket = Number.isFinite(event.timestampMs)
      ? Math.floor(event.timestampMs / 60_000)
      : `na:${event.description}`;
    const key = [event.stage, event.location.toLowerCase(), event.description.toLowerCase(), minuteBucket].join("|");
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, deduped.length);
      deduped.push({ ...event, sourceRefs: [event.source] });
    } else {
      const existing = deduped[existingIndex];
      if (!existing.sourceRefs.includes(event.source)) existing.sourceRefs.push(event.source);
    }
  }
  return deduped;
}

function compareEvents(a, b) {
  if (Number.isFinite(a.timestampMs) && Number.isFinite(b.timestampMs) && a.timestampMs !== b.timestampMs) {
    return b.timestampMs - a.timestampMs;
  }
  if (Number.isFinite(a.timestampMs) !== Number.isFinite(b.timestampMs)) {
    return Number.isFinite(a.timestampMs) ? -1 : 1;
  }
  return a.originalIndex - b.originalIndex;
}

function findConflicts(events) {
  const byTimestamp = new Map();
  for (const event of events) {
    const key = Number.isFinite(event.timestampMs) ? String(event.timestampMs) : `unknown-${event.originalIndex}`;
    if (!byTimestamp.has(key)) byTimestamp.set(key, []);
    byTimestamp.get(key).push(event);
  }
  const conflicts = [];
  for (const atSameTime of byTimestamp.values()) {
    if (atSameTime.length < 2) continue;
    const stages = new Set(atSameTime.map(event => event.stage));
    const locations = new Set(atSameTime.map(event => event.location.toLowerCase()).filter(Boolean));
    if (stages.size > 1) {
      conflicts.push({
        type: "status_conflict",
        time: atSameTime[0].time,
        values: [...stages]
      });
    }
    if (locations.size > 1) {
      conflicts.push({
        type: "location_conflict",
        time: atSameTime[0].time,
        values: [...locations]
      });
    }
  }
  return conflicts;
}

function eventScore(event, newestTime) {
  let score = 0;
  if (Number.isFinite(event.timestampMs) && Number.isFinite(newestTime)) {
    const ageHours = Math.max(0, (newestTime - event.timestampMs) / 3_600_000);
    score += Math.max(0, 45 - Math.min(45, ageHours));
  }
  score += STAGE_ORDER[event.stage] ? STAGE_ORDER[event.stage] * 8 : 8;
  if (event.location) score += 8;
  if (event.description.length >= 16) score += 6;
  if (event.description.length >= 40) score += 3;
  if (Number.isFinite(event.timestampMs)) score += 10;
  return score;
}

function buildInsights(events, selectedEvent, expectedDelivery) {
  const descriptions = events.map(event => event.description.toLowerCase());
  const hasDelaySignal = descriptions.some(text => DELAY_SIGNALS.some(signal => text.includes(signal)));
  const hasExceptionStage = events.some(event => ["exception", "failed_attempt", "returned"].includes(event.stage));
  const hasCustomsSignal = descriptions.some(text => CUSTOMS_SIGNALS.some(signal => text.includes(signal)));
  const hasCustomsHoldSignal = descriptions.some(text => CUSTOMS_HOLD_SIGNALS.some(signal => text.includes(signal)));

  const delay = hasDelaySignal || hasExceptionStage
    ? { level: "confirmed", reason: "carrier_exception_signal" }
    : events.length >= 2 && selectedEvent?.stage !== "delivered"
      ? { level: "possible", reason: "in_transit_without_completion" }
      : { level: "insufficient_evidence", reason: "no_delay_signals" };

  const customs = hasCustomsHoldSignal
    ? { state: "hold", reason: "customs_hold_signal" }
    : hasCustomsSignal
      ? { state: "processing", reason: "customs_processing_signal" }
      : { state: "insufficient_evidence", reason: "no_customs_signals" };

  const estimate = expectedDelivery
    ? { source: "carrier", value: expectedDelivery, confidence: "reported" }
    : { source: "insufficient_data", value: null, confidence: "unknown" };

  return { delay, customs, estimate };
}

export function resolveShipmentTruth({ events = [], status = "unknown", source = "carrier", expectedDelivery = null } = {}) {
  const normalized = events.slice(0, 80).map((event, originalIndex) => {
    const stage = normalizeStage(event?.stage || event?.state || status);
    const description = normalizeText(event?.description, 320);
    const location = normalizeText(event?.location, 180);
    const { iso, timestampMs } = parseEventTime(normalizeText(event?.time, 80));
    return {
      stage,
      description,
      location,
      time: iso,
      rawTime: normalizeText(event?.time, 80) || null,
      timestampMs,
      source,
      originalIndex,
      point: event?.point && Number.isFinite(event.point.latitude) && Number.isFinite(event.point.longitude)
        ? { latitude: event.point.latitude, longitude: event.point.longitude }
        : null
    };
  }).filter(event => event.description || event.location || event.time || event.point);

  const deduped = dedupeEvents(normalized).sort(compareEvents);
  const conflicts = findConflicts(deduped);
  const newestTime = deduped.find(event => Number.isFinite(event.timestampMs))?.timestampMs ?? null;

  let selectedEvent = null;
  let selectedScore = -1;
  for (const event of deduped) {
    const score = eventScore(event, newestTime);
    if (score > selectedScore) {
      selectedScore = score;
      selectedEvent = event;
    }
  }

  const latest = selectedEvent
    ? {
      stage: selectedEvent.stage,
      description: selectedEvent.description || null,
      location: selectedEvent.location || null,
      time: selectedEvent.time,
      source: selectedEvent.source,
      score: selectedScore
    }
    : null;

  const confidence = conflicts.length > 0
    ? "low"
    : selectedScore >= 55
      ? "high"
      : selectedScore >= 35
        ? "medium"
        : "low";

  const timeline = deduped.map(event => ({
    stage: event.stage,
    description: event.description || null,
    location: event.location || null,
    time: event.time,
    rawTime: event.rawTime,
    source: event.source,
    sourceRefs: event.sourceRefs,
    ...(event.point ? { point: event.point } : {})
  }));

  return {
    status: latest?.stage || normalizeStage(status),
    confidence,
    selected: latest,
    conflicts,
    timeline,
    insights: buildInsights(timeline, latest, expectedDelivery)
  };
}
