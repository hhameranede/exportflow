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

### Google OAuth Web application client
Create a Google OAuth 2.0 client with application type **Web application**. This code uses the server-side authorization-code flow: configure the following **Authorized redirect URI** exactly (scheme, hostname, path, and trailing slash must match):

```text
https://feat-merchant-official-api-p.exportflow-aja.pages.dev/api/merchant/auth/google/callback
```

The flow requests only `openid email profile` and uses state, nonce, and PKCE. It exchanges the authorization code on the server. A JavaScript origin is not required for this server-side redirect flow; do not add one unless a separate browser-side Google API flow is introduced. See Google's [Web Server OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server).

In Cloudflare Pages **Preview** environment only, set:
- `GOOGLE_OAUTH_CLIENT_ID` — ordinary Variable.
- `GOOGLE_OAUTH_CLIENT_SECRET` — Secret.
- `MERCHANT_CREDENTIAL_KEYRING_JSON` — Secret.
- `GLOBAL_RATE_LIMITER_HMAC_SECRET` is already configured in Preview and must be retained.
- `GOOGLE_REDIRECT_URI` is optional. If set, it must equal the callback URI above exactly; otherwise the code derives the URI from `MERCHANT_APP_ORIGIN`.

### Merchant AES-256 key-ring
Generate a fresh 32-byte key locally; do not send its output in chat or commit it to Git:

```sh
openssl rand -base64 32
```

Put the output into the JSON structure below, replacing the placeholder. The value under `keys.v1` must be valid Base64 that decodes to exactly 32 bytes, and `activeKeyId` must match a key name:

```json
{
  "activeKeyId": "v1",
  "keys": {
    "v1": "REPLACE_WITH_BASE64_OUTPUT"
  }
}
```

Store this whole JSON document as the `MERCHANT_CREDENTIAL_KEYRING_JSON` Preview Secret. Keep a secure offline backup of the key-ring. Losing the key means credentials encrypted with it cannot be decrypted. During future key rotation, retain old key IDs in `keys` until all records encrypted with those keys have been re-encrypted or deleted.

Do not place secret values in Git, PR comments, Notion, or chat. Do not configure any of these values under Production for this Preview test.

## Validation limits
The latest Preview page returns HTTP 200 with `noindex,nofollow,noarchive`. The session and UPS/FedEx credential-status routes return 401 for an unauthenticated visitor, confirming origin validation and the D1-backed auth gate. The mocked test suite is not evidence of a real UPS/FedEx Sandbox call, carrier Production entitlement, or third-party shipment-display rights.

## Latest verified Preview release — 2026-11-11
- Verify CI [#558](https://github.com/hhameranede/exportflow/actions/runs/43028249749) passed all quality/build steps on code head `df9cf44fb34c951f7097429e2a443f276860f959`.
- Pages Preview deployment [7547730f](https://7547730f.exportflow-aja.pages.dev) succeeded on the same code head and retains alias `https://feat-merchant-official-api-p.exportflow-aja.pages.dev`.
- Live checks: Merchant page HTTP 200 with noindex; session and UPS/FedEx credential-status endpoints HTTP 401 unauthenticated.
- PR [#67](https://github.com/hhameranede/exportflow/pull/67) remains Open / Draft / mergeable / unmerged. Production remains on `main` commit `b67f6ae470ef9733ffb0988e7185dfcb7c0f3411`, deployment `5bffba35-f815-4cec-8d34-4ecd63e4afc5`, alias `https://exportflow.me`.
- Remaining gate: configure Preview Google OAuth client ID/secret and `MERCHANT_CREDENTIAL_KEYRING_JSON` as Preview secrets, then complete owner sign-in and live UPS/FedEx Sandbox checks with merchant-owned test credentials. No live carrier call has been sent yet.

## Simulated Test Mode and Datadog CI Visibility — 2026-11-12

The Merchant workspace now separates credential-free simulation from the optional official carrier Sandbox features.

- `POST /api/merchant/carriers/{provider}/mock` supports `ups` and `fedex` only. It requires a valid merchant session and a trusted same-origin request.
- The mock route returns deterministic ExportFlow fixture events with `environment=simulated`, `fixture=deterministic_mock`, `outboundRequests=0` and `realShipmentLookup=false`. It imports no carrier SDK, calls no carrier endpoint, and does not read the credential vault.
- The Merchant UI exposes separate “Run UPS simulated test” and “Run FedEx simulated test” actions. The existing “Run Sandbox check” controls remain isolated and still require user-owned/authorized credentials.
- Tests cover both providers, successful fixtures, unauthenticated access, origin rejection, unsupported providers, method restriction, and the absence of a network-call path.
- `scripts/datadog-ci-test-events.cjs` wraps the custom `npm test` regression suite as one Datadog manual test event. It reports suite-level pass/fail, not individual assertion results, and does not enable Production APM, RUM, or application logging.
- CI installs the pinned `dd-trace@6.24.0` package into a runner-temporary directory only when the GitHub Actions repository secret `DD_API_KEY` is present. Agentless Test Visibility and the manual API are configured for `DD_SITE=us5.datadoghq.com`. If the secret is absent, tests still run normally and the Datadog upload is skipped with a workflow warning. The runner removes `DD_*` and `NODE_OPTIONS` from the child `npm test` process; only the wrapper sends the suite event.
- Datadog CI/Test Visibility dashboards remain the place to inspect events after ingestion is confirmed. No project-specific dashboard is claimed as created yet.

### Status correction

The earlier “Remaining Preview gate” section above is a pre-completion checkpoint. As of 2026-11-12, the Preview OAuth and key-ring secrets have been configured, the owner Google sign-in has succeeded, and the Merchant workspace has been opened successfully. The user chose not to create UPS/FedEx developer accounts, so no real carrier Sandbox credentials or carrier requests are in scope. Mock results must never be described as official carrier validation.

The current implementation is on PR [#67](https://github.com/hhameranede/exportflow/pull/67), head commit `25ea26cca1904780966645d63f993f1239f9a54f`. Verify CI [#572](https://github.com/hhameranede/exportflow/actions/runs/43203304140) is running for this head. Production remains on `main` commit `b67f6ae470ef9733ffb0988e7185dfcb7c0f3411`, deployment `5bffba35-f815-4cec-8d34-4ecd63e4afc5`, with no changes in this work.

### Datadog ingestion verification — 2026-11-12

- Datadog CI Pipeline Visibility returned the GitHub Actions pipeline for Verify CI run [#574](https://github.com/hhameranede/exportflow/actions/runs/43204827539) with conclusion `success`.
- The CI Test Events search returned zero events for the initial per-process manual reporter, so Test Visibility was not marked verified.
- The manual reporter was changed to emit one suite-level event from a process preloaded with `dd-trace/ci/init`; `DD_CIVISIBILITY_MANUAL_API_ENABLED=true` is now explicit. The next successful CI run must be searched for a corresponding Test Event before claiming Test Visibility ingestion is complete.
