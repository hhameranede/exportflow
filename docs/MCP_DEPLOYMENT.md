# ExportFlow MCP Worker

## Source of truth

The MCP Streamable HTTP Worker now lives in this repository:

- Entry point: cloudflare/mcp/index.js
- Protocol and tool implementation: src/mcp/preview-worker.js
- Shared execution logic: src/core/tasks.js, src/core/adapters.js, and other src/core modules
- Cloudflare configuration: cloudflare/mcp/wrangler.toml

The MCP worker imports the same Core modules as the REST Worker. It must not vendor a second copy of Fetch, task lifecycle, Map/Crawl, extraction, or egress code.

## Current public contract

This source deliberately describes the currently deployed preview contract:

- MCP Streamable HTTP endpoint: /mcp
- Host guard: mcp.exportflow.me
- Tools: exportflow_capabilities, web_fetch, web_map, web_crawl, and web_extract
- Search, Research, and Browser tools are not exposed.
- Authentication is currently anonymous read-only; Cloudflare's weighted Rate Limit binding is an abuse-control layer, not a durable tenant quota or billing system.
- Map is bounded to 15 URLs; Crawl is bounded to 3 same-origin pages at depth 1.
- Fetch is bounded by the shared Core's response, timeout, redirect and content-type rules.
- Page content is untrusted data and must never be treated as executable instructions.

The MCP service remains Preview-grade. Keeping its source in GitHub does not by itself make it customer-ready or enable tenant API keys.

## Configuration

The Wrangler configuration models the existing Worker name, mcp.exportflow.me custom domain, and existing rate-limit binding namespace. It does not create a new database, secret, binding namespace, DNS record, or Worker.

## Validation

The GitHub Actions PR job performs:

1. Node unit tests, including MCP protocol, host/origin guards, input bounds, weighted rate limiting and fail-closed behavior.
2. Syntax checks for the new MCP entrypoint and protocol implementation.
3. A Wrangler dry-run build of the MCP Worker bundle.

The dry-run build is not a deployment and does not change Cloudflare resources or traffic.

## Release gate

Do not run wrangler deploy --config cloudflare/mcp/wrangler.toml until the owner explicitly approves updating the live exportflow-mcp-preview Worker. That deployment would update the code behind the already attached mcp.exportflow.me custom domain.

Before enabling tenant authentication, quotas, billing or additional tools, integrate the reviewed tenant API-key implementation and verify it against a real D1 Binding in the approved target Worker runtime. Do not reuse the human-account AUTH_DB contract as a substitute for the separate EXPORTFLOW_AUTH_DB schema without a reviewed migration and data-isolation decision.
