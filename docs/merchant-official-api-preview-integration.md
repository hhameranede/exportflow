# ExportFlow official API Sandbox integration

This branch is a focused integration from current `main`, not a merge of the legacy Global Logistics stack.

## Scope
- Merchant Google OAuth identity and revocable D1 sessions.
- Merchant-owned UPS and FedEx credentials encrypted with AES-256-GCM, merchant/provider/scope-bound AAD, and explicit consent.
- Metadata-only credential status and lifecycle audit.
- Official non-production UPS CIE and FedEx Sandbox endpoints with fixed synthetic references.
- No public visitor tracking, live shipment references, public-route rights changes, CAPTCHA bypass, or third-party access-control bypass.

## Branch and environment boundary
- Branch is based on `main` commit `b67f6ae470ef9733ffb0988e7185dfcb7c0f3411`.
- The Pages `MERCHANT_DB` and `GLOBAL_RATE_LIMITER` bindings added here are under `env.preview` only. No Production D1 or Durable Object binding is added.
- The current Pages Preview branch rule includes `feat/*`, not `integration/*`; this branch is for CI and code review and should not trigger a Preview deployment automatically.
- Existing Preview D1 already contains the merchant identity and audit foundation; migration 0008 is supplied for the official UPS/FedEx credential table and audit expansion. No remote migration is applied from this branch.

## Required Preview configuration before a live owner test
- `MERCHANT_APP_ORIGIN` set to the HTTPS Preview origin.
- Google OAuth client ID and secret, with callback URI `/api/merchant/auth/google/callback`.
- `MERCHANT_CREDENTIAL_KEYRING_JSON` containing an active 32-byte AES-256 key ring.
- Existing Preview `GLOBAL_RATE_LIMITER_HMAC_SECRET` and the deployed `exportflow-global-rate-limiter` Worker binding.

No secrets or provider credentials are included in this branch. Mocked tests are not evidence of a real provider Sandbox call, carrier Production entitlement, or third-party shipment-display rights.
