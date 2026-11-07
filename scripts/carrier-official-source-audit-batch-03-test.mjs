import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../migrations/0007_carrier_official_source_research_batch_03.sql", import.meta.url), "utf8");
const audit = await readFile(new URL("../docs/CARRIER_OFFICIAL_SOURCE_AUDIT_BATCH_03.md", import.meta.url), "utf8");
const statements = migration.split(/(?=UPDATE carrier_evidence)/g).filter(part => part.startsWith("UPDATE carrier_evidence"));
assert.equal(statements.length, 2, "The third research batch must update exactly the two remaining seeded providers.");

const expected = [["china-post","https://iframe.chinapost.com.cn/en/category/1408/3925-1.htm"],["yunexpress","https://www.yunexpress.com/resource/shipment-tracking"]];
for (const [providerId, sourceUrl] of expected) {
  const matches = statements.filter(statement => statement.includes("WHERE provider_id = '" + providerId + "';"));
  assert.equal(matches.length, 1, "Expected one source-evidence update for " + providerId);
  const statement = matches[0];
  assert.ok(statement.includes("official_source_url = '" + sourceUrl + "'"), providerId + " must use its recorded official source");
  assert.ok(statement.includes("evidence_status = 'research'"), providerId + " must remain Research");
  assert.ok(statement.includes("verification_method = 'none'"), providerId + " must not be marked verified");
  assert.ok(statement.includes("verified_at = NULL"), providerId + " must not receive a verification timestamp");
  assert.ok(statement.includes("verification_evidence_url = NULL"), providerId + " must not receive fabricated test evidence");
  assert.ok(statement.includes("authorization_evidence_url = NULL"), providerId + " must not receive fabricated authorization");
  assert.ok(audit.includes(sourceUrl), providerId + " source URL must appear in the audit document");
}
assert.doesNotMatch(migration, /evidence_status\s*=\s*'verified'/i);
assert.doesNotMatch(migration, /verification_method\s*=\s*'(sandbox|live)'/i);
assert.match(audit, /all \*\*22 of 22 records\*\*/);
assert.match(audit, /All 22 remain Research/);
console.log("Carrier official-source audit batch 03 tests passed: the last two seed records have official source links and remain Research.");
