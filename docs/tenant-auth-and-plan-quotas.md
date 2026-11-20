# ExportFlow Tenant API Authentication and Request Quotas

## Scope and release status

This implementation adds tenant-scoped developer API keys and persistent daily/monthly request-count quotas to both the REST Task endpoint and MCP execution tools. It is source code in a Draft PR only. It is not active in the deployed Production Worker or the currently deployed MCP Worker until a separately approved release and D1 binding are configured.

Human account sessions (Better Auth) and developer API credentials are separate identity systems:

- `AUTH_DB` remains the Better Auth database for human users, sessions and OAuth accounts.
- `EXPORTFLOW_AUTH_DB` is a separate, dedicated D1 database for plans, tenants, API keys and request usage.
- Do not bind both names to the same database by default, and do not treat a Google sign-in session as a developer API key.

## API key format and storage

- Keys have the form `ef_live_<key-id>_<secret>`.
- Key ID is 96 bits of random lookup material; secret is 256 bits of random material.
- `generateTenantApiKey()` returns one-time plaintext token material and its SHA-256 digest. Reveal the token once through a trusted provisioning process; never persist or log the plaintext token.
- D1 stores only the 64-character SHA-256 digest. Verification hashes the supplied full token and selects the matching key ID + digest.
- Tenant ID, plan, scope, key status, expiry and request limit are read from D1. Caller-provided tenant or plan identifiers are never authoritative.
- Keys support active/revoked status, expiry and explicit scopes. A scope can be one of `tasks:fetch`, `tasks:map`, `tasks:crawl`, or `tasks:extract`; `tasks:*` and `*` are supported wildcards.
- No per-request last-used timestamp is written.

## Shared REST + MCP authorization boundary

Both REST and MCP use `src/core/tenant-task-gateway.js`:

1. Per-isolate pre-auth IP burst guard using only Cloudflare's `CF-Connecting-IP`; caller-supplied `X-Forwarded-For` and `X-Real-IP` are ignored.
2. Tenant API key authentication, expiry, tenant/plan state and operation-specific scope validation.
3. Per-isolate tenant burst limiter.
4. Request contract validation and public egress/schema validation.
5. One atomic D1 request-quota reservation.
6. Task execution only after all previous steps pass.

REST `POST /api/v1/tasks` currently requires `tasks:fetch` because the public REST task contract is still Fetch-only.

MCP maps tools to scopes:
- `web_fetch` → `tasks:fetch`
- `web_map` → `tasks:map`
- `web_crawl` → `tasks:crawl`
- `web_extract` → `tasks:extract`

The read-only `tools/list`, MCP initialization/health and `exportflow_capabilities` discovery do not execute a tenant task. The actual task tools declare HTTP Bearer authentication and reject missing/invalid API keys. The existing Cloudflare weighted MCP Rate Limit binding remains a separate IP-level abuse guard; it is not the tenant plan quota.

## D1 schema and migrations

The Worker expects a separate D1 binding named `EXPORTFLOW_AUTH_DB`. Apply migrations in order:

1. `migrations/0001_tenant_auth_quota.sql`
2. `migrations/0002_guard_quota_period_transitions.sql`
3. `migrations/0003_tenant_admin_audit_log.sql`

Tables:
- `plan_policies`: owner-managed daily/monthly request allowance and policy version.
- `tenants`: active/suspended/closed tenant records and assigned plan.
- `api_keys`: key ID, digest, scopes, status and expiry.
- `tenant_request_usage`: per-tenant UTC window snapshots, consumed request count and limit.

The migrations intentionally seed no plan, tenant or API key. Do not invent Free/Developer/Pro allowances. Decide limits and approve the trusted provisioning/revocation workflow before onboarding customers.

The existing dedicated integration-test D1 database has previously received these schema migrations. This PR does not re-apply migrations or change any D1 database. Production currently has no `EXPORTFLOW_AUTH_DB` binding configured.

## Privileged Tenant Lifecycle Service — isolated implementation

The Draft implementation adds `src/core/tenant-admin.js` as an internal D1-backed service. It does not add an HTTP route, public provisioning endpoint, dashboard or production binding.

Supported operations:
- Create/update owner-managed plan policies with validated periods, positive integer request limits and explicit policy versions.
- Provision a tenant only when its target plan is active.
- Issue a scoped API key only for an active tenant on an active plan. The plaintext key is returned once; D1 stores only the salted SHA-256 digest and the audit record excludes both token and digest.
- Revoke an active key only when both tenant ID and key ID match.
- Rotate an active key in one D1 batch: revoke the old key, insert the replacement, and append both audit events atomically.
- Suspend/close tenants and reassign active plans. A closed tenant cannot be reactivated through this service.

