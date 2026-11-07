import assert from "node:assert/strict";
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

console.log("ExportFlow carrier engine facade tests passed.");
