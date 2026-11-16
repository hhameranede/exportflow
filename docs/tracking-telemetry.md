# Private tracking telemetry sink

## Status

The sink is implemented but **disabled by default**. Two dedicated D1 databases have been provisioned and the schema migration applied. The Pages project has no D1 binding in either environment, so application telemetry is not being written yet.

The Pages Function writes only when the private `EXPORTFLOW_TELEMETRY_DB` D1 binding exists and the Pages execution context exposes `waitUntil`. Preview and Production must use separate D1 databases behind the same binding name.

## Dedicated databases

| Environment | Database | UUID | State |
|---|---|---|---|
| Preview | `exportflow-tracking-telemetry-preview-db` | `decef588-a198-4bdd-9764-e0ce2e2caaee` | Created; migration applied; binding not configured |
| Production | `exportflow-tracking-telemetry-production-db` | `9f90b381-7635-4857-b9f9-fa3a3d23b64b` | Created; migration applied; binding not configured |

Both schemas were inspected through the D1 API. The table and two supporting indexes are present in both databases. Row count is zero in each database. A synthetic fixture insert/read/delete round trip passed against Preview and the test row was deleted. No shipment reference or personal data was used.

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
- The write is a parameterized D1 batch: prune expired records, then insert one event with `INSERT OR IGNORE`.
- Each row has a 14-day expiry timestamp. Expired rows are physically pruned on the next telemetry write (lazy cleanup); if writes stop, expired records may remain stored until a later write. No Cron Trigger is created.
- Missing binding, unavailable `waitUntil`, or D1 failure is fail-open and must not change the tracking result.
- No public read API or user-facing telemetry endpoint is added. Reads should use authenticated Cloudflare D1 tooling only.

## Current binding state

- The Pages project currently reports no D1 bindings in either environment.
- The next step requires a separate approved Pages configuration change: bind Preview to `decef588-a198-4bdd-9764-e0ce2e2caaee` using the name `EXPORTFLOW_TELEMETRY_DB`.
- Keep Production unbound until Preview runtime persistence and redaction are verified. Then consider a separate Production binding to `9f90b381-7635-4857-b9f9-fa3a3d23b64b`.
- Existing ExportFlow intelligence databases are not reused.

## Cost and limits

Cloudflare D1 metrics for 2026-11-16, queried account-wide before provisioning these two new databases, showed 110,229 rows read, 2,997 rows written and approximately 4.47 MiB across the three existing databases. This was a partial-day snapshot. The official Workers Free allowances are 5 million rows read/day, 100,000 rows written/day, 5 GB total storage and 10 databases; Workers Paid includes 100,000 databases, 25 billion rows read/month, 50 million rows written/month and 5 GB included storage. The current Workers billing entitlement itself was not independently read. The account now has five D1 databases total, including the two dedicated telemetry databases.

References: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/), [D1 billing](https://developers.cloudflare.com/d1/observability/billing/).

No D1 binding was configured and no telemetry from live tracking requests has been persisted. No paid ingestion, Pages settings, secrets, Access policies, DNS or Production deployment were changed.
