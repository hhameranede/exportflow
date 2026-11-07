import assert from "node:assert/strict";
import { CARRIER_IDS } from "universal-parcel-scraper";
import { onRequestGet } from "../functions/api/carrier-directory.js";

function request(params = {}) {
  const url = new URL("https://exportflow.me/api/carrier-directory");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return new Request(url);
}

function fakeDb(rows) {
  return {
    prepare(sql) {
      assert.match(sql, /FROM carrier_evidence/);
      return { async all() { return { results: rows }; } };
    }
  };
}

const base = await onRequestGet({ request: request() });
assert.equal(base.status, 200);
assert.match(base.headers.get("Content-Type") || "", /application\/json/);
assert.match(base.headers.get("X-Robots-Tag") || "", /noindex/);
assert.match(base.headers.get("Cache-Control") || "", /max-age=300/);
const first = await base.json();

assert.equal(CARRIER_IDS.length, 1339, "Pinned Universal Parcel Scraper revision must retain its 1,339 catalog entries.");
assert.equal(first.summary.catalogEntries, 1339);
assert.equal(first.summary.catalogRecordObjects, 1339);
assert.ok(first.summary.selectableRecords > 1_000);
assert.ok(first.summary.dedicatedAdapterRecords >= 600);
assert.equal(first.upstreamSnapshot.catalogEntries, 1339);
assert.equal(first.upstreamSnapshot.dedicatedAdapters, 732);
assert.equal(first.upstreamSnapshot.universalFallbacks, 5);
assert.equal(first.upstreamSnapshot.countriesRepresented, 156);
assert.equal(first.upstreamSnapshot.carrierNetworkClaim, "3500+");
assert.match(first.upstreamSnapshot.note, /not a count of independent legal entities/);
assert.equal(first.pagination.page, 1);
assert.equal(first.pagination.pageSize, 50);
assert.equal(first.records.length, 50);
assert.ok(first.pagination.totalMatches >= 1_000);
assert.ok(first.records.every(record => record.evidence.level === "catalogued"));
assert.ok(first.records.every(record => typeof record.id === "string" && typeof record.name === "string"));
assert.ok(first.records.every(record => Array.isArray(record.aliases) && Array.isArray(record.countries)));
assert.ok(first.records.every(record => ["dedicated", "universal-fallback", "link-only", "none"].includes(record.adapterType)));
assert.ok(first.records.every(record => record.evidence.verification.liveVerified === false));
assert.ok(first.records.every(record => record.isCatalogEntry === true));
assert.equal(first.summary.totalDirectoryRecords, 1339);

// Paging is stable, bounded, and does not repeat carrier identifiers.
const secondResponse = await onRequestGet({ request: request({ page: 2, pageSize: 50 }) });
const second = await secondResponse.json();
assert.equal(second.pagination.page, 2);
assert.equal(second.records.length, 50);
const firstIds = new Set(first.records.map(record => record.id));
assert.equal(second.records.some(record => firstIds.has(record.id)), false);

// The page size is capped at 100 to keep responses bounded.
const capped = await (await onRequestGet({ request: request({ pageSize: 9999 }) })).json();
assert.equal(capped.pagination.pageSize, 100);
assert.equal(capped.records.length, 100);

// Search resolves names, aliases and ISO country codes through the same catalogue.
const upsResponse = await onRequestGet({ request: request({ q: "UPS", pageSize: 100 }) });
const upsSearch = await upsResponse.json();
assert.ok(upsSearch.records.some(record => record.id === "ups" || record.name.toLowerCase().includes("ups") || record.aliases.some(alias => alias.toLowerCase().includes("ups"))));

const chinaResponse = await onRequestGet({ request: request({ country: "CN", pageSize: 100 }) });
const china = await chinaResponse.json();
assert.ok(china.records.length > 0);
assert.ok(china.records.every(record => record.countries.includes("CN")));

const dedicatedResponse = await onRequestGet({ request: request({ adapter: "dedicated", pageSize: 100 }) });
const dedicated = await dedicatedResponse.json();
assert.ok(dedicated.records.length > 0);
assert.ok(dedicated.records.every(record => record.adapterType === "dedicated"));

