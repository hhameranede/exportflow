import assert from "node:assert/strict";
import { CARRIER_CATALOG_METADATA, CARRIER_IDS, CARRIERS } from "../data/carrier-catalog.generated.mjs";

assert.equal(CARRIER_IDS.length, 1339);
assert.equal(Object.keys(CARRIERS).length, 1339);
assert.equal(new Set(CARRIER_IDS).size, CARRIER_IDS.length);
assert.ok(CARRIER_IDS.includes("unknown"), "The source snapshot should preserve the reserved unknown id.");
assert.equal(CARRIER_CATALOG_METADATA.catalogOwner, "ExportFlow");
assert.equal(CARRIER_CATALOG_METADATA.upstreamCommit, "e64a466772ef25ce68e02d9c7c9f1613eec1208b");
assert.equal(CARRIER_CATALOG_METADATA.carrierRecords, 1339);
assert.equal(CARRIER_CATALOG_METADATA.adapterSourceDirectories, 732);
assert.equal(CARRIER_CATALOG_METADATA.liveAdapterTestFiles, 727);
assert.equal(CARRIER_CATALOG_METADATA.generationUsesNetwork, false);

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
