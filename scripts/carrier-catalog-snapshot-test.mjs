import assert from "node:assert/strict";
import { CARRIER_CATALOG_METADATA, CARRIER_IDS, CARRIERS, CARRIER_INTEGRATION_MATRIX } from "../data/carrier-catalog.generated.mjs";

assert.equal(CARRIER_IDS.length, 1339);
assert.equal(Object.keys(CARRIERS).length, 1339);
assert.equal(new Set(CARRIER_IDS).size, CARRIER_IDS.length);
assert.ok(CARRIER_IDS.includes("unknown"), "The source snapshot should preserve the reserved unknown id.");
assert.equal(CARRIER_CATALOG_METADATA.catalogOwner, "ExportFlow");
assert.equal(CARRIER_CATALOG_METADATA.upstreamCommit, "e64a466772ef25ce68e02d9c7c9f1613eec1208b");
assert.equal(CARRIER_CATALOG_METADATA.carrierRecords, 1339);
assert.equal(CARRIER_CATALOG_METADATA.adapterSourceDirectories, 732);
assert.equal(CARRIER_CATALOG_METADATA.liveAdapterTestFiles, 727);
assert.equal(CARRIER_CATALOG_METADATA.providerApiModuleDirectories, 3);
assert.equal(CARRIER_CATALOG_METADATA.generationUsesNetwork, false);
assert.equal(Object.keys(CARRIER_INTEGRATION_MATRIX).length, 1339);
assert.equal(CARRIER_CATALOG_METADATA.integrationMatrixRecords, 1339);
assert.equal(CARRIER_CATALOG_METADATA.providerApiClientRecords, 3);

for (const id of CARRIER_IDS) {
  const row = CARRIER_INTEGRATION_MATRIX[id];
  assert.ok(row, "Every source catalog entry needs an integration matrix row: " + id);
  assert.equal(row.carrierId, id);
  assert.ok(["provider_api_client", "dedicated_adapter", "universal_fallback", "link_only", "adapter_reference_only", "catalogue_only"].includes(row.integrationClass));
  assert.ok(["present", "not_found"].includes(row.adapterSource));
  assert.ok(["defined", "not_found"].includes(row.fixtureTest));
  assert.ok(["defined", "not_found"].includes(row.liveTestDefinition));
  assert.equal("commercialAuthorization" in row, false);
  assert.equal("thirdPartyTrackingRights" in row, false);
}
assert.deepEqual(CARRIER_INTEGRATION_MATRIX.ups.requiredEnvironment, ["UPS_CLIENT_ID", "UPS_CLIENT_SECRET"]);
assert.equal(CARRIER_INTEGRATION_MATRIX.ups.apiAuthentication, "oauth2_client_credentials");
assert.equal(CARRIER_INTEGRATION_MATRIX.ups.sandboxMode, "customer_integration_environment");
assert.equal(CARRIER_INTEGRATION_MATRIX.ups.sandboxBaseUrl, "https://wwwcie.ups.com");
assert.deepEqual(CARRIER_INTEGRATION_MATRIX.fedex.requiredEnvironment, ["FEDEX_API_KEY", "FEDEX_SECRET_KEY"]);
assert.equal(CARRIER_INTEGRATION_MATRIX.fedex.apiAuthentication, "oauth2_client_credentials");
assert.equal(CARRIER_INTEGRATION_MATRIX.fedex.sandboxMode, "developer_sandbox");
assert.equal(CARRIER_INTEGRATION_MATRIX.fedex.sandboxBaseUrl, "https://apis-sandbox.fedex.com");
assert.equal(CARRIER_INTEGRATION_MATRIX.fedex.onboardingRole, "integrator_provider");
assert.deepEqual(CARRIER_INTEGRATION_MATRIX["dhl-express"].requiredEnvironment, ["DHL_API_KEY"]);
assert.equal(CARRIER_INTEGRATION_MATRIX["dhl-express"].apiAuthentication, "api_key_header");
assert.equal(CARRIER_INTEGRATION_MATRIX["dhl-express"].sandboxMode, "no_external_customer_test_environment");
assert.equal(CARRIER_INTEGRATION_MATRIX["dhl-express"].sandboxBaseUrl, null);
assert.equal(CARRIER_INTEGRATION_MATRIX.aramex.apiClient, "not_assessed");
assert.equal(CARRIER_INTEGRATION_MATRIX.aramex.commercialAuthorization, "not_assessed");

const records = Object.values(CARRIERS);
const displayRecords = records.filter(record => record.id !== "unknown");
assert.equal(displayRecords.length, 1338);
assert.ok(displayRecords.every(record => typeof record.name === "string" && record.name.length > 0));
assert.ok(displayRecords.every(record => Array.isArray(record.aliases) && Array.isArray(record.countries)));
assert.ok(displayRecords.every(record => record.countries.every(code => /^[A-Z]{2}$/.test(code))));
assert.ok(displayRecords.every(record => typeof record.capabilities?.selectable === "boolean"));
assert.ok(displayRecords.every(record => ["automatic", "link-only", "not-declared"].includes(record.capabilities?.tracking?.mode)));
assert.ok(displayRecords.every(record => record.capabilities?.tracking?.adapter === null ||
  /^[a-z0-9_-]{1,80}$/i.test(record.capabilities.tracking.adapter)));

const serialized = JSON.stringify(records);
assert.equal(serialized.includes("apiKey"), false, "The generated directory must not copy API credentials.");
assert.equal(serialized.includes("portal"), false, "The public index must not expose unreviewed portal URL metadata.");
assert.equal(serialized.includes("trackingNumber"), false, "The generated index must not contain shipment data.");

console.log("ExportFlow native carrier catalogue snapshot passed: 1,339 records, source provenance, 732 adapter directories and 727 live-test definitions.");
