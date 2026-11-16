const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DELETE_EXPIRED_SQL = `
  DELETE FROM exportflow_tracking_events
  WHERE expires_at <= ?
`;

const INSERT_EVENT_SQL = `
  INSERT OR IGNORE INTO exportflow_tracking_events (
    request_id,
    occurred_at,
    outcome,
    carrier,
    source,
    status,
    error_class,
    duration_ms,
    event_count,
    attempts_json,
    expires_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function safeIdentifier(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const result = value.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return result || fallback;
}

function safeStage(value) {
  return typeof value === "string" && /^[a-z_]{2,40}$/.test(value)
    ? value
    : null;
}

function safeDuration(value) {
  return Number.isFinite(value) && value >= 0
    ? Math.min(2_147_483_647, Math.round(value))
    : null;
}

function safeEventCount(value) {
  return Number.isSafeInteger(value) && value >= 0
    ? Math.min(1_000, value)
    : null;
}

function safeAttempts(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map(attempt => ({
    carrier: safeIdentifier(attempt?.carrier, "unknown"),
    failureKind: safeIdentifier(attempt?.failureKind, "unknown"),
    durationMs: safeDuration(attempt?.durationMs)
  }));
}

/**
 * Projects a runtime diagnostic onto the deliberately small persisted schema.
 * Unknown fields (including parcel IDs, postcodes, IPs and upstream messages)
 * are never copied.
 */
export function sanitizeTrackingEvent(record, now = new Date()) {
  if (!record || typeof record !== "object") return null;
  if (typeof record.requestId !== "string" || !REQUEST_ID_PATTERN.test(record.requestId)) return null;
  if (record.outcome !== "success" && record.outcome !== "failure") return null;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null;

  const occurredAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + RETENTION_MS).toISOString();
  const isSuccess = record.outcome === "success";

  return {
    requestId: record.requestId.toLowerCase(),
    occurredAt,
    outcome: record.outcome,
    carrier: safeIdentifier(record.carrier, "unknown"),
    source: safeIdentifier(record.source),
    status: safeStage(record.status),
    errorClass: isSuccess ? null : safeIdentifier(record.errorClass),
    durationMs: safeDuration(record.durationMs),
    eventCount: isSuccess ? safeEventCount(record.eventCount) : null,
    attemptsJson: JSON.stringify(isSuccess ? [] : safeAttempts(record.attempts)),
    expiresAt
  };
}

/**
 * Writes one sanitized event and prunes expired rows in the same D1 batch.
 * The D1 binding is private to the Pages Function; this module exposes no
 * public read or write route.
 */
export async function persistTrackingEvent(database, record, now = new Date()) {
  if (!database || typeof database.prepare !== "function" || typeof database.batch !== "function") {
    return false;
  }

  const event = sanitizeTrackingEvent(record, now);
  if (!event) return false;

  const prune = database.prepare(DELETE_EXPIRED_SQL).bind(event.occurredAt);
  const insert = database.prepare(INSERT_EVENT_SQL).bind(
    event.requestId,
    event.occurredAt,
    event.outcome,
    event.carrier,
    event.source,
    event.status,
    event.errorClass,
    event.durationMs,
    event.eventCount,
    event.attemptsJson,
    event.expiresAt
  );

  const results = await database.batch([prune, insert]);
  if (!Array.isArray(results) || results.some(result => result?.success === false)) {
    throw new Error("Tracking telemetry batch did not complete successfully");
  }
  return true;
}

/**
 * Schedules best-effort persistence without delaying the tracking response.
 * Missing bindings, waitUntil errors, and D1 failures are intentionally
 * fail-open: diagnostics must never break carrier tracking.
 */
export function scheduleTrackingEvent(context, env, record) {
  const database = env?.EXPORTFLOW_TELEMETRY_DB;
  if (!database || typeof context?.waitUntil !== "function") return false;

  try {
    const persistence = persistTrackingEvent(database, record).catch(() => false);
    context.waitUntil(persistence);
    return true;
  } catch {
    return false;
  }
}
