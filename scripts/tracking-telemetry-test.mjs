import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  persistTrackingEvent,
  sanitizeTrackingEvent,
  scheduleTrackingEvent
} from "../functions/lib/tracking-telemetry.mjs";

// Lock the D1 binding to Pages Preview only. Do not add a root or production
// binding: the latter would attach telemetry persistence to live Production.
const wranglerConfig = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
assert.match(wranglerConfig, /^\[\[env\.preview\.d1_databases\]\]$/m);
assert.match(wranglerConfig, /^binding = "EXPORTFLOW_TELEMETRY_DB"$/m);
assert.match(wranglerConfig, /^database_name = "exportflow-tracking-telemetry-preview-db"$/m);
assert.match(wranglerConfig, /^database_id = "decef588-a198-4bdd-9764-e0ce2e2caaee"$/m);
assert.match(wranglerConfig, /^preview_database_id = "local-exportflow-telemetry"$/m);
assert.match(wranglerConfig, /^migrations_dir = "migrations\/telemetry"$/m);
assert.doesNotMatch(wranglerConfig, /^\[\[d1_databases\]\]$/m);
assert.doesNotMatch(wranglerConfig, /^\[\[env\.production\.d1_databases\]\]$/m);
assert.doesNotMatch(wranglerConfig, /exportflow-tracking-telemetry-production-db/);

const now = new Date("2026-11-16T12:00:00.000Z");
const requestId = "7a1b2c3d-4e5f-4678-9abc-def012345678";
const unsafeInput = {
  event: "exportflow.tracking.lookup",
  requestId,
  outcome: "failure",
  carrier: "DHL Express",
  errorClass: "carrier_unavailable",
  durationMs: 128,
  attempts: [{
    carrier: "DHL Express",
    failureKind: "transport",
    durationMs: 12,
    trackingNumber: "PRIVATE-TRACKING-ID",
    postcode: "PRIVATE-POSTCODE",
    message: "PRIVATE-UPSTREAM-MESSAGE"
  }],
  trackingNumber: "PRIVATE-TRACKING-ID",
  postcode: "PRIVATE-POSTCODE",
  ipAddress: "PRIVATE-IP",
  rawMessage: "PRIVATE-UPSTREAM-MESSAGE",
  recipient: "PRIVATE-RECIPIENT"
};

const sanitized = sanitizeTrackingEvent(unsafeInput, now);
assert.deepEqual(sanitized, {
  requestId,
  occurredAt: "2026-11-16T12:00:00.000Z",
  outcome: "failure",
  carrier: "dhl-express",
  source: null,
  status: null,
  errorClass: "carrier-unavailable",
  durationMs: 128,
  eventCount: null,
  attemptsJson: '[{"carrier":"dhl-express","failureKind":"transport","durationMs":12}]',
  expiresAt: "2026-11-30T12:00:00.000Z"
});

const sanitizedJson = JSON.stringify(sanitized);
for (const secret of [
  "PRIVATE-TRACKING-ID",
  "PRIVATE-POSTCODE",
  "PRIVATE-IP",
  "PRIVATE-UPSTREAM-MESSAGE",
  "PRIVATE-RECIPIENT"
]) {
  assert.equal(sanitizedJson.includes(secret), false, `Sensitive field leaked: ${secret}`);
}

const success = sanitizeTrackingEvent({
  requestId,
  outcome: "success",
  carrier: "UPS",
  source: "UPS",
  status: "delivered",
  durationMs: 250,
  eventCount: 3,
  events: [{ description: "PRIVATE-EVENT", location: "PRIVATE-LOCATION" }]
}, now);
assert.equal(success.outcome, "success");
assert.equal(success.eventCount, 3);
assert.equal(success.attemptsJson, "[]");
assert.equal(success.status, "delivered");
assert.equal(JSON.stringify(success).includes("PRIVATE-EVENT"), false);
assert.equal(JSON.stringify(success).includes("PRIVATE-LOCATION"), false);

assert.equal(sanitizeTrackingEvent({ ...unsafeInput, requestId: "not-a-uuid" }, now), null);
assert.equal(sanitizeTrackingEvent({ ...unsafeInput, outcome: "unknown" }, now), null);
assert.equal(sanitizeTrackingEvent(null, now), null);

function createFakeD1() {
  const state = { statements: [], batches: 0 };
  return {
    state,
    prepare(sql) {
      return {
        bind(...values) {
          const statement = { sql, values };
          state.statements.push(statement);
          return statement;
        }
      };
    },
    async batch(statements) {
      state.batches += 1;
      assert.equal(statements.length, 2);
      return statements.map(() => ({ success: true }));
    }
  };
}

const database = createFakeD1();
assert.equal(await persistTrackingEvent(database, unsafeInput, now), true);
assert.equal(database.state.batches, 1);
assert.equal(database.state.statements.length, 2);
assert.match(database.state.statements[0].sql, /DELETE FROM exportflow_tracking_events/);
assert.match(database.state.statements[0].sql, /expires_at <= \?/);
assert.match(database.state.statements[1].sql, /INSERT OR IGNORE INTO exportflow_tracking_events/);
assert.equal(database.state.statements[1].values.length, 11);
assert.equal(database.state.statements[1].values[0], requestId);
assert.equal(database.state.statements[1].values[9], sanitized.attemptsJson);
assert.equal(JSON.stringify(database.state.statements).includes("PRIVATE-TRACKING-ID"), false);
assert.equal(JSON.stringify(database.state.statements).includes("PRIVATE-POSTCODE"), false);
assert.equal(JSON.stringify(database.state.statements).includes("PRIVATE-UPSTREAM-MESSAGE"), false);

const noBindingContext = { waitUntil() { throw new Error("must not be called"); } };
assert.equal(scheduleTrackingEvent(noBindingContext, {}, unsafeInput), false);
assert.equal(scheduleTrackingEvent({}, { EXPORTFLOW_TELEMETRY_DB: database }, unsafeInput), false);

let scheduled;
const scheduledContext = { waitUntil(promise) { scheduled = promise; } };
const scheduledDatabase = createFakeD1();
assert.equal(scheduleTrackingEvent(
  scheduledContext,
  { EXPORTFLOW_TELEMETRY_DB: scheduledDatabase },
  unsafeInput
), true);
assert.ok(scheduled instanceof Promise);
assert.equal(await scheduled, true);
assert.equal(scheduledDatabase.state.batches, 1);

const failingDatabase = {
  prepare(sql) {
    return { bind(...values) { return { sql, values }; } };
  },
  async batch() {
    throw new Error("private database diagnostic");
  }
};
let failedTask;
assert.equal(scheduleTrackingEvent(
  { waitUntil(promise) { failedTask = promise; } },
  { EXPORTFLOW_TELEMETRY_DB: failingDatabase },
  unsafeInput
), true);
assert.equal(await failedTask, false);

console.log("Tracking telemetry sink tests passed.");
