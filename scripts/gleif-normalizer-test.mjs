import assert from "node:assert/strict";
import {
  GLEIF_ALLOWED_CATEGORIES,
  normalizeGleifRecord
} from "../functions/lib/gleif-normalizer.mjs";

const validRecord = {
  type: "lei-records",
  id: "636700STJZG4U8W2I596",
  attributes: {
    lei: "636700STJZG4U8W2I596",
    entity: {
      legalName: { name: "Kommstart 174 AB (publ)", language: "sv" },
      legalAddress: {
        addressLines: ["Example Street 1"],
        city: "Stockholm",
        country: "SE",
        postalCode: "111 22"
      },
      headquartersAddress: {
        addressLines: ["Example HQ Street 2"],
        city: "Stockholm",
        country: "SE"
      },
      jurisdiction: "SE",
      category: "GENERAL",
      legalForm: { id: "AB", other: null },
      registeredAs: "556000-0000",
      registeredAt: { id: "RA000123", other: null },
      status: "ACTIVE"
    },
    registration: {
      initialRegistrationDate: "2020-01-02T10:00:00Z",
      lastUpdateDate: "2026-10-20T12:00:00Z",
      nextRenewalDate: "2027-01-02T10:00:00Z",
      status: "ISSUED",
      managingLou: "5493001KJTIIGC8Y1R12",
      validationSources: "FULLY_CORROBORATED"
    },
    bic: "EXAMPLESE",
    mic: null
  }
};

const result = normalizeGleifRecord(validRecord);
assert.equal(result.eligible, true);
assert.equal(result.entity.entity_id, "global:lei:636700STJZG4U8W2I596");
assert.equal(result.entity.lei, "636700STJZG4U8W2I596");
assert.equal(result.entity.legal_name, "Kommstart 174 AB (publ)");
assert.equal(result.entity.normalized_name, "kommstart 174 ab (publ)");
assert.equal(result.entity.jurisdiction, "SE");
assert.equal(result.entity.country_code, "SE");
assert.equal(result.entity.legal_form, "AB");
assert.equal(result.entity.entity_status, "ACTIVE:ISSUED");
assert.equal(result.entity.source_updated_at, "2026-10-20T12:00:00Z");
assert.equal(result.entity.registered_address, null);
assert.equal(result.entity.postal_code, null);
assert.equal(result.sourceRecord.registration.validationSources, "FULLY_CORROBORATED");
assert.equal("registeredAs" in result.sourceRecord, false);
assert.equal("legalAddress" in result.sourceRecord, false);
assert.equal("headquartersAddress" in result.sourceRecord, false);
assert.equal("bic" in result.sourceRecord, false);
assert.equal("mic" in result.sourceRecord, false);

for (const category of ["BRANCH", "FUND", "SOLE_PROPRIETOR"]) {
  assert.equal(
    normalizeGleifRecord({
      ...validRecord,
      attributes: {
        ...validRecord.attributes,
        entity: { ...validRecord.attributes.entity, category }
      }
    }).reason,
    "excluded_entity_category",
    category
  );
}

assert.equal(GLEIF_ALLOWED_CATEGORIES.includes("GENERAL"), true);
assert.equal(normalizeGleifRecord({
  ...validRecord,
  attributes: {
    ...validRecord.attributes,
    entity: { ...validRecord.attributes.entity, category: "UNREVIEWED_TYPE" }
  }
}).reason, "unknown_entity_category");

assert.equal(normalizeGleifRecord({
  ...validRecord,
  attributes: {
    ...validRecord.attributes,
    entity: { ...validRecord.attributes.entity, status: "INACTIVE" }
  }
}).reason, "entity_not_active");

assert.equal(normalizeGleifRecord({
  ...validRecord,
  attributes: {
    ...validRecord.attributes,
    registration: { ...validRecord.attributes.registration, status: "LAPSED" }
  }
}).reason, "registration_not_issued");

assert.equal(normalizeGleifRecord({
  ...validRecord,
  attributes: { ...validRecord.attributes, lei: "636700STJZG4U8W2I597" }
}).reason, "invalid_lei_or_check_digit");

assert.equal(normalizeGleifRecord({
  ...validRecord,
  attributes: {
    ...validRecord.attributes,
    entity: {
      ...validRecord.attributes.entity,
      legalAddress: { ...validRecord.attributes.entity.legalAddress, country: "SWE" }
    }
  }
}).reason, "invalid_or_missing_country");

assert.equal(normalizeGleifRecord({
  ...validRecord,
  attributes: {
    ...validRecord.attributes,
    entity: { ...validRecord.attributes.entity, legalName: { name: " " } }
  }
}).reason, "missing_legal_name");

assert.equal(normalizeGleifRecord({
  ...validRecord,
  attributes: {
    ...validRecord.attributes,
    entity: { ...validRecord.attributes.entity, category: null }
  }
}).reason, "missing_entity_category");
assert.equal(normalizeGleifRecord(null).reason, "invalid_record");
assert.equal(normalizeGleifRecord({ data: {} }).reason, "missing_attributes");

console.log("GLEIF normalizer tests passed: ISO 17442 checksum, country/name validation, legal-entity allowlist, active/issued status, and address/person-data exclusion.");
