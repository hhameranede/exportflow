# ExportFlow

A mobile-first parcel tracker in English and Arabic. Live tracking runs server-side through the open-source Universal Parcel Scraper engine plus carefully isolated ExportFlow-owned carrier adapters where the upstream catalog has no suitable direct integration.

## Global carrier coverage

ExportFlow pins [Universal Parcel Scraper](https://github.com/plhery/universal-parcel-scraper) to upstream commit `c61efbf18b780f3d3b8764a5847520c69a28f212`.

The upstream currently documents:
- 3,500+ carrier names in its catalog
- 733 dedicated carrier adapters
- 5 optional universal fallback providers
- 1,340 catalog entries representing 156 countries

ExportFlow exposes `GET /api/coverage`, which derives a country-by-country coverage matrix from the installed carrier catalog. A country is counted as **directly covered** only when at least one selectable carrier has an automatic, dedicated adapter and explicitly lists that country. Link-only entries and the UPU/universal fallback are reported separately and do not inflate the direct-coverage count.

The coverage count means the engine or an ExportFlow-owned custom adapter has a direct carrier integration serving that country; it is not a guarantee that every carrier, tracking number, route or shipment will return live scans. Carrier websites can rate-limit, block automated requests, require extra recipient details, or temporarily change their systems. Each provider's availability is therefore surfaced separately from catalog presence.

### What works in this integration

- Automatic carrier detection and direct carrier adapters from the upstream engine.
- An ExportFlow-owned Cambodia Post adapter for Cambodia (KH), routed automatically for S10 numbers ending in `KH` or by explicit carrier ID. This adapter reads the official public tracking page and rejects bot challenges instead of bypassing them. Synthetic parser/HTTP tests pass; **a positive public live sample has not yet been verified**, so Cambodia Post is marked as an implemented, pending-live-canary integration rather than live-verified.
- A server-side `POST /api/track` endpoint. Tracking numbers are never sent to browser-side third-party APIs.
- A server-side `GET /api/carriers` endpoint exposing the engine catalog.
- A server-side `GET /api/coverage` endpoint exposing directly covered countries and the carrier adapters serving each one, with link-only and universal-fallback coverage separated.
- A health endpoint at `GET /api/health`.
- Bounded request size, per-isolate rate limits, concurrency limits, a lookup deadline, no-store responses, and privacy-conscious error output.
- English and Arabic status/timeline UI.
- An interactive shipment map using Leaflet and OpenStreetMap tiles. It plots only carrier-supplied scan coordinates after server-side validation; it does not guess locations or geocode private addresses. OpenStreetMap attribution is displayed on the map.

Cloudflare Workers does not implement Fetch `redirect: "error"`; the Pages adapter converts that mode to `redirect: "manual"` so redirects are returned as visible 3xx responses rather than failing before a network request is sent. Carrier adapters that explicitly request `follow` or `manual` keep their chosen mode. This behavior is covered by `scripts/cloudflare-fetch-test.mjs`.

The only universal fallback enabled by default is UPU. Other optional third-party fallback providers are intentionally not enabled because they receive the user's tracking number too. Some carrier adapters need a browser service (TRAWL/Chromium); those adapters can remain unavailable until a separate browser service is configured.

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
- `functions/lib/cambodia-post.mjs` and `functions/lib/custom-carriers.mjs` — ExportFlow-managed direct carrier adapters
- `functions/api/coverage.js` — country-by-country coverage derived from automatic dedicated adapters
- `functions/lib/coordinates.mjs` — validation for carrier-supplied map coordinates
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
