# ExportFlow MCP Worker

## Source of truth

- Entry point: `cloudflare/mcp/index.js`
- Protocol implementation: `src/mcp/preview-worker.js`
- Shared execution and security: `src/core/tasks.js`, `src/core/adapters.js`, `src/core/http-fetch.js`, `src/core/egress-guard.js`
- Shared tenant authentication and quotas: `src/core/tenant-task-gateway.js`, `src/core/tenant-auth.js`, `src/core/plan-quota.js`
- Cloudflare configuration: `cloudflare/mcp/wrangler.toml`

MCP and REST import the same Core modules. Do not maintain separate copies of Fetch, egress, task, auth or quota behavior.

## Tool contract in this PR

- Endpoint: `/mcp` on `mcp.exportflow.me`
- Read-only metadata: `exportflow_capabilities`
- Execution tools: `web_fetch`, `web_map`, `web_crawl`, `web_extract`
- Search, Research and Browser remain unavailable.
- Execution tools require `Authorization: Bearer <ExportFlow API key>`.
- Scopes: `tasks:fetch`, `tasks:map`, `tasks:crawl`, `tasks:extract` respectively. `tasks:*` and `*` are supported wildcards.
- Each admitted execution tool reserves one persistent tenant request from `EXPORTFLOW_AUTH_DB` before invoking shared Task execution.
- The MCP Cloudflare weighted Rate Limit binding remains an IP-level abuse guard, separate from per-tenant request quotas.
- Map is bounded to 15 URLs; Crawl to 3 same-origin pages / depth 1.
- URL egress checks and extraction schema validation happen before quota reservation.
- Page contents are untrusted data and must not be treated as instructions.

## Current deployed state versus proposed code

The live Cloudflare MCP Worker is still the previously deployed `0.4.1-preview` anonymous-read-only version until a separately approved deployment. This PR proposes `0.5.0-preview` behavior. The proposed MCP and REST Workers fail closed for execution if `EXPORTFLOW_AUTH_DB` is not bound and provisioned.

The existing human account `AUTH_DB` (Better Auth) is not the tenant auth database. Do not point `EXPORTFLOW_AUTH_DB` at it by default. No D1 binding is added to the Wrangler config in this PR because the dedicated target database and release action still require explicit approval.

## Configuration and validation

- The existing `MCP_RATE_LIMITER` namespace is recorded in the Wrangler config.
- `EXPORTFLOW_AUTH_DB` is intentionally not configured here; without it, execution tools fail closed.
- GitHub Actions runs Node tests, syntax checks and Wrangler `--dry-run` builds. These do not upload a Worker, change domains or validate a real D1 binding.

## Release gate

Do not run `wrangler deploy --config cloudflare/mcp/wrangler.toml` or modify Production `wrangler.toml` until the owner explicitly approves the exact D1 binding and deployment action. That update changes the code behind the existing `mcp.exportflow.me` custom domain.

Before customer enablement, run authenticated target-runtime D1 Binding acceptance for both REST and MCP, then review the diff and owner-approve the release.
