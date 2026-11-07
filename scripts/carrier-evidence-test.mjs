import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/carriers.js";

const rows = [
  {
    provider_id: "dhl-express",
    display_name: "DHL Express",
    country_scope: "Global",
    integration_method: "official_api",
    adapter_state: "present",
    adapter_ids_json: JSON.stringify(["dhl-express"]),
    commercial_access_status: "written_permission_required",
    tracking_rights_status: "third_party_permission_required",
    official_source_url: "https://developer.dhl.com/api-reference/dhl-express-mydhl-api",
    public_disclosure: "MyDHL account scope and third-party display permission must be confirmed.",
    evidence_status: "research",
    verification_method: "none",
    verified_at: null,
    verification_evidence_url: null,
    authorization_evidence_url: null,
    research_notes: "INTERNAL NOTE MUST NOT BE RETURNED"
  },
  {
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
  },
  {
    provider_id: "postnl",
    display_name: "PostNL",
    country_scope: "Netherlands",
    integration_method: "official_api",
    adapter_state: "missing",
    adapter_ids_json: "[]",
    commercial_access_status: "customer_code_scoped",
    tracking_rights_status: "own_shipments_scope",
    official_source_url: "https://developer.postnl.nl/integration-with-postnl/use-cases/track-and-trace/",
    public_disclosure: "Shipment status is scoped to the merchant's own customer codes and parcels.",
    evidence_status: "research",
    verification_method: "none",
    verified_at: null,
    verification_evidence_url: null,
    authorization_evidence_url: null
  }
];

function fakeDb({ results = rows, error = null } = {}) {
  return {
    prepared: [],
    prepare(sql) {
      this.prepared.push(sql);
      return {
        async all() {
          if (error) throw error;
          return { results };
        }
      };
    }
  };
}

const db = fakeDb();
const response = await onRequestGet({ env: { MERCHANT_DB: db } });
assert.equal(response.status, 200);
assert.match(response.headers.get("Cache-Control") || "", /max-age=3600/);
const payload = await response.json();

assert.equal(payload.evidenceRegistryAvailable, true);
assert.equal(payload.evidenceRegistry.length, 3);
assert.deepEqual(payload.evidenceRegistryCounts, {
  researched: 3,
  testing: 0,
  integrated: 0,
  verified: 0,
  blocked: 0,
  withoutAdapter: 1
});

const dhl = payload.carrierRecords.find(record => record.tracking.adapter === "dhl-express");
assert.ok(dhl, "Pinned upstream catalog must expose the DHL Express adapter record");
assert.equal(dhl.evidence.level, "research");
assert.equal(dhl.evidence.commercialAccess, "written_permission_required");
assert.equal(dhl.evidence.trackingRights, "third_party_permission_required");
assert.equal(dhl.evidence.verification.liveVerified, false);
assert.equal(dhl.evidence.verification.method, "none");
assert.equal(dhl.evidence.sourceUrl, rows[0].official_source_url);

const ups = payload.carrierRecords.find(record => record.tracking.adapter === "ups");
assert.ok(ups, "Pinned upstream catalog must expose the UPS adapter record");
assert.equal(ups.evidence.level, "research");
assert.equal(ups.evidence.verification.liveVerified, false);

const unintegrated = payload.evidenceRegistry.find(record => record.id === "postnl");
assert.equal(unintegrated.adapterState, "missing");
assert.deepEqual(unintegrated.adapterIds, []);
assert.equal(unintegrated.evidenceLevel, "research");

const json = JSON.stringify(payload);
assert.equal(json.includes("research_notes"), false);
assert.equal(json.includes("INTERNAL NOTE MUST NOT BE RETURNED"), false);
assert.equal(json.includes("authorization_evidence_url"), false);
assert.match(payload.metadataNotice, /authorization/);

// A broken or not-yet-applied Preview D1 migration falls back to catalog-only
// evidence; it never makes an adapter appear verified.
const noDbResponse = await onRequestGet({});
const noDb = await noDbResponse.json();
assert.equal(noDb.evidenceRegistryAvailable, false);
assert.deepEqual(noDb.evidenceRegistry, []);
assert.equal(noDb.evidenceRegistryCounts.verified, 0);
const catalogOnly = noDb.carrierRecords.find(record => record.tracking.adapter === "dhl-express");
assert.ok(catalogOnly);
assert.equal(catalogOnly.evidence.level, "catalogued");
assert.equal(catalogOnly.evidence.verification.liveVerified, false);

const unavailableResponse = await onRequestGet({ env: { MERCHANT_DB: fakeDb({ error: new Error("migration missing") }) } });
const unavailable = await unavailableResponse.json();
assert.equal(unavailable.evidenceRegistryAvailable, false);
assert.equal(unavailable.evidenceRegistryCounts.verified, 0);

// Invalid, status-only "verified" rows are downgraded by the public projection.
// D1 constraints and triggers are the primary guard; the API provides defense in depth.
const forgedVerified = {
  ...rows[0],
  evidence_status: "verified",
  verification_method: "mock",
  verified_at: null,
  verification_evidence_url: null,
  authorization_evidence_url: null,
  commercial_access_status: "authorized_service_provider",
  tracking_rights_status: "third_party_authorized"
};
const forgedResponse = await onRequestGet({ env: { MERCHANT_DB: fakeDb({ results: [forgedVerified] }) } });
const forged = await forgedResponse.json();
assert.equal(forged.evidenceRegistry[0].evidenceLevel, "research");
assert.equal(forged.evidenceRegistry[0].verification.liveVerified, false);
assert.equal(forged.evidenceRegistry[0].verification.authorizationConfirmed, false);

const properlyVerified = {
  ...rows[0],
  evidence_status: "verified",
  verification_method: "live",
  verified_at: "2026-11-07T10:00:00Z",
  verification_evidence_url: "https://example.test/redacted-live-test-evidence",
  authorization_evidence_url: "https://example.test/redacted-authorization-reference",
  commercial_access_status: "authorized_service_provider",
  tracking_rights_status: "third_party_authorized"
};
const verifiedResponse = await onRequestGet({ env: { MERCHANT_DB: fakeDb({ results: [properlyVerified] }) } });
const verified = await verifiedResponse.json();
assert.equal(verified.evidenceRegistryCounts.verified, 1);
assert.equal(verified.evidenceRegistry[0].evidenceLevel, "verified");
assert.equal(verified.evidenceRegistry[0].verification.liveVerified, true);
assert.equal(verified.evidenceRegistry[0].verification.authorizationConfirmed, true);
assert.equal(verified.evidenceRegistry[0].verification.evidenceUrl, properlyVerified.verification_evidence_url);

console.log("Carrier evidence registry API tests passed: catalog, research, no-adapter, unavailable-DB and verified-evidence guards.");
