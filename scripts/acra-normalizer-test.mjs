import assert from "node:assert/strict";
import { normalizeAcraRecord } from "../functions/lib/acra-normalizer.mjs";

const base = {
  uen: "201912345K",
  issuance_agency_desc: "ACRA",
  uen_status_desc: "Registered",
  entity_name: "  Example   Logistics Pte. Ltd. ",
  entity_type_desc: "Local Company",
  uen_issue_date: "2019-04-25",
  reg_street_name: "ROBINSON ROAD",
  reg_postal_code: "068877"
};

const company = normalizeAcraRecord(base);
assert.equal(company.eligible, true);
assert.equal(company.entity.entity_id, "sg:acra:201912345K");
assert.equal(company.entity.legal_name, "Example Logistics Pte. Ltd.");
assert.equal(company.entity.normalized_name, "example logistics pte. ltd.");
assert.equal(company.entity.country_code, "SG");
assert.equal(company.entity.jurisdiction, "SG");
assert.equal(company.entity.registry_identifier, "201912345K");
assert.equal(company.entity.entity_status, "registered");
assert.equal(company.entity.registered_address, null, "street name alone is not a complete street address");
assert.equal(company.sourceRecord.reg_street_name, "ROBINSON ROAD");
assert.equal("director_name" in company.sourceRecord, false);
assert.equal("email" in company.sourceRecord, false);
assert.equal("phone" in company.sourceRecord, false);

const llp = normalizeAcraRecord({
  ...base,
  uen: "T19LL1234A",
  entity_type_desc: "Limited Liability Partnership"
});
assert.equal(llp.eligible, true);
assert.equal(llp.entity.legal_form, "Limited Liability Partnership");

for (const type of [
  "Sole Proprietorship/ Partnership",
  "Foreign Company Branch",
  "Limited Partnership",
  "Unknown"
]) {
  const result = normalizeAcraRecord({ ...base, entity_type_desc: type });
  assert.equal(result.eligible, false, type);
  assert.equal(result.reason, "excluded_or_unknown_entity_type");
}

assert.equal(normalizeAcraRecord({ ...base, uen_status_desc: "Deregistered" }).reason, "not_currently_registered");
assert.equal(normalizeAcraRecord({ ...base, uen: "" }).reason, "invalid_or_missing_uen");
assert.equal(normalizeAcraRecord({ ...base, entity_name: " " }).reason, "missing_legal_name");
assert.equal(normalizeAcraRecord({ ...base, uen_issue_date: "25/04/2019" }).reason, "invalid_registration_date");
assert.equal(normalizeAcraRecord(null).reason, "invalid_record");
assert.equal(normalizeAcraRecord({ ...base, director_name: "Example Person", email: "person@example.com" }).sourceRecord.director_name, undefined);

console.log("ACRA normalizer tests passed: only registered local companies and LLPs are eligible; personal/contact fields are never copied.");
