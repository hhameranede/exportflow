# Temporary Better Auth Owner Session Lab

This isolated Worker validates the actual Better Auth cookie/session path used by `authorizePlatformOwner()`.

- CI builds this Worker with the template `wrangler.toml` using `--dry-run` only.
- Each runtime acceptance run creates a unique temporary D1 database and a unique Worker name from the GitHub run ID, then generates a private per-run Wrangler config at runtime.
- The temporary Worker binds only that run's new D1 database as `AUTH_DB`.
- The lab creates a synthetic email/password user, marks only that synthetic user as verified in the isolated D1, and obtains a real Better Auth session cookie.
- The authorization route calls the production `authorizePlatformOwner()` from `src/core/auth-app.js` and `src/core/platform-admin-auth.js`.
- Per-run cleanup deletes both the temporary Worker and D1 database, including when runtime checks fail.

Never point this Worker at Production `AUTH_DB`, never use a real user or Google OAuth credential, and never persist the temporary Worker config or generated secrets.
