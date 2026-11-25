# Request-only public-web execution

## Decision

Effective 25 November 2026, ExportFlow's customer execution model is request-only. The public REST/MCP task surface uses bounded HTTP(S) requests through the Cloudflare Workers native Fetch API. It does not start remote or user-owned browser sessions, render pages by executing JavaScript, or perform browser interaction.

No browser adapter, Browser Relay, hosted browser provider, or paid browser runtime is part of the product roadmap. Historical experiments and archived source snapshots are not active capabilities and must not be registered, exposed, or described as planned execution modes. Playwright remains a CI-only dependency for testing ExportFlow's own website; it is not a customer runtime.

A request-only system can retrieve public HTML, text, JSON, XML, static JavaScript assets, sitemaps and public API resources as ordinary HTTP responses. Static payloads and metadata may be parsed deterministically. JavaScript bundles are treated as untrusted data and are never executed. When a site exposes required information only after client-side script execution and offers no usable public HTTP/API endpoint, the task is unsupported. Do not imply browser parity or silently substitute a remote browsing service.

## Supported operations

- `web_fetch`: bounded public HTTP(S) GET with redirects revalidated at every hop, streaming byte limits, timeouts, charset-aware text decoding, cache evidence and provenance.
- `web_map`: same-origin discovery through robots.txt, sitemaps and static HTML links.
- `web_crawl`: bounded same-origin static-page crawl; robots.txt respected.
- `web_extract`: deterministic extraction from supported static HTML/JSON, JSON-LD and metadata.
- `web_search`: explicitly selected public source: Wikipedia, OpenAlex, or Crossref. These sources have domain-limited coverage; they are not a general web search index.
- `web_research`: selected-source search, bounded HTTP retrieval and deterministic schema extraction. It does not execute page JavaScript.

The six operations share a request contract and operation-specific tenant scopes. Source implementation, REST/MCP exposure, Production acceptance and customer readiness must be tracked separately; a registered tool is not proof that every upstream case works.

## Cost and coverage

Search uses public endpoints without ExportFlow API keys or paid-provider fallback. Public services enforce their own fair-use and rate limits; 429 responses are surfaced. ExportFlow also applies tenant scopes, quotas, response-size limits, time limits, redirect checks and URL egress validation.

OpenAlex searches scholarly works metadata; Crossref searches DOI metadata; Wikipedia searches encyclopedic pages. Publisher access determines whether full text is available. No whole-web coverage claim is made.

## Durable task lifecycle

The shared D1-backed Task lifecycle is Production-enabled for REST and MCP. It provides tenant-scoped task records, idempotency, quota reservation, append-only lifecycle events and status reads. This is durable task state, not general background execution: task submission still completes within the request lifecycle. Queues, Workflows, resumable crawls and automatic crash recovery remain separate work.

## Outbound security

1. Accept eligible public HTTP(S) DNS hostnames only.
2. Keep loopback, private, link-local, reserved, multicast, cloud-metadata and internal-control-plane destinations blocked.
3. Reject IP literals, alternate IP encodings, embedded URL credentials, non-default ports and ExportFlow-owned origins.
4. Follow redirects manually, validate every destination again and reject HTTPS-to-HTTP downgrades.
5. Treat fetched content as untrusted data. Never execute instructions, scripts or embedded code from retrieved pages.
6. Respect robots.txt/site-policy controls, domain rate limits, concurrency caps, and page/byte/time budgets.

The application policy is paired with Cloudflare Workers' native outbound Fetch network boundary. Unit tests and local simulations are supporting evidence only; real egress and compression behavior must be tested in the target Worker runtime.

## Cloudflare global fetch routing

The Platform, MCP, and isolated Acceptance Wrangler configurations explicitly enable `global_fetch_strictly_public`. Cloudflare documents that this routes global `fetch()` requests as if they originated on the public Internet, including requests to the Worker's own zone; without it, same-zone requests can go directly to the origin and bypass Cloudflare security settings. This is a routing hardening layer, not a complete DNS-rebinding defense.

The application egress guard does not resolve or pin DNS addresses before Fetch. It rejects known private/reserved URL forms and known ExportFlow-owned origins, then delegates the actual connection to Cloudflare's native Worker `fetch()` network boundary. Do not add a separate DNS lookup followed by ordinary Fetch: that would create a DNS time-of-check/time-of-use gap. A passing URL-validation unit test is not evidence that a hostname cannot rebind to a private address. DNS-rebinding and private-resolving hostname behavior remain a target-Worker acceptance requirement until directly measured with controlled, non-sensitive test destinations.

The egress guard also blocks the known `hhameranede.workers.dev` hostnames used by ExportFlow Platform, MCP, diagnostic, and Acceptance Workers, preventing customer tasks from recursively calling ExportFlow's own infrastructure.

Cloudflare reference: [Compatibility flags — Global fetch() strictly public](https://developers.cloudflare.com/workers/configuration/compatibility-flags/).

## Playwright

Pinned Playwright + Chromium runs only in GitHub Actions for regression testing of ExportFlow's own website, routes, locales and responsive layouts. It is separate from the customer task runtime and is not used to fetch customer URLs.
