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

## Platform Owner Authentication and Tenant Administration API

The isolated tenant lifecycle service is now exposed through a narrow first-party HTTP API under `/api/v1/admin/*`. It is **owner-only**, same-origin and cookie-session protected; it is not an open developer/admin API and does not provide account role promotion or user impersonation.

The owner identity is a deployment-time allowlist in `EXPORTFLOW_OWNER_USER_IDS` (comma-separated Better Auth user IDs, maximum 20). The allowlist is not read from request parameters, JSON bodies, headers or user profile fields. If it is absent, malformed, or does not include the signed-in user, access fails closed. No owner IDs are currently configured in the checked-in Wrangler config or Production Worker.

Each mutating request must:
- Pass a pre-authentication burst guard keyed only by Cloudflare's `CF-Connecting-IP`: 10 POSTs per minute per Worker isolate. Excess requests receive HTTP 429 with `Retry-After` before Better Auth session lookup.
- This in-memory guard is a local abuse-control layer only; it is not globally consistent across Worker isolates/locations and does not replace a Cloudflare edge rate limit or durable abuse controls.
- Use the configured `BETTER_AUTH_URL` origin and matching request URL origin; a missing or mismatched `Origin` is denied.
- Use a Better Auth session loaded server-side from `AUTH_DB` with cookie-cache bypass (`disableCookieCache: true`).
- Belong to an allowlisted user with a verified email and a session created within the previous 10 minutes, not expired and not impersonated.
- Use the dedicated `EXPORTFLOW_AUTH_DB` binding and have migrations 0001–0003 plus both append-only audit triggers from migration 0003 present. The Worker fails closed if either trigger is missing. Better Auth `AUTH_DB` is never reused as tenant/admin storage.

The API supports:
- `POST /api/v1/admin/plan-policies`
- `POST /api/v1/admin/tenants`
- `POST /api/v1/admin/tenants/:tenantId/status`
- `POST /api/v1/admin/tenants/:tenantId/plan`
- `POST /api/v1/admin/tenants/:tenantId/api-keys`
- `POST /api/v1/admin/tenants/:tenantId/api-keys/:keyId/rotate`
- `POST /api/v1/admin/tenants/:tenantId/api-keys/:keyId/revoke`

Admin request bodies are bounded to 16 KiB, JSON-only, and reject unknown fields. Responses use `Cache-Control: no-store`, no CORS allow-origin header, and never return stored API-key digests. A newly issued/rotated plaintext API key is included once in that single response.

No Better Auth Admin plugin was added. That plugin brings broad user-management endpoints (including role changes and impersonation) and additional schema fields; this project uses a narrow owner allowlist instead. This avoids introducing a client-accessible self-promotion path and avoids expanding the Better Auth schema at this stage. There is no endpoint to modify the owner allowlist.

**Release/configuration state:** `EXPORTFLOW_OWNER_USER_IDS` is not set in Production and `EXPORTFLOW_AUTH_DB` is not bound to the Production Worker. Migration 0003 was applied only to temporary isolated D1 databases for the runtime acceptance described below; those databases were deleted and verified absent. Therefore the admin API remains fail-closed/source-only in the current deployed environment. Do not set the owner allowlist, apply migrations, bind the database or deploy this code without separate owner approval.

## Privileged Tenant Lifecycle Service — isolated implementation

The Draft implementation adds `src/core/tenant-admin.js` as a D1-backed service and `src/core/tenant-admin-http.js` as a narrowly scoped owner-only HTTP adapter. It does not add a general public admin interface, role-promotion endpoint, dashboard or production binding.

Supported operations:
- Create/update owner-managed plan policies with validated periods, positive integer request limits and explicit policy versions.
- Provision a tenant only when its target plan is active.
- Issue a scoped API key only for an active tenant on an active plan. The plaintext key is returned once; D1 stores only the domain-separated SHA-256 digest and the audit record excludes both token and digest.
- Revoke an active key only when both tenant ID and key ID match.
- Rotate an active key in one D1 batch: revoke the old key, insert the replacement, and append both audit events atomically.
- Suspend/close tenants and reassign active plans. A closed tenant cannot be reactivated through this service.

