# ExportFlow

ExportFlow is a mobile-first parcel-tracking website with eight selectable interface languages: English, Arabic, Spanish, Chinese, Hindi, Portuguese, French and Bengali.

- Production domain: [https://exportflow.me](https://exportflow.me)
- Worldwide country/territory directory: [https://exportflow.me/coverage/](https://exportflow.me/coverage/)
- Hosting: Cloudflare Pages and Pages Functions
- Runtime: Node.js compatibility enabled for Cloudflare Workers

## Live tracking engine

ExportFlow integrates [Universal Parcel Scraper](https://github.com/plhery/universal-parcel-scraper) at the pinned upstream revision `e64a466772ef25ce68e02d9c7c9f1613eec1208b`.

The upstream catalog documents thousands of carrier names and dedicated adapters. Those are catalog/adapter records, **not a count of verified operating companies, live successful lookups, delivery performance or official partnerships**. The homepage reads catalog-entry and direct-country counts from the installed runtime catalog rather than hard-coding marketing claims.

### Implemented routes

- `POST /api/track` — server-side carrier lookup. Accepts a tracking number and optional carrier, postcode and language (`en`, `ar`, `es`, `zh`, `hi`, `pt`, `fr`, `bn`). Tracking numbers are not sent to browser-side third-party APIs. Returns normalized timeline events with deterministic status, confidence, conflict detection, and delay/customs/ETA insights.
- `GET /api/carriers` — exposes the installed carrier ID list, sanitized adapter metadata and the D1-backed evidence register for the curated 22-network research cohort. Every seed remains `research`; a carrier catalog or adapter is never presented as a successful live integration.
- `GET /api/carrier-directory` — paginated, searchable access to the **complete pinned source catalog** (1,339 records in this revision). Supports `q`, `country`, `evidence`, `adapter`, `page` and `pageSize` (maximum 100). The D1 evidence overlay is joined to matching adapters while all unmatched records remain `catalogued`.
- `GET /api/coverage` — returns a live country-by-country classification derived from the installed carrier catalog.
- `GET /api/health` — a liveness response; it does not prove that upstream carriers are reachable.
- `POST /api/batch-track` — bounded batch tracking for up to five shipments. Each result includes an individual status and reuses the single-tracking validation and safeguards.
- `GET /api/openapi` — machine-readable OpenAPI 3.1 contract for the public API.
- `POST /api/mcp` — stateless Model Context Protocol Streamable HTTP endpoint (protocol `2026-07-28`) for single/batch tracking, carrier discovery, country coverage and health checks. No MCP session or server-side agent history is stored.
- `GET /developers/` — developer quick start, JavaScript SDK and MCP agent integration guide; the SDK is served as `/exportflow-sdk.mjs`.
- `/merchant/` — device-only merchant workspace. It stores up to ten watchlist entries in browser local storage, refreshes them in two sequential batches of at most five and can export a CSV. It is not an account, cloud sync or server-side shipment history.

#
### Global carrier directory scale and interpretation

The pinned upstream Universal Parcel Scraper README at revision `e64a466772ef25ce68e02d9c7c9f1613eec1208b` reports **1,339 catalog entries**, **732 dedicated adapters**, **5 universal fallbacks**, **156 countries represented** and **3,500+ carrier-network names**. ExportFlow's carrier directory exposes all catalog records in 50-record pages (API maximum 100), with name/alias/country search and separate adapter/evidence filters. The public page does not download or render thousands of cards at once.

These figures describe the upstream engine's catalog and network naming. They are not a count of 3,500 independently incorporated companies, successful live lookups, commercial permissions or verified ExportFlow integrations. The current curated D1 evidence overlay contains 22 researched network dossiers, all separate from the 1,339 catalog entries. Every other entry remains `catalogued` until source, adapter scope, access terms and test evidence are reviewed. The D1 database is intentionally not bulk-filled with static upstream catalog metadata; the pinned package is the source of truth for that catalogue, while D1 stores the smaller, curated evidence and permission layer.

### Tracking API Response

The `/api/track` endpoint returns a structured response:

```json
{
  "carrier": "fedex",
  "source": "fedex",
  "status": "out_for_delivery",
  "confidence": "medium",
  "truth": {
    "latestReceived": { "stage": "in_transit", "time": "2026-11-06T08:00:00.000Z", "receivedAt": "2026-11-06T10:00:00.000Z" },
    "latestTrusted": { "stage": "out_for_delivery", "time": "2026-11-06T09:30:00.000Z", "receivedAt": "2026-11-06T09:31:00.000Z" },
    "selected": { "stage": "out_for_delivery" },
    "conflicts": [],
    "insights": {
      "delay": { "level": "insufficient_evidence", "reason": "no_explicit_delay_signal" },
      "customs": { "state": "insufficient_evidence", "reason": "no_explicit_customs_signal" },
      "estimate": { "source": "carrier", "value": "2026-11-09", "confidence": "reported" }
    }
  },
  "expectedDelivery": "2026-11-09",
  "service": "Express",
  "events": []
}
```

- **status**: Determined chronologically by timestamp, not by stage scoring. If different stages conflict at the latest timestamp, status is `unknown`; if the latest stage or location is ambiguous, `latestTrusted` and `selected` are `null` rather than choosing an event by input order. If all latest stages agree but locations conflict, the shared status remains available while the location remains unresolved.
- **confidence**: "low" when no trusted timestamp exists or evidence conflicts; "medium" when a source-attributed, timezone-qualified event exists. The engine does not claim "high" confidence until independent source quality can be verified.
- **latestReceived**: The last event in the resolver's input order, or the event with the latest valid explicit `receivedAt` when every event supplies one. Input order is not treated as carrier event time; it may refer to an older scan.
- **latestTrusted**: The newest event with a valid timestamp containing an explicit timezone/UTC offset and at least one source reference. Timezone-less timestamps remain visible as raw values but are not trusted for chronology.
- **conflicts**: Detected when trusted events at the same timestamp have different stages or locations.
- **insights**: Delay requires an explicit current carrier delay signal; two scans or a generic exception alone are insufficient. Conflicting latest customs signals remain `insufficient_evidence`. Customs states require explicit hold/processing/release evidence. ETA is reported only when supplied by the carrier.
- **sourceRefs**: Per-event source attribution. Duplicate normalized scans retain all source references found on the original events.

### Worldwide country directory

The directory lists all **249 assigned ISO 3166-1 alpha-2 country and territory codes**. Each is classified from the current installed carrier catalog as one of:

1. **Direct adapter listed** — at least one selectable carrier has an automatic dedicated adapter associated with the country.
2. **Universal / postal fallback only** — the catalog lists an automatic universal provider entry but no direct dedicated adapter for that country.
3. **Tracking-page link only** — the catalog has a tracking-page link but no automatic lookup adapter.
4. **No catalog entry** — no selectable country-specific carrier record was found in the installed catalog.

A country appearing in the directory does not mean ExportFlow has a working direct integration there. A carrier catalog entry does not guarantee every tracking number will return live scan data. Carriers can require additional details, rate-limit automated requests, block traffic or change their tracking systems. The directory explicitly separates catalog presence from automatic support.

### Carrier evidence and permission model

The D1 `carrier_evidence` registry starts with 22 researched global networks: Aramex, Australia Post, Cainiao, Canada Post, China Post, Correos, DHL Express, DPD/Geopost, Emirates Post, FedEx, GLS, India Post, Japan Post, La Poste/Colissimo, PostNL, Royal Mail, SF Express, Singapore Post, UPS, USPS, Yanwen and YunExpress.

Every seed remains `research` until its own source, adapter scope, access model and use rights have been confirmed. The registry distinguishes a present adapter from country-specific adapters and missing adapters; it also records whether access is account-bound, merchant-scoped, partner-onboarded or requires written permission. For example, the DPD and GLS entries are country-specific, PostNL is tied to customer codes, and DHL Express/FedEx/UPS have third-party permission conditions. These facts are not collapsed into a generic "supported" badge.

The API exposes only public summaries and official source links; internal research notes and authorization documents are not returned. A row can become `verified` only with a repeatable live test, a timestamp, a test-evidence URL, an authorization-evidence URL and a declared rights scope. D1 constraints and a trigger reject status-only promotions. The registry is an evidence workflow, not a claim that these providers are already connected or commercially cleared.

### What is enabled in the server integration

- Automatic carrier detection and direct carrier adapters from the pinned engine.
- UPU is the only universal fallback enabled by default.
- Other optional third-party universal fallback providers remain disabled because they would also receive users' tracking numbers.
- Some upstream adapters require a remote browser service (TRAWL/Chromium); those adapters remain unavailable until a compatible service is separately configured.
- A shipment map displays only carrier-supplied scan coordinates after server-side validation. It does not geocode recipient addresses or invent locations.

### Privacy and safeguards

- Carrier/provider credentials must remain server-side.
- Do not log full tracking numbers or postcodes.
- MCP is a stateless public endpoint: each request carries protocol metadata and routing headers. Tracking tools reuse the same underlying validation, rate limits and provider safeguards as the REST API; no API key is currently required and no agent conversation history is stored.
- The selected carrier receives the tracking number. UPU may receive eligible postal tracking numbers.
- Tracking responses use `Cache-Control: no-store`.
- The tracking endpoint applies request-body validation, a bounded lookup deadline, per-isolate request throttling and concurrency limits. The merchant workspace keeps the watchlist and compact result summaries in browser local storage only; a refresh explicitly sends the shipment details to the tracking API. The in-memory limits are per Worker isolate, not global customer quotas.
- Country and carrier listing data is public catalog information; individual tracking results are not public directory content.

## SEO

The public site includes a canonical homepage URL, crawlable metadata, `robots.txt`, an XML sitemap and a separate crawlable country directory. The sitemap intentionally includes only public pages. It does not include API routes, tracking numbers or per-shipment URLs.

The eight supported interface languages have crawlable locale routes for the homepage and country directory: English uses the unprefixed canonical URLs, while Arabic, Spanish, Chinese, Hindi, Portuguese, French and Bengali use `/{locale}/` and `/{locale}/coverage/`. The build generates canonical metadata and reciprocal `hreflang` alternates for all eight languages and includes every locale URL in the XML sitemap.

On first visits to the homepage or country directory, Cloudflare Pages middleware uses the visitor's country code to select a supported language. Countries without a configured language use English. A visitor's explicit language choice is stored in a first-party `ef-locale` cookie and local storage and takes precedence over country detection on later visits.

## Additional upstream source snapshots

Reviewed upstream repositories are stored as ordinary tracked source snapshots under `vendor/sources/`; they are not Git submodules and this repository has no `.gitmodules` file. The pinned snapshots can be inspected directly after cloning without running `git submodule update`.

Only Universal Parcel Scraper is part of the current runtime. Shopana, Karrio Community and the Algerian DZ Delivery SDK are reference sources, not additional production engines. License details, exact pins, exclusions and carrier-authorization caveats are documented in [Third-party source registry](docs/THIRD_PARTY_SOURCES.md).

## Local development

Requirements: Node.js 24+ and Python 3.

```bash
npm install
npm test
npm run build
npm run dev
```

Open http://localhost:4173. Static preview is for layout only; Pages Functions and `/api/*` routes require the Cloudflare Pages runtime.

## Project structure

- `index.html`, `styles.css`, `app.js` — responsive homepage and tracking UI
- `translations.js` — eight complete interface locale dictionaries
- `coverage/index.html`, `coverage.js` — searchable country/territory directory
- `merchant/index.html`, `merchant.js` — browser-local merchant watchlist, bounded batch refresh and CSV export
- `functions/api/track.js` — server-side tracking lookup
- `functions/api/carriers.js` — installed carrier ID list and sanitized catalog capability records
- `functions/api/coverage.js` — catalog-derived country classification and counts
- `functions/api/health.js` — liveness endpoint
- `functions/lib/country-codes.mjs` — ISO 3166-1 alpha-2 country/territory codes
- `functions/lib/shipment-truth.mjs` — deterministic shipment truth resolution engine (chronology-based, conflict detection, confidence modeling)
- `functions/lib/exportflow-carrier-engine.mjs` — ExportFlow-owned facade over universal-parcel-scraper
- `scripts/shipment-truth-test.mjs` — unit tests for the truth engine
- `scripts/` — build and regression tests
- `.github/workflows/ci.yml` — CI on pushes and pull requests
- `docs/roadmaps/` — strategic product roadmaps (2.0 and 3.0)

## Cloudflare Pages

- Repository: `hhameranede/exportflow`
- Production branch: `main`
- Build command: `npm run build`
- Build output: `dist`
- Root: `/`

Pages Functions are deployed from the root `functions/` directory. The build prepares the pinned tracking engine for the Workers runtime.

## Licensing

The pinned `universal-parcel-scraper` core is Apache-2.0. Copies of its upstream `LICENSE` and `NOTICE` at the pinned commit are retained in `third-party-licenses/universal-parcel-scraper/`. The NOTICE records additional model/data attributions, including MIT, CC BY 4.0 and ODbL sources. The optional TRAWL derivative/image is AGPL-3.0; it is not bundled or enabled in this integration.
