# Encrypted merchant credential vault

**Status: isolated AES-256-GCM + D1 adapter and migration; not configured or enabled in production.**

This is the next security layer for the Algerian merchant connector. It does not add merchant login, expose an API route, or activate any carrier.

## Security design

- Credentials are encrypted with Web Crypto AES-256-GCM before they reach D1.
- Each write gets a new 96-bit IV. Authenticated additional data binds the ciphertext to the schema version, merchant ID, carrier ID, tracking-only scope and encryption key ID.
- The database stores only key ID, IV, ciphertext, scope and timestamps; plaintext API keys are never persisted.
- The carrier allowlist and required credential fields are shared with the existing connector module. Custom URLs, arbitrary fetch functions and unknown fields are discarded.
- Saving requires explicit `consent: true`; connection authorization is checked before writes, tracking authorization before reads, and disconnect authorization before revocation.
- The key ring supports planned rotation: new writes use the active key ID; existing records remain decryptable while their prior key is retained.
- No HTTP route imports this module and no client code can access decrypted credentials.

## Files

- `functions/lib/merchant-credential-vault.mjs`: D1 adapter, AES-GCM encryption and authorization boundary.
- `migrations/0001_merchant_credentials.sql`: minimal ciphertext-only schema.
- `scripts/merchant-credential-vault-test.mjs`: fake-D1 tests for consent, access ordering, ciphertext-only persistence, AAD merchant isolation, allowlisting, non-executed accessors, size limits, key rotation and revocation.

## Required Cloudflare setup — deliberately not performed

1. Create a dedicated D1 database for merchant credentials.
2. Apply the migration to that database.
3. Bind it to the Pages project as `MERCHANT_VAULT_DB` and redeploy for the binding to take effect.
4. Create a cryptographically random 32-byte AES key, base64-encode it, store that value as a Cloudflare secret, and pass a key ring of base64-encoded 32-byte keys plus the active key ID into this factory. Never put it in Git, Notion, Datadog, `wrangler.toml`, client code or GitHub Actions logs.
5. Implement a real merchant authentication/session provider. The `merchantId` must be derived from that verified session, never accepted from a request body, URL or local storage.
6. Implement account ownership proofs, consent UI, scopes, rate limits, revocation UX and an audit trail before route integration.

Cloudflare's Pages Functions documentation describes D1 bindings through Wrangler configuration or the dashboard, and exposes the database on `context.env`: https://developers.cloudflare.com/pages/functions/bindings/. D1 local Pages development uses a local database; Cloudflare currently documents that remote D1 development is not supported for Pages: https://developers.cloudflare.com/d1/best-practices/local-development/.

## Important boundaries

- This branch does not configure a D1 database or make any Cloudflare account changes.
- The vault is not connected to a merchant login or session system. Its authorization callback is mandatory and must enforce ownership; passing a caller-controlled merchant ID would be unsafe.
- No provider credentials, real tracking numbers or live carrier endpoints were used.
- All nine carriers remain catalogue/mock-tested only. No production route invokes this module.
