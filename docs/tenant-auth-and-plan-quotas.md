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
- `POST /api/v1/admin/tenants/:tenantId/memberships`
- `POST /api/v1/admin/tenants/:tenantId/memberships/:userId/revoke`
- `POST /api/v1/admin/tenants/:tenantId/api-keys`
- `POST /api/v1/admin/tenants/:tenantId/api-keys/:keyId/rotate`
- `POST /api/v1/admin/tenants/:tenantId/api-keys/:keyId/revoke`

Tenant membership assignment is owner-only. Before writing to tenant D1, the service looks up the supplied Better Auth user ID in the separate `AUTH_DB` and requires `emailVerified = 1`. Unknown/unverified IDs return 404; a missing or unavailable Better Auth directory returns 503. Assignment and its audit event are committed together in `EXPORTFLOW_AUTH_DB`; revocation protects the last active owner and is also audited. Because Better Auth and tenant records live in separate D1 databases, the identity lookup and membership batch are not one cross-database transaction; a later account deletion remains possible and OAuth access must continue re-checking active membership at token/resource use.

The admin schema readiness check also requires `bump_tenant_membership_version_on_tenant_state_change`; plan/status changes must invalidate earlier tenant-scoped OAuth claims.

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
- General public admin interface/dashboard and multi-operator/RBAC management. The owner-only API can assign/revoke tenant membership roles, but it does not change Better Auth global roles or the deployment-only platform-owner allowlist.
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
6. Verify tenant membership assignment accepts only an existing `AUTH_DB` user with `emailVerified = 1`; missing/unverified users and directory failures must fail closed without tenant D1 writes. Verify last-owner revocation denial and tenant-state membership-version invalidation.
7. Confirm the Production and MCP Workers have the intended separate `EXPORTFLOW_AUTH_DB` binding, without reusing the human account `AUTH_DB`.
8. Obtain separate owner approval before changing bindings, deploying or enabling live customer keys.

Node fixtures and Wrangler dry-run builds are supporting checks only; neither proves Cloudflare D1 Binding runtime acceptance.


## Owner session authorization runtime evidence and remaining gates

- The combined tenant-admin HTTP handler + service + Cloudflare D1 Binding acceptance passed **19/19 checks** on an isolated Worker and temporary D1 database. It covered the owner-gate denial path with an injected synthetic owner, plan and tenant provisioning, API-key issue/rotation/revocation, tenant isolation, append-only audit enforcement and batch rollback. The temporary Worker and D1 database were deleted and independently verified absent.
- A separate real Better Auth email/password cookie-session runtime test passed five cases: fresh verified allowlisted session accepted; no-cookie denied; non-allowlisted user denied; mismatched Origin denied; unverified account denied.
- A later isolated Worker + D1 test of the `platform-admin-auth.js` freshness helper passed all three cases: fresh accepted, stale denied and expired denied. It used only synthetic D1 session fixtures and did **not** issue or validate a Better Auth cookie.
- Therefore real Better Auth stale/expired cookie denials remain unverified. The five-case Better Auth result and the three-case helper result are distinct evidence and must not be merged into one claim.
- A 10-minute session-age check is a freshness gate, not proof of step-up MFA. Better Auth's 2FA plugin does not apply its credential sign-in challenge to OAuth/social sign-in by default; an explicit server-side policy/hook is required if Google OAuth owners must complete a second factor before admin mutations. See [Better Auth 2FA documentation](https://better-auth.com/docs/plugins/2fa).
- Admin-specific rate limiting, exact owner user-ID verification, account recovery/lockout handling and final operation-level security review remain outstanding. No owner allowlist or tenant D1 binding is configured in Production.


## Owner TOTP step-up for privileged operations

