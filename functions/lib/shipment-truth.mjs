const normalizeText = (value, max = 320) =>
  typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max)
    : "";

const normalizeStage = value => {
  if (typeof value !== "string") return "unknown";
  const stage = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return /^[a-z_]{2,40}$/.test(stage) ? stage : "unknown";
};

const normalizeSource = value => normalizeText(value, 120);

function parseEventTime(value) {
  const raw = normalizeText(value, 80);
  // Only explicit UTC/offset timestamps are unambiguous enough for chronology.
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/i);
  if (!match) return { iso: null, timestampMs: null };

  const [, year, month, day, hour, minute, second = "0", zone] = match;
  const calendarDate = [year, month, day].join("-");
  const parsedCalendarDate = new Date(calendarDate + "T00:00:00.000Z");
  if (
    !Number.isFinite(parsedCalendarDate.getTime()) ||
    parsedCalendarDate.toISOString().slice(0, 10) !== calendarDate ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    return { iso: null, timestampMs: null };
  }

  if (zone.toUpperCase() !== "Z") {
    const offsetMatch = zone.match(/^([+-])(\d{2}):(\d{2})$/);
    if (!offsetMatch || Number(offsetMatch[2]) > 23 || Number(offsetMatch[3]) > 59) {
      return { iso: null, timestampMs: null };
    }
    // RFC 3339 uses -00:00 to mean that the local offset is unknown.
    if (zone === "-00:00") return { iso: null, timestampMs: null };
  }

  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return { iso: null, timestampMs: null };
  return { iso: new Date(parsed).toISOString(), timestampMs: parsed };
}

function collectSourceRefs(event, fallbackSource) {
  const refs = Array.isArray(event?.sourceRefs)
    ? event.sourceRefs.map(normalizeSource).filter(Boolean)
    : [];
  const directSource = normalizeSource(event?.source);
  const fallback = normalizeSource(fallbackSource);

  if (directSource) refs.push(directSource);
  else if (refs.length === 0 && fallback && fallback !== "unknown") refs.push(fallback);

  return [...new Set(refs)];
}

function normalizeEvent(event, originalIndex, fallbackSource) {
  const stage = normalizeStage(event?.stage || event?.state);
  const description = normalizeText(event?.description, 320);
  const location = normalizeText(event?.location, 180);
  const rawTime = normalizeText(event?.time, 80) || null;
  const { iso, timestampMs } = parseEventTime(rawTime);
  const rawReceivedAt = normalizeText(event?.receivedAt ?? event?.received_at, 80);
  const { iso: receivedAt, timestampMs: receivedAtMs } = parseEventTime(rawReceivedAt);
  const sourceRefs = collectSourceRefs(event, fallbackSource);
  const point = event?.point &&
    Number.isFinite(event.point.latitude) &&
    Number.isFinite(event.point.longitude)
    ? { latitude: event.point.latitude, longitude: event.point.longitude }
    : null;

  return {
    stage,
    description,
    location,
    time: iso,
    rawTime,
    timestampMs,
    receivedAt,
    receivedAtMs,
    source: sourceRefs[0] || "unknown",
    sourceRefs,
    trusted: event?.trusted !== false,
    originalIndex,
    point
  };
}

function dedupeEvents(events) {
  const deduped = [];
  const indexByKey = new Map();

  for (const event of events) {
    const timeKey = Number.isFinite(event.timestampMs)
      ? String(event.timestampMs)
      : "invalid:" + String(event.originalIndex);
    // Do not merge explicitly trusted and untrusted copies of an event.
    const key = [
      event.stage,
      event.location.toLowerCase(),
      event.description.toLowerCase(),
      timeKey,
      String(event.trusted)
    ].join("|");

    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, deduped.length);
      deduped.push({ ...event });
      continue;
    }

    const existing = deduped[existingIndex];
    existing.sourceRefs = [...new Set([...existing.sourceRefs, ...event.sourceRefs])];
    existing.source = existing.sourceRefs[0] || "unknown";
    if (event.originalIndex > existing.originalIndex) {
      existing.originalIndex = event.originalIndex;
    }
    if (
      event.receivedAtMs !== null &&
      (existing.receivedAtMs === null || event.receivedAtMs > existing.receivedAtMs)
    ) {
      existing.receivedAtMs = event.receivedAtMs;
      existing.receivedAt = event.receivedAt;
    }
  }

  return deduped;
}

function compareEvents(a, b) {
  if (a.timestampMs !== b.timestampMs) {
    if (a.timestampMs === null) return 1;
    if (b.timestampMs === null) return -1;
    return b.timestampMs - a.timestampMs;
  }
  return b.originalIndex - a.originalIndex;
}

function findConflicts(events) {
  const byTimestamp = new Map();
  for (const event of events) {
    if (!event.trusted || event.sourceRefs.length === 0 || !Number.isFinite(event.timestampMs)) continue;
    const key = String(event.timestampMs);
    if (!byTimestamp.has(key)) byTimestamp.set(key, []);
    byTimestamp.get(key).push(event);
  }

  const conflicts = [];
  for (const atSameTime of byTimestamp.values()) {
    if (atSameTime.length < 2) continue;

    const stages = [...new Set(atSameTime.map(event => event.stage))];
    const locations = [...new Set(atSameTime.map(event => event.location.toLowerCase()).filter(Boolean))];

    if (stages.length > 1) {
      conflicts.push({
        type: "status_conflict",
        time: atSameTime[0].time,
        values: stages
      });
    }
    if (locations.length > 1) {
      conflicts.push({
        type: "location_conflict",
        time: atSameTime[0].time,
        values: locations
      });
    }
  }
  return conflicts;
}

