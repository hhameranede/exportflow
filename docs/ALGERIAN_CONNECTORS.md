# Algerian carrier connector layer

**Status: isolated adapter boundary + mock-tested contract. Not enabled in production.**

This layer specializes ExportFlow for Algerian merchants without changing the global tracking engine. It is deliberately read-only: it supports tracking, not order creation, cancellation, labels, fee quotes, parcel lists or merchant-side write operations.

## Architecture boundary

- Global public tracking remains in `functions/api/track.js` and `functions/lib/exportflow-carrier-engine.mjs`.
- Algerian merchant-account tracking is isolated in `functions/lib/algerian-carrier-connectors.mjs`.
- The Algerian connector is not imported by the public tracking route and is not an automatic fallback.
- A caller must inject the upstream SDK `createClient` function, an authorization check and a server-side credential resolver.
- A failed Algerian merchant connection must not silently fall through to UPU or another carrier. Keep the two paths explicit.

The complete upstream source snapshot is already present as ordinary Git files under `vendor/sources/algeria/dz-delivery/` in the parent Global Logistics branch: 910 files / 4,228,323 bytes, pinned to the exact upstream commit above. Its root MIT LICENSE and `packages/ts/package.json` are preserved. Do not create a second copy. The SDK is not yet installed as an ExportFlow runtime dependency or imported into the Cloudflare bundle.

The connector uses dependency injection rather than importing the SDK directly. This keeps the current Cloudflare build and lockfile unchanged until package integrity, Worker compatibility, credentials and carrier authorization have been approved.

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
3. `createClient(provider, config)` is the upstream SDK factory supplied by the eventual integration module.

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
- There is no credential persistence, logging, telemetry or network request in this boundary itself.

The credential vault, merchant authentication, connection management, revocation and audit trail are intentionally not simulated. They must exist before any route invokes this connector.

## Test and evidence status

Run:

```bash
node scripts/algerian-connectors-test.mjs
```

The mock tests cover the provider allowlist, GuepEx alias and fixed endpoint, credential field filtering, authorization-before-secret-resolution, prototype-key provider rejection, valid and invalid Ecotrack courier keys, MDM tracking without an optional store ID, response minimization, redaction and sanitized upstream failures.

Evidence level for every provider remains **catalogued / mock-tested only**. No API key was used, no real tracking number was sent, no sandbox call was made and no carrier is marked live-verified.

## Production activation gates

1. Choose and implement an encrypted server-side credential store. Do not place carrier API keys in GitHub, static pages, local storage, analytics, logs or the public tracking payload.
2. Add authenticated merchant connection setup, proof of account ownership, explicit consent, per-provider scopes and immediate revocation.
3. Review each carrier's current API contract, terms, display rights, rate limits and data-retention conditions independently.
4. Adopt the already materialized TypeScript SDK only after a Cloudflare Pages compatibility build and supply-chain review. Keep its existing MIT LICENSE and upstream notices with the source snapshot; do not duplicate the snapshot.
5. Add provider-specific mock fixtures and run tests with synthetic values. Use official sandbox/read-only credentials where available; any live test requires the merchant's explicit authorization.
6. Enable providers individually only after their own evidence reaches sandbox-tested or live-verified. Never display a provider as active merely because its adapter exists.

Until those gates are complete, this code is an isolated, testable foundation and has no effect on production tracking.
