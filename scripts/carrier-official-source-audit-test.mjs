import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../migrations/0005_carrier_official_source_research.sql", import.meta.url), "utf8");
const audit = await readFile(new URL("../docs/CARRIER_OFFICIAL_SOURCE_AUDIT.md", import.meta.url), "utf8");
const statements = migration.split(/(?=UPDATE carrier_evidence)/g).filter(part => part.startsWith("UPDATE carrier_evidence"));
assert.equal(statements.length, 10, "The first research batch must update exactly ten named providers.");

const expected = [
  [
    "ups",
    "https://developer.ups.com/tag/Tracking?loc=en_US"
  ],
  [
    "fedex",
    "https://developer.fedex.com/"
  ],
  [
    "dhl-express",
    "https://developer.dhl.com/tracking?language_content_entity=en"
  ],
  [
    "aramex",
    "https://www.aramex.com/ae/en/developers-solution-center/aramex-apis"
  ],
  [
    "canada-post",
    "https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/services/tracking/default.jsf?LOCALE=en"
  ],
  [
    "australia-post",
    "https://developers.auspost.com.au/apis/shipping-and-tracking/info/api-resources/tracking"
  ],
  [
    "royal-mail",
    "https://developer.royalmail.net/api"
  ],
  [
    "correos",
    "https://www.correos.es/es/en/companies/e-commerce/reinforce-your-ecommerce-logistics/api-integration"
  ],
  [
    "la-poste",
    "https://developer.laposte.fr/catalog-apis/suivi%402"
  ],
  [
    "japan-post",
    "https://www.post.japanpost.jp/index_en.html"
  ]
];
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
assert.match(audit, /All 10 remain at \*\*Research\*\*/);
assert.match(audit, /does not grant ExportFlow credentials, API access/);
console.log("Carrier official-source audit tests passed: 10 primary-source records, all retained at Research with no fabricated authorization or live evidence.");
