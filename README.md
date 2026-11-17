# ExportFlow

ExportFlow is a model-agnostic agentic web infrastructure platform for AI agents.

## Product foundation
- **Web data plane:** search, map, direct HTTP fetch, bounded crawl, and structured extraction.
- **Browser execution plane:** render dynamic pages and perform explicitly user-directed interactions.
- **Shared runtime:** adaptive routing, ExportFlow-owned adapter contracts, normalized results, provenance, bounded execution, and resumable task lifecycle.
- **Developer surface:** remote MCP first, then a versioned REST API and SDKs.

## Current implementation status
The Cloudflare Worker provides the public homepage, health/platform endpoints, and routing preview. The Core includes an internal `http.fetch.v1` adapter for bounded direct HTTP retrieval, registered through the adapter catalog and covered by deterministic tests. It is not exposed as a public API endpoint.

## Outbound security model

ExportFlow uses two complementary controls:

1. **Application Egress Policy:** validates each destination and redirect. It accepts only HTTP(S), rejects IP literals (including alternate IPv4 spellings), credentials, non-default ports, local/reserved hostnames, and ExportFlow-owned origins.
2. **Cloudflare Workers runtime egress:** outbound requests must use the native Workers Fetch API. Cloudflare documents that Worker outbound HTTP is routed through its network proxy, which checks that a request targets the public Internet or the Worker's zone origin rather than internal services. We do not perform a separate DNS lookup and then assume the result is pinned to a later connection.

Do not add `cf.resolveOverride` as a generic destination pinning mechanism: Cloudflare documents that it only takes effect when both the request host and override host are within the same Cloudflare zone. Keep every redirect manual and revalidate the destination before following it.

The fetch adapter is still internal Core code. Do not expose it to public callers until authentication, tenant quotas, rate limits, and the production egress behavior have been separately verified.

## HTTP fetch limits
- GET only; HTTP and HTTPS.
- Default ports only.
- At most three manually followed redirects.
- Redirects are revalidated; HTTPS-to-HTTP downgrade is rejected.
- Maximum text response: 1 MiB.
- Timeout: 8 seconds.
- No cookies or origin credentials are forwarded.

## Not connected yet
Live web search, crawl orchestration, browser automation, hosted MCP, authentication, persistent tasks, queues, streaming progress, and billing are not yet connected.

## Development
Requires Node.js 24+.
```sh
npm test
npm run check
npx wrangler dev
```

## Runtime
Cloudflare Workers only. No Cloudflare Pages application or build pipeline is used by this project.

## Engineering principles
- Start with direct HTTP and escalate to browser execution only when needed.
- Keep providers behind ExportFlow-owned adapter contracts.
- Enforce URL/redirect policy, Cloudflare runtime egress restrictions, resource budgets, authorization, and site policies before enabling outbound execution.
- Treat fetched page content as untrusted data, not instructions.
- Return structured results with source provenance, timestamps, warnings, and evidence.
- Distinguish proposed, implemented, tested, deployed, and live-verified capabilities.
