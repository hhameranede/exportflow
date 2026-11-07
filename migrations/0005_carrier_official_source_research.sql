-- Official carrier-owned source checks for a small, evidence-backed first batch.
-- These updates document primary source discovery only. They deliberately retain Research
-- and do not grant ExportFlow API access, trademark rights, shipment-data rights or partnership.
-- Reviewed on 2026-11-07. Keep all authorizations and live verification NULL until separately proven.

UPDATE carrier_evidence
SET official_source_url = 'https://developer.ups.com/tag/Tracking?loc=en_US',
    public_disclosure = 'Official UPS developer portal and Track API category identified. Account association and written-consent requirements remain; ExportFlow is not authorized to display third-party shipment data.',
    research_notes = '2026-11-07 source check: the UPS-owned developer.ups.com portal and Tracking API category were returned by official-domain search. The page is a source for UPS API documentation, not an ExportFlow credential grant. The existing research record notes OAuth tied to associated shipper accounts and written consent for third-party display/distribution. No ExportFlow API authorization, contract, live test or data-display permission is recorded.',
    evidence_status = 'research',
    verification_method = 'none',
    verified_at = NULL,
    verification_evidence_url = NULL,
    authorization_evidence_url = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = 'ups';

UPDATE carrier_evidence
SET official_source_url = 'https://developer.fedex.com/',
    public_disclosure = 'The official FedEx Developer Portal was identified. The tracking API documentation page was not retrievable during this check; account/EULA and third-party service-provider rights remain unconfirmed.',
    research_notes = '2026-11-07 source check: search results identify developer.fedex.com as the FedEx APIs and Developer Portal and link to FedEx Developer Resource Center guidance. Automated retrieval of the portal page failed, so the exact Track API contract and current onboarding clauses were not independently re-read in this pass. Existing research records account association and EULA requirements and third-party permission limits. No ExportFlow authorization, contract or live test is recorded.',
    evidence_status = 'research',
    verification_method = 'none',
    verified_at = NULL,
    verification_evidence_url = NULL,
    authorization_evidence_url = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = 'fedex';

UPDATE carrier_evidence
SET official_source_url = 'https://developer.dhl.com/tracking?language_content_entity=en',
    public_disclosure = 'DHL-owned Unified Shipment Tracking API documentation was retrieved. API documentation does not establish ExportFlow approval, service-provider access or permission to redistribute shipment data.',
    research_notes = '2026-11-07 live source check: the DHL Developer Portal page identifies Unified Shipment Tracking API v1.5.8, global scope and tracking across multiple DHL divisions and shipment types. API access routes through the DHL developer account/login. This validates the presence of official DHL tracking API documentation only; it does not grant credentials, third-party display rights, commercial authorization or a partnership. Existing MyDHL account-scope and written-consent restrictions remain applicable where relevant.',
    evidence_status = 'research',
    verification_method = 'none',
    verified_at = NULL,
    verification_evidence_url = NULL,
    authorization_evidence_url = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = 'dhl-express';

UPDATE carrier_evidence
SET official_source_url = 'https://www.aramex.com/ae/en/developers-solution-center/aramex-apis',
    public_disclosure = 'An Aramex-owned Developer Solution Center listing a Shipment Tracking API was identified. Page content was partially obscured by the consent layer; API onboarding and third-party rights still need direct review.',
    research_notes = '2026-11-07 source check: official-domain search result from aramex.com identifies a Shipment Tracking API under Aramex APIs. A live scrape reached the Aramex site but was largely occupied by the cookie-consent layer, so technical authentication and terms were not fully inspected. Treat this as official-source discovery, not permission to call the API or use shipment data for third parties. ExportFlow account eligibility and authorization remain unconfirmed.',
    evidence_status = 'research',
    verification_method = 'none',
    verified_at = NULL,
    verification_evidence_url = NULL,
    authorization_evidence_url = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = 'aramex';

UPDATE carrier_evidence
SET official_source_url = 'https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/services/tracking/default.jsf?LOCALE=en',
    public_disclosure = 'Canada Post Developer Program Tracking Web Service documentation was retrieved. Customer credentials and account eligibility apply; no ExportFlow authorization or third-party redistribution permission is recorded.',
    research_notes = '2026-11-07 live source check: Canada Post-owned Developer Program page identifies the Tracking Web Service and describes retrieval of parcel tracking events. The Developer Program service directory and API-key onboarding are linked from the official page. Customer/API credentials are required; the scope for an independent multi-merchant tracking service and downstream data display must be confirmed with Canada Post. No ExportFlow credentials, agreement or live test is recorded.',
    evidence_status = 'research',
    verification_method = 'none',
    verified_at = NULL,
    verification_evidence_url = NULL,
    authorization_evidence_url = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = 'canada-post';

