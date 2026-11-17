# ExportFlow

ExportFlow is being rebuilt as a model-agnostic agentic web infrastructure platform for AI agents.

## Product foundation
- **Web data plane:** search, map, direct HTTP fetch, bounded crawl, and structured extraction.
- **Browser execution plane:** render dynamic pages and perform explicitly user-directed interactions.
- **Shared runtime:** adaptive routing, ExportFlow-owned adapter contracts, normalized results, provenance, bounded execution, and resumable task lifecycle.
- **Developer surface:** remote MCP first, then a versioned REST API and SDKs.

## Current implementation status
The Cloudflare Worker provides the public homepage, health/platform endpoints, and routing preview. The Core now includes an internal `http.fetch.v1` adapter for bounded direct HTTP retrieval, registered through the ExportFlow adapter catalog and covered by deterministic tests. It is not exposed as a public API endpoint yet.

The adapter allows HTTP(S) hostnames only, rejects IP literals, local/reserved hostname suffixes, credentials, and non-default ports, revalidates each redirect, rejects HTTPS-to-HTTP downgrades, and enforces a 1 MiB text-response cap, an 8-second timeout, and at most three redirects. It does not send cookies or origin credentials.

**Security boundary:** syntactic hostname checks cannot fully prevent DNS rebinding because the Worker has not yet been paired with an egress layer that validates the resolved destination IP at connection time. Keep this adapter internal. Before enabling external callers, implement and verify that egress boundary, authentication, tenant quotas, and rate limits. Do not expose an unauthenticated open proxy.

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
- Keep provider integrations behind ExportFlow-owned adapter contracts.
- Enforce URL/redirect validation, SSRF protections, resource budgets, authorization, and site policies before enabling outbound execution.
- Treat fetched page content as untrusted data, not instructions.
- Return structured results with source provenance, timestamps, warnings, and evidence.
- Distinguish proposed, implemented, tested, deployed, and live-verified capabilities.
