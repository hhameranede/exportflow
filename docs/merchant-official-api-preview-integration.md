# ExportFlow official API Sandbox integration

This branch is a focused integration from current `main`, not a merge of the legacy Global Logistics stack.

## Scope
- Merchant Google OAuth identity and revocable D1 sessions.
- Merchant-owned UPS and FedEx credentials encrypted with AES-256-GCM, merchant/provider/scope-bound AAD, and explicit consent.
- Metadata-only credential status and lifecycle audit.
- Official non-production UPS CIE and FedEx Sandbox endpoints with fixed synthetic references.
- No public visitor tracking, live shipment references, public-route rights changes, CAPTCHA bypass, or third-party access-control bypass.

## Branch and environment boundary
- Branch is based on `main` commit `b67f6ae470ef9733ffb0988e7185dfcb7c0f3411`.
- Draft PR: https://github.com/hhameranede/exportflow/pull/67
- The Pages `MERCHANT_DB` and `GLOBAL_RATE_LIMITER` bindings are under `env.preview` only. No Production D1 or Durable Object binding is added.
- The current Pages Preview branch rule includes `feat/*`; the review PR branch remains `integration/*`. A separate `feat/*` branch is used for the Preview build only.
- Live Preview URL: https://feat-merchant-official-api-p.exportflow-aja.pages.dev
- `MERCHANT_APP_ORIGIN` is bound to the stable Preview branch alias in `wrangler.toml`. The OAuth callback URL to allow in the Google OAuth client is:
  `https://feat-merchant-official-api-p.exportflow-aja.pages.dev/api/merchant/auth/google/callback`.
- The Preview D1 database already has merchant identity and audit foundation tables. Migration 0008 adds the UPS/FedEx credential vault table and expands the metadata-only audit provider constraint. The migration test replays migrations 0001–0003 to cover the existing Preview case where the schema exists but no Wrangler migration journal is present, then verifies migration 0008 preserves audit rows.

## Required Preview configuration before an authenticated owner test
Set these in Cloudflare Pages **Preview** environment only:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET` (Secret)
- `MERCHANT_CREDENTIAL_KEYRING_JSON` (Secret; active AES-256 key must be exactly 32 bytes, with a retained offline backup)
- `GLOBAL_RATE_LIMITER_HMAC_SECRET` is already present in Preview and must be retained.

The OAuth client must allow the callback URI above. Do not place secrets in Git, PR comments, Notion, or chat. Do not configure any of these under Production for this Preview test.

## D1 migration gate
- The Preview database is `exportflow-intelligence-preview-db`.
- Migration 0008 is not applied remotely yet.
- Apply it only to Preview D1 after reviewing the current schema and taking an export/backup. Never target Production from this branch.
- Do not infer migration completion from a green CI run. Verify the `merchant_official_api_credentials` table exists after the remote migration.

## Validation limits
The current Preview build is successful and the UI returns HTTP 200 with `noindex,nofollow,noarchive`. The session route returns 401 for an unauthenticated visitor. Credential-status routes currently return `origin_forbidden` until the Preview origin variable is applied in a new build; after that, unauthenticated status should return 401. The mocked test suite is not evidence of a real UPS/FedEx Sandbox call, carrier Production entitlement, or third-party shipment-display rights.
