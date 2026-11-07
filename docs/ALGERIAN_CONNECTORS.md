# Algerian carrier connector layer

**Status: merchant-only tracking route added on PR #49 branch; code-level route test registered. Cloudflare Preview bundle and live authorization remain unverified. Not enabled in Production.**

This layer specializes ExportFlow for Algerian merchants without changing the global tracking engine. It is deliberately read-only: it supports tracking, not order creation, cancellation, labels, fee quotes, parcel lists or merchant-side write operations.

## Architecture boundary

- Global public tracking remains in `functions/api/track.js` and `functions/lib/exportflow-carrier-engine.mjs`.
- Algerian merchant-account tracking is isolated in `functions/lib/algerian-carrier-connectors.mjs`.
- The Algerian connector is not imported by public `POST /api/track` and is never an automatic fallback. The separate `POST /api/merchant/track` route calls it only after a verified merchant session, same-origin check, server-side credential resolution and global rate-limit approval.
- A caller must inject the upstream SDK `createClient` function, an authorization check and a server-side credential resolver.
- A failed Algerian merchant connection must not silently fall through to UPU or another carrier. Keep the two paths explicit.

The complete upstream source snapshot is present as ordinary Git files under `vendor/sources/algeria/dz-delivery/`: 910 files / 4,228,323 bytes, pinned to the exact upstream commit above. Its root MIT LICENSE and `packages/ts/package.json` are preserved. Do not create a second copy. The merchant route dynamically imports the pinned TypeScript source entrypoint at `packages/ts/src/index.ts`; no npm runtime dependency or generated `dist` artifact was added. Wrangler bundling of that TypeScript source is still awaiting CI verification.

The connector retains dependency injection. The merchant endpoint supplies a factory that dynamically imports `createClient` from the pinned MIT source only after the request passes session, origin, provider and quota checks. This keeps the public tracking engine and global fallback independent. The source's MIT license and attribution remain preserved.

## Upstream source review

