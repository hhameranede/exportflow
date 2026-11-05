# ExportFlow

A clean, mobile-first parcel-tracking experience for everyday online shoppers. ExportFlow is intended to bring shipment updates from multiple delivery carriers into one clear timeline.

> **Current status:** frontend MVP prototype. Only the sample tracking number is simulated. No carrier adapters, live tracking API, user accounts, saved parcels, or notifications are connected yet.

## Run locally

Requirements: Node.js 22+ and Python 3 (for the zero-dependency preview server).

```bash
npm test
npm run build
npm run dev
```

Open `http://localhost:4173`.

## GitHub and Cloudflare

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

GitHub Actions runs code checks and a build on pushes and pull requests. Cloudflare Pages Git integration is intended for automatic production and preview deployments.

## Privacy and security

- Never place carrier API credentials in browser JavaScript.
- Route real carrier requests through a server-side endpoint.
- Avoid storing or logging full tracking numbers unless a disclosed feature requires it.
- Private tracking results must not be indexed by search engines.

## Next milestones

1. Verify the parcel connector engine and its licenses.
2. Build a server-side tracking endpoint and carrier auto-detection.
3. Test real shipments across countries and delivery handoffs.
4. Normalize carrier events into a consistent status timeline.
5. Add saved parcels and notifications after live tracking quality is proven.
6. Publish carrier-specific SEO pages only when they contain accurate, useful information.
