# Durable Task Lifecycle v1

Status: Merged into `main` via squash merge on 25 November 2026. PR #134 is closed as merged. The implementation passed exact-head CI and real isolated Cloudflare Acceptance; Production migration and rollout remain separate approval-gated steps.
Original implementation branch: `feat/durable-task-lifecycle-v1-20261124`.
Verified application-code head: `142c20f84ca9dcf191bb64e798b5fa7bfd15c21a`.
Final pre-merge head: `1fa7fba94474c01ec726341fd50a49d52e5d79ce`.
Squash merge commit on main: `dadcd2b787a6ce5c2cb155e806b3c67aa89a9b1e`.
Base before implementation: `9fe35036c30114095e3ae782909164d2c0671967` (`main`, 25 November 2026).

## Scope

This change adds one tenant-scoped durable task ledger shared by REST and MCP. It keeps small bounded operations on the existing synchronous Request-First execution path. It does not add Queues, Workflows, background execution, resumable Crawl or automatic recovery after a Worker crash.

Normal push and pull-request CI runs repository tests, browser QA and Wrangler dry-runs without deploying Acceptance resources. The isolated Acceptance job is opt-in through GitHub Actions `workflow_dispatch`: select the original implementation branch and explicitly set `run_acceptance=true`. With that opt-in, the job applies migration `0005_durable_task_lifecycle.sql` only to the dedicated Acceptance D1 database, deploys the two dedicated Task Acceptance Workers, seeds run-scoped synthetic tenants/API keys, runs real Worker + D1 tests, and removes the run-scoped data. The Acceptance Workers and schema are isolated test resources; this is not a Production rollout. The boolean input defaults to `false`, and the job is skipped for ordinary pushes and pull requests. GitHub makes a `workflow_dispatch` workflow available only after its workflow file exists on the default branch; the workflow file is now present on `main`, so the original implementation branch can be selected for a separately approved manual Acceptance run.

The merge did not apply Migration 0005 to the Production tenant D1 database, deploy either Production Worker, change Production bindings, secrets, DNS, permissions or traffic, or provision customer tenants.

## Shared API

### REST

- `POST /api/v1/tasks`: authenticated task submission. Accepts an optional `Idempotency-Key` request header.
- `GET /api/v1/tasks/{taskId}`: retrieves a task owned by the authenticated tenant. Requires the separate `tasks:read` scope.

### MCP

- Existing six tools (Fetch, Map, Crawl, Extract, Search and Research) accept an optional `idempotencyKey` argument.
- `web_task_status({ taskId })` retrieves a task owned by the authenticated tenant and requires `tasks:read`.
- OAuth MCP tool scopes advertise `tasks:read` alongside the six execution scopes.

REST and MCP call the same `executeDurableTask()` / `getDurableTask()` service and use the same `EXPORTFLOW_AUTH_DB` tenant database.

## Idempotency and quota semantics

- Idempotency keys are optional. When supplied, they must contain 8–128 visible ASCII characters without spaces. When omitted, a new random task ID is used as the one-request key; callers must supply a key to deduplicate retries.
- Only a SHA-256 fingerprint scoped by tenant is stored; the raw idempotency key is not stored.
- The request fingerprint canonicalizes URL form, query whitespace and transport defaults, and excludes the display-only `goal`, so equivalent REST and MCP requests can replay the same task.
- Same tenant + same key + same effective request returns the original task. Same tenant + same key + a different effective request returns HTTP 409 / `IDEMPOTENCY_KEY_REUSED`.
- The first task-row insert is the single quota acceptance point. D1's `AFTER INSERT` trigger increments `tenant_request_usage` and inserts `task.accepted` in the same statement transaction. An idempotency conflict does not fire the trigger; a quota failure aborts the task insert and event as well.
- Existing quota-window policy snapshots remain authoritative for that window. The task records the effective limit and policy returned by the usage row, rather than assuming a newly read plan policy can change a window already in progress.
- Request execution failures still count as accepted logical tasks. Queue retries and provider retries are not part of this version.

## Persistence and lifecycle

Migration `0005_durable_task_lifecycle.sql` creates:

- `tasks`: tenant-owned task metadata, request/idempotency hashes, operation, status, timestamps, lease, quota snapshot, bounded result and usage metadata.
- `task_events`: append-only lifecycle events with monotonically increasing per-task revisions.

Supported transitions:

`accepted → running → partial | succeeded | failed | cancelled | expired | unsupported`

Task reads always filter by both `tenant_id` and `task_id`. A caller from another tenant receives the same 404 as an unknown task. State transitions are conditional D1 updates; invalid transitions fail closed.

## Retention and result bounds

- Task/result retention target: 24 hours.
- Result JSON retention ceiling: 1.5 MB per task row.
- Display-only `goal` text is returned from the initial execution but is not retained in the D1 result JSON.
- If a result exceeds the storage ceiling, the initial response still returns it and marks `persistence.resultAvailable=false`; later status reads return lifecycle metadata but no retained result.
- Logical result/status availability ends after 24 hours. An expired status read returns HTTP 410 and deletes that task row; its lifecycle events are removed by the foreign-key cascade. New task acceptance also opportunistically cleans at most 100 expired rows for that tenant. Cleanup is indexed by tenant and expiry time to avoid an unbounded scan. A scheduled global cleanup job is not part of v1, so physical deletion for an inactive tenant is best-effort and may occur later than the 24-hour access expiry.
- Execution remains inline. Both the accepted-before-claim phase and the running phase have a 3-minute lease. A status read or idempotent retry that observes an expired lease records the task as `expired`; this version does not automatically resume or re-run that task.

