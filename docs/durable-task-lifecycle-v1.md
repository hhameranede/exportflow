# Durable Task Lifecycle v1

Status: Draft implementation on `feat/durable-task-lifecycle-v1-20261124`.
Base: `9fe35036c30114095e3ae782909164d2c0671967`.

## Scope

This change adds one tenant-scoped durable task ledger shared by REST and MCP. It keeps small bounded operations on the existing synchronous Request-First execution path. It does not provision Queues or Workflows, deploy Workers, apply D1 migrations, create tenants, or change Production.

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

## Explicit non-goals / remaining gates

- No asynchronous task submission contract, Queue fan-out, Workflow orchestration, polling backoff, webhook notifications, child work units, resumable crawl checkpoints, or automatic retry after Worker failure.
- No public cancel endpoint. An inbound request abort is still forwarded into the existing executor and its resulting cancelled state is persisted when the handler can finish.
- No D1 schema is applied by this PR; the existing Production D1 remains untouched. The migration is source-only until separately approved for an isolated Acceptance target.
- Node SQLite tests are supplementary checks. Real Cloudflare D1 Binding acceptance for migrations, trigger atomicity, simultaneous requests, replay, quota exhaustion, status reads and tenant isolation is required before any runtime rollout.
- Production rollout, Worker bindings, migration execution, secrets, DNS, permissions and customer tenant provisioning each remain separately approval-gated.
