# ExportFlow

A mobile-first parcel tracker in English and Arabic. Live tracking runs server-side through the open-source Universal Parcel Scraper engine.

## Live tracking engine

ExportFlow integrates [Universal Parcel Scraper](https://github.com/plhery/universal-parcel-scraper) at the pinned upstream commit `e64a466772ef25ce68e02d9c7c9f1613eec1208b`.

The upstream currently documents:
- 3,500+ carriers in its catalog
- 732 dedicated carrier adapters
- 5 universal fallback providers
- 1,339 catalog entries across 156 countries

These figures describe catalog and adapter coverage, not a guarantee that every shipment number will return a live scan. The project benchmarks a selected sample, and carriers may rate-limit or block automated requests.

### What works in this integration

- Automatic carrier detection and direct carrier adapters.
- A server-side `POST /api/track` endpoint. Tracking numbers are never sent to browser-side third-party APIs.
- A server-side `GET /api/carriers` endpoint exposing the engine catalog.
- A health endpoint at `GET /api/health`.
- Bounded request size, per-isolate rate limits, concurrency limits, a lookup deadline, no-store responses, and privacy-conscious error output.
- English and Arabic status/timeline UI.

The only universal fallback enabled by default is UPU. Other optional third-party fallback providers are intentionally not enabled because they receive the user's tracking number too. Some carrier adapters need a browser service (TRAWL/Chromium); those adapters can remain unavailable until a separate browser service is configured.

## Carrier verification

The default `npm test` suite checks the shape and definitions of every carrier ID in the pinned upstream catalog (currently more than 1,000 entries), plus the tracking API's output contract using synthetic status fixtures. These checks make no network requests.

Run `npm run test:carriers:live` for a separate live canary. It checks one publicly re-checkable benchmark number for each supported carrier in the upstream's 100-carrier benchmark dataset. The canary uses the dedicated carrier adapters only: universal third-party fallback providers are disabled. It reports carrier, status, event count, and duration, but never writes tracking numbers, event descriptions, or recipient/location details to its report.

Live numbers can age out, and a negative result can mean that a carrier no longer retains that shipment's history. The canary does **not** prove that every one of the 1,339 catalog entries can return live tracking data. It is deliberately separate from `npm test` because it contacts carrier websites.

## Local development

Requirements: Node.js 24+ and Python 3.

```bash
npm install
npm test
npm run build
npm run dev
```

Open http://localhost:4173. Static preview is for layout only; live API routes require Cloudflare Pages Functions runtime.

## Project structure

- `index.html`, `styles.css`, `app.js` — bilingual frontend
- `functions/api/track.js` — server-side live tracking
- `functions/api/carriers.js` — upstream carrier catalog
- `functions/api/health.js` — API health check
- `scripts/` — build and smoke tests
- `.github/workflows/ci.yml` — CI on pushes and PRs

## Cloudflare Pages

- Repository: `hhameranede/exportflow`
- Production branch: `main`
- Build command: `npm run build`
- Build output: `dist`
- Root: `/`

Cloudflare Pages Functions are deployed from the root `functions/` directory. Node.js 24 is required by the upstream package.

## Licensing

The upstream core is Apache-2.0. Its optional TRAWL derivative is AGPL-3.0; it is not bundled or enabled in this integration. Keep the upstream `LICENSE`, `NOTICE`, and relevant third-party notices with any redistribution. See upstream `NOTICE` for bundled model and data attributions.

## Privacy

- Never put carrier or provider credentials in browser JavaScript.
- Never log full tracking numbers or postcodes.
- The selected carrier receives the tracking number; UPU may receive it for eligible postal numbers.
- Additional universal fallback providers must remain opt-in and disclosed because they also receive the tracking number.
- Tracking responses use `Cache-Control: no-store`; do not index private tracking results.
