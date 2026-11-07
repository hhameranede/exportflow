# Carrier API integration and batch test plan

## Current connector inventory

The pinned source snapshot is a mixed catalogue, not a list of official API integrations. The measured inventory is:

| Artifact | Count | Meaning |
| --- | ---: | --- |
| Carrier manifests | 1,339 | Source records in the pinned carrier catalogue |
| Dedicated adapter source files | 732 | Adapter implementations; many use public tracking pages or browser/HTTP transports |
| Live-test definitions | 727 | Test definitions in the source tree; many are skipped until their private environment inputs exist |
| Provider-specific `api.ts` modules | 3 | DHL Express, FedEx and UPS API client modules |

The three API modules are exercised by `scripts/carrier-official-api-contract-test.mjs`. That script is part of `npm test`, and each assertion script is published through the existing Datadog CI Visibility integration in GitHub Actions.

## What the batch contract test checks

The CI suite uses mock fetch transports and fake credentials. It validates that each client constructs the correct request sequence and parses the test reply:

| Provider | Contract tested | Expected credential inputs | Sandbox / test path |
| --- | --- | --- | --- |
| UPS | Basic-auth OAuth client-credentials POST, then bearer-auth Track API GET | `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET` | UPS Customer Integration Environment can be selected with `UPS_API_URL=https://wwwcie.ups.com`; production default is `https://onlinetools.ups.com` |
| FedEx | OAuth client-credentials POST, then bearer-auth Track API POST with detailed scans | `FEDEX_API_KEY`, `FEDEX_SECRET_KEY` | Use `FEDEX_API_URL=https://apis-sandbox.fedex.com` for sandbox credentials; production default is `https://apis.fedex.com` |
| DHL Express | API-key-authenticated Shipment Tracking Unified API GET | `DHL_API_KEY` | The API uses `https://api-eu.dhl.com/track/shipments`; access requires an activated subscription key. DHL documents an initial development quota of 250 calls/day and a maximum of one call every five seconds, which is not a production allowance. |

**The CI contract test makes zero requests to carrier networks.** It does not prove that a credential is valid, that an account has Track API access, that a carrier accepts ExportFlow as a service provider, or that ExportFlow may display third-party shipment data.

## Live test inputs (never commit these)

The upstream live suites are opt-in and require private, approved inputs. Examples include:

- UPS: `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET`, and (for a shipment-history test) `UPS_LIVE_TRACKING_NUMBER`.
- FedEx: `FEDEX_API_KEY`, `FEDEX_SECRET_KEY`, and (for a shipment-history test) `FEDEX_LIVE_TRACKING_NUMBER`.
- DHL Express: `DHL_API_KEY` and (for shipment-history tests) `DHL_EXPRESS_LIVE_TRACKING_NUMBER`.

Use only carrier-approved sandbox credentials and synthetic tracking references where the provider supports them. A real shipment reference must be supplied by its owner with permission for the test. Keep secrets in a secret manager/GitHub Actions secrets, keep tracking references out of logs and telemetry, and never store raw carrier responses in the repository.

## Evidence stages

1. **Catalogued** — an upstream manifest identifies the carrier.
2. **Adapter present** — source code exists for the connector.
3. **Mock tested** — local contract/fixture tests pass; this is what the current API batch test establishes.
4. **Sandbox tested** — the provider's own sandbox/test environment responds successfully to ExportFlow's app credentials.
5. **Live tested** — a permitted live request succeeds with authorized inputs and safe projected output.
6. **Commercially authorized** — documentary evidence explicitly covers the intended third-party/multi-merchant use and shipment-data display.

A provider must not be promoted to `verified` based only on an API module, mock test, successful homepage probe or a generic developer key. The D1 evidence registry requires both live test evidence and a separate authorization reference before it can expose the verified state.

## Datadog use and limits

The current CI job enables Datadog Test Visibility when `DD_API_KEY` is configured, then runs the 23 assertion scripts through the `dd-trace:ci:manual:test:start/finish` channels. The API contract suite appears as `carrier-official-api-contract-test`. GitHub Actions output confirms that result was recorded in the CI session.

