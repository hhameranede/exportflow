# Carrier official-source audit — batch 02

**Review date:** 2026-11-07  
**Scope:** Ten additional operator records from the existing seeded evidence registry. Primary company/government domains were preferred. Findings distinguish a public tracking page from API documentation and account authorization.

## Results

- Ten additional carrier/network evidence rows received a first-party source review.
- Official API developer/source documentation was identified for USPS, PostNL, Geopost/DPD, GLS, Emirates Post, SF Express, Yanwen and Cainiao.
- Official public tracking pages (not developer API grants) were confirmed for India Post and SingPost.
- All ten remain **Research**; no Testing, Integrated or Verified state was assigned.
- No ExportFlow account approval, credential grant, carrier agreement, service-provider authorization or right to redistribute shipment data was established.

## Per-provider evidence

| Provider | Primary source | What it establishes | Boundary / remaining work |
| --- | --- | --- | --- |
| USPS | [USPS Developer Portal](https://developers.usps.com/) and [API Access guidance](https://www.usps.com/business/api-access.htm) | Tracking API, OAuth2 onboarding, app registration and CAT/live environments. | 2026 account/access-control and Mailer ID scope must be reviewed for third-party service-provider use. |
| PostNL | [Shipping status webservice](https://developer.postnl.nl/integration-with-postnl/api-overview/send-and-track/shippingstatus-webservice/) | Current/full status and updates by customer number; API key and sandbox navigation. | Documentation restricts disclosure to matching customer and parcel codes; no independent public third-party scope. |
| Geopost / DPD | [Geopost API Portal](https://developer.dpdgroup.com/) | Carrier-owned API portal with product categories and public/restricted API groupings. | Country, product and approval vary; this is not a single global DPD tracking integration. |
| GLS Group | [GLS Developer Portal](https://dev-portal.gls-group.net/get-started) and [GLS Poland Track & Trace](https://developer.gls-poland.com/en/trackandtrace/rest/) | Registration, app keys and API approval model; country-specific Track & Trace material exists. | Restricted APIs require approval; GLS Poland documentation ties rights to a customer WebAPI/YourGLS account. |
| Emirates Post | [Integration Solutions](https://www.emiratespost.ae/all-services/integration-solutions) | Official API page lists Track Shipments in Pickup & Delivery APIs. | Production integration is account/support-led; ExportFlow has no agreement or delegated access. |
| SF Express | [SF Express Open Platform — Developer Introduction](https://open.sf-express.com/developerIntroduction) | Carrier-owned platform describes APIs, SDKs, test tools, sandbox and onboarding. | A specific Track API contract and third-party access terms still need review. |
| India Post | [Department of Posts — Track & Trace](https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspxTrack) | Government of India postal operator's official public tracking workflow. | No public developer API was established; existing upstream scraper reference is not the official API. |
| SingPost | [Track Your Item](https://www.singpost.com/track-items) and [tracking help](https://www.singpost.com/support/managing-deliveries/tracking-receiving-your-items) | Official public tracking for smartpac, Registered Service and Speedpost. | No developer tracking API was identified in this review; tracker presence is not reuse permission. |
| Yanwen | [Yanwen Open Platform — tracking documentation](https://opendocs.yw56.com.cn/webfile/7128663508291424256/) | Official API documentation describes tracking and signed account-based requests. | API uses the customer's account ID/token; no ExportFlow account or third-party rights. Sample credentials were not copied or used. |
| Cainiao | [Global Fulfilment Open Platform](https://open.gfn.cainiao.com/apiInfo/introduce) and [official global tracker](https://global.cainiao.com/) | Official Open Platform describes logistics APIs including tracking and an explicit software-provider/customer-authorization workflow; a separate public tracker exists. | Platform/API onboarding and customer delegation required; no ExportFlow app approval or seller authorization is recorded. |

## Evidence status applied in D1

Migration `0006_carrier_official_source_research_batch_02.sql` updates these ten rows with official source URLs and dated research notes. All remain:

- `evidence_status = research`
- `verification_method = none`
- `verified_at = NULL`
- `verification_evidence_url = NULL`
- `authorization_evidence_url = NULL`

Two distinctions are important:

1. A public tracking page (India Post, SingPost) establishes a carrier-operated consumer lookup, not an API right or permission to scrape/re-publish results.
2. An API portal (USPS, PostNL, Geopost, GLS, Emirates Post, SF Express, Yanwen, Cainiao) establishes documentation and an access path only. Credentials, customer delegation, product scope, carrier approval and downstream data rights remain separate requirements.

## Coverage accounting

Together with batch 01, 20 of the 22 providers already seeded in the evidence registry now have dated first-party source notes. The remaining two seed records, China Post and YunExpress, need separate source-quality review; the 1,338-entry catalog outside this 22-provider research overlay still requires its own per-carrier primary-source checks. Source-manifest license attribution is not an official-carrier identity certificate or a carrier-issued data-use license.
