# Merchant Workspace — adapter-based tracking Preview

## Current implementation

The Merchant Workspace provides Google OAuth sign-in, revocable D1 sessions, an AES-256-GCM merchant credential vault, metadata-only connection status, credential save/disconnect, and shipment tracking through the existing universal-parcel-scraper carrier adapters.

- POST /api/merchant/carriers/{provider}/track accepts a bounded tracking-number payload for ups or fedex.
- The route resolves credentials from the signed-in merchant's vault entry. Credentials are merchant/provider/scope-bound and are never returned to the browser.
- Each lookup creates a fresh createTracker({ env, providers: [] }) instance. The existing UPS or FedEx adapter receives only the selected merchant's credentials. providers: [] disables universal aggregator fallbacks, so the tracking number is sent only through the selected direct carrier adapter.
- The route uses the official non-production API origin for this Preview branch: UPS CIE (https://wwwcie.ups.com) or FedEx Sandbox (https://apis-sandbox.fedex.com).
- The route returns a bounded, sanitized status/timeline. It does not store the tracking number, expose credentials, or return raw upstream errors.
- The tracking route enforces same-origin requests, authenticated merchant sessions, a global rate limit, a 25-second request budget, bounded JSON input and no-store responses.

## Removed test-only flow

The separate /mock simulated-fixture route, fixed-reference /sandbox credential-check route, Mock/Sandbox buttons and their dedicated route tests were removed. The UI no longer claims that saving a credential proves carrier connectivity. A connection status means only that encrypted credentials are stored; a successful shipment lookup is the adapter result.

Regression coverage remains for Google OAuth/session behavior, credential encryption and revocation, migration safety, tenant isolation, consent, origin validation, rate limiting and the new adapter-backed tracking route.

## Branch and environment boundary

- Repository: hhameranede/exportflow.
- Review PR: https://github.com/hhameranede/exportflow/pull/67
- This branch includes the current main state as its first-parent base.
- Merchant D1, the migration journal and the global Durable Object rate limiter are bound under env.preview only.
- The Google OAuth callback remains bound to the Preview origin:
  https://integration-merchant-officia.exportflow-aja.pages.dev/api/merchant/auth/google/callback
- No Production D1 binding, Production migration, secret update, DNS change, access-control change or Pages configuration change is part of this work.

## Preview configuration and verification

The November 12 project record confirmed that the Preview Google OAuth and AES-256 key-ring secrets were configured and owner sign-in was completed. The scoped Preview D1 migration was applied previously; it recorded zero Merchant accounts, sessions, credentials and audit rows at that time.

The new CI tests inject a tracker factory to verify that the route passes the correct credential names, fixed Preview API origins and selected carrier to the existing tracker, while proving separate merchant requests receive separate credentials. They do not claim a live carrier response. A real adapter lookup against the carrier Sandbox still requires an authenticated Preview session with a saved carrier account and a valid carrier-approved Sandbox test reference.

## Explicitly not claimed

- A saved credential is not a verified live connection.
- A passing unit test is not proof of a successful real carrier lookup.
- This Preview Sandbox route is not Production carrier routing.
- No public visitor shipment lookup, production enablement, analytics persistence, billing or webhooks are added by this change.


## Read-only Preview readback — 2026-11-16

The Preview Merchant D1 migration journal contains `0001_official_api_credentials.sql`. A read-only count check found one merchant user, one unrevoked and unexpired session, zero saved official carrier credentials, one merchant security event and zero provider credential audit events. This confirms the migration and database records exist; it does not independently prove a fresh browser OAuth flow or a successful carrier adapter response.
