# Temporary Better Auth Owner Session Lab

This isolated Worker is only for validating the Better Auth session-cookie path used by `authorizePlatformOwner()`.

- It must be deployed only with a newly created temporary D1 database and temporary test-only settings.
- The signup path uses a lab-only Better Auth instance with email verification disabled solely to create a synthetic account; it marks only that synthetic test user as verified, then obtains a real Better Auth session cookie.
- The authorization path calls the production `authorizePlatformOwner()` function from `src/core/auth-app.js` and `src/core/platform-admin-auth.js`.
- Never point this Worker at the Production `AUTH_DB`, never use a real user or OAuth credential, and delete both temporary resources after acceptance.
- The static lab token and session data are temporary synthetic test material, not production credentials.

The dry-run bundle is built with Wrangler and included from `cloudflare/auth-session-lab/dist/` in the short-lived CI artifact.
