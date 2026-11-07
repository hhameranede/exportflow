import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("migrations/0005_open_company_data_registry.sql", "utf8");
for (const table of [
  "company_data_sources",
  "company_entities",
  "company_source_snapshots",
  "company_source_records",
  "company_field_provenance",
  "company_entity_links",
  "company_ingestion_runs",
  "company_data_source_audit"
]) {
  assert.match(migration, new RegExp("CREATE TABLE IF NOT EXISTS " + table + "\\b"));
}
assert.match(migration, /trg_company_source_records_rights_insert/);
assert.match(migration, /trg_company_source_records_rights_update/);
assert.match(migration, /commercial_use = 1/);
assert.match(migration, /redistribution = 1/);
assert.match(migration, /RAISE\(ABORT/);
assert.doesNotMatch(migration, /\b(email|phone|personal_id|beneficial_owner)\s+TEXT\b/i);

const registry = JSON.parse(
  await readFile("data/open-company-data-sources.json", "utf8")
);

assert.equal(registry.schema_version, "1.0.0");
assert.equal(registry.catalogue, "ExportFlow Open Company Data Sources");
assert.equal(registry.policy.commercial_use_required, true);
assert.equal(registry.policy.redistribution_required, true);
assert.equal(registry.policy.repository_publicity_is_not_a_license, true);
assert.equal(registry.policy.software_license_does_not_license_embedded_data, true);
const seedMigration = await readFile("migrations/0006_seed_open_company_data_sources.sql", "utf8");
assert.match(seedMigration, /INSERT OR IGNORE INTO company_data_sources/);
for (const source of registry.sources) {
  assert.ok(seedMigration.includes("'" + source.id + "'"), source.id + " must be seeded in the D1 source register");
}
assert.ok(registry.sources.length >= 20, "Expected the external source register to include the Singapore and Canada official datasets");
assert.ok(registry.rejected_candidates.length >= 4, "Unlicensed and unsuitable GitHub candidates must remain explicitly rejected");
assert.ok(registry.existing_exportflow_sources.length >= 4, "Existing pinned sources must remain documented");

const ids = new Set();
for (const source of registry.sources) {
  assert.ok(source.id && !ids.has(source.id), "Every source needs a unique stable id");
  ids.add(source.id);
  assert.ok(source.name && source.publisher, source.id + " needs a source name and publisher");
  assert.ok(source.source_url?.startsWith("https://"), source.id + " needs an HTTPS source URL");
  assert.ok(Array.isArray(source.coverage) && source.coverage.length > 0, source.id + " needs coverage");
  assert.ok(Array.isArray(source.data_scope) && source.data_scope.length > 0, source.id + " needs a declared data scope");
  assert.ok(Array.isArray(source.limitations) && source.limitations.length > 0, source.id + " needs explicit limitations");
  assert.ok(Array.isArray(source.verification_sources) && source.verification_sources.length > 0, source.id + " needs evidence links");
  assert.equal(typeof source.commercial_use, "boolean", source.id + " must state commercial-use permission");
  assert.equal(typeof source.redistribution, "boolean", source.id + " must state redistribution permission");
  assert.ok(source.license || source.license_policy || source.reuse_basis, source.id + " needs a license or explicit reuse basis");
  assert.ok(source.rights_status && source.ingestion_status, source.id + " needs rights and ingestion states");
  if (source.attribution_required === true) {
    assert.ok(source.attribution_text || source.verification_sources.length > 0, source.id + " needs attribution evidence");
  }
  if (source.license === "ODbL-1.0") {
    assert.match(source.limitations.join(" ").toLowerCase(), /share.alike/);
    assert.match(source.ingestion_status, /separate/);
  }
}


const acra = registry.sources.find(source => source.id === "acra-singapore-entities");
assert.equal(acra.license, "SINGAPORE-OPEN-DATA-LICENCE-1.0");
assert.equal(acra.commercial_use, true);
assert.equal(acra.redistribution, true);
assert.equal(acra.attribution_required, true);
assert.match(acra.ingestion_status, /sole_proprietor_and_personal_data_filter/);
assert.ok(acra.limitations.some(value => /does not grant rights over personal data/i.test(value)));
assert.ok(acra.verification_sources.includes("https://developers.data.gov.sg/open-data-licence"));

const canada = registry.sources.find(source => source.id === "canada-federal-corporations");
assert.equal(canada.license, "OPEN-GOVERNMENT-LICENCE-CANADA");
assert.equal(canada.commercial_use, true);
assert.equal(canada.redistribution, true);
assert.equal(canada.attribution_required, true);
assert.match(canada.ingestion_status, /field_level_privacy_and_schema_review/);
assert.ok(canada.limitations.some(value => /provincial\/territorial corporations/i.test(value)));
assert.ok(canada.verification_sources.includes("https://open.canada.ca/data/en/dataset/0032ce54-c5dd-4b66-99a0-320a7b5e99f2"));

const gleif = registry.sources.find(source => source.id === "gleif-global-lei");
assert.equal(gleif.license, "CC0-1.0");
assert.ok(gleif.limitations.some(value => /official GLEIF Access Service/i.test(value)));
assert.ok(gleif.limitations.some(value => /do not imply GLEIF endorsement/i.test(value)));

const latvia = registry.sources.find(source => source.id === "latvia-enterprise-register");
assert.equal(latvia.license, "CC0-1.0");
assert.equal(latvia.rights_status, "verified_open");
assert.match(latvia.ingestion_status, /personal_data_filter/);

const ireland = registry.sources.find(source => source.id === "ireland-cro-company-records");
assert.equal(ireland.license, "CC-BY-4.0");
assert.equal(ireland.commercial_use, true);
assert.equal(ireland.redistribution, true);

const uk = registry.sources.find(source => source.id === "uk-companies-house-register");
assert.equal(uk.license, "STATUTORY_PUBLIC_REGISTER_REUSE_NOT_OGL");
assert.ok(uk.license.endsWith("_NOT_OGL"));

const france = registry.sources.find(source => source.id === "france-insee-sirene");
assert.equal(france.license, "LICENCE-OUVERTE-2.0");
assert.equal(france.commercial_use, true);
assert.equal(france.redistribution, true);

const norway = registry.sources.find(source => source.id === "norway-brreg-enhetsregisteret");
assert.equal(norway.license, "NLOD-2.0");
assert.ok(norway.limitations.some(value => /national identity numbers/i.test(value)));

const estonia = registry.sources.find(source => source.id === "estonia-rik-e-business-register");
assert.match(estonia.license, /CC-BY-4.0_CURRENT_RIK_PAGE__CC-BY-SA-4.0_IN_2023_EU_HVD_REPORT/);
assert.equal(estonia.redistribution, false);
assert.match(estonia.rights_status, /provisional_license_conflict/);
assert.match(estonia.ingestion_status, /quarantined/);
const estoniaSeed = seedMigration.split("\n").find(line => line.includes("'estonia-rik-e-business-register'"));
assert.ok(estoniaSeed?.includes("'quarantined', 1, 0"));
assert.ok(estoniaSeed?.includes("'blocked', 'pending'"));

const lithuania = registry.sources.find(source => source.id === "lithuania-centre-of-registers-open-financial-data");
assert.equal(lithuania.license, "CC-BY-4.0");
assert.match(lithuania.ingestion_status, /open_financial_datasets_only/);
assert.ok(lithuania.limitations.some(value => /service agreement/i.test(value)));

const netherlands = registry.sources.find(source => source.id === "netherlands-kvk-basic-company-hvds");
assert.equal(netherlands.license, "CC-BY-4.0");
assert.match(netherlands.ingestion_status, /aggregate_analytics_only/);
assert.ok(netherlands.limitations.some(value => /not suitable for entity-level directory lookup/i.test(value)));

const slovenia = registry.sources.find(source => source.id === "slovenia-ajpes-prs");
assert.equal(slovenia.license, "CC-BY-4.0");
assert.match(slovenia.ingestion_status, /personal_data_filter/);

const worldIndex = registry.sources.find(source => source.id === "world-company-database-github-index");
assert.equal(worldIndex.license, "CC-BY-4.0");
assert.match(worldIndex.ingestion_status, /discovery_feed_only/);

const openCorporates = registry.sources.find(source => source.id === "opencorporates-commercial-api");
assert.equal(openCorporates.commercial_use, false);
assert.equal(openCorporates.redistribution, false);
assert.match(openCorporates.ingestion_status, /blocked/);

const osm = registry.sources.find(source => source.id === "openstreetmap-business-pois");
assert.equal(osm.license, "ODbL-1.0");
assert.match(osm.ingestion_status, /separate/);

for (const source of registry.existing_exportflow_sources) {
  assert.ok(source.repository?.startsWith("https://github.com/"), source.id + " needs its upstream repository");
  assert.ok(source.pinned_commit, source.id + " needs a pinned upstream commit");
  assert.ok(source.license && source.status && source.rights_boundary, source.id + " needs license/status/rights boundary");
}

for (const candidate of registry.rejected_candidates) {
  assert.ok(candidate.repository?.startsWith("https://github.com/"), candidate.id + " needs its source repository");
  assert.ok(candidate.license_status && candidate.data_origin && candidate.decision, candidate.id + " needs explicit rejection evidence");
}

console.log("Open company-data source register passed: " + registry.sources.length + " external sources, " + registry.existing_exportflow_sources.length + " existing ExportFlow sources and " + registry.rejected_candidates.length + " rejected candidates.");
