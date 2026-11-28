# ExportFlow

**Agent Execution Infrastructure — the request-first execution layer for AI.**

ExportFlow gives AI agents one bounded REST/MCP interface for public-web requests and structured results with source evidence.

## Execution model

- **Request-first:** outbound work uses the Cloudflare Workers native `fetch()` API over eligible public HTTP(S) destinations.
- **Bounded:** GET-only upstream retrieval, manual redirect validation, response-byte ceilings, timeouts, quotas, and normalized errors.
- **Evidence-backed:** outputs preserve requested/final URLs, HTTP status, retrieval time, byte counts, redirect history, and per-field evidence where available.
- **Model-agnostic:** REST and MCP expose the same ExportFlow-owned task contracts.

ExportFlow does not launch remote or user-owned browser sessions, execute website JavaScript, or offer browser-session interaction. Public HTML, text, JSON and XML resources can be retrieved as ordinary HTTP responses when they pass egress policy. JavaScript files are data, never executed. If a site only reveals its content after client-side JavaScript execution and exposes no usable public HTTP endpoint, that task is unsupported. ExportFlow has no browser-service fallback.

Playwright is used only by GitHub Actions for ExportFlow's own website QA. It is not part of customer task execution.

## Current operations

The authenticated REST Task API and MCP surface define six bounded operations:

| Operation | Current behavior | Important limits |
| --- | --- | --- |
| Fetch | Public HTTP(S) GET with response normalization and provenance | 1 MiB body, 8 s upstream timeout, up to 3 redirects |
| Map | Same-origin discovery from robots.txt, sitemaps, and static page links | Bounded URL count; no JavaScript execution |
| Crawl | Bounded same-origin static-page crawl | Public MCP contract: up to 3 pages and depth 1 |
| Extract | Deterministic HTML/JSON metadata, JSON-LD, and bounded CSV column extraction | CSV columns are returned as string arrays; 256 KiB input, up to 1,000 rows and 100 columns |
| Search | Explicitly selected public datasets | Wikipedia, OpenAlex, or Crossref; not general whole-web search |
| Research | Search → bounded Fetch → deterministic Extract | Up to 3 candidate URLs; static HTTP only |

A capability being present in Core or exposed through REST/MCP does not mean every upstream behavior is Production-verified. See the P0 capability matrix and acceptance evidence before making coverage claims.

## Durable task lifecycle

The shared D1-backed task lifecycle is Production-enabled for REST and MCP. It provides tenant-scoped task records, idempotency, quota reservation, append-only lifecycle events, and task-status reads. Production smoke acceptance exercised the real Workers and D1 path with synthetic tenants and cleaned up the run-scoped data afterward.

This is durable task state, not a general background job engine. Submission still executes within the request lifecycle; Queues, Workflows, resumable crawls, and automatic crash recovery are separate future work.

## Security and egress

The application egress policy rejects:

- loopback, private, link-local, reserved, and single-label hostnames;
- IP-literal destinations and alternate IPv4 encodings;
- embedded URL credentials and non-default ports;
- ExportFlow-owned hostnames and unsafe redirect destinations;
- HTTPS-to-HTTP redirect downgrades.

Every redirect is followed manually and revalidated before the next request. Upstream response bodies are streamed under a byte ceiling. No cookies, browser sessions, or origin credentials are forwarded. Retrieved page content is untrusted data and is never treated as executable instructions.

The application policy is paired with Cloudflare Workers' native outbound Fetch network boundary. A unit test or local simulation is not proof of target-runtime SSRF coverage; use the recorded target-runtime acceptance evidence for claims about runtime behavior.

## Extraction boundary

Structured extraction supports static HTML/JSON metadata, JSON-LD, declared schema paths, and bounded CSV. For CSV, declare selected columns as arrays of strings and map them with `x-source: "csv:Column Name"`; values (including leading zeroes and formula-looking text) remain strings and formulas are never executed. CSV is capped at 256 KiB, 1,000 rows, 100 columns, and 256 characters per header. Google Sheets integrations and private Sheets OAuth are permanently out of scope; generic HTTP Fetch is not Google Sheets integration. PDF, DOCX and XLSX require separate parser implementations and acceptance matrices before being advertised.

## Development

Requires Node.js 24+.

```sh
npm install
npm test
npm run check
npx wrangler dev
```

GitHub Actions runs the repository test suite, syntax checks, site-wide Playwright QA, and Wrangler dry-runs. Playwright/Chromium is installed in the CI runner separately from product dependencies.

## Deployment

The product runtime is deployed on Cloudflare Workers. The official Platform Worker serves `exportflow.me`; the MCP Worker is deployed separately. Production releases are approval-gated and coordinated through the repository's release workflow.

## Engineering principles

- Inspect the exact repository revision and deployed Worker versions before making runtime claims.
- Prefer direct public HTTP requests; never imply JavaScript rendering or browser interaction.
- Keep provider implementations behind versioned ExportFlow-owned contracts.
- Enforce URL, redirect, origin, tenant, quota, timeout, and byte boundaries before returning data.
- Distinguish source implementation, unit tests, target-runtime acceptance, API/MCP exposure, Production enablement, and customer readiness.
- Preserve clear evidence for what was tested, where it ran, and what remains unsupported.