const fallbackResponse = await onRequestGet({ request: request({ adapter: "universal-fallback" }) });
const fallback = await fallbackResponse.json();
assert.ok(fallback.records.length > 0);
assert.ok(fallback.records.every(record => record.adapterType === "universal-fallback"));

const cataloguedOnlyResponse = await onRequestGet({ request: request({ evidence: "catalogued" }) });
const cataloguedOnly = await cataloguedOnlyResponse.json();
assert.equal(cataloguedOnly.pagination.totalMatches, 1339);

// D1 remains the curated evidence overlay; it does not replace the 1,339-entry source catalog.
const evidenceRows = [{
  provider_id: "ups",
  display_name: "UPS",
  country_scope: "Global",
  integration_method: "official_api",
  adapter_state: "present",
  adapter_ids_json: JSON.stringify(["ups"]),
  commercial_access_status: "written_permission_required",
  tracking_rights_status: "third_party_permission_required",
  official_source_url: "https://developer.ups.com/tag/Tracking?loc=en_US",
  public_disclosure: "Written consent is required for third-party display and commercial distribution.",
  evidence_status: "research",
  verification_method: "none",
  verified_at: null,
  verification_evidence_url: null,
  authorization_evidence_url: null
}];
const withEvidence = await (await onRequestGet({
  request: request({ q: "UPS" }),
  env: { MERCHANT_DB: fakeDb(evidenceRows) }
})).json();
const ups = withEvidence.records.find(record => record.id === "ups");
assert.ok(ups);
assert.equal(ups.evidence.level, "research");
assert.equal(ups.evidence.commercialAccess, "written_permission_required");
assert.equal(ups.evidence.trackingRights, "third_party_permission_required");
assert.equal(ups.evidence.verification.liveVerified, false);


const standaloneResearch = await (await onRequestGet({
  request: request({ q: "Cainiao" }),
  env: { MERCHANT_DB: fakeDb([{
    provider_id: "cainiao",
    display_name: "Cainiao",
    country_scope: "Global cross-border e-commerce network",
    integration_method: "official_api",
    adapter_state: "missing",
    adapter_ids_json: "[]",
    commercial_access_status: "partner_onboarding_required",
    tracking_rights_status: "not_assessed",
    official_source_url: "https://open.gfn.cainiao.com/apiInfo/introduce",
    public_disclosure: "Official logistics APIs exist, but ExportFlow has no standalone adapter or approved application.",
    evidence_status: "research",
    verification_method: "none",
    verified_at: null,
    verification_evidence_url: null,
    authorization_evidence_url: null
  }]) }
})).json();
const cainiaoDossier = standaloneResearch.records.find(record => record.id === "cainiao");
assert.ok(cainiaoDossier, "A researched provider without a catalog adapter must remain discoverable.");
assert.equal(cainiaoDossier.isCatalogEntry, false);
assert.equal(cainiaoDossier.adapterType, "none");
assert.equal(cainiaoDossier.evidence.level, "research");
assert.equal(cainiaoDossier.countryScope, "Global cross-border e-commerce network");

const unavailable = await (await onRequestGet({
  request: request({ q: "UPS" }),
  env: { MERCHANT_DB: { prepare() { throw new Error("D1 unavailable"); } } }
})).json();
assert.equal(unavailable.summary.evidenceRegistryAvailable, false);
assert.ok(unavailable.records.every(record => record.evidence.level === "catalogued"));

// Invalid query constraints are rejected rather than silently widening a query.
assert.equal((await onRequestGet({ request: request({ country: "USA" }) })).status, 400);
assert.equal((await onRequestGet({ request: request({ evidence: "unverified" }) })).status, 400);
assert.equal((await onRequestGet({ request: request({ adapter: "browser-scrape" }) })).status, 400);

console.log("Carrier directory tests passed: 1,339 catalog entries, 50-record pages, filters, search, and D1 evidence overlay.");
