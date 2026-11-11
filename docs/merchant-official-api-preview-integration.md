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

### Backup and apply result
- Preview database: `exportflow-intelligence-preview-db` (`9657dfdc-5b80-4a0b-a982-8865152b2c82`).
- A D1 SQL export backup of the affected Merchant identity/credential/audit tables completed immediately before migration. Backup file: `9657dfdc-5b80-4a0b-a982-8865152b2c82-00000016-00000000-00005120-0192ab295d4cb310a9a9a257e3f3f950.sql`.
- Migration `0001_official_api_credentials.sql` was applied to **Preview D1 only** on 2026-11-11 at 13:25:17 UTC through the Cloudflare D1 API. The custom journal records that exact migration filename. The legacy `d1_migrations` table was not created or modified.
- Post-migration checks confirmed `merchant_official_api_credentials`, its update index and three metadata-only audit triggers exist; the audit provider allowlist includes UPS/FedEx; the new table contains ciphertext/key metadata and scope/consent/timestamps only; no plaintext credential columns exist.
- Existing Merchant row counts remained unchanged (0 users, 0 sessions, 0 legacy credentials and 0 audit rows); Carrier Evidence remained at 22 rows; `PRAGMA foreign_key_check` returned no violations.
- For a newly provisioned Preview D1 database, the scoped migration can be applied with:
  ```sh
  npx wrangler d1 migrations apply exportflow-intelligence-preview-db --remote --config wrangler.toml --env preview
  ```
- Do not apply this migration under Production or use the root migrations directory.

## Required Preview credentials before an authenticated owner test
Set the following in Cloudflare Pages **Preview** environment only:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET` (Secret)
- `MERCHANT_CREDENTIAL_KEYRING_JSON` (Secret; active AES-256 key must be exactly 32 bytes, with a secure offline backup)
- `GLOBAL_RATE_LIMITER_HMAC_SECRET` is already configured in Preview and must be retained.

The OAuth client must include the callback URI above. Do not place secrets in Git, PR comments, Notion, or chat. Do not configure these values under Production for this Preview test.

## Validation limits
The latest Preview page returns HTTP 200 with `noindex,nofollow,noarchive`. The session and UPS/FedEx credential-status routes return 401 for an unauthenticated visitor, confirming origin validation and the D1-backed auth gate. The mocked test suite is not evidence of a real UPS/FedEx Sandbox call, carrier Production entitlement, or third-party shipment-display rights.

## Latest verified Preview release — 2026-11-11
- Verify CI [#558](https://github.com/hhameranede/exportflow/actions/runs/43028249749) passed all quality/build steps on code head `df9cf44fb34c951f7097429e2a443f276860f959`.
- Pages Preview deployment [7547730f](https://7547730f.exportflow-aja.pages.dev) succeeded on the same code head and retains alias `https://feat-merchant-official-api-p.exportflow-aja.pages.dev`.
- Live checks: Merchant page HTTP 200 with noindex; session and UPS/FedEx credential-status endpoints HTTP 401 unauthenticated.
- PR [#67](https://github.com/hhameranede/exportflow/pull/67) remains Open / Draft / mergeable / unmerged. Production remains on `main` commit `b67f6ae470ef9733ffb0988e7185dfcb7c0f3411`, deployment `5bffba35-f815-4cec-8d34-4ecd63e4afc5`, alias `https://exportflow.me`.
- Remaining gate: configure Preview Google OAuth client ID/secret and `MERCHANT_CREDENTIAL_KEYRING_JSON` as Preview secrets, then complete owner sign-in and live UPS/FedEx Sandbox checks with merchant-owned test credentials. No live carrier call has been sent yet.
