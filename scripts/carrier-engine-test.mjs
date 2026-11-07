import assert from "node:assert/strict";
import { onRequestGet as getCarrierCatalog } from "../functions/api/carriers.js";
import {
  createExportFlowCarrierEngine,
  EXPORTFLOW_ENGINE_METADATA,
  TrackingError
} from "../functions/lib/exportflow-carrier-engine.mjs";

assert.equal(EXPORTFLOW_ENGINE_METADATA.name, "ExportFlow Carrier Engine");
assert.equal(EXPORTFLOW_ENGINE_METADATA.upstreamCommit, "e64a466772ef25ce68e02d9c7c9f1613eec1208b");
assert.deepEqual([...EXPORTFLOW_ENGINE_METADATA.defaultUniversalFallbacks], ["UPU"]);
assert.equal(typeof TrackingError, "function");

const engine = createExportFlowCarrierEngine();
assert.equal(typeof engine.detect, "function", "ExportFlow facade should expose offline detection");
assert.equal(typeof engine.track, "function", "ExportFlow facade should expose live tracking");

const detected = engine.detect("1Z999AA10123456784");
assert.equal(detected.carrier, "ups", "Known UPS example should be detected through the ExportFlow facade");

assert.throws(
  () => createExportFlowCarrierEngine({ trawlUrl: 42 }),
  TypeError,
  "Facade should reject a non-string TRAWL URL"
);

const catalogResponse = await getCarrierCatalog();
assert.equal(catalogResponse.status, 200);
assert.match(catalogResponse.headers.get("Cache-Control") || "", /max-age=3600/);
const catalog = await catalogResponse.json();
assert.ok(catalog.catalogEntries >= catalog.carriers.length);
assert.ok(catalog.selectableCarrierRecords > 0);
assert.ok(catalog.carrierRecords.length > 0);
assert.equal(catalog.carrierRecords.length, catalog.selectableCarrierRecords);
assert.equal(
  catalog.directAdapterCatalogRecords + catalog.universalFallbackCatalogRecords +
    catalog.linkOnlyCatalogRecords,
  catalog.carrierRecords.filter(record =>
    ["automatic", "link-only"].includes(record.tracking.mode)
  ).length
);
for (const record of catalog.carrierRecords) {
  assert.match(record.id, /^[a-z0-9-]{2,80}$/i);
  assert.ok(Array.isArray(record.countries));
  assert.ok(record.countries.every(code => /^[A-Z]{2}$/.test(code)));
  assert.ok(["automatic", "link-only", "not-declared"].includes(record.tracking.mode));
}
assert.match(catalog.metadataNotice, /not a live availability check/);
assert.ok(!JSON.stringify(catalog).includes("apiKey"), "Public carrier metadata must not include secrets");

console.log("ExportFlow carrier engine facade and structured carrier catalog tests passed.");