Every mutating operation requires an injected `authorizeAdmin` function. The caller must derive the operator identity from a verified server-side session and an explicit owner/admin role; request-body fields, query parameters and caller-supplied headers must never establish authority. Construction fails without this function, and every operation fails closed when it denies access. No Better Auth role mapping or public route is wired in this PR.

Migration `0003_tenant_admin_audit_log.sql` adds an append-only audit table with update/delete guards. Each D1 mutation and its audit event are submitted in the same `D1Database.batch()`; if the batch fails, the operation returns a sanitized 503. The migration has not been applied to any database. The service remains draft-only until the verified owner-role integration and real D1 Binding acceptance are separately reviewed.

## Quota semantics

- This is a persistent **request-count quota**, not EF Credits, a monetary budget, provider COGS, or a billing ledger.
- The active server-side plan policy supplies the quota period and request limit; callers cannot choose them.
- Daily window IDs use UTC `YYYY-MM-DD`; monthly windows use UTC `YYYY-MM`.
- A single conditional D1 UPSERT consumes one request only when capacity remains. It is atomic at the D1 database layer and prevents the counter exceeding the snapshotted window limit.
- The usage row snapshots `plan_code`, `policy_version` and `request_limit`; later policy edits do not change a window already in progress.
- A valid, admitted task consumes one request even if the upstream site later fails. Invalid task arguments, malformed schemas and egress-disallowed URLs are rejected before persistent quota reservation.
- Exhaustion returns HTTP 429 on REST with `Retry-After`, `X-Plan-Limit`, `X-Plan-Remaining` and `X-Plan-Reset`. MCP returns an `isError` tool result with quota/reset metadata.
- D1/auth failures fail closed with HTTP 503 for REST and a structured MCP tool error. No fallback to anonymous task execution exists.
- A per-isolate 60 requests/minute tenant burst guard is supplementary only. The pre-auth IP guard is 300 requests/minute per isolate. Neither is a globally consistent quota.
- Migration 0002 prevents changing the daily/monthly period mid-month for a plan/tenant with consumed quota. Request-limit and policy-version changes do not reset an existing window snapshot.

## Readiness reporting

- Unauthenticated `GET /api/v1/platform` returns discovery metadata, reports only whether the binding exists, performs no D1 query, and keeps `auth.ready=false` and `liveCapabilities=[]`.
- An authenticated platform request validates that caller's tenant key, active tenant/plan and `tasks:fetch` scope, then probes the quota schema. Readiness is per caller, not a scan of every tenant.
- The readiness response is informational only. Each Task/MCP execution always re-authenticates and reserves quota; never cache readiness as authorization.

## Important exclusions

This implementation does not include:
- Public provisioning/admin HTTP endpoint or dashboard, and the verified Better Auth owner/admin role integration.
- Durable task records or a durable usage-receipt ledger.
- Cost Router reservation/settlement, EF Credit weights, monetary billing, invoices, checkout, subscriptions, webhooks, top-ups or refunds.
- Search, Research or Browser runtime enablement.
- Production D1 binding, schema migration, plan/tenant/key seeding, Worker upload or deployment.

## Required acceptance before customer enablement

1. Choose plan limits and policy versioning, and bind the internal lifecycle service to a verified server-side owner/admin identity without trusting caller-controlled fields.
2. Apply migrations to a dedicated, explicitly approved non-production D1 database only.
3. Run the actual JavaScript `D1Database` Binding path in an approved Worker Preview/test target, including auth lookup, revocation, expiry, scopes, concurrency, quota exhaustion, policy snapshots, tenant isolation, and fail-closed storage errors.
4. Verify the same API key and quota policy across both REST and MCP.
5. Exercise migration 0003 and tenant plan/create/issue/rotate/revoke/suspend operations against a dedicated test D1 Binding; verify audit immutability, cross-tenant isolation and atomic rollback when audit writes fail.
6. Confirm the Production and MCP Workers have the intended separate `EXPORTFLOW_AUTH_DB` binding, without reusing the human account `AUTH_DB`.
7. Obtain separate owner approval before changing bindings, deploying or enabling live customer keys.

Node fixtures and Wrangler dry-run builds are supporting checks only; neither proves Cloudflare D1 Binding runtime acceptance.
