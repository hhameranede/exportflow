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

## Plan quota semantics

- The plan period and request limit are read from the active server-side plan policy, not supplied by the caller.
- UTC daily windows use `YYYY-MM-DD`; monthly windows use `YYYY-MM`.
- A single conditional SQLite UPSERT consumes one request atomically only when the current window still has capacity. Concurrent requests cannot increment beyond the snapshotted limit.
- The usage row snapshots `plan_code`, `policy_version` and `request_limit`; plan-policy edits apply to the next window, not midway through an existing one.
- A syntactically valid, admitted task consumes one request even if the upstream site subsequently fails. Invalid JSON/contract requests do not consume persistent plan quota, although they do count toward the short-lived per-isolate burst limiter.
- Exhaustion returns HTTP 429 with `Retry-After` and `X-Plan-Limit`, `X-Plan-Remaining`, and `X-Plan-Reset` headers.
- Database failures fail closed with HTTP 503. The in-memory 60 requests/minute limiter remains supplementary burst protection only; it is not the plan quota.

## Cost Router boundary

The monetary Cost Router budget and provider quota pools remain distinct from the task-count allowance in `tenant_request_usage`. This patch does not claim the existing Cost Router D1 JavaScript adapter has passed Workers D1 Binding runtime acceptance, and it does not wire monetary reservations into Fetch execution.

## Operational prerequisites and safety

1. Choose plan request limits and window periods.
2. Provision plan, tenant and hashed API-key rows through a trusted administrative path; never insert plaintext API keys.
3. Apply the migration to a dedicated D1 database and verify it with controlled synthetic rows.
4. Add `EXPORTFLOW_AUTH_DB` only to a separately approved isolated Worker/Preview first.
5. Validate auth, revocation, expiry, scopes, quota concurrency, and fail-closed behavior in the target Worker runtime.
6. Do not deploy to Production or expose customer keys until the separate release gate is approved.

This source change does not add a D1 binding, create or alter a Cloudflare database, seed customer data, create API keys, or change Production.
