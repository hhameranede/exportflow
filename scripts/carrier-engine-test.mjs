import assert from "node:assert/strict";
import { createExportFlowCarrierEngine, EXPORTFLOW_ENGINE_METADATA } from "../functions/lib/exportflow-carrier-engine.mjs";

assert.equal(EXPORTFLOW_ENGINE_METADATA.name, "ExportFlow Carrier Engine");
assert.equal(EXPORTFLOW_ENGINE_METADATA.upstreamCommit.length, 40);
assert.deepEqual([...EXPORTFLOW_ENGINE_METADATA.defaultUniversalFallbacks], ["UPU"]);

const engine = createExportFlowCarrierEngine();
assert.equal(typeof engine.detect, "function", "engine should expose offline detection");
assert.equal(typeof engine.track, "function", "engine should expose live tracking");

const detected = engine.detect("1Z999AA10123456784");
assert.equal(detected.carrier, "ups");
console.log("ExportFlow Carrier Engine facade tests passed.");
