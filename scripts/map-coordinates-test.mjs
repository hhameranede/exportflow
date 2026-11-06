import assert from "node:assert/strict";
import { safeEventPoint } from "../functions/lib/coordinates.mjs";

assert.deepEqual(safeEventPoint({ latitude: 48.85661, longitude: 2.35222 }), {
  latitude: 48.8566, longitude: 2.3522
});
assert.equal(safeEventPoint({ latitude: "48.85", longitude: 2.35 }), null);
assert.equal(safeEventPoint({ latitude: 91, longitude: 2 }), null);
assert.equal(safeEventPoint({ latitude: 20, longitude: 181 }), null);
assert.equal(safeEventPoint({ latitude: 0, longitude: 0 }), null);
assert.equal(safeEventPoint(null), null);
console.log("Shipment map coordinate validation tests passed.");
