# Tenant API Authentication and Plan Quotas

## Scope

This change replaces the single shared Worker Bearer token with tenant-scoped API keys and adds a persistent D1 request allowance. It does not publish MCP, enable Map/Crawl/Extract/Search/Research/Browser, or create a billing/subscription checkout system. The public task endpoint remains Fetch-only.

## API key format and storage

- Keys have the form `ef_live_<key-id>_<secret>`.
- The key ID is a 96-bit random public lookup identifier; the secret is 256 random bits.
- `generateTenantApiKey()` creates a one-time token and a SHA-256 hash. Show the token once to the customer and store only `key_hash` in D1.
- Authentication computes the hash of the presented key and queries by both key ID and hash. The tenant ID is always read from the database; caller-supplied tenant identifiers are never authoritative.
- Keys have active/revoked state, optional expiry and explicit scopes. The task endpoint requires `tasks:fetch`.
- No last-used timestamp is written per request, to avoid an unnecessary D1 row write on every call.

## D1 binding and migration

The Worker expects an explicitly configured D1 binding named `EXPORTFLOW_AUTH_DB`. Apply `migrations/0001_tenant_auth_quota.sql` to a dedicated, approved D1 database before adding this binding to any Worker version.

The migration creates:
- `plan_policies`: owner-managed daily/monthly request allowance and policy version.
- `tenants`: active/suspended/closed tenant records and their plan.
- `api_keys`: hashed API credentials, scopes, status and expiry.
- `tenant_request_usage`: per-tenant usage snapshots for each UTC day/month.

The migration deliberately inserts no plan rows or tenant records. Do not invent Free/Pro limits during a technical migration. The owner must decide request allowances and have an approved provisioning workflow before any customer API key can work.

## Platform readiness reporting

- `auth.configured` reports whether the Worker has the D1 binding.
- `auth.ready` is stricter: the quota table must be queryable and at least one non-expired active API key must join to an active tenant and active plan with the `tasks:fetch` scope.
- `liveCapabilities` includes `http.fetch.v1` only when that readiness check succeeds. A binding alone, an empty database, an incomplete migration, or a tenant without an eligible key must not be advertised as a live customer capability.

## Public platform readiness

- Unauthenticated GET /api/v1/platform returns public discovery metadata and performs no D1 queries. It reports auth.configured from binding presence, but auth.ready remains false and liveCapabilities remains empty until a caller presents an API key.
- An authenticated request to /api/v1/platform validates that caller's API key, tenant, plan and tasks:fetch scope, then probes the quota table. Readiness is per-caller, not a scan of all provisioned tenants.
- The readiness response is informational only; POST /api/v1/tasks always re-authenticates and atomically reserves quota. Never use cached readiness as authorization.

## Plan quota semantics

- The plan period and request limit are read from the active server-side plan policy, not supplied by the caller.
- UTC daily windows use `YYYY-MM-DD`; monthly windows use `YYYY-MM`.
- A single conditional SQLite UPSERT consumes one request atomically only when the current window still has capacity. Concurrent requests cannot increment beyond the snapshotted limit.
- The usage row snapshots `plan_code`, `policy_version` and `request_limit`; plan-policy edits apply to the next window, not midway through an existing one.
- A syntactically valid, admitted task consumes one request even if the upstream site subsequently fails. Invalid JSON/contract requests do not consume persistent plan quota, although they do count toward the short-lived per-isolate burst limiter.
- Exhaustion returns HTTP 429 with `Retry-After` and `X-Plan-Limit`, `X-Plan-Remaining`, and `X-Plan-Reset` headers.
- Database failures fail closed with HTTP 503. The in-memory 60 requests/minute limiter remains supplementary burst protection only; it is not the plan quota.
- The daily/monthly period cannot be changed for a plan or reassigned to a tenant during a UTC calendar month in which that tenant has consumed quota. Migration 0002_guard_quota_period_transitions.sql enforces this at the D1 layer; period transitions can occur at the next UTC month boundary. Request-limit and policy-version changes within the same period do not reset an existing window snapshot.

## Pre-authentication abuse protection

- Every POST /api/v1/tasks request passes a per-isolate IP burst guard before key hashing or D1 lookup. It uses Cloudflare's CF-Connecting-IP value and does not trust X-Forwarded-For or X-Real-IP.
- This Worker-local guard is supplementary and is not a global rate limit. Configure the separate Cloudflare zone Rate Limiting rule described in docs/security/tenant-api-edge-rate-limits.md before public launch.

## Fetch usage receipts

The Fetch task response now includes sanitized, in-memory per-attempt usage receipts under `task.usage.receipts`.

Each outbound Fetch attempt (including each redirect hop) can emit:
- Attempt number, outcome, and HTTP status when a response exists.
- Normalized content type and declared Content-Length metadata when valid.
- Bytes observed at the response stream-reader boundary.
- I/O-inclusive wall elapsed time and a safe error code, when applicable.

Receipts intentionally omit URLs, hostnames, query strings, headers, response bodies, cookies and credentials. `elapsedMs` is **not CPU time**; `responseBodyBytesRead` is not total wire egress. The observer is best-effort: callback errors must not change Fetch success/failure. Receipts live only in the current Task result; this change does not persist them to D1 or create a durable audit ledger.

The response continues to report `usage.cost: null`. No EF Credit weight, monetary cost, provider charge, or billable amount is inferred from these measurements.

## Cost Router boundary

The monetary Cost Router budget and shared provider quota pools remain distinct from the task-count allowance in `tenant_request_usage`.

The existing Cost Router D1 adapter did pass a separate, one-shot Cloudflare Workers D1 Binding acceptance using the dedicated `exportflow-cost-router-integration-test` database. That acceptance exercised 11 checks, including reservation, idempotency, settlement/replay, release, concurrent quota contention and cleanup verification. Its temporary harness/binding were removed afterward. It proves only those tested adapter paths in that test run; it does not mean Cost Router is integrated into the current public Fetch execution path or that Production currently has a D1 binding. The active Production Worker settings still report `bindings: []`.

This PR adds only tenant request-count quotas and ephemeral Fetch usage receipts. It does not wire monetary reservations, EF Credit debits, or settlement into Fetch execution.

## Operational prerequisites and safety

1. Choose plan request limits and window periods.
2. Provision plan, tenant and hashed API-key rows through a trusted administrative path; never insert plaintext API keys.
3. Apply the migration to a dedicated D1 database and verify it with controlled synthetic rows.
4. Add `EXPORTFLOW_AUTH_DB` only to a separately approved isolated Worker/Preview first.
5. Validate auth, revocation, expiry, scopes, quota concurrency, and fail-closed behavior in the target Worker runtime.
6. Do not deploy to Production or expose customer keys until the separate release gate is approved.

This source change does not add a D1 binding, create or alter a Cloudflare database, seed customer data, create API keys, or change Production.


Migration 0002_guard_quota_period_transitions.sql is additive. It is included for review but is not applied to any D1 database by this source patch.
