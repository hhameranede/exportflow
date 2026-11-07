# ExportFlow

ExportFlow is a mobile-first parcel-tracking website with eight selectable interface languages: English, Arabic, Spanish, Chinese, Hindi, Portuguese, French and Russian.

- Production domain: [https://exportflow.me](https://exportflow.me)
- Worldwide country/territory directory: [https://exportflow.me/coverage/](https://exportflow.me/coverage/)
- Hosting: Cloudflare Pages and Pages Functions
- Runtime: Node.js compatibility enabled for Cloudflare Workers

## Live tracking engine

ExportFlow integrates [Universal Parcel Scraper](https://github.com/plhery/universal-parcel-scraper) at the pinned upstream revision `e64a466772ef25ce68e02d9c7c9f1613eec1208b`.

The upstream catalog documents thousands of carrier names and dedicated adapters. Those are catalog/adapter records, **not a count of verified operating companies, live successful lookups, delivery performance or official partnerships**. The homepage reads catalog-entry and direct-country counts from the installed runtime catalog rather than hard-coding marketing claims.

### Implemented routes

- `POST /api/track` — server-side carrier lookup. Accepts a tracking number and optional carrier, postcode and language (`en`, `ar`, `es`, `zh`, `hi`, `pt`, `fr`, `ru`). Tracking numbers are not sent to browser-side third-party APIs. Returns normalized timeline events with deterministic status, confidence, conflict detection, and delay/customs/ETA insights.
- `GET /api/carriers` — exposes the installed carrier ID catalog.
- `GET /api/coverage` — returns a live country-by-country classification derived from the installed carrier catalog.
- `GET /api/health` — a liveness response; it does not prove that upstream carriers are reachable.

#### Tracking API Response

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

### What is enabled in the server integration

- Automatic carrier detection and direct carrier adapters from the pinned engine.
- UPU is the only universal fallback enabled by default.
- Other optional third-party universal fallback providers remain disabled because they would also receive users' tracking numbers.
- Some upstream adapters require a remote browser service (TRAWL/Chromium); those adapters remain unavailable until a compatible service is separately configured.
- A shipment map displays only carrier-supplied scan coordinates after server-side validation. It does not geocode recipient addresses or invent locations.

### Privacy and safeguards

- Carrier/provider credentials must remain server-side.
- Do not log full tracking numbers or postcodes.
- The selected carrier receives the tracking number. UPU may receive eligible postal tracking numbers.
- Tracking responses use `Cache-Control: no-store`.
- The tracking endpoint applies request-body validation, a bounded lookup deadline, per-isolate request throttling and concurrency limits. The in-memory limits are per Worker isolate, not global customer quotas.
- Country and carrier listing data is public catalog information; individual tracking results are not public directory content.

## SEO

The public site includes a canonical homepage URL, crawlable metadata, `robots.txt`, an XML sitemap and a separate crawlable country directory. The sitemap intentionally includes only public pages. It does not include API routes, tracking numbers or per-shipment URLs.

The eight supported interface languages have crawlable locale routes for the homepage and country directory: English uses the unprefixed canonical URLs, while Arabic, Spanish, Chinese, Hindi, Portuguese, French and Russian use `/{locale}/` and `/{locale}/coverage/`. The build generates canonical metadata and reciprocal `hreflang` alternates for all eight languages and includes every locale URL in the XML sitemap.

On first visits to the homepage or country directory, Cloudflare Pages middleware uses the visitor's country code to select a supported language. Countries without a configured language use English. A visitor's explicit language choice is stored in a first-party `ef-locale` cookie and local storage and takes precedence over country detection on later visits.

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
- `functions/api/track.js` — server-side tracking lookup
- `functions/api/carriers.js` — installed carrier ID catalog
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
