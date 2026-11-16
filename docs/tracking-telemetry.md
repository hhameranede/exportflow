# Private tracking telemetry sink

## Status

The optional D1 sink is implemented. A dedicated Preview D1 database is now bound to Cloudflare Pages Preview as `EXPORTFLOW_TELEMETRY_DB`. Production remains unbound. Runtime persistence must still be verified with a real Pages Function invocation; the existing Cloudflare Access policy protects Preview deployment URLs.

## Dedicated databases

| Environment | Database | UUID | State |
|---|---|---|---|
| Preview | `exportflow-tracking-telemetry-preview-db` | `decef588-a198-4bdd-9764-e0ce2e2caaee` | Created; migration applied; Pages Preview binding configured |
| Production | `exportflow-tracking-telemetry-production-db` | `9f90b381-7635-4857-b9f9-fa3a3d23b64b` | Created; migration applied; Pages Production remains unbound |

Both schemas were inspected through the D1 API. The table and two supporting indexes are present in both databases. A synthetic fixture insert/read/delete round trip passed against Preview and the test row was deleted. Both databases were subsequently verified at zero rows. No shipment reference or personal data was used.

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

- Cloudflare Pages Preview has `EXPORTFLOW_TELEMETRY_DB` bound to `decef588-a198-4bdd-9764-e0ce2e2caaee`.
- Cloudflare Pages Production has no D1 telemetry binding. This remains intentionally unconfigured until Preview application-level persistence is verified.
- The Pages project update preserved existing Preview compatibility date/flags and existing environment variable names. Production config was not modified.
- The Preview binding takes effect in a deployment created after the configuration update. The current Preview branch is being rebuilt to test this exact binding.
- Existing ExportFlow intelligence databases are not reused.

## Cost and limits

Cloudflare D1 metrics for 2026-11-16 showed 110,259 rows read and 3,012 rows written account-wide after database provisioning and the synthetic test. The two new telemetry databases currently contain zero rows. The official Workers Free allowances are 5 million rows read/day, 100,000 rows written/day, 5 GB total storage and 10 databases; Workers Paid includes 100,000 databases, 25 billion rows read/month, 50 million rows written/month and 5 GB included storage. The active Workers billing entitlement itself was not independently read. The account now has five D1 databases total, including the two dedicated telemetry databases.

References: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/), [D1 billing](https://developers.cloudflare.com/d1/observability/billing/).

No Production D1 binding, Production deployment, paid ingestion, secret, Access policy, DNS or permission change was performed.