function latestByReceipt(events) {
  if (events.length === 0) return null;
  const allHaveReceiptTimes = events.every(event => event.receivedAtMs !== null);
  return events.reduce((latest, event) => {
    if (!latest) return event;
    if (allHaveReceiptTimes && event.receivedAtMs !== latest.receivedAtMs) {
      return event.receivedAtMs > latest.receivedAtMs ? event : latest;
    }
    return event.originalIndex > latest.originalIndex ? event : latest;
  }, null);
}

function hasExplicitDelaySignal(event) {
  if (!event) return false;
  const explicitStages = new Set(["delayed", "delivery_delayed", "delay_confirmed"]);
  const explicitDescriptions = [
    /\bshipment delayed\b/i,
    /\bdelivery delayed\b/i,
    /\bdelayed due to\b/i,
    /\bdelivery delay reported\b/i,
    /\bservice disruption\b/i,
    /\bcarrier delay confirmed\b/i
  ];
  return explicitStages.has(event.stage) ||
    explicitDescriptions.some(pattern => pattern.test(event.description));
}

function classifyCustomsEvent(event) {
  if (!event) return null;
  if (
    ["customs_hold", "held_at_customs"].includes(event.stage) ||
    /\b(customs hold|held by customs|detained by customs|inspection required|awaiting (customs )?documents)\b/i.test(event.description)
  ) return { state: "hold", reason: "explicit_customs_hold_signal" };

  if (
    ["customs_released", "released_by_customs"].includes(event.stage) ||
    /\b(released by customs|customs cleared)\b/i.test(event.description)
  ) return { state: "released", reason: "explicit_customs_release_signal" };

  if (
    ["customs_processing", "customs_clearance"].includes(event.stage) ||
    /\b(customs processing|customs clearance in progress|under customs review)\b/i.test(event.description)
  ) return { state: "processing", reason: "explicit_customs_processing_signal" };

  return null;
}

function normalizeExpectedDelivery(value) {
  const raw = normalizeText(value, 80);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(raw + "T00:00:00.000Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw
      ? raw
      : null;
  }
  return parseEventTime(raw).iso ? raw : null;
}

function buildInsights(trustedEvents, latestTrusted, expectedDelivery) {
  const delay = latestTrusted && hasExplicitDelaySignal(latestTrusted)
    ? { level: "possible", reason: "explicit_carrier_delay_signal" }
    : {
        level: "insufficient_evidence",
        reason: latestTrusted?.stage === "delivered"
          ? "shipment_delivered"
          : "no_current_explicit_delay_signal"
      };

  const latestCustomsEvent = trustedEvents
    .filter(event => classifyCustomsEvent(event) !== null)
    .sort(compareEvents)[0] || null;
  const customs = classifyCustomsEvent(latestCustomsEvent) ||
    { state: "insufficient_evidence", reason: "no_explicit_customs_signal" };

  const estimate = expectedDelivery
    ? { source: "carrier", value: expectedDelivery, confidence: "reported" }
    : { source: "insufficient_data", value: null, confidence: "unknown" };

  return {
    delay,
    customs,
    estimate,
    latestTrustedTime: latestTrusted?.time || null
  };
}

function toPublicEvent(event) {
  return {
    stage: event.stage,
    description: event.description || null,
    location: event.location || null,
    time: event.time,
    rawTime: event.rawTime,
    timestampMs: event.timestampMs,
    receivedAt: event.receivedAt,
    source: event.source,
    sourceRefs: event.sourceRefs,
    ...(event.point ? { point: event.point } : {})
  };
}

export function resolveShipmentTruth({
  events = [],
  status = "unknown",
  source = "unknown",
  expectedDelivery = null
} = {}) {
  const normalized = (Array.isArray(events) ? events : [])
    .slice(0, 80)
    .map((event, originalIndex) => normalizeEvent(event, originalIndex, source))
    .filter(event =>
      event.description || event.location || event.rawTime || event.point
    );

  const deduped = dedupeEvents(normalized);
  const timelineEvents = [...deduped].sort(compareEvents);
  const conflicts = findConflicts(timelineEvents);

  // Received means latest ingestion order (or latest explicit receivedAt when
  // all events provide one). Trusted means structurally eligible for chronology:
  // valid zoned event time, source reference, and no trusted:false marker.
  // It does not imply independently audited carrier reliability.
  const latestReceivedEvent = latestByReceipt(deduped);
  const trustedEvents = deduped.filter(event =>
    event.trusted &&
    Number.isFinite(event.timestampMs) &&
    event.sourceRefs.length > 0
  );
  const latestTrustedEvent = [...trustedEvents].sort(compareEvents)[0] || null;

  // Source-quality metadata is not available, so a single provider cannot
  // produce high confidence. Reserve high for a future calibrated model.
  const confidence = conflicts.length > 0
    ? "low"
    : latestTrustedEvent
      ? "medium"
      : "low";

  const expected = normalizeExpectedDelivery(expectedDelivery);
  const timeline = timelineEvents.map(toPublicEvent);
  const latestReceived = latestReceivedEvent ? toPublicEvent(latestReceivedEvent) : null;
  const latestTrusted = latestTrustedEvent ? toPublicEvent(latestTrustedEvent) : null;

  return {
    status: latestTrustedEvent?.stage || normalizeStage(status),
    confidence,
    latestReceived,
    latestTrusted,
    selected: latestTrusted,
    conflicts,
    timeline,
    insights: buildInsights(trustedEvents, latestTrustedEvent, expected)
  };
}
