# ExportFlow account authentication setup

This branch introduces a server-side Better Auth integration. It does not enable account creation in Production by itself. The active Worker currently has no AUTH_DB binding and no Google OAuth client credentials, so the integration remains disabled until the prerequisites below are configured and verified.

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

Create a dedicated D1 database for account identity data. Do not reuse the Cost Router integration-test database or an unrelated application database.

Bind the new database to the exportflow-platform Worker as AUTH_DB. This binding is intentionally not added in this branch because creating a D1 resource and changing the official Worker configuration require separate approval.

After the binding and BETTER_AUTH_SECRET are configured on an isolated test target, run the schema setup once using POST /api/auth/_ops/migrate with Authorization: Bearer AUTH_MIGRATION_TOKEN. The endpoint is hidden unless the migration token is configured and the token is checked server-side. Do not call it against Production until the migration has been reviewed and a dedicated approval is given.

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

1. Configure an isolated test D1 binding and Google OAuth client credentials.
2. Apply the Better Auth schema on that test database.
3. Verify Google sign-up, callback state handling, sign-in, sign-out, linking and unlinking with a controlled test Google account.
4. Verify session persistence, single-session revoke, revoke-all, profile update, CSRF/origin rejection, expired/invalid sessions, and tenant/user separation.
5. If Email Service is configured, verify email verification, password reset, token expiry and non-enumerating responses.
6. Run real Worker-runtime and browser tests before enabling the Production binding or credentials.

## Current limitations

- The current `exportflow-platform` Worker has no Google OAuth secret binding configured. Earlier project history records a Google OAuth client used by the separate Merchant Preview flow (Google Cloud project `478533247081`), whose callback was `/api/merchant/auth/google/callback`. That historical client has not been verified as reusable for developer accounts, and access to its Google Cloud project was previously unavailable. Do not assume it is the same credential set or silently reuse it. The owner of that Google Cloud project must confirm access and either add `https://exportflow.me/api/auth/callback/google` as an authorized redirect URI to the intended Web OAuth client, or create a dedicated Web OAuth client.
- No dedicated ExportFlow Auth D1 database or AUTH_DB binding exists yet.
- Email/password is intentionally disabled until a verified transactional sender exists.
- Two-factor authentication, organization/team roles, account deletion workflow, billing entitlements, and admin provisioning are not included in this first implementation.
- This branch does not change Worker secrets, bindings, D1 resources, DNS, permissions, Production traffic, or deployments.