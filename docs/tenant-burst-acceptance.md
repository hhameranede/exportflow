# Shared tenant burst limiter — real Worker acceptance plan

**Status:** prepared, not executed (22 November 2026).

## Why isolated Acceptance is required

The current Production Platform Worker has only its human-account `AUTH_DB` binding, and the live MCP Worker has only its existing `MCP_RATE_LIMITER` binding. Neither has `EXPORTFLOW_AUTH_DB` or the new `TENANT_BURST_LIMITER` namespace. Production therefore has no safe authenticated tenant-task path for this acceptance. Do not substitute an unbound Production test or attach the tenant test D1 to `AUTH_DB`.

Use dedicated Acceptance Workers and a dedicated D1 test database. One Acceptance Platform Worker owns the `TenantBurstRateLimiter` class/migration; the separate Acceptance MCP Worker binds to that exact class through `script_name` pointing at the Acceptance Platform Worker. Both Workers use the same dedicated tenant-auth D1 test database. No Production hostname, Worker, D1, secret, route, or customer record is involved.

## Acceptance procedure

1. Confirm the Acceptance D1 schema and create one synthetic tenant/API key with the minimum `tasks:fetch` scope. Keep the token in the test runner environment only; never log it.
2. Deploy the isolated Platform Acceptance Worker with `TENANT_BURST_LIMITER` bound to its own SQLite-backed `TenantBurstRateLimiter` namespace. Set the test gateway's burst limit to 1 through factory options so one REST call consumes the window.
3. Deploy the isolated MCP Acceptance Worker with `TENANT_BURST_LIMITER` bound using the same `class_name` and `script_name` of the Acceptance Platform Worker. Do not create a second MCP-owned namespace.
4. Send one authenticated REST `POST /api/v1/tasks` request for the synthetic tenant. Confirm it is accepted and quota headers are present.
5. Immediately send one authenticated MCP `tools/call` (`web_fetch`) request for the same tenant. Confirm the result is `RATE_LIMITED`, no second task runs, and the D1 plan quota is not reserved a second time. Reverse the order in a fresh window to prove symmetry.
6. With a different synthetic tenant ID, verify counter isolation. Then exercise concurrent calls and the exact reset boundary. Capture Worker runtime responses and D1 quota rows; do not rely on unit fixtures.
7. Remove only synthetic Acceptance rows and temporary Acceptance resources after evidence is captured. Confirm no test rows or temporary bindings remain.

## Required evidence and gates

- Both request paths execute in actual Cloudflare Workers, not Node mocks or local Wrangler simulation.
- Both bindings point to one owner Worker and one namespace. Record script names, deployment/version IDs, class name and owner script name; never record API tokens or secret values.
- Capture real REST and MCP responses showing one accepted task and one cross-transport tenant burst rejection, plus persisted D1 quota counts.
- Report concurrency, reset-boundary, tenant-isolation and cross-location results separately. Do not infer global consistency from one location.
- Keep this acceptance isolated from Production. A later decision to bind Production requires distinct, explicit approval for that rollout.

## Verification boundary

The unit test exercises the actual Durable Object class and adapter with a deterministic SQL fixture and two gateway instances. It does not prove Cloudflare's live SQLite, namespace binding, cross-Worker external binding, or Production behavior. Real runtime acceptance remains **not run / blocked** until isolated Acceptance deployment/resource approval and test D1 readiness are available.
