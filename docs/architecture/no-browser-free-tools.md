# No-browser execution and public-source tools

## Decision

ExportFlow does not provide browser rendering, user-directed browser interaction, or Browser Run escalation. These capabilities are removed from task routing and the public tool registry. Playwright remains a CI-only QA dependency for site and route regression; it is not a product execution runtime.

Running Chromium for end users still requires a supported compute host and browser lifecycle infrastructure. The open-source Playwright package does not make that runtime free. No Browser Rendering/Browser Run binding, third-party browser service, or paid search provider is added.

## Supported tools

- `web_fetch`: bounded public HTTP(S) GET.
- `web_map`: same-origin discovery through robots.txt, sitemaps and static HTML links.
- `web_crawl`: bounded same-origin static-page crawl; robots.txt respected.
- `web_extract`: deterministic extraction from static HTML/JSON, JSON-LD and metadata.
- `web_search`: explicitly selected public source: Wikipedia, OpenAlex, or Crossref. These sources have domain-limited coverage; they are not a general web search index.
- `web_research`: selected-source search, bounded HTTP retrieval and deterministic schema extraction. It does not render JavaScript.

## Cost and coverage

Search uses public endpoints without ExportFlow API keys or paid-provider fallback. Public services enforce their own fair-use and rate limits; 429 responses are surfaced. ExportFlow also applies tenant scopes, quotas, response-size limits, time limits, and URL egress validation.

OpenAlex searches scholarly works metadata; Crossref searches DOI metadata; Wikipedia searches encyclopedic pages. Publisher access determines whether full text is available. No whole-web coverage claim is made.

## REST API

`POST /api/v1/tasks` accepts `fetch`, `map`, `crawl`, `extract`, `search`, and `research`, with operation-specific `tasks:<operation>` scopes. Browser flags, arbitrary headers, cookies and credentials are not accepted.

## Playwright

Pinned Playwright + Chromium runs only in GitHub Actions for site regression and viewport checks. This consumes GitHub Actions runner time (subject to repository allowance); it is separate from Cloudflare Browser Run minutes and is not a user-facing tool.