## Full-catalog source integration matrix

The offline catalog generator also emits `CARRIER_INTEGRATION_MATRIX` for all 1,339 source records (including the reserved `unknown` row). The public paginated `GET /api/carrier-directory` response exposes the matching `sourceIntegration` object per carrier and adds `summary.integrationCounts` and `summary.apiClientRecords`.

Use `GET /api/carrier-directory?integration=provider_api_client&pageSize=100` to list the three carriers with a provider-specific API client in the pinned source snapshot. Other supported classes are:

| Class | Meaning |
| --- | --- |
| `provider_api_client` | A provider-specific `api.ts` client exists in the pinned source tree |
| `dedicated_adapter` | A dedicated upstream `adapter.ts` exists; the source may use a public page, private endpoint or other transport |
| `universal_fallback` | The carrier uses an upstream universal fallback |
| `link_only` | The source record exposes a tracking link but no automated tracking mode |
| `adapter_reference_only` | The manifest declares an automatic adapter reference but no matching local adapter source file was found in that carrier folder |
| `catalogue_only` | A catalog record exists without an assessed dedicated connector |

The per-record metadata includes whether adapter/fixture/live-test source files exist and the transport step names declared by the upstream manifest. The live-test field means a test definition exists; it does not mean it ran or passed. For API client records, required environment variable **names** and authentication pattern are listed, never secret values.

All records start with `commercialAuthorization=not_assessed` and `thirdPartyTrackingRights=not_assessed` in this source matrix. Curated D1 evidence overlays these defaults where a researched provider record exists. The matrix intentionally does not infer "no official API" from the absence of an upstream `api.ts` file: that means only that the pinned snapshot did not include a provider-specific API client.

Datadog Synthetic Monitoring currently has no Synthetic tests configured in the connected account, and test-creation permissions are not available. Do not describe the CI contract suite as a Datadog Synthetic test or production API uptime check. A future live suite can be added as a separate, manually approved workflow after the provider sandbox accounts and permitted inputs exist.

## Official provider references

- [UPS — Get started with UPS APIs](https://developer.ups.com/get-started): app registration, OAuth credentials and Customer Integration Environment guidance.
- [FedEx Developer Portal — Track API](https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html): Track API onboarding and request contract.
- [FedEx — API best practices](https://www.fedex.com/content/dam/fedex/eu-europe/downloads/FedEx-API-Best-Practices_09_2022.pdf): sandbox and production OAuth endpoints and credential handling.
- [DHL Developer Portal — Shipment Tracking Unified API](https://developer.dhl.com/tracking): subscription key, endpoint, activation and initial rate limits.

## Provider-specific sandbox decisions

- **UPS Track:** use the official Customer Integration Environment base `https://wwwcie.ups.com` with an application Client ID and Client Secret. UPS explicitly says CIE is for basic validation and not load testing. The provider's docs and Postman collection include sample requests. Keep the default live endpoint disabled in a sandbox workflow unless `UPS_API_URL` is deliberately set to CIE.
- **FedEx Track:** use the Developer Portal's Test Key credentials and `https://apis-sandbox.fedex.com`. Because ExportFlow is intended to expose carrier services inside a platform, review the **Integrator Provider** onboarding path rather than assuming the ordinary shipper profile covers the use case. FedEx describes an organization/project setup, test-key requests, test API calls and a separate validation process before production.
- **DHL Shipment Tracking Unified API (pull):** DHL support says an external-customer testing environment is unavailable; external customers are directed to test in production. Therefore the matrix marks this API as `no_external_customer_test_environment` and no unattended Sandbox probe is scheduled. A live call must use an approved key and shipment reference whose owner has authorized the test, while following current rate and data-retention/redisplay conditions. Do not confuse this pull API with DHL's separate Unified Push API, which has its own access/onboarding flow.

The directory API exposes these decisions as `sourceIntegration.sandboxMode`, `sandboxBaseUrl` and (where relevant) `onboardingRole`. These values describe the provider's documented environment and do not mean ExportFlow already has credentials or access.

Provider terms and quotas can change. Reconfirm them in the carrier's current developer portal before enabling a new live connector.