| Item | Reviewed value |
| --- | --- |
| Repository | [developing-off/dz-delivery](https://github.com/developing-off/dz-delivery) |
| Pinned source commit | [45aa32ddf2ba7392da6c696aef187fcc059b3c8d](https://github.com/developing-off/dz-delivery/commit/45aa32ddf2ba7392da6c696aef187fcc059b3c8d) |
| TypeScript package | `@dz-delivery/core` |
| Published version reviewed | `0.1.12` |
| Root and TypeScript package license | MIT; upstream LICENSE file and package metadata inspected |
| Runtime claims | TypeScript package documents Node.js 18+ and zero runtime dependencies, using native Fetch |
| Materialization status | Full 910-file upstream source snapshot is already stored at `vendor/sources/algeria/dz-delivery/` in the parent branch; it remains reference-only and is **not** installed as a runtime dependency in this change |

The upstream project documents a common `ShippingProvider` contract and provider-specific API mappings. It is a useful adapter implementation, not proof of official carrier partnership or live availability. Its package is still 0.x, so API stability must be reviewed before adopting it as a production dependency.

## Provider identifiers and credential contracts

The connector accepts only these static identifiers. Credentials are retrieved from a server-side resolver and are never accepted from a browser request.

| ExportFlow ID | Upstream SDK provider | Required credential fields |
| --- | --- | --- |
| `yalidine` | `yalidine` | `apiId`, `apiToken` |
| `guepex` | `yalidine` | `apiId`, `apiToken`; fixed GuepEx API base URL |
| `zrexpress` | `zrexpress` | `apiKey`, `tenant` |
| `maystro` | `maystro` | `apiToken` |
| `ecotrack` | `ecotrack` | `token`, approved `courier` key |
| `noest` | `noest` | `apiToken`, `userGuid` |
| `ecom` | `ecom` | `apiKey`, `apiToken` |
| `mdm` | `mdm` | `apiKey` (optional `storeId`; required for parcel creation, not tracking) |
| `elogistia` | `elogistia` | `apiKey` |

GuepEx is documented upstream as using the Yalidine platform with a different fixed API host; it is therefore an alias, not a wholly separate SDK provider. Ecotrack represents several courier brands on one platform. Its accepted built-in keys are pinned to the upstream TypeScript map: `dhd`, `anderson`, `andersondelivery`, `worldexpress`, `48hrexpress`, `ecorapid`, `conexlog`, `msmgo`, `packers` and `rocketdelivery`. The allowlist in code prevents a merchant-provided URL from becoming an arbitrary outbound destination.

The upstream feature matrix describes tracking support for the listed providers, but ExportFlow has not independently verified every endpoint against live carrier accounts. Carrier-specific operation limitations remain authoritative; do not infer that every provider supports every SDK method.

## Required authorization and secret flow

The factory requires three injected functions:

1. `authorizeMerchantProvider({ merchantId, provider, operation: "track" })` must return literal `true` only after checking the authenticated merchant owns that connection and has tracking permission.
2. `resolveCredentials({ merchantId, provider })` must return the saved provider credentials from a server-side secret store. It is called only after authorization succeeds.
3. `createClient(provider, config)` is supplied by the merchant route from the pinned `@dz-delivery/core` source. The API only calls the provider tracking method; parcel creation, cancellation, labels, rates and order operations are not exposed.

The merchant ID passed to this internal boundary must come from a verified server session, never from a request body or browser local storage. The resolver must scope every credential lookup to that authenticated merchant and selected provider.

### Security controls in this implementation

- Provider names and Ecotrack courier names are allowlisted.
- Merchant-supplied `baseUrl`, `fetch` and other arbitrary SDK options are discarded.
- GuepEx uses a fixed upstream base URL; no arbitrary host is accepted.
- Ecotrack courier keys follow the upstream implementation's exact identifiers; custom tenant URLs are intentionally not accepted by this first boundary.
- MDM `storeId` is retained only when present; the upstream type marks it optional, while parcel-creation and some merchant account operations need a store scope.
- Elogistia's upstream adapter sends its API key in the query string. Do not activate it until outbound URL logging and telemetry controls have been reviewed for secret leakage.
- The SDK is configured with a 10-second timeout and `includeRaw: false`.
- Returned payloads expose only the requested tracking number, normalized status and a bounded event timeline. Raw carrier payloads, parcel identifiers and credentials are not returned.
- Event labels are length-limited and email/phone-like strings are redacted.
- Upstream exceptions are converted to stable error codes; raw provider messages are not exposed.
- The connector boundary itself performs no credential persistence, logging, telemetry or network request.

The encrypted AES-256-GCM credential vault, Google OIDC session layer and merchant audit schema are present in the stacked PR chain. Migrations 0001-0004 were applied to the EU Preview D1 only; Production was not migrated. Preview has 22 research-only carrier records and the pre-existing integration/source rows were preserved. The route imports the session-bound vault, but `MERCHANT_CREDENTIAL_KEYRING_JSON`, Google OAuth credentials and `MERCHANT_APP_ORIGIN` have not been configured; therefore no real merchant sign-in or credential save has been exercised.

## Test and evidence status

Run:

```bash
node scripts/algerian-connectors-test.mjs
node scripts/merchant-tracking-route-test.mjs
```

The second suite covers the merchant-only HTTP boundary, session binding, same-origin guard, global quota fail-closed behavior, credential isolation, provider selection, response minimization and Elogistia's disabled default. It uses injected mock clients and does not call a carrier.

The mock tests cover the provider allowlist, GuepEx alias and fixed endpoint, credential field filtering, authorization-before-secret-resolution, prototype-key provider rejection, valid and invalid Ecotrack courier keys, MDM tracking without an optional store ID, response minimization, redaction and sanitized upstream failures.

Evidence level for every provider remains **catalogued / mock-tested only**. No API key was used, no real tracking number was sent, no sandbox call was made and no carrier is marked live-verified.

## Production activation gates

1. Configure a recoverable AES-256-GCM key ring as an encrypted Pages secret (`MERCHANT_CREDENTIAL_KEYRING_JSON`) only after documenting backup, rotation and recovery. Never place carrier API keys in GitHub, static pages, local storage, analytics, logs or public payloads.
2. Configure and independently test Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MERCHANT_APP_ORIGIN` and exact callback URI), then complete account ownership proof, explicit consent, per-provider scopes and immediate revocation.
3. Review each carrier's current API contract, terms, display rights, rate limits and data-retention conditions independently.
4. Complete Wrangler bundling and Preview compatibility checks for the pinned TypeScript source import. Keep the existing MIT LICENSE and upstream notices with the source snapshot; do not duplicate it.
5. Add provider-specific mock fixtures and run tests with synthetic values. Use official sandbox/read-only credentials where available; any live test requires the merchant's explicit authorization.
6. Configure the Preview-only vault key and OAuth credentials, pass the new route's CI and Cloudflare Preview bundle, then test only with owner-authorized sandbox credentials. Enable providers individually only after their own evidence reaches sandbox-tested or live-verified. Never display a provider as active merely because its adapter exists.

Until those gates are complete, the route remains a Preview/PR feature. It does not change public tracking, does not use carrier credentials belonging to other merchants, and does not establish live carrier coverage or commercial authorization.
