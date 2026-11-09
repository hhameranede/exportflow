# FedEx and UPS — tenant-bound API sandbox pilot

## Purpose

This pilot creates a small, isolated Native Connector foundation for two official API clients already present in ExportFlow's pinned Universal Parcel Scraper source: FedEx Track and UPS Track. It validates an individual merchant's own API credentials against each provider's non-production environment. It is not a public parcel-tracking route.

## Current code state

- The implementation branch is stacked on ExportFlow native carrier catalog PR #49.
- FedEx and UPS credentials use a separate D1 table, `merchant_official_api_credentials`, with exactly two provider IDs and a fixed `sandbox_track` scope.
- Credentials are encrypted using AES-256-GCM. AAD binds the merchant ID, provider, scope and key ID, preventing ciphertext copied across tenants or provider rows from decrypting.
- D1 audit triggers record connected/updated/disconnected events using only metadata (`{"scope":"sandbox_track"}`); they do not store credential values.
- Credential write, revoke and sandbox operations require the signed-in merchant session and same-origin request. The request cannot supply a merchant ID.
- The outbound host is fixed in code: FedEx `https://apis-sandbox.fedex.com`; UPS `https://wwwcie.ups.com`. A submitted credential object cannot set URLs, fetch functions or other runtime options.
- Sandbox verification uses fixed synthetic references, never a parcel number supplied by a visitor.
- Sandbox route is globally rate-limited and fails closed when the limiter or merchant vault is unavailable.
- Only a small status object is returned. No raw response or recipient/location details are exposed.

## Rights and release boundary

The existence of official Track APIs and a successful API sandbox call do not establish permission for ExportFlow to display any merchant's data to other people. This pilot is restricted to sandbox connectivity and account-bound test credentials. It does not clear public recipient display, commercial redistribution, advertising, data retention or multi-merchant service-provider rights.

The legal/data rights matrix remains the source of truth. Do not use the FedEx or UPS path for public visitor lookups, do not add global API credentials, and do not route around the restricted website-scraping paths. DHL Express is excluded from this first cohort because the reviewed Unified Tracking API conditions conflict with the current public ad-supported display model.

## Validation gates

1. Run the complete GitHub Actions CI on the draft branch, including the new vault, sandbox route and D1 migration tests.
2. Configure a Preview-only merchant session/key-ring and owner-controlled FedEx Test Key / UPS Customer Integration Environment credentials, if/when those credentials are made available through the approved setup path. Never place keys in git or chat.
3. Execute only the fixed synthetic sandbox checks from Preview; record a redacted request result, provider environment and timestamp.
4. Keep the feature disabled in Production until the intended merchant-facing data display and service-provider scope is independently established.
5. Do not merge, deploy, migrate Production D1, or set secrets without explicit approval.

## Status at branch creation

- Code and mocked tests are implemented in the isolated draft branch.
- No provider sandbox request has been sent.
- No credentials or keys have been configured.
- No public tracking path was changed.
- No PR merge, Cloudflare Preview/Production deployment, D1 remote migration, DNS change or secret/permission change was performed.
