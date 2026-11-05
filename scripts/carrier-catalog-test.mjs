import assert from "node:assert/strict";
import { CARRIER_CATALOG, CARRIER_IDS } from "universal-parcel-scraper";

assert.ok(Array.isArray(CARRIER_IDS), "Carrier IDs must be exposed as an array");
assert.ok(CARRIER_IDS.length >= 1_000, "The upstream carrier catalog unexpectedly shrank");
assert.equal(new Set(CARRIER_IDS).size, CARRIER_IDS.length, "Carrier IDs must be unique");

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
for (const id of CARRIER_IDS) {
  assert.equal(typeof id, "string", "Every carrier ID must be a string");
  assert.match(id, idPattern, `Carrier ID has an invalid format: ${id}`);
  assert.ok(
    Object.hasOwn(CARRIER_CATALOG, id),
    `Carrier catalog is missing its definition for ${id}`
  );

  const definition = CARRIER_CATALOG[id];
  assert.ok(definition && typeof definition === "object", `Invalid catalog definition: ${id}`);
  assert.equal(typeof definition.displayName, "string", `Missing display name: ${id}`);
  assert.ok(definition.displayName.trim().length > 0, `Empty display name: ${id}`);
}

console.log(JSON.stringify({
  carrierCatalog: "passed",
  entries: CARRIER_IDS.length,
  uniqueIds: true,
  definitionsValidated: CARRIER_IDS.length
}, null, 2));
