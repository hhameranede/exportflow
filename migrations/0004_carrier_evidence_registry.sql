-- Evidence-backed carrier registry for Global Logistics Intelligence.
-- All seed records deliberately remain at "research": adapter code and official API docs
-- do not prove live success, account authorization or third-party display rights.
CREATE TABLE IF NOT EXISTS carrier_evidence (
  provider_id TEXT PRIMARY KEY CHECK (length(provider_id) BETWEEN 2 AND 80),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 120),
  country_scope TEXT NOT NULL CHECK (length(country_scope) <= 240),
  integration_method TEXT NOT NULL CHECK (integration_method IN ('official_api', 'tracking_page', 'aggregator', 'manual')),
  adapter_state TEXT NOT NULL CHECK (adapter_state IN ('present', 'country_specific', 'missing')),
  adapter_ids_json TEXT NOT NULL CHECK (json_valid(adapter_ids_json)),
  commercial_access_status TEXT NOT NULL CHECK (commercial_access_status IN (
    'not_assessed', 'contracted_account_required', 'partner_onboarding_required',
    'written_permission_required', 'country_specific_approval_required',
    'account_and_eula_required', 'third_party_service_unverified',
    'api_offer_access_unconfirmed', 'customer_code_scoped',
    'business_account_onboarding_required', 'developer_onboarding_required',
    'third_party_provider_approval_required', 'merchant_account_scoped',
    'public_tracker_unverified', 'authorized_service_provider'
  )),
  tracking_rights_status TEXT NOT NULL CHECK (tracking_rights_status IN (
    'not_assessed', 'own_shipments_scope', 'third_party_permission_required', 'third_party_authorized'
  )),
  official_source_url TEXT NOT NULL CHECK (official_source_url LIKE 'https://%'),
  public_disclosure TEXT NOT NULL CHECK (length(public_disclosure) BETWEEN 20 AND 420),
  research_notes TEXT NOT NULL CHECK (length(research_notes) BETWEEN 20 AND 1400),
  upstream_source_commit TEXT NOT NULL,
  evidence_status TEXT NOT NULL DEFAULT 'research' CHECK (evidence_status IN (
    'research', 'testing', 'integrated', 'verified', 'blocked', 'deprecated'
  )),
  verification_method TEXT NOT NULL DEFAULT 'none' CHECK (verification_method IN ('none', 'mock', 'sandbox', 'live')),
  verified_at TEXT,
  verification_evidence_url TEXT,
  authorization_evidence_url TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (evidence_status != 'verified' OR (
    verification_method = 'live' AND verified_at IS NOT NULL
    AND verification_evidence_url LIKE 'https://%'
    AND tracking_rights_status = 'third_party_authorized'
    AND commercial_access_status = 'authorized_service_provider'
    AND authorization_evidence_url LIKE 'https://%'
  )),
  CHECK (verification_method NOT IN ('sandbox', 'live') OR verification_evidence_url LIKE 'https://%')
);

CREATE INDEX IF NOT EXISTS idx_carrier_evidence_status
  ON carrier_evidence (evidence_status, display_name);
CREATE INDEX IF NOT EXISTS idx_carrier_evidence_adapter_state
  ON carrier_evidence (adapter_state, display_name);

