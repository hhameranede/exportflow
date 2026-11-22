# Durable tenant burst limiter — source-only implementation

**Status (22 November 2026):** integrated into the shared tenant gateway source on this PR branch. Wrangler config declares the SQLite class/migration on the Platform Worker and an external binding from MCP to that owner Worker. These are repository changes only: no live namespace has been provisioned and no Worker deployment or Production change has occurred.

## Why this exists

The tenant gateway in the open tenant-auth workstream currently uses an in-memory Map for its burst limiter. That counter is local to a Worker isolate and cannot enforce one strict counter across all locations or across the REST and MCP Workers.

Cloudflare's Workers Rate Limiting API is useful as a fast approximate edge filter, but its counters are separately scoped by Cloudflare location and can temporarily exceed the configured threshold. A strict cross-location limit requires routing each tenant's requests through one Durable Object.

Official references:
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/durable-objects/get-started/
- https://developers.cloudflare.com/durable-objects/platform/pricing/

## Implementation

- TenantBurstRateLimiter owns one SQLite row per tenant Durable Object.
- One SQL INSERT ... ON CONFLICT ... WHERE ... RETURNING statement is the atomic allow/deny decision point.
- The window is fixed from the first accepted request; the row is reused when the window expires.
- createDurableTenantBurstLimiter(namespace) hashes the tenant ID with Web Crypto before idFromName(). Raw tenant IDs are not sent in the internal request or used as the object name.
- The adapter returns an asynchronous check(tenantId) result. Its future gateway integration must await the check and convert any binding/storage exception into a fail-closed 503; it must not fall back to an isolate-local Map.
- The Durable Object accepts only its internal POST /consume contract and rejects caller-supplied identity fields or malformed limits.

## Required follow-up before activation

1. Integrate the async adapter with the shared tenant gateway only after its PR is reconciled and reviewed.
2. Export the class from the Platform Worker module and declare one SQLite-backed namespace owned by exportflow-platform.
3. Bind the MCP Worker to that same namespace using the external script_name = exportflow-platform reference. Separate namespaces would create separate REST and MCP counters and would not satisfy the shared limit requirement.
4. Add the binding only with explicit approval, then run real Worker acceptance with concurrent requests, two entrypoints, synthetic tenants, reset-boundary checks, and cross-location verification where feasible.
5. Keep D1 plan quota reservation separate. Burst limiting controls short spikes; persistent D1 quotas control the plan allowance.

## Free-plan capacity gate

The current Cloudflare Workers Free Durable Objects allowance is 100,000 requests/day, 13,000 GB-s/day, 5 million SQL rows read/day, 100,000 SQL rows written/day, and 5 GB total SQLite storage. Exceeding a Free allowance causes further operations of that type to fail until reset. This implementation performs one Durable Object request and one SQL row write per accepted API/MCP task call; denied requests also read the current row to calculate Retry-After. Thus the strict limiter has a meaningful throughput ceiling and must be reviewed against account-wide usage before activation.

No Wrangler binding, migration, namespace creation, Worker deployment, D1 operation, secret change, or Production request was made as part of this source-only change.


## Integration boundary — 22 November 2026

- The shared gateway awaits the durable adapter and returns HTTP 503 / `TENANT_RATE_LIMITER_UNAVAILABLE` on a missing binding, malformed response, or storage failure. It never falls back to an isolate-local tenant Map.
- REST and MCP both resolve `env.TENANT_BURST_LIMITER`. The Platform Worker owns the SQLite class and MCP declares an external `script_name = "exportflow-platform"` binding.
- The cross-transport unit test runs the actual limiter class through a deterministic SQL shim. It is not Cloudflare Worker acceptance.
- No merge, deploy, namespace creation, migration, secret change, or live binding activation is included.
