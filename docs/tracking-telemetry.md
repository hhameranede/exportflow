# Private tracking telemetry sink

## Status

The sink is implemented but **disabled by default**. No database, binding, Pages setting, secret, or Production configuration is created or changed by this code change.

The Pages Function writes only when the private `EXPORTFLOW_TELEMETRY_DB` D1 binding exists and the Pages execution context exposes `waitUntil`. Preview and Production should use separate D1 databases behind the same binding name.

## Persisted fields

The table stores only:
- generated request ID;
- event time and success/failure outcome;
- normalized carrier and adapter source;
- normalized status or mapped error class;
- lookup duration and (for success) event count;
- a bounded list of normalized adapter failure summaries;
- expiry timestamp.

It does not store shipment/tracking numbers, postcodes, IP addresses, request bodies, recipient data, carrier event descriptions or locations, raw upstream messages, credentials, or response payloads. The module applies an independent allow-list projection before any D1 statement is prepared.

## Runtime behavior

- Persistence runs through `context.waitUntil()`, so the tracking response does not wait for D1.
- The write is a parameterized D1 batch: prune expired rows, then insert one event with `INSERT OR IGNORE`.
- Retention is 14 days. Expired rows are pruned on the next telemetry write (lazy cleanup); no Cron Trigger is created.
- Missing binding, unavailable `waitUntil`, or D1 failure is fail-open and must not change the tracking result.
- No public read API or user-facing telemetry endpoint is added. Reads should use authenticated Cloudflare D1 tooling only.

## Provisioning gate

Before enabling:
1. Create dedicated ExportFlow telemetry D1 databases, keeping Preview separate from Production.
2. Apply `migrations/telemetry/0001_create_tracking_events.sql` only to those new databases.
3. Configure the private `EXPORTFLOW_TELEMETRY_DB` binding for each Pages environment, pointing to its matching database.
4. Verify D1 quotas and storage available across the account first.
5. Run a Preview-only test and inspect the persisted row for redaction before considering Production enablement.

The current repository has no D1 binding in `wrangler.toml`, and the Pages project currently reports no D1 bindings in either environment. Existing ExportFlow D1 databases contain other project data and are intentionally not reused.

## Cost and limits

D1 pricing is usage-based. The Cloudflare Workers Free allowance currently lists 5 million rows read/day, 100,000 rows written/day, and 5 GB total storage. Those allowances are shared at account level; the account's current D1 consumption and entitlement have not been verified in this change. When free daily limits are exceeded, D1 queries fail until reset. The sink is best-effort so such failures do not affect tracking.

No database was created and no billable feature was enabled as part of this implementation.
