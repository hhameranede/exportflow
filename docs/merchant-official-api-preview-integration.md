# ExportFlow official API Sandbox integration

This branch is a focused integration from current `main`, not a merge of the legacy Global Logistics stack.

## Scope
- Merchant Google OAuth identity and revocable D1 sessions.
- Merchant-owned UPS and FedEx credentials encrypted with AES-256-GCM, merchant/provider/scope-bound AAD, and explicit consent.
- Metadata-only credential status, save, and disconnect routes.
- Official non-production UPS CIE and FedEx Sandbox endpoints with fixed synthetic references.
- No public visitor tracking, live shipment references, public-route rights changes, CAPTCHA bypass, or third-party access-control bypass.

## Branch and environment boundary
- Branch is based on `main` commit `b67f6ae470ef9733ffb0988e7185dfcb7c0f3411`.
- Draft PR: https://github.com/hhameranede/exportflow/pull/67
- Pages `MERCHANT_DB` and `GLOBAL_RATE_LIMITER` bindings are under `env.preview` only. No Production D1 or Durable Object binding is added.
- Current Pages Preview rule includes `feat/*`; the integration review branch remains `integration/*`. A separate `feat/*` branch is used for Preview only.
- Live Preview URL: https://feat-merchant-official-api-p.exportflow-aja.pages.dev
- `MERCHANT_APP_ORIGIN` is bound to the Preview alias in `wrangler.toml`. Google OAuth callback URI:
  `https://feat-merchant-official-api-p.exportflow-aja.pages.dev/api/merchant/auth/google/callback`.

## Preview D1 migration strategy
The shared Preview D1 already contains the older merchant identity, carrier evidence, and company-data schema, but no `d1_migrations` journal. The wider legacy migration chain (including duplicate `0005` and `0006` prefixes) is not part of this focused PR. Do not run the root `migrations/` directory against this database.

The Merchant Sandbox migration is isolated to:
- Directory: `migrations/merchant-official-api/`
- Wrangler migration journal: `merchant_official_api_migrations`
- Current migration: `0001_official_api_credentials.sql`

This avoids claiming that unrelated legacy migrations were applied and avoids replaying their history. The migration adds `merchant_official_api_credentials` and safely rebuilds the metadata-only audit provider allowlist while preserving existing audit rows. A SQLite regression test exercises replay of baseline migrations 0001–0003, the official credential migration, trigger behavior, ciphertext-only columns, and the dedicated migration-journal name.

### Backup and apply gate
- Preview database: `exportflow-intelligence-preview-db` (`9657dfdc-5b80-4a0b-a982-8865152b2c82`).
- A D1 SQL export backup of the affected Merchant identity/credential/audit tables was completed before any schema write.
- Migration has **not** been applied remotely yet.
- After reviewing the branch and ensuring the target is Preview, run:
  ```sh
  npx wrangler d1 migrations apply exportflow-intelligence-preview-db --remote --config wrangler.toml --env preview
  ```
- Verify `merchant_official_api_credentials` exists and `merchant_official_api_migrations` contains exactly `0001_official_api_credentials.sql`. Do not apply this under Production or use the root migrations directory.

## Required Preview credentials before an authenticated owner test
Set the following in Cloudflare Pages **Preview** environment only:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET` (Secret)
- `MERCHANT_CREDENTIAL_KEYRING_JSON` (Secret; active AES-256 key must be exactly 32 bytes, with a secure offline backup)
- `GLOBAL_RATE_LIMITER_HMAC_SECRET` is already configured in Preview and must be retained.

The OAuth client must include the callback URI above. Do not place secrets in Git, PR comments, Notion, or chat. Do not configure these values under Production for this Preview test.

## Validation limits
The latest Preview page returns HTTP 200 with `noindex,nofollow,noarchive`. The session and UPS/FedEx credential-status routes return 401 for an unauthenticated visitor, confirming origin validation and the D1-backed auth gate. The mocked test suite is not evidence of a real UPS/FedEx Sandbox call, carrier Production entitlement, or third-party shipment-display rights.
