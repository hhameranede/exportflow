# D1 Merchant Identity & Sessions

**Status: implementation branch / Draft PR. Not enabled in production.**

ExportFlow uses Cloudflare Pages Functions and Cloudflare D1 for merchant identity. Supabase is not part of this design or runtime.

## Architecture

- Google OpenID Connect is the identity provider. ExportFlow does not store or verify passwords.
- OAuth uses state, nonce and PKCE (S256). The callback verifies the Google ID-token RS256 signature against Google's JWKS and validates issuer, audience, authorized party when present, expiry, issue time, nonce and verified email.
- Merchant records are keyed by a server-generated UUID and the immutable Google subject. An email collision with a different Google subject is rejected; account linking is not implemented.
- Sessions use a cryptographically random opaque bearer token in a `__Host-` Secure, HttpOnly, SameSite=Lax cookie. D1 stores only the SHA-256 token digest, never the browser token.
- Session resolution checks expiry, revocation and disabled-account state. Logout revokes the row and appends a security event.
- Security events are append-only at the D1 schema layer. Event metadata is deliberately small and excludes tokens, carrier secrets, tracking numbers and request bodies.

## D1 databases

The Cloudflare account already contains two EU-jurisdiction databases. ExportFlow reuses them rather than creating new infrastructure:

| Environment | Database | Binding |
| --- | --- | --- |
| Production | `exportflow-intelligence-db` | `MERCHANT_DB` |
| Pages Preview | `exportflow-intelligence-preview-db` | `MERCHANT_DB` |
| Local Pages development | Local Miniflare D1 | `MERCHANT_DB` |

Wrangler config points local Pages development to a local D1 emulator. Cloudflare Pages environment bindings point Preview and Production to their separate remote databases. Never point a Preview deployment at the production database.

## Schema

- `migrations/0001_merchant_credentials.sql`: ciphertext-only provider credential table from the prior vault foundation.
- `migrations/0002_merchant_identity.sql`: merchant users, revocable sessions and append-only security events.
- `scripts/d1-migration-test.py`: applies both migrations to in-memory SQLite and checks table, foreign-key, ciphertext-only and append-only constraints.
- `scripts/merchant-identity-test.mjs`: exercises OAuth state/nonce/PKCE, ID-token verification, session hashing, session lookup and revocation with a fake D1 binding.

Run migrations using Wrangler by database name after reviewing the exact target:
- Preview first: `npx wrangler d1 migrations apply exportflow-intelligence-preview-db --remote`
- Production only after a separately approved release: `npx wrangler d1 migrations apply exportflow-intelligence-db --remote`

Migrations are deliberately not executed against either remote database by CI, and no production schema has been changed in this implementation checkpoint.

## Google OAuth configuration required before login works

Configure these values in Cloudflare Pages project settings, independently for Preview and Production:

- `MERCHANT_APP_ORIGIN`: the exact origin for that environment (Production: `https://exportflow.me`; Preview: the selected Cloudflare Pages preview origin).
- `GOOGLE_OAUTH_CLIENT_ID`: Google OAuth client ID.
- `GOOGLE_OAUTH_CLIENT_SECRET`: secret stored only as an encrypted Cloudflare secret.

Register the exact callback URL with Google:
`<MERCHANT_APP_ORIGIN>/api/merchant/auth/google/callback`

Do not put the Google client secret in Git, Notion, Datadog, browser JavaScript, Wrangler TOML, workflow logs or a chat message. No OAuth credentials have been created or configured by this PR. Until credentials are supplied and stored in Cloudflare, the auth endpoints fail closed with a configuration error.

## Routes

- `POST /api/merchant/auth/google/start`: same-origin initiation; returns the Google authorization URL and sets short-lived HttpOnly state/nonce/PKCE cookies.
- `GET /api/merchant/auth/google/callback`: verifies the callback, upserts the merchant identity, creates the D1 session and redirects to the workspace.
- `GET /api/merchant/session`: returns the current authenticated merchant or 401.
- `DELETE /api/merchant/session`: same-origin logout, revokes the session and clears its cookie.

The existing Merchant Workspace remains explicitly device-only. This PR does not add a credential form, merchant provider-connection route, carrier activation, account-linking, password login, MFA, billing or public API access. The credential vault still requires a future server-side authorization adapter that derives merchant identity from the verified session; never accept a merchant ID from request JSON, URL parameters or local storage.

## Release gates

1. Review the OAuth implementation and tests; pass Cloudflare Pages Functions bundling.
2. Apply migrations to the isolated Preview D1 database only after reviewing the preview target.
3. Add rate limits at Cloudflare edge for OAuth initiation and session endpoints before public launch.
4. Configure Google OAuth secrets in Cloudflare Dashboard and validate login on a protected Preview.
5. Connect the credential vault only through a server-side adapter that derives merchant ID from the verified D1 session.
6. Run independent security review before enabling merchant credentials or any live carrier API calls.

No Vercel build/deploy checks are part of this workflow. GitHub Actions verifies code and Cloudflare compatibility; Cloudflare Pages is the sole deployment platform.
