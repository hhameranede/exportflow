# ExportFlow account authentication setup

This branch introduces a server-side Better Auth integration using `better-auth@1.7.27`. It does not enable account creation in Production by itself. The active `exportflow-platform` Worker has no AUTH_DB binding or developer-account Google OAuth credentials. The isolated D1 test database is bound only to `exportflow-auth-lab`; however, the currently uploaded Lab script is still a diagnostic harness, not this PR's Better Auth application bundle. No Better Auth schema migration has been applied.

## Google OAuth client

Create or locate a Google OAuth 2.0 Web application client in Google Cloud Console. Do not use an Android, Desktop, or API-key credential.

Add this exact authorized redirect URI:

https://exportflow.me/api/auth/callback/google

Set the following as Worker secrets; never commit them or add them to frontend code:

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- BETTER_AUTH_SECRET (at least 32 cryptographically random bytes)
- BETTER_AUTH_URL=https://exportflow.me
- AUTH_MIGRATION_TOKEN (a separate long random token for the one-time schema migration route)

Better Auth uses the standard Google authorization-code flow and server-side callback. The callback URI in Google Cloud must match exactly.

## Cloudflare D1

A dedicated isolated test database already exists:

- Name: `exportflow-auth-test-20261120`
- Database ID: `4dbed731-1191-4ce6-8aec-4955e5082c77`
- Current state: empty of application tables; not bound to any Worker; no migration has been applied.

Do not reuse the Cost Router integration-test database or an unrelated application database. The current `AUTH_DB` binding is isolated to `exportflow-auth-lab`; do not add it to the official `exportflow-platform` Worker. Production requires a separate reviewed database and explicit authorization before any Worker binding, migration, secret change or deployment.

After the actual PR application bundle has been uploaded to the isolated Lab Worker and its runtime can be safely invoked, run the schema setup once using POST `/api/auth/_ops/migrate` with Authorization: Bearer `AUTH_MIGRATION_TOKEN`. The endpoint is hidden unless the migration token is configured and the token is checked server-side. Run it only on the isolated test Worker and test database; never call it against Production without a separate reviewed migration and explicit approval. The current diagnostic Lab script does not include Better Auth or this migration handler.

## Email and password

Email/password registration, verification, and password reset remain disabled unless both of these are configured:

- A Cloudflare Email Service send_email binding named EMAIL.
- AUTH_EMAIL_FROM set to a sender address on a domain onboarded and verified for Cloudflare Email Service.

When enabled, Better Auth requires email verification and sends verification/reset links through the server-side EMAIL binding. No fake local account or password-reset flow is used.

## Account management

- Google sign-in and Google account linking/unlinking use Better Auth server endpoints.
- Session cookies are HttpOnly, Secure on HTTPS, SameSite=Lax, and scoped to the ExportFlow origin.
- Sessions last seven days; recent-session checks use a ten-minute fresh-session window.
- Cookie session caching is disabled so server-side session revocation is not masked by a cached session.
- The account UI loads the actual session, profile, linked providers and active sessions from the server. Session tokens are never written to localStorage.
- Account pages are noindex, nofollow, excluded from sitemap.xml, and served with Cache-Control: no-store.

## Required acceptance before release

1. Obtain a dedicated Google OAuth Web client (or verify owner access to the historical Merchant client and add the developer callback).
2. Build and upload the exact PR bundle to the isolated Lab Worker with the `AUTH_DB` binding and test-only secrets.
3. Apply the Better Auth schema on the test D1 using the protected migration route.
4. Verify Google sign-up, callback state handling, sign-in, sign-out, linking and unlinking with a controlled test Google account.
5. Verify session persistence, single-session revoke, revoke-all, profile update, CSRF/origin rejection, expired/invalid sessions, and user isolation.
6. If Email Service is configured, verify email verification, password reset, token expiry and non-enumerating responses.
7. Run real Worker-runtime and browser tests before enabling the Production binding or credentials.

## Current limitations

- The current `exportflow-platform` Worker has no Google OAuth secret binding configured. Earlier project history records a Google OAuth client used by the separate Merchant Preview flow (Google Cloud project `478533247081`), whose callback was `/api/merchant/auth/google/callback`. That historical client has not been verified as reusable for developer accounts, and access to its Google Cloud project was previously unavailable. Do not assume it is the same credential set or silently reuse it. The owner of that Google Cloud project must confirm access and either add `https://exportflow.me/api/auth/callback/google` as an authorized redirect URI to the intended Web OAuth client, or create a dedicated Web OAuth client.
- The isolated D1 test database is bound to the diagnostic `exportflow-auth-lab` Worker. It still has no Better Auth application schema. No Production Auth D1 database or AUTH_DB binding exists.
- Email/password is intentionally disabled until a verified transactional sender exists.
- Two-factor authentication, organization/team roles, account deletion workflow, billing entitlements, and admin provisioning are not included in this first implementation.
- The Lab has three test-only secret bindings and the isolated `AUTH_DB`; the current uploaded script remains a diagnostic harness. No Production secret, binding, schema, DNS, permission, traffic or deployment was changed.

## Cloudflare Auth Lab deployment configuration

The isolated Lab uses a separate Wrangler file at `cloudflare/auth-lab/wrangler.toml`. Do not change the root `wrangler.toml` as part of Lab setup: it remains the configuration for `exportflow-platform`.

- Cloudflare Workers Builds root directory: `/cloudflare/auth-lab`
- Build command: `cd ../.. && npm install --no-audit --no-fund && npm test && npm run check`
- Upload command (creates a new Worker Version without promoting it): `cd ../.. && npx wrangler versions upload --config cloudflare/auth-lab/wrangler.toml`
- Previews: disabled
- The Lab Wrangler config binds only `AUTH_DB` to the isolated D1 database `exportflow-auth-test-20261120`.
- The config sets `workers_dev = false` and `preview_urls = false`; no public Workers subdomain or Preview URL is enabled.

Connect the build only to the `exportflow-auth-lab` immutable Worker tag `044d4d82df164d248b523723a1c15652` and branch `feat/real-google-auth-account-system-20261120`. Never point this build command at the root config or `exportflow-platform`. Previews must remain disabled. A Workers Build configuration is not active yet: the account currently has no Build Token. The browser-based token creation step is blocked until a usable Cloudflare Dashboard session path is available; do not invent a token or expose a credential in chat. The upload command creates a new Lab Worker Version but does not by itself prove the version is active or that Better Auth works.