## Exact-head verification — 25 November 2026

- Push CI [#1232](https://github.com/hhameranede/exportflow/actions/runs/45654618812) attempt 2 passed on exact application-code head `142c20f84ca9dcf191bb64e798b5fa7bfd15c21a`. Repository tests, `npm run check`, full-site Chromium QA (646/646 route/viewport combinations), same-origin links and all nine Wrangler v4 dry-run bundles passed. Attempt 1 had one browser navigation `net::ERR_ABORTED` at local `/oauth/consent`; attempt 2 did not reproduce it.
- The same Push CI #1232 attempt 2 completed real Cloudflare D1 + Worker Acceptance. Migration 0005 was applied only to the dedicated Acceptance D1 database; both dedicated Task Acceptance Workers were deployed (Version 11 each); synthetic tenants/API keys were seeded and subsequently cleaned.
- Real Acceptance verified REST and MCP Fetch HTTP 200, expected content and HTTPS source-host provenance; concurrent idempotency, exactly one quota reservation, REST/MCP replay parity, request-identity conflict (409), status reads, `tasks:read`, cross-tenant isolation, quota exhaustion and 24-hour expiry metadata.
- Cleanup completed. A separate read-only D1 query confirmed zero run-scoped tenants, API keys, quota usage, Tasks and plan policies; total `task_events` rows were also zero. Pre-existing Acceptance records outside this run were retained.
- PR CI [#1233](https://github.com/hhameranede/exportflow/actions/runs/45654641938) passed on the same exact head: tests, syntax checks, 646/646 Chromium QA, same-origin links and all nine Wrangler v4 dry-run bundles. Acceptance and Production jobs were skipped on the pull-request event.
- Maintainer/agent self-review covered REST/MCP submission and status reads, scopes, tenant isolation, idempotency, D1 quota/lifecycle triggers, leases, retention, readiness, token masking and Fetch provenance. No blocking source-code defect was identified. Required GitHub branch-protection rules must still be respected.
- Follow-up commit `1fa7fba94474c01ec726341fd50a49d52e5d79ce` added the Acceptance opt-in and refreshed documentation; it did not change application source. Push CI #1234 and PR CI #1235 both passed on that exact follow-up head. Each reported 343/343 unit tests, `npm run check`, 646/646 Chromium page/viewport checks across 297 routes, 384 unique same-origin links, eight locales, four viewport widths, and all nine Wrangler v4 dry-runs. Both runs skipped Acceptance and Production deployment.
- PR #134 was squash-merged after explicit user approval on 25 November 2026. The resulting `main` commit is `dadcd2b787a6ce5c2cb155e806b3c67aa89a9b1e`. The post-merge main CI is tracked separately in the Command Center.

## Manual Acceptance procedure

1. Open GitHub Actions → Worker CI → Run workflow.
2. Select `feat/durable-task-lifecycle-v1-20261124` as the branch.
3. Set `run_acceptance` to `true` only when explicitly authorizing the isolated Acceptance migration and two Acceptance Worker deployments. Leaving it false runs no Acceptance deployment.
4. The job runs after the test job passes and always attempts run-scoped data cleanup. Production deployment is not part of this manual dispatch.

The workflow file is already present on `main`, so the `workflow_dispatch` action is available. Running it still requires separate, explicit authorization for the isolated Acceptance migration and Worker deployments.

## Production release gate — read-only check on 25 November 2026

- Cloudflare still reports `exportflow-platform` Version 23 at 100% traffic and `exportflow-mcp-preview` Version 8.
- The Platform Worker's `EXPORTFLOW_AUTH_DB` binding points to Production D1 `exportflow-tenant-production`. A read-only query found no `tasks` or `task_events` tables there; Migration 0005 remains unapplied in Production.
- No Production D1 writes/migration, Worker deployment/version/traffic change, DNS, secret, binding, permissions or billing change was made. Production remains outside this PR's current verification.

## Explicit non-goals / remaining gates

- No asynchronous task submission contract, Queue fan-out, Workflow orchestration, polling backoff, webhook notifications, child work units, resumable crawl checkpoints, or automatic retry after Worker failure.
- No public cancel endpoint. An inbound request abort is still forwarded into the existing executor and its resulting cancelled state is persisted when the handler can finish.
- The isolated Acceptance workflow is manual and opt-in only. It may apply Migration 0005 to the dedicated Acceptance D1 database and deploy the two dedicated Task Acceptance Workers, then clean run-scoped synthetic tenant, key, usage and Task data. It does not modify `exportflow-tenant-production`.
- Node SQLite tests are supplementary checks. Real Cloudflare D1 Binding acceptance covers migration execution, trigger atomicity, simultaneous requests, replay, quota exhaustion, status reads and tenant isolation.
- A read-only Production D1 check on 25 November 2026 found the tenant/auth tables but no `tasks` or `task_events` tables; Migration 0005 remains unapplied in Production.
- Production rollout, Production D1 migration, Worker bindings, secrets, DNS, permissions and customer tenant provisioning each remain separately approval-gated. Manually dispatching the isolated Acceptance job also requires explicit action-specific authorization.