UPDATE carrier_evidence
SET official_source_url = 'https://developers.auspost.com.au/apis/shipping-and-tracking/info/api-resources/tracking',
    public_disclosure = 'Australia Post-owned Shipping and Tracking API documentation for item tracking was retrieved. Testbed and production API-key onboarding are separate; contractual rights for ExportFlow remain unconfirmed.',
    research_notes = '2026-11-07 live source check: Australia Post Developers page documents Tracking an item under Shipping and Tracking and links to a test-bed environment and production API-key creation. The broader API catalogue identifies Shipping and Tracking. Existing research notes that eParcel/StarTrack customer contracts and onboarding apply. This is not proof of ExportFlow account eligibility or third-party data-display rights.',
    evidence_status = 'research',
    verification_method = 'none',
    verified_at = NULL,
    verification_evidence_url = NULL,
    authorization_evidence_url = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = 'australia-post';

UPDATE carrier_evidence
SET official_source_url = 'https://developer.royalmail.net/api',
    public_disclosure = 'Royal Mail-owned API Developer Portal lists business APIs and says an API account is needed. Tracking API V3 documentation is available to account customers; ExportFlow access is not established.',
    research_notes = '2026-11-07 live source check: Royal Mail API Developer Portal page lists APIs and says users must set up an API account before use. The Tracking API V3 official portal result describes track-and-trace information for account customers. This confirms official documentation and an account requirement, not a credential grant, partner status or right to redistribute third-party shipment data.',
    evidence_status = 'research',
    verification_method = 'none',
    verified_at = NULL,
    verification_evidence_url = NULL,
    authorization_evidence_url = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = 'royal-mail';

UPDATE carrier_evidence
SET official_source_url = 'https://www.correos.es/es/en/companies/e-commerce/reinforce-your-ecommerce-logistics/api-integration',
    public_disclosure = 'Correos-owned business API integration page was retrieved. It targets high-volume business customers and states a transport contract is needed; ExportFlow has no such contract.',
    research_notes = '2026-11-07 live source check: Correos official company page describes API integration for high-volume e-commerce logistics and access to its API catalogue through Correos ID. The page states a transport contract is required to integrate. No matching standalone adapter was found in the pinned carrier engine. This source does not grant API credentials or third-party shipment-data display rights to ExportFlow.',
    evidence_status = 'research',
    verification_method = 'none',
    verified_at = NULL,
    verification_evidence_url = NULL,
    authorization_evidence_url = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = 'correos';

UPDATE carrier_evidence
SET official_source_url = 'https://developer.laposte.fr/catalog-apis/suivi%402',
    public_disclosure = 'La Poste Group-owned Okapi API catalogue lists a Suivi tracking API for tracked letters, Colissimo parcels and Chronopost. Eligibility, credentials and third-party service-provider terms remain to be confirmed.',
    research_notes = '2026-11-07 source check: La Poste Group Okapi developer portal was retrieved and its official API catalogue search result identifies the Suivi API as real-time tracking for tracked letters, Colissimo parcels and Chronopost. The generic developer portal is official; API offer eligibility, quotas, authentication and commercial third-party display scope still require direct contract review. The existing upstream adapter is not proof that ExportFlow may use the credentialed API.',
    evidence_status = 'research',
    verification_method = 'none',
    verified_at = NULL,
    verification_evidence_url = NULL,
    authorization_evidence_url = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = 'la-poste';

UPDATE carrier_evidence
SET official_source_url = 'https://www.post.japanpost.jp/index_en.html',
    public_disclosure = 'Japan Post-owned website and Track & Trace service were identified. This check confirms the official public tracker, not a currently approved ExportFlow API integration or commercial use right.',
    research_notes = '2026-11-07 live source check: Japan Post corporate website identifies the official Track & Trace Service and links to the carrier-operated tracking service. The page fetched in this pass documents a public tracking destination, not an API contract. A separate 2026 Japan Post service notice in the existing research record references XML tracking integration; current application eligibility, endpoint documentation and third-party display permissions have not been independently confirmed. No ExportFlow authorization or live test is recorded.',
    evidence_status = 'research',
    verification_method = 'none',
    verified_at = NULL,
    verification_evidence_url = NULL,
    authorization_evidence_url = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = 'japan-post';