INSERT OR IGNORE INTO carrier_evidence (
  provider_id, display_name, country_scope, integration_method, adapter_state,
  adapter_ids_json, commercial_access_status, tracking_rights_status,
  official_source_url, public_disclosure, research_notes, upstream_source_commit,
  evidence_status, verification_method, verified_at, verification_evidence_url,
  authorization_evidence_url
) VALUES
('aramex','Aramex','Middle East, Africa, Asia and international network','official_api','present','["aramex","aramex-au","aramex-nz"]','not_assessed','not_assessed','https://www.aramex.com/dz/en/developers-solution-center/aramex-apis','Official tracking API documentation exists. ExportFlow account eligibility, credentials and third-party display rights have not been confirmed.','Official Developer Solution Center lists a Shipment Tracking API with shipment status updates. Production onboarding, authentication and intended service-provider use remain to be confirmed.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('australia-post','Australia Post','Australia and international services','official_api','present','["australia-post"]','contracted_account_required','not_assessed','https://developers.auspost.com.au/apis','Shipping and Tracking API access is tied to eParcel or StarTrack customer contracts; no ExportFlow customer authorization is recorded.','Official API catalogue lists Shipping and Tracking APIs, with customer testbed and production registration. Contract scope and rights for a multi-merchant tracking service must be confirmed.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('cainiao','Cainiao','Cross-border e-commerce logistics and last-mile partner network','official_api','missing','[]','partner_onboarding_required','not_assessed','https://open.gfn.cainiao.com/apiInfo/introduce','Official platform offers logistics APIs, but ExportFlow has no standalone Cainiao adapter or approved application.','Cainiao Global Fulfilment Open Platform documents tracking/logistics APIs and onboarding for merchants and software service providers. Public country/provider counts describe Cainiao''s own network, not ExportFlow integrations.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('canada-post','Canada Post','Canada','official_api','present','["canada-post"]','contracted_account_required','not_assessed','https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/services/tracking/default.jsf?LOCALE=en','Tracking Web Service requires developer/API credentials and an authorized customer account; third-party display scope is unconfirmed.','Official Tracking Web Service exposes summary/detail tracking. API keys, customer authorization and supported reference types apply; no ExportFlow test credentials or authorized live sample exist.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('china-post','China Post','China origin; domestic and international postal items and EMS handoff','tracking_page','present','["china-post"]','public_tracker_unverified','not_assessed','https://www.ems.com.cn/mailtracking/you_jian_cha_xun.html','The adapter uses an EMS/public-tracker route for a limited scope; it is not evidence of an official China Post API or commercial reuse rights.','No official open developer API was established in the research record. Pinned adapter documentation excludes some domestic waybill types and uses the EMS tracking workflow; terms and data provenance need legal review.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('correos','Correos','Spain; domestic and international parcels','official_api','missing','[]','partner_onboarding_required','not_assessed','https://www.correos.es/es/en/companies/e-commerce/reinforce-your-ecommerce-logistics/api-integration','Official business API documentation exists, but no matching standalone adapter was found in the pinned engine.','Correos documents high-volume customer API integration using Correos ID, Developer Portal, OAuth 2.0 and Trackpub traceability. Eligibility for a third-party tracking platform must be confirmed.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('dhl-express','DHL Express','Global','official_api','present','["dhl-express"]','written_permission_required','third_party_permission_required','https://developer.dhl.com/api-reference/dhl-express-mydhl-api','MyDHL terms limit use to the account holder''s shipments; third-party sharing requires prior written consent. Do not enable public third-party tracking without a compliant agreement.','MyDHL API requires an active DHL Express account and limits usage to that account''s shipments. DHL Shipment Tracking Unified API has explicit confidentiality, attribution, retention and consent conditions. The existing scraper adapter is not an ExportFlow partnership or authorization.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('dpd-geopost','DPD / Geopost','Europe; country-specific network and APIs','official_api','country_specific','["dpd","dpd-de","dpd-fr","dpd-pl"]','country_specific_approval_required','not_assessed','https://developer.dpdgroup.com/','The upstream dpd slug refers to a country-specific service (including Switzerland); other national networks use separate adapters. Do not infer network-wide coverage.','Official Geopost portal lists API products; exact country access and commercial use differ by national company. Pinned engine contains distinct DPD country adapters; a generic global DPD integration is not established.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('emirates-post','Emirates Post','United Arab Emirates and international postal/courier services','official_api','present','["emirates-post"]','partner_onboarding_required','not_assessed','https://www.emiratespost.ae/all-services/integration-solutions','Official integration onboarding requires a contract and successful testing. Existing adapter uses public tracking/browser capture, not the partner API.','Official integration documentation lists Track Shipments and CrossBorder tracking. Production onboarding requires contract completion, tests and supplied credentials; no ExportFlow partner agreement is present.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('fedex','FedEx','Global','official_api','present','["fedex"]','account_and_eula_required','third_party_permission_required','https://developer.fedex.com/api/en-us/catalog/track.html','Track API registration links a FedEx account and terms/EULA apply; third-party service-provider rights and customer authorization are not established.','Basic Integrated Visibility supports Express, Ground, Ground Economy and Freight. Portal registration links a shipper account; relevant license and EULA terms apply. Public website tracking terms do not authorize arbitrary third-party tracking.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('gls','GLS','Europe; country-specific APIs','official_api','country_specific','["gls-de","gls-fr","gls-pl"]','country_specific_approval_required','not_assessed','https://dev-portal.gls-group.net/get-started','GLS tracking adapters and APIs are country-specific; approvals and account rights vary by national entity.','Official developer portal distinguishes public and restricted APIs. GLS Poland Track&Trace is tied to customer WebAPI/YourGLS rights. The pinned engine has country-specific adapters, not one global GLS integration.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('india-post','India Post','India; domestic Speed Post, EMS and registered mail','tracking_page','present','["india-post"]','third_party_service_unverified','not_assessed','https://services.india.gov.in/service/detail/track-status-of-mails-send-through-indian-postal-servcies','The pinned adapter uses a third-party tracking service, not the official India Post tracking site/API. Production use is blocked pending rights and provenance review.','Government portal confirms public consignment tracking, but no current open developer API was confirmed. Upstream adapter relies on MySpeedPost, a third-party tracker; source rights and data handling remain unverified.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('japan-post','Japan Post','Japan and international postal services','official_api','present','["japan-post"]','not_assessed','not_assessed','https://www.post.japanpost.jp/notification/productinformation/2026/0128_01_01.pdf','Official service notices indicate tracking integrations exist, but current API eligibility, technical guide and permitted third-party scope need confirmation.','Japan Post''s 2026 service notice lists XML history-query integration and a corporate Tracking Web Service API. Application eligibility and current operational terms require confirmation.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('la-poste','La Poste / Colissimo','France; Colissimo and selected international postal services','official_api','present','["la-poste"]','api_offer_access_unconfirmed','not_assessed','https://developer.laposte.fr/catalog-apis','The official API hub lists Tracking API products, but the pinned adapter uses a public tracking feed rather than the documented credentialed API.','La Poste Okapi lists Colissimo and Tracking APIs for mail, parcels and Chronopost. Current offers, quotas, access eligibility and third-party terms must be confirmed before a separate official API adapter is built.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('postnl','PostNL','Netherlands and international services','official_api','missing','[]','customer_code_scoped','own_shipments_scope','https://developer.postnl.nl/integration-with-postnl/use-cases/track-and-trace/','ShippingStatus is scoped to the customer''s own customer codes and parcels; no generic PostNL adapter exists in the pinned engine.','Official ShippingStatus provides current/full events and updated shipments. Security policy limits status disclosure to the company''s own customer codes and parcels. A merchant-authorized connection is required.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('royal-mail','Royal Mail','United Kingdom and international services','official_api','present','["royal-mail"]','business_account_onboarding_required','not_assessed','https://developer.royalmail.net/api','Tracking API V3 is available to account customers; onboarding and application credentials are required. ExportFlow access and third-party display rights are unconfirmed.','Official API catalogue lists Tracking API V3 with shipment state and history. Onboarding involves an account manager and application client credentials; no ExportFlow integration test exists.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('sf-express','SF Express','China and international services','official_api','present','["sf-express"]','developer_onboarding_required','not_assessed','https://open.sf-express.com/','Official Open Platform and sandbox exist, but exact tracking endpoints, overseas coverage and third-party display permission remain unconfirmed.','SF Express Open Platform provides developer onboarding and sandbox facilities. Exact tracking endpoints and authorized third-party data use have not been confirmed.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('singapore-post','Singapore Post (SingPost)','Singapore; domestic mail, Speedpost and international postal items','tracking_page','present','["singapore-post"]','public_tracker_unverified','not_assessed','https://www.singpost.com/track-items','The upstream adapter calls a public tracking-site endpoint; no API license or permission for third-party commercial reuse is established.','Official tracking page supports selected mail and parcel products. No public developer tracking API was identified in the research record; anonymous endpoint reuse needs terms review.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('ups','UPS','Global','official_api','present','["ups"]','written_permission_required','third_party_permission_required','https://developer.ups.com/tag/Tracking?loc=en_US','UPS OAuth scope follows associated shipper accounts. Written consent or a service-provider agreement is required before third-party website display or distribution.','Official TrackService returns status/activity/ETA, but OAuth is tied to associated shipper accounts. Website terms restrict own/on-behalf tracking and require express written consent for third-party display or commercial distribution.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('usps','USPS','United States','official_api','present','["usps"]','third_party_provider_approval_required','not_assessed','https://developers.usps.com/','2026 provider-access rules may require paid access, an IP agreement and authorization for each Mailer ID. ExportFlow''s eligibility is unconfirmed.','Official developer portal offers Tracking API and Webhook with OAuth 2.0. Third-party provider access may require commercial approval and authorization for each Mailer ID.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('yanwen','Yanwen','China origin; cross-border e-commerce and destination last-mile partners','official_api','present','["yanwen"]','merchant_account_scoped','own_shipments_scope','https://opendocs.yw56.com.cn/webfile/7128663508291424256/','Official API uses a merchant number or shipment-creating account. The published endpoint requires an HTTPS transport check before implementation.','Yanwen Open Platform describes tracking for Yanwen and last-mile numbers, with authorization scoped to merchant number or shipment creator. Confirm HTTPS endpoint and third-party rights before use.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL),
('yunexpress','YunExpress','China origin; international e-commerce fulfillment and last-mile partners','tracking_page','present','["yunexpress"]','public_tracker_unverified','not_assessed','https://www.yuntrack.com/','The upstream adapter captures the public Yuntrack workflow; anti-bot protections and interactive verification can block automated requests. No developer API or commercial data-use permission is confirmed.','Official Yuntrack page supports public tracking, but no public developer API was found in the research record. Browser capture can be challenged by site protections; terms and partner API access require review.','e64a466772ef25ce68e02d9c7c9f1613eec1208b','research','none',NULL,NULL,NULL);

-- Status promotion to Verified must be backed by a repeatable live result and an
-- explicit authorization reference. Prevent a careless status-only update.
CREATE TRIGGER IF NOT EXISTS carrier_evidence_verified_guard
BEFORE UPDATE OF evidence_status ON carrier_evidence
WHEN NEW.evidence_status = 'verified' AND (
  NEW.verification_method != 'live' OR
  NEW.verified_at IS NULL OR
  NEW.verification_evidence_url IS NULL OR
  NEW.authorization_evidence_url IS NULL OR
  NEW.tracking_rights_status != 'third_party_authorized' OR
  NEW.commercial_access_status != 'authorized_service_provider'
)
BEGIN
  SELECT RAISE(ABORT, 'verified carrier requires live test and authorization evidence');
END;