The owner authentication path now requires a separate TOTP verification immediately before every /api/v1/admin/* mutation. A fresh Better Auth cookie session alone is insufficient.

- Better Auth registers the twoFactor plugin on every configured Auth Worker. Enrollment is not auto-verified; the account must have user.twoFactorEnabled = 1 and a verified twoFactor record before step-up can succeed. Passwordless account owners (for example, Google-only accounts) may enroll without a local password; credential accounts still use Better Auth's password requirement.
- POST /api/v1/admin/step-up accepts only a six-digit TOTP code, same-origin POST, and a recent allowlisted owner session. It calls Better Auth's server-side auth.api.verifyTOTP with trustDevice: false.
- Better Auth's built-in account lockout protects its sign-in challenge flow; its already-authenticated TOTP re-verification path does not enforce that failed-attempt budget. ExportFlow therefore reserves each verification attempt atomically in Better Auth's existing verification D1 table. Five in-flight/failed attempts per owner in a rolling 15-minute window are allowed; further attempts fail with HTTP 429. Failed attempts persist, infrastructure errors release their pending reservation, and a successful TOTP clears failed attempts without deleting concurrent pending reservations.
- A successful verification creates a domain-separated HMAC proof bound to the exact owner ID and Better Auth session ID, valid for five minutes. The proof is delivered only in a __Host- Secure, HttpOnly, SameSite=Strict cookie, never in the JSON body. Its nonce is backed by a D1 row.
- Each admin mutation consumes the D1 proof row before invoking the tenant administration service. The delete is conditional on the actor-bound proof nonce and expiry; a second use, different user, different session, altered token, missing proof, database outage, or expired proof fails closed. Admin responses clear the cookie after its one use.
- Admin request payload validation and tenant schema readiness checks run before proof consumption, so malformed requests do not burn a valid proof. The proof is still consumed before any privileged service method or D1 mutation.
- The owner allowlist and privileged API remain unconfigured in Production. The new twoFactor D1 schema must be applied through the existing Better Auth migration process before account sign-in is considered ready on a deployed version. Do not run that migration, configure an owner ID, bind tenant D1, or deploy without separate approval.

Verification coverage is split deliberately: source/unit tests exercise the durable attempt budget, actor/session binding, one-use proof replay denial, tamper denial, unverified enrollment denial, and infra fail-closed paths. This does not substitute for a real Better Auth browser-cookie + authenticator runtime acceptance; that remains a separate release gate.


### Owner authenticator bootstrap and recovery boundary

- The account-level authenticator enrollment UI supports TOTP setup and first-code confirmation. The setup key and backup codes are returned only during the enrollment response and rendered into the current account page; they are not persisted by the site client or sent to analytics. A reload does not restore previously issued backup codes.
- Because Google/passkey-only users may have no credential password, the shared Better Auth plugin allows passwordless TOTP enrollment for users without a credential account. This is necessary for those account types but means possession of an authenticated session can initiate first-time enrollment. Therefore **do not add an account to `EXPORTFLOW_OWNER_USER_IDS` until its TOTP factor has been enrolled and verified through a separately reviewed owner bootstrap process**. The owner API remains fail-closed if no verified factor exists.
- Once an allowlisted owner has a verified factor, direct authenticated-session `two-factor/verify-totp` is blocked and the owner must use `/api/v1/admin/step-up`, which applies the durable D1 attempt budget. Self-service `two-factor/disable` is blocked for an owner with an active factor. This intentionally makes owner authenticator recovery an operational process: remove the owner allowlist only through an explicitly approved configuration change, recover/re-enroll the account, verify the factor, then separately approve restoring the allowlist. Do not attempt that process in Production without explicit approval.
- This repository does not yet provide recovery for a lost authenticator or a lost copy of backup codes. The release gate remains closed until the operator-bootstrap/recovery procedure and real browser/Worker tests are reviewed.


### Additional Better Auth owner-endpoint hardening — 22 November 2026

A source review of Better Auth 1.7.27 found that the TOTP secret can be returned by `POST /api/auth/two-factor/get-totp-uri` for accounts that do not have a local credential password when passwordless 2FA management is enabled. The plugin also exposes alternate authenticated-session verification paths for backup codes and OTP; Better Auth's existing-session re-verification path does not apply its sign-in attempt budget.

The owner guard now applies to an authenticated, allowlisted owner session across these Better Auth paths: `two-factor/enable`, `two-factor/disable`, `two-factor/get-totp-uri`, `two-factor/generate-backup-codes`, `two-factor/verify-totp`, `two-factor/verify-backup-code`, `two-factor/verify-otp`, and `two-factor/send-otp`. It rejects an allowlisted owner unless the account already has an enabled and verified TOTP factor; when verified, it blocks these direct management/re-verification routes and directs the Owner to the approved step-up/recovery flow. Sessionless Better Auth 2FA sign-in challenges are not intercepted, and ordinary non-owner accounts retain the normal Better Auth flows.

Proof consumption has also been tightened: the single-use D1 `DELETE` now includes an `EXISTS` predicate against Better Auth's `session` table for the same session ID, user ID, and unexpired session. Proof consumption and session validity are checked in one D1 statement, so a session revoked or expired after the initial owner check cannot use an outstanding proof.

Focused tests now cover TOTP secret retrieval, backup-code regeneration, backup-code and OTP verification bypasses, enable/send routes, bootstrap-before-allowlist enforcement, sessionless sign-in continuity, and revoked-session proof consumption. These are still unit/contract tests; real Worker/D1/browser acceptance remains outstanding.
