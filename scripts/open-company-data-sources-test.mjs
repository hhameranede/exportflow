import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registry = JSON.parse(
  await readFile("data/open-company-data-sources.json", "utf8")
);

assert.equal(registry.schema_version, "1.0.0");
assert.equal(registry.catalogue, "ExportFlow Open Company Data Sources");
assert.equal(registry.policy.commercial_use_required, true);
assert.equal(registry.policy.redistribution_required, true);
assert.equal(registry.policy.repository_publicity_is_not_a_license, true);
assert.equal(registry.policy.software_license_does_not_license_embedded_data, true);
assert.ok(registry.sources.length >= 11, "Expected the external source register to keep growing");
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

const gleif = registry.sources.find(source => source.id === "gleif-global-lei");
assert.equal(gleif.license, "CC0-1.0");
assert.ok(gleif.limitations.some(value => /official GLEIF Access Service/i.test(value)));
assert.ok(gleif.limitations.some(value => /do not imply GLEIF endorsement/i.test(value)));

const latvia = registry.sources.find(source => source.id === "latvia-enterprise-register");
assert.match(latvia.ingestion_status, /quarantined/);
assert.match(latvia.rights_status, /confirm_exact_dataset_metadata/);

const ireland = registry.sources.find(source => source.id === "ireland-cro-company-records");
assert.equal(ireland.license, "CC-BY-4.0");
assert.equal(ireland.commercial_use, true);
assert.equal(ireland.redistribution, true);

const uk = registry.sources.find(source => source.id === "uk-companies-house-register");
assert.equal(uk.license, "STATUTORY_PUBLIC_REGISTER_REUSE_NOT_OGL");
assert.ok(uk.limitations.some(value => /not OGL/i.test(value)));

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

console.log("Open company-data source register passed: " + registry.sources.length + " external sources and " + registry.existing_exportflow_sources.length + " existing ExportFlow sources.");
