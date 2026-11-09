# FedEx Integrator Readiness — Tracking API

**Status:** Research / approval required  
**Prepared:** 2026-11-09  
**Target API:** Basic Integrated Visibility (formerly Track API)  
**Program route:** FedEx Integrator Provider — software / non-shipping solution

## Decision

FedEx is the first Tier-A candidate to evaluate for an official ExportFlow tracking integration. Its public Developer Portal describes an Integrator Provider program for software providers serving multiple FedEx customers and explicitly lists tracking as a supported non-shipping solution. Basic Integrated Visibility provides basic tracking information for FedEx shipments.

This is a readiness plan, not proof that ExportFlow has been accepted into the program, is entitled to use the API for its current public lookup product, or has permission to redistribute shipment data. No FedEx account was created, no agreement was accepted, no credentials were issued, no API request was made, and no carrier integration was deployed.

## Why this API

- The official API catalog identifies Basic Integrated Visibility as the successor name for the Track API and describes basic tracking information for FedEx shipments.
- The listed services include FedEx Express, Ground, Ground Economy and Freight tracking by tracking number.
- The Integrator Provider program is designed for providers building solutions for multiple FedEx customers globally.
- FedEx says the program can support non-shipping solutions such as Tracking and Rating; label generation is not required simply to participate.
- The program page says joining the program has no fee, while premium APIs/services may have separate costs. This is not a guarantee that every later service, account or transaction is free.

Official sources:
- [FedEx — Become a Provider](https://www.fedex.com/en-us/compatible/become-a-provider.html)
- [FedEx — Integrator Provider Validation](https://developer.fedex.com/api/en-nl/certification/integrator-provider.html)
- [FedEx — Basic Integrated Visibility API](https://developer.fedex.com/api/en-eg/catalog/track.html)
- [FedEx — Basic Integrated Visibility documentation](https://developer.fedex.com/api/en-cd/catalog/track/docs.html)

## Required program and approval path

1. **Eligibility and legal review.** Confirm that the actual ExportFlow operating entity and intended multi-customer use case qualify for the Integrator Provider route. Review the current Global Integrator Agreement, API-specific conditions, region availability, end-customer terms, data-use permissions, retention, privacy, security, support and commercial/advertising restrictions.
2. **Authorized organization registration.** If eligibility is confirmed, an authorized legal representative for the organization should create or administer the correct software-provider / Integrator Provider organization in the FedEx Developer Portal. Use accurate legal-entity information; do not represent a personal developer account as the software provider.
3. **Agreement acceptance.** Only a legally authorized adult/company representative may review and accept any binding agreement on behalf of the relevant entity. Do not click acceptance or represent that approval has been obtained before that review.
4. **Project and API selection.** After the organization route is accepted, select Basic Integrated Visibility in the Developer Portal project and review the exact current API documentation, country/territory coverage and restrictions.
5. **Test access and customer onboarding.** Use only provider-issued test credentials and FedEx-provided test accounts. Follow the required registration and customer authorization/MFA flow for each relevant customer. Do not test with real customer shipment references without documented permission and an approved test procedure.
6. **API validation.** FedEx lists Basic Integrated Visibility among APIs requiring additional Integrator Provider validation. Its published validation guidance includes regional test cases, completion of registration transactions using test account numbers, test execution, a Product Information Worksheet (PIW), a Validation Cover Sheet, and customer-facing material such as screenshots of the solution, disclaimer, EULA and end-customer registration flow. Confirm the exact deliverables with FedEx for the selected API and target markets.
7. **Production approval.** Request production credentials only after the required validation is complete. FedEx states that the request is reviewed and production keys are provided only after approval. No code path should use production credentials before written approval and secure owner-managed configuration.
8. **Controlled rollout.** Start with a limited, customer-authorized pilot. Measure success, latency, error types, event freshness, rate-limit behavior and data deletion. Expand only within the approved service, territory, customer and usage scope.

## Important contract boundary

The individual Developer Portal Developer License Agreement is not a substitute for Integrator Provider authorization. The currently published individual agreement defines an End User in terms of that entity's own internal purposes and restricts distribution of an application to more than one End User; it also contains per-End-User credential restrictions. It must not be used as a shortcut to authorize a multi-merchant or public consumer tracking service.

The Integrator Provider route is the relevant route to investigate for a multi-customer product, but its current Global Integrator Agreement and any customer-facing EULA must be reviewed before implementation or data use. Availability of an API, successful test credentials, or an upstream adapter does not independently establish rights to display or commercially use shipment data.

Reference: [FedEx Developer Portal Developer License Agreement](https://developer.fedex.com/api/en-us/legal/fdpla.html). The agreement page states that acceptance creates a binding agreement and that a person accepting for a legal entity represents that they have authority to bind it.

## ExportFlow architecture proposal — not implemented

If and only if the provider agreement and intended use are approved:

- Implement a separate server-side FedEx provider adapter; do not repurpose or silently relabel the existing public-page / scraper route as the official API.
- Keep API credentials server-side in approved secret storage. Never expose credentials in browser code, Git history, logs, public artifacts or Notion.
- Model customer authorization explicitly. Bind each lookup to the customer/merchant account and permissions that authorize that shipment; prevent cross-tenant credential or shipment-data access.
- Keep the consumer public lookup route separate from a merchant-connected account route unless FedEx's written terms explicitly permit the public recipient-facing flow.
- Normalize tracking events through ExportFlow's existing internal status model while preserving source timestamps, source identifiers and provider error semantics.
- Add offline contract tests with synthetic fixtures for authentication failures, invalid input, authorization denial, rate limits, timeouts, empty/delayed histories, duplicate events and out-of-order events.
- Add privacy-safe operational metrics without logging full tracking numbers, recipient details, access tokens or shipment payloads.
- Record the approved API product, legal entity, region, allowed customer type, data-display scope, quotas, retention/deletion requirements and re-verification date in the existing carrier evidence registry before changing its status.

## Current blockers

- Integrator Provider eligibility and the current Global Integrator Agreement have not been reviewed by an authorized representative.
- No written authorization has been established for ExportFlow's specific public consumer or multi-merchant tracking use case.
- No approved organization, project, test credentials or production credentials have been set up.
- Region-specific eligibility and customer authorization requirements still need confirmation.
- Retention, deletion, caching, recipient-facing display and commercial/advertising rights must be confirmed from the applicable agreement and API terms.
- The existing upstream FedEx adapter is not evidence of official API access or permission.

Until these are resolved, keep the FedEx registry entry in Research. Do not mark it Testing, Integrated or Verified; do not make live carrier requests; and do not claim an official FedEx integration or partnership.

## Acceptance checklist

- [ ] Authorized representative confirms the legal entity and intended use are eligible.
- [ ] Current Global Integrator Agreement and API-specific conditions are reviewed and accepted by an authorized representative.
- [ ] Written confirmation covers the intended customer type, regions, recipient-facing display and commercial use.
- [ ] Customer onboarding, EULA and MFA requirements are documented.
- [ ] Test credentials and test account numbers are issued by FedEx.
- [ ] Regional API test cases and validation deliverables are completed.
- [ ] FedEx approves production access in writing.
- [ ] Credentials are stored securely and tenant boundaries are tested.
- [ ] Retention, deletion, support, quota and monitoring controls are documented.
- [ ] Repeatable authorized pilot tests pass before any coverage status is promoted.
