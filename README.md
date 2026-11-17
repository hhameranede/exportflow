# ExportFlow

ExportFlow is a model-agnostic agentic web infrastructure platform for AI agents.

## Product foundation
- **Web data plane:** search, map, direct HTTP fetch, bounded crawl, and structured extraction.
- **Browser execution plane:** render dynamic pages and perform explicitly user-directed interactions.
- **Shared runtime:** adaptive routing, ExportFlow-owned adapter contracts, normalized results, provenance, bounded execution, and task lifecycle primitives.
- **Developer surface:** remote MCP first, then a versioned REST API and SDKs.

## Current implementation status
The Cloudflare Worker provides the public homepage, health/platform endpoints, and routing preview. The Core includes an internal `http.fetch.v1` adapter for bounded direct HTTP retrieval and an internal `executeWebTask()` primitive. Neither is exposed as a public API endpoint.

## Bounded map and crawl
- `web.map.v1` discovers same-origin URLs from `robots.txt` sitemap declarations, a bounded sitemap fetch, and links from the requested start page.
- `web.crawl.v1` crawls at most five pages and depth two, with per-page and total byte limits.
- The crawler identifies itself as `ExportFlowBot/0.1`, applies RFC 9309 user-agent groups and longest-match Allow/Disallow rules, and stops on robots network errors, 401/403/429, and 5xx responses.
- The HTTP fetch layer pins redirects to the requested origin during mapping/crawling, so an off-origin redirect is rejected before its destination request.
- It does not traverse off-origin links, carry credentials, or attempt access to authenticated pages.
- Cloudflare Workers use the runtime `HTMLRewriter` parser; Node tests use a deterministic fallback parser.

## Schema-based extraction

- `web.extract.v1` accepts a bounded JSON Schema object and extracts declared fields from JSON-LD, OpenGraph/meta tags, page title, canonical URL, or explicit `x-source` paths.
- Returns only values that match the requested field types, `missingFields`, `missingRequired`, and field-level source evidence.
- Uses deterministic parsing only: no LLM inference, remote `@context` loading, page-script execution, or arbitrary selectors.
- Supports HTML and JSON sources only; JSON-LD graph traversal, metadata fallbacks, and invalid-block warnings are bounded.
- Schema limits: 16 KiB, 20 properties, up to 8 source paths per field; JSON-LD limits are 20 blocks, 128 KiB per block, and 100 nodes.
- The extractor does not fetch remote JSON-LD contexts and never executes page scripts.

## Internal task execution
- Creates a task ID and an in-memory lifecycle event sequence (`accepted`, `started`, `succeeded`, `partial`, `failed`, or `unsupported`).
- Routes static retrieval to `http.fetch.v1`.
- Reports JavaScript/rendering/interaction tasks as `unsupported` until a reviewed Browser adapter is connected; it does not simulate a browser action.
- Returns normalized result data, source provenance, timestamps, and warnings.
- Does not persist tasks, create queues, or accept caller-supplied credentials or arbitrary request headers.
- Treats fetched page content as untrusted data. The executor never treats page text as executable instructions.

Task state is currently ephemeral and exists only in the returned object. Durable task persistence and external API/MCP access are separate future stages.

## Outbound security model

ExportFlow uses two complementary controls:

1. **Application Egress Policy:** validates each destination and redirect. It accepts only HTTP(S), rejects IP literals (including alternate IPv4 spellings), credentials, non-default ports, local/reserved hostnames, and ExportFlow-owned origins.
2. **Cloudflare Workers runtime egress:** outbound requests use the native Workers Fetch API. Cloudflare documents that Worker outbound HTTP is mediated by a local proxy and that workers cannot access hosts outside the permitted network boundary. No separate DNS lookup is used as a substitute for pinning the actual connection.

A bounded Preview test used DNS-only records in the full `exportflow.me` zone. The public control (A → `34.223.124.45`) returned HTTP 403 from the remote HTTP service, while records resolving to `127.0.0.1` and `10.0.0.1` returned Cloudflare HTTP 530 / error 1016. This is evidence that the private destinations did not reach an origin in this test, but 1016 is documented as an Origin DNS Error, not a dedicated private-IP-denial code. Record this as **runtime private-destination blocked at resolution stage — strong evidence, not a complete DNS-rebinding proof**.

The temporary DNS records were deleted after the test. The isolated Preview Worker remains without a public route or custom domain.

Do not add `cf.resolveOverride` as a generic destination pinning mechanism: it only takes effect when both the request hostname and override hostname are within the same Cloudflare zone. Keep every redirect manual and revalidate the destination before following it.

The fetch adapter and task executor are still internal Core code. Do not expose them to public callers until authentication, tenant quotas, rate limits, and the egress verification boundaries are complete.

## HTTP fetch limits
- GET only; HTTP and HTTPS.
- Default ports only.
- At most three manually followed redirects.
- Redirects are revalidated; HTTPS-to-HTTP downgrade is rejected.
- Maximum text response: 1 MiB.
- Timeout: 8 seconds.
- No cookies or origin credentials are forwarded.

## Not connected yet
Live web search, browser automation, hosted MCP, authentication, persistent tasks, queues, streaming progress, and billing are not yet connected.

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
