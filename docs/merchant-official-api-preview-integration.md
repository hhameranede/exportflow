# Merchant Workspace — existing-adapter tracking

## Current implementation

The Merchant Workspace uses Google OAuth and revocable D1 merchant sessions. A signed-in merchant submits a carrier and tracking number; ExportFlow runs its already-installed `universal-parcel-scraper` adapter with the same server-side environment as the public tracker.

- `POST /api/merchant/carriers/{provider}/track` currently allows UPS and FedEx.
- The route resolves the authenticated merchant session directly. It does not require an encrypted merchant carrier-credential record.
- Each lookup creates a fresh `createTracker({ env, fetcher, trawlUrl?, providers: [] })` instance.
- The selected built-in carrier adapter receives the tracking number. `providers: []` disables universal-provider fallbacks, so no third-party universal aggregator is sent the parcel identifier.
- The adapter reads only ExportFlow's server-side environment. No carrier API key or secret is requested from or returned to the merchant's browser.
- The route returns a bounded, sanitized status/timeline. It does not store the tracking number or return raw upstream errors.
- Same-origin checks, authenticated merchant sessions, global rate limiting, a 25-second request budget, bounded JSON input and no-store responses remain enforced.

## Carrier adapter availability

- UPS has an existing direct tracking path and can use an ExportFlow-managed official API configuration when one is present. Direct carrier requests may still be challenged or rate-limited by UPS.
- FedEx's built-in adapter needs either an ExportFlow-managed official API configuration or the existing browser/Trawl service. The current Preview environment has no `EXPORTFLOW_TRAWL_URL` or FedEx API credentials configured, so a live FedEx response is not currently verified and may return a carrier verification/unavailable error. This is a server-side readiness gap, not a reason to collect each merchant's keys.
- A passing route test confirms adapter configuration and isolation; it is not proof of a live carrier reply.

## Removed merchant credential-entry flow

The user-facing UPS/FedEx API-key forms and their connection-status gating have been removed. The legacy credential vault and its endpoints/migrations remain isolated for any future owner-approved use, but the current Merchant tracking route does not call them and does not need the vault key-ring secret.

The separate mock fixture, fixed-reference sandbox credential-check, and Mock/Sandbox buttons remain absent. A successful lookup is the only evidence that the selected adapter returned tracking data.

## Security and environment boundary

- Merchant OAuth/session identity remains required; private API access is not anonymous.
- Each request is sent only through the selected built-in carrier adapter. The merchant route deliberately disables universal-provider fallbacks.
- The merchant tracking number is bounded, not written to browser storage, and omitted from diagnostics.
- Merchant D1, session data and global rate-limit bindings remain Preview-only.
- The route uses the server's existing `EXPORTFLOW_TRAWL_URL` when configured, without changing Pages settings or secrets.
- No Production D1 binding, Production migration, secret update, DNS change, access-control change or Pages configuration change is part of this change.

## Branch and verification boundary

- Repository: hhameranede/exportflow.
- Review PR: https://github.com/hhameranede/exportflow/pull/67
- Preview OAuth callback:
  `https://integration-merchant-officia.exportflow-aja.pages.dev/api/merchant/auth/google/callback`
- Unit and route tests inject the tracker factory. They verify app-level adapter environment reuse, selected-carrier-only routing, merchant session isolation, origin checks, rate limiting and sanitized errors; they do not claim a live carrier response.
- No production tracking path is changed by this feature branch.
