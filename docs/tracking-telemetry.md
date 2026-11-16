# Private tracking telemetry sink

## Status

The optional D1 sink is implemented and protected by a default-off runtime binding check. The dedicated Preview and Production D1 databases are provisioned and migrated. The Preview binding is now declared in the source-controlled Wrangler configuration under `env.preview`; it must not exist at the root level or under `env.production`.

A previous dashboard/API-only Pages binding was visible before a deployment but absent again after Wrangler-configured deployment. Cloudflare documents that the Wrangler file is the source of truth for Pages projects that use one. The source-controlled Preview-only binding below is the durable configuration; the next deployment of this commit must prove that Cloudflare applies it.

## Dedicated databases

| Environment | Database | UUID | State |
|---|---|---|---|
| Preview | `exportflow-tracking-telemetry-preview-db` | `decef588-a198-4bdd-9764-e0ce2e2caaee` | Created; migration applied; Preview-only binding declared in `wrangler.toml`; awaiting new deployment verification |
| Production | `exportflow-tracking-telemetry-production-db` | `9f90b381-7635-4857-b9f9-fa3a3d23b64b` | Created; migration applied; intentionally unbound |

Both schemas were inspected through the D1 API. The table and two supporting indexes are present in both databases. A synthetic fixture insert/read/delete round trip passed against Preview and the test row was deleted. Both databases were subsequently verified at zero rows. No shipment reference or personal data was used.

## Wrangler configuration and environment isolation

The binding is declared only as:

```toml
[[env.preview.d1_databases]]
binding = "EXPORTFLOW_TELEMETRY_DB"
database_name = "exportflow-tracking-telemetry-preview-db"
database_id = "decef588-a198-4bdd-9764-e0ce2e2caaee"
```

There is no top-level `[[d1_databases]]` and no `[[env.production.d1_databases]]`. A regression assertion enforces that separation. Cloudflare Pages supports `[env.preview]` and `[env.production]` as the only two environment overrides, and treats the Wrangler configuration file as the source of truth when present.

References: [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [Pages D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/), [D1 environment configuration](https://developers.cloudflare.com/d1/configuration/environments/).

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

## Current verification state — 2026-11-16

- The latest dashboard/API-only Preview deployment `0d680bb5-bd43-40af-88f2-fc12d88c24a5` completed Build and Deploy, but its final Pages project configuration again showed no D1 binding. This exposed the conflict between dashboard-only configuration and the Wrangler source-of-truth file.
- The new source-controlled `env.preview.d1_databases` binding is the corrective change. Its CI and Preview deployment are pending.
- Cloudflare Access still protects `*.exportflow-aja.pages.dev` with the existing approved-member One-time PIN policy. A public fetch of the Preview `/api/health` endpoint returns `login_required`.
- A read-only inventory found no existing Access Service Tokens, and the current Pages Access application policy only allows approved member emails. No service token or Access policy was created/changed. No login, bypass or credential use occurred.
- Preview D1 currently contains zero rows and no live Pages telemetry event has been verified. Account Pages Functions metrics show no Preview Function invocation within the checked post-deployment window, consistent with Access blocking the external request before Pages.
- Production remains unbound. The separate Production telemetry database is only provisioned/migrated; it is not connected to Pages.

## Cost and limits

Cloudflare D1 metrics for 2026-11-16 showed approximately 110,259 rows read and 3,012 rows written account-wide around provisioning and synthetic tests. The two new telemetry databases currently contain zero rows. The official Workers Free allowances are 5 million rows read/day, 100,000 rows written/day, 5 GB total storage and 10 databases; Workers Paid includes 100,000 databases, 25 billion rows read/month, 50 million rows written/month and 5 GB included storage. The active Workers billing entitlement itself was not independently read. The account has five D1 databases total.

References: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/), [D1 billing](https://developers.cloudflare.com/d1/observability/billing/).

No Production D1 binding, Production deployment, paid ingestion, secret, Access policy, DNS or permission change was performed.