Every mutating service operation requires an injected `authorizeAdmin` function. The HTTP adapter constructs the service separately for each request and binds the already-verified allowlisted owner identity only for that request. Request-body fields, query parameters and caller-supplied headers never establish authority. No Better Auth role mapping, user-role promotion endpoint or impersonation route is wired in this PR.

Migration `0003_tenant_admin_audit_log.sql` adds an append-only audit table with update/delete guards. Each D1 mutation and its audit event are submitted in the same `D1Database.batch()`; if the batch fails, the operation returns a sanitized 503. Migration 0003 was applied to a temporary isolated D1 database for the combined tenant-admin HTTP + D1 Binding acceptance (19/19 checks), then that test database and Worker were deleted and independently verified absent. That test used an injected synthetic owner at the HTTP boundary; it did not prove Better Auth browser-cookie authorization. The service remains Draft-only pending the remaining authentication, step-up/MFA, rate-limit, recovery/lockout and owner-identity reviews, plus separate release approvals.

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
- General public admin interface/dashboard, role promotion API, and multi-operator/RBAC management. The only route surface is the owner-allowlisted same-origin API documented above.
- Durable task records or a durable usage-receipt ledger.
- Cost Router reservation/settlement, EF Credit weights, monetary billing, invoices, checkout, subscriptions, webhooks, top-ups or refunds.
- Search, Research or Browser runtime enablement.
- Production D1 binding, schema migration, plan/tenant/key seeding, Worker upload or deployment.

## Required acceptance before customer enablement

1. Approve and provision the exact Better Auth owner user ID, then configure the deployment-only `EXPORTFLOW_OWNER_USER_IDS` allowlist through a separately approved control-plane change.
2. Apply migrations to a dedicated, explicitly approved non-production D1 database only.
3. Run the actual JavaScript `D1Database` Binding path in an approved Worker Preview/test target, including auth lookup, revocation, expiry, scopes, concurrency, quota exhaustion, policy snapshots, tenant isolation, and fail-closed storage errors.
4. Verify the same API key and quota policy across both REST and MCP.
5. Exercise migration 0003 and the owner-only HTTP API against a dedicated test Worker and D1 Binding; verify origin/session/allowlist denial, audit immutability, cross-tenant isolation and atomic rollback when audit writes fail.
6. Confirm the Production and MCP Workers have the intended separate `EXPORTFLOW_AUTH_DB` binding, without reusing the human account `AUTH_DB`.
7. Obtain separate owner approval before changing bindings, deploying or enabling live customer keys.

Node fixtures and Wrangler dry-run builds are supporting checks only; neither proves Cloudflare D1 Binding runtime acceptance.


## Owner session authorization runtime evidence and remaining gates

- The combined tenant-admin HTTP handler + service + Cloudflare D1 Binding acceptance passed **19/19 checks** on an isolated Worker and temporary D1 database. It covered the owner-gate denial path with an injected synthetic owner, plan and tenant provisioning, API-key issue/rotation/revocation, tenant isolation, append-only audit enforcement and batch rollback. The temporary Worker and D1 database were deleted and independently verified absent.
- A separate real Better Auth email/password cookie-session runtime test passed five cases: fresh verified allowlisted session accepted; no-cookie denied; non-allowlisted user denied; mismatched Origin denied; unverified account denied.
- A later isolated Worker + D1 test of the `platform-admin-auth.js` freshness helper passed all three cases: fresh accepted, stale denied and expired denied. It used only synthetic D1 session fixtures and did **not** issue or validate a Better Auth cookie.
- Therefore real Better Auth stale/expired cookie denials remain unverified. The five-case Better Auth result and the three-case helper result are distinct evidence and must not be merged into one claim.
- A 10-minute session-age check is a freshness gate, not proof of step-up MFA. Better Auth's 2FA plugin does not apply its credential sign-in challenge to OAuth/social sign-in by default; an explicit server-side policy/hook is required if Google OAuth owners must complete a second factor before admin mutations. See [Better Auth 2FA documentation](https://better-auth.com/docs/plugins/2fa).
- Admin-specific rate limiting, exact owner user-ID verification, account recovery/lockout handling and final operation-level security review remain outstanding. No owner allowlist or tenant D1 binding is configured in Production.
