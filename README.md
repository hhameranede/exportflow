# ExportFlow

A clean, mobile-first parcel-tracking experience for everyday online shoppers. ExportFlow aims to bring updates from multiple delivery carriers into one clear timeline.

> **Current status:** frontend MVP prototype. The sample tracking number is simulated. Live carrier adapters, a tracking API, user accounts, saved parcels, and notifications are not connected yet.

## Run locally

Requirements: Node.js 22+ and Python 3.

```bash
npm test
npm run build
npm run dev
```

Open http://localhost:4173.

## Project structure

- index.html — bilingual landing page and tracking interface
- styles.css — responsive design, Arabic RTL and small-screen layouts
- app.js — language switcher, input validation, and clearly labelled demo result
- scripts/ — smoke tests and static build script
- .github/workflows/ci.yml — GitHub Actions checks on pushes and pull requests
- .github/copilot-instructions.md — product-specific guidance for Copilot
- .devcontainer/devcontainer.json — ready-to-use Codespaces environment
- _headers — baseline security headers and caching policy for Cloudflare Pages

## Cloudflare Pages

- Git repository: hhameranede/exportflow
- Production branch: main
- Build command: npm run build
- Build output directory: dist
- Root directory: /

Cloudflare Pages Git integration will deploy commits to main and provide preview deployments for branches or pull requests according to the Pages settings.

## Privacy and security

- Never place carrier API credentials in browser JavaScript.
- Route real carrier requests through a server-side endpoint.
- Avoid storing or logging full tracking numbers unless a clearly disclosed feature requires it.
- Private tracking results must not be indexed by search engines.

## Next milestones

1. Verify the parcel connector engine and its licenses.
2. Build a server-side tracking endpoint and carrier auto-detection.
3. Test real shipments across countries and delivery handoffs.
4. Normalize carrier events into a consistent status timeline.
5. Add saved parcels and notifications only after live tracking quality is proven.
6. Publish carrier-specific SEO pages only when they contain accurate, genuinely useful information.
