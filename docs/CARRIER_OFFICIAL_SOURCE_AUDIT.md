# Carrier official-source audit — first verified batch

**Review date:** 2026-11-07  
**Scope:** Primary carrier-owned web properties only. This audit verifies that an official company source exists and records what the source supports. It does not grant ExportFlow credentials, API access, a commercial service-provider agreement, trademark permissions, or permission to display or redistribute shipment data.

## Result

- 10 carrier research records received a primary-source review.
- 9 official developer/API portals or API documentation pages were retrieved or identified.
- Japan Post's official tracking website was confirmed; the public page itself is not API documentation.
- FedEx's official developer portal was identified in search, but its page was not retrievable during this automated check.
- Aramex's official page was reached, but a consent layer obscured much of its body; its official search result identifies a Shipment Tracking API.
- All 10 remain at **Research**. None is marked Testing, Integrated, or Verified by this source check.
- No ExportFlow API approval, credential grant, contract, or third-party shipment-data permission was established.

## Carrier-by-carrier evidence

| Provider | Official source | What this review established | Remaining boundary |
| --- | --- | --- | --- |
| UPS | [UPS Developer Portal — Tracking](https://developer.ups.com/tag/Tracking?loc=en_US) | UPS-owned developer domain and Tracking API category identified. | OAuth/customer-account scope and written consent for third-party display remain; no ExportFlow authorization. |
| FedEx | [FedEx Developer Portal](https://developer.fedex.com/) | FedEx-owned Developer Portal identified by official-domain search. | Page retrieval failed in this check; exact Track API terms and ExportFlow eligibility require manual review. |
| DHL Express / DHL Group | [Unified Shipment Tracking API](https://developer.dhl.com/tracking?language_content_entity=en) | Live page identifies Unified Shipment Tracking API v1.5.8, global scope, multiple DHL divisions and tracking use. | Developer login/access and contract scope remain; documentation is not a grant of third-party display rights. |
| Aramex | [Aramex APIs](https://www.aramex.com/ae/en/developers-solution-center/aramex-apis) | Official Aramex page and search result identify a Shipment Tracking API. | Cookie-consent layer obscured much of the fetched page; auth and service-provider terms need direct review. |
| Canada Post | [Tracking Web Service](https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/services/tracking/default.jsf?LOCALE=en) | Canada Post Developer Program identifies a Tracking Web Service that returns parcel events. | API credentials/account eligibility and multi-merchant third-party use must be confirmed. |
| Australia Post | [Tracking an item](https://developers.auspost.com.au/apis/shipping-and-tracking/info/api-resources/tracking) | Australia Post Developers documents tracking and links to test-bed and production-key onboarding. | eParcel/StarTrack contract eligibility and third-party display scope remain unconfirmed. |
| Royal Mail | [Royal Mail API Developer Portal](https://developer.royalmail.net/api) | Official API portal lists business APIs and says an API account is needed; Tracking API V3 is described for account customers. | Account/client approval and third-party display rights remain unconfirmed. |
| Correos | [API integration](https://www.correos.es/es/en/companies/e-commerce/reinforce-your-ecommerce-logistics/api-integration) | Official Correos business page describes API integration for high-volume e-commerce logistics. | Page states a transport contract is required; ExportFlow has no such contract. |
| La Poste / Colissimo | [Okapi — Suivi API](https://developer.laposte.fr/catalog-apis/suivi%402) | Official La Poste Group API catalogue identifies real-time tracking for tracked letters, Colissimo and Chronopost. | Offer eligibility, quotas, authentication and third-party terms require contract review. |
| Japan Post | [Japan Post — Track & Trace](https://www.post.japanpost.jp/index_en.html) | Corporate domain and official public Track & Trace destination confirmed. | This page is not an API contract; the separate XML tracking integration research and present terms still need manual confirmation. |

## How the records are represented

The corresponding D1 carrier_evidence rows are updated by migration 0005_carrier_official_source_research.sql with the source URL and a dated research note. Each remains:

- evidence_status = research
- verification_method = none
- verified_at = NULL
- verification_evidence_url = NULL
- authorization_evidence_url = NULL

No carrier is promoted to Verified. The current Verified gate requires live test evidence and independent authorization evidence; an official website, official developer portal, public tracker, API specification, or open-source adapter cannot satisfy that gate by itself.

## Full-catalog rule

The 1,338 display entries receive a per-record upstream source-manifest and Apache-2.0 attribution entry in the separate licensing ledger. This audit is intentionally not represented as 1,338 official carrier validations. The remaining records must be checked individually against the relevant carrier or national postal operator's own website, developer documentation, terms, and rights statements before adding an official-source label or changing any carrier evidence status. Upstream manifest URLs remain discovery leads, not official proof.
