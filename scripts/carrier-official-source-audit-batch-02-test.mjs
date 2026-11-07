import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../migrations/0006_carrier_official_source_research_batch_02.sql", import.meta.url), "utf8");
const audit = await readFile(new URL("../docs/CARRIER_OFFICIAL_SOURCE_AUDIT_BATCH_02.md", import.meta.url), "utf8");
const statements = migration.split(/(?=UPDATE carrier_evidence)/g).filter(part => part.startsWith("UPDATE carrier_evidence"));
assert.equal(statements.length, 10, "The second research batch must update exactly ten named providers.");

const expected = [["usps","https://developers.usps.com/"],["postnl","https://developer.postnl.nl/integration-with-postnl/api-overview/send-and-track/shippingstatus-webservice/"],["dpd-geopost","https://developer.dpdgroup.com/"],["gls","https://dev-portal.gls-group.net/get-started"],["emirates-post","https://www.emiratespost.ae/all-services/integration-solutions"],["sf-express","https://open.sf-express.com/developerIntroduction"],["india-post","https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspxTrack"],["singapore-post","https://www.singpost.com/track-items"],["yanwen","https://opendocs.yw56.com.cn/webfile/7128663508291424256/"],["cainiao","https://open.gfn.cainiao.com/apiInfo/introduce"]];
for (const [providerId, sourceUrl] of expected) {
  const matches = statements.filter(statement => statement.includes("WHERE provider_id = '" + providerId + "';"));
  assert.equal(matches.length, 1, "Expected one source-evidence update for " + providerId);
  const statement = matches[0];
  assert.ok(statement.includes("official_source_url = '" + sourceUrl + "'"), providerId + " must use its recorded primary source URL");
  assert.ok(statement.includes("evidence_status = 'research'"), providerId + " must remain Research");
  assert.ok(statement.includes("verification_method = 'none'"), providerId + " must not be marked live or sandbox verified");
  assert.ok(statement.includes("verified_at = NULL"), providerId + " must not receive a verification timestamp");
  assert.ok(statement.includes("verification_evidence_url = NULL"), providerId + " must not receive fabricated test evidence");
  assert.ok(statement.includes("authorization_evidence_url = NULL"), providerId + " must not receive fabricated authorization");
  assert.ok(audit.includes(sourceUrl), providerId + " source URL must appear in the audit document");
}
assert.doesNotMatch(migration, /evidence_status\s*=\s*'verified'/i);
assert.doesNotMatch(migration, /verification_method\s*=\s*'(sandbox|live)'/i);
assert.match(audit, /All ten remain \*\*Research\*\*/);
assert.match(audit, /does not grant ExportFlow credentials/);
console.log("Carrier official-source audit batch 02 tests passed: ten primary-source records, all retained at Research with no fabricated authorization or live evidence.");
