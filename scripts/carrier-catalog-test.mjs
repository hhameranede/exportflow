import assert from "node:assert/strict";
import {
  CARRIER_DEFINITIONS,
  CARRIER_IDS,
  carrierInfo,
} from "universal-parcel-scraper";
import { REGISTRY } from "universal-parcel-scraper/node";

// This is an offline catalog/dispatch audit. It deliberately does not send
// synthetic parcel IDs to carrier websites or third-party tracking services.
const ids = [...CARRIER_IDS];
assert.ok(ids.length >= 1_300, `Expected the pinned catalog to contain at least 1,300 carriers; found ${ids.length}`);
assert.equal(new Set(ids).size, ids.length, "Carrier catalog must not contain duplicate IDs");

const summary = {
  catalogEntries: ids.length,
  automatic: 0,
  linkOnly: 0,
  dedicatedAdapter: 0,
  universalRoute: 0,
  legacyDispatch: 0,
  requirementsChecked: 0,
};

for (const id of ids) {
  assert.equal(typeof id, "string", "Every carrier ID must be a string");
  assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid carrier ID: ${id}`);

  const definition = CARRIER_DEFINITIONS[id];
  assert.ok(definition, `Catalog ID ${id} must have a carrier definition`);

  const info = carrierInfo(id);
  assert.equal(info.id, id, `Carrier info must preserve ID ${id}`);
  assert.ok(typeof info.name === "string" && info.name.trim(), `Carrier ${id} must have a display name`);
  assert.ok(typeof definition.color === "string" && definition.color.trim(), `Carrier ${id} must define a color`);
  assert.ok(typeof definition.timezone === "string" && definition.timezone.trim(), `Carrier ${id} must define a timezone`);
  assert.doesNotThrow(
    () => new Intl.DateTimeFormat("en", { timeZone: definition.timezone }),
    `Carrier ${id} must use a valid IANA timezone`
  );

  const requirements = definition.tracking?.requirements ?? [];
  assert.ok(Array.isArray(requirements), `Carrier ${id} requirements must be an array`);
  for (const requirement of requirements) {
    assert.ok(
      requirement.field === "trackingUrl" || requirement.field === "postcode",
      `Carrier ${id} has an unsupported input requirement`
    );
    assert.ok(typeof requirement.label === "string" && requirement.label.trim(), `Carrier ${id} has an unlabeled input`);
    for (const property of ["pattern", "whenTrackingNumber"]) {
      if (requirement[property] !== undefined) {
        assert.doesNotThrow(
          () => new RegExp(requirement[property]),
          `Carrier ${id} has an invalid ${property} expression`
        );
      }
    }
    summary.requirementsChecked += 1;
  }

  const mode = definition.tracking?.mode;
  const route = REGISTRY.carriers[id];

  if (mode === "link-only") {
    summary.linkOnly += 1;
    assert.equal(route, null, `Link-only carrier ${id} must not be mapped to a tracking adapter`);
    continue;
  }

  assert.equal(mode, "automatic", `Carrier ${id} must declare automatic or link-only tracking`);
  summary.automatic += 1;

  if (route === "universal") {
    summary.universalRoute += 1;
    continue;
  }

  if (typeof route === "string" && route.length > 0) {
    assert.ok(
      Object.hasOwn(REGISTRY.factories, route),
      `Carrier ${id} points to missing adapter factory ${route}`
    );
    assert.equal(typeof REGISTRY.factories[route], "function", `Adapter factory ${route} must be callable`);
    summary.dedicatedAdapter += 1;
    continue;
  }

  assert.equal(
    route,
    undefined,
    `Carrier ${id} has an invalid registry route; expected a factory, universal route, or legacy dispatch`
  );
  // Some automatic carriers are still served through the scraper's legacy
  // dispatch path and are counted separately instead of being marked broken.
  summary.legacyDispatch += 1;
}

assert.equal(
  summary.automatic + summary.linkOnly,
  summary.catalogEntries,
  "Every catalog entry must be classified"
);
assert.equal(
  summary.dedicatedAdapter + summary.universalRoute + summary.legacyDispatch,
  summary.automatic,
  "Every automatic carrier must have an explicit dispatch classification"
);

console.log("ExportFlow carrier catalog and dispatch audit passed.");
console.log(JSON.stringify(summary, null, 2));
