# D1 Merchant Identity, Sessions & Credential Vault

**Status: Draft PR implementation deployed to Cloudflare Preview only. Not enabled in Production.**

ExportFlow uses Cloudflare Pages Functions and Cloudflare D1 for merchant identity, sessions and encrypted carrier credentials. Supabase is not part of the architecture.

## Identity and session design

- Google OpenID Connect is the identity provider; ExportFlow does not store or verify passwords.
- OAuth uses state, nonce and PKCE S256. The callback verifies Google's RS256 ID-token signature using Google's JWKS and checks issuer, audience, authorized party (when present), expiry, issue time, nonce and verified email.
- Merchant records use a server-generated UUID and immutable Google subject. An email collision with a different Google subject is rejected; automatic account linking is not implemented.
- Sessions use a cryptographically random opaque token in a `__Host-` Secure, HttpOnly, SameSite=Lax cookie. D1 stores only its SHA-256 digest, never the browser token.
- Session resolution enforces expiry, revocation and disabled-account state. Logout revokes the session and appends a security event.

## D1 databases and bindings

The Cloudflare account already had two EU-jurisdiction databases. ExportFlow reuses them:

| Environment | Database | Binding |
| --- | --- | --- |
| Production | `exportflow-intelligence-db` | `MERCHANT_DB` |
| Pages Preview | `exportflow-intelligence-preview-db` | `MERCHANT_DB` |
| Local Pages development | Local Miniflare D1 | `MERCHANT_DB` |

Cloudflare Pages Preview and Production bindings point to separate databases. Local Pages development uses a local D1 emulator (`preview_database_id = "DB"`); it does not point to either remote database. Never point Preview at Production.

## Schema and audit

- `migrations/0001_merchant_credentials.sql`: ciphertext-only carrier credential table.
- `migrations/0002_merchant_identity.sql`: merchant users, revocable sessions and append-only session-security events.
- `migrations/0003_merchant_provider_audit.sql`: append-only carrier credential lifecycle events. D1 triggers record connect, update and disconnect with provider, merchant ID, timestamp and tracking-only scope. No API key, IV, ciphertext or plaintext value is copied into audit metadata.
- `scripts/d1-migration-test.py`: applies all three migrations to in-memory SQLite and checks the five required tables, ciphertext-only schema, foreign keys, trigger-generated audit events and append-only constraints.
- `scripts/merchant-identity-test.mjs`: OAuth state/nonce/PKCE, Google ID-token signature verification, session hashing, lookup and revocation.
- `scripts/session-bound-merchant-vault-test.mjs`: verifies session-derived merchant isolation, same-origin enforcement, explicit consent, payload size/content-type validation, provider allowlist, no plaintext/API-secret response, and disconnect.

The migration tests run locally in SQLite during CI. **No migration has been applied to either remote D1 database yet.**

When the preview schema is approved, apply it only to the isolated preview database:
`npx wrangler d1 migrations apply exportflow-intelligence-preview-db --remote`

Production migration is a separate release action and must not happen until an independently reviewed production release:
`npx wrangler d1 migrations apply exportflow-intelligence-db --remote`

## Cloudflare secrets required before login or credential routes can work

Configure these in Cloudflare Pages settings separately for Preview and Production. Do not commit secret values:

- `MERCHANT_APP_ORIGIN`: exact HTTPS origin for the environment. The current branch preview alias is `https://feat-d1-merchant-identity-se.exportflow-aja.pages.dev`; verify it still maps to the latest deployment before registering the OAuth callback.
- `GOOGLE_OAUTH_CLIENT_ID`: Google OAuth client ID.
- `GOOGLE_OAUTH_CLIENT_SECRET`: Google OAuth client secret, stored only as a Cloudflare encrypted secret.
- `MERCHANT_CREDENTIAL_KEYRING_JSON`: Cloudflare encrypted secret containing JSON of the form `{"activeKeyId":"key-v1","keys":{"key-v1":"BASE64_OF_RANDOM_32_BYTE_KEY"}}`. Keep old key IDs in the ring during a rotation window; never log or expose the secret.

Register the exact callback URI with Google:
`<MERCHANT_APP_ORIGIN>/api/merchant/auth/google/callback`

No Google OAuth client, OAuth secret or AES key ring was created or configured by this PR. Until configured, routes fail closed. Never put secrets in Git, Notion, Datadog, browser code, Wrangler TOML, workflow logs or chat.

## Routes

Identity:
- `POST /api/merchant/auth/google/start`: same-origin OAuth initiation; issues short-lived HttpOnly state, nonce and PKCE cookies.
- `GET /api/merchant/auth/google/callback`: verifies the provider response, upserts the merchant identity and creates a D1 session.
- `GET /api/merchant/session`: returns the authenticated merchant or 401.
- `DELETE /api/merchant/session`: same-origin logout, revokes the D1 session and clears its cookie.

Merchant carrier credentials:
- `POST /api/merchant/carriers/{provider}/credentials`: requires a verified D1 session, exact same-origin request, JSON body within 12 KiB, explicit `consent: true`, supported provider and the encrypted key-ring secret. The merchant ID is derived only from the verified session; caller-supplied merchant IDs are rejected. The response never returns credentials.
- `DELETE /api/merchant/carriers/{provider}/credentials`: same-origin, session-bound revocation. D1 triggers append an immutable lifecycle event.
- There is intentionally no HTTP route that returns decrypted credentials. Server-side connector code can resolve credentials only through the session-bound adapter; never expose that method to a browser response.

The existing Merchant Workspace UI remains a device-only watchlist. No cloud watchlist sync, account-linking, password login, MFA, billing or live carrier activation is claimed. The login and credential APIs are foundations and remain unavailable until Cloudflare secrets, remote Preview migrations, rate limits and security review are completed.

## Release gates

1. Review OAuth, session-bound vault and D1 audit implementation; pass the Cloudflare Pages Functions bundle and all regression tests.
2. Apply migrations to isolated Preview D1 only after review; never run remote migrations from CI.
3. Configure Google OAuth and the AES key-ring only as Cloudflare encrypted secrets.
4. Add Cloudflare edge rate limits for OAuth, session and credential routes.
5. Validate the auth flow and credential lifecycle with synthetic values on a protected Preview.
6. Complete independent security review before merchant credential collection or any live carrier API call.
7. Only after approval, plan the Production D1 migration and Cloudflare production release separately.

No Vercel build/test/deploy checks are part of CI. GitHub Actions verifies code, D1 migration integrity, Datadog Test Visibility, Cloudflare Pages build, locale/SEO and Wrangler Functions bundling; Cloudflare Pages is the only deployment platform.
