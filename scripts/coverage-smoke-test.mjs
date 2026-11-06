import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/coverage.js";

const response = await onRequestGet();
assert.equal(response.status, 200);
assert.match(response.headers.get("Cache-Control") || "", /max-age=3600/);
const payload = await response.json();

assert.equal(payload.engine, "universal-parcel-scraper");
assert.ok(Array.isArray(payload.dedicatedAdapterCountries));
assert.ok(Array.isArray(payload.universalFallbackOnlyCountries));
assert.ok(Array.isArray(payload.linkOnlyCountries));
assert.ok(Array.isArray(payload.customCarriers));
assert.ok(
  payload.universalFallbackOnlyCountries.every(country => Array.isArray(country.carriers) && country.carriers.length > 0),
  "Universal-only countries should include the carrier names that need direct integrations"
);
assert.ok(
  payload.linkOnlyCountries.every(country => Array.isArray(country.carriers) && country.carriers.length > 0),
  "Link-only countries should include the carrier names that need direct integrations"
);
assert.equal(payload.countryCount, payload.dedicatedAdapterCountries.length);
assert.ok(
  payload.countryCount >= 100,
  `Expected at least 100 countries with a dedicated automatic adapter; got ${payload.countryCount}`
);

const byCode = new Map(payload.dedicatedAdapterCountries.map(country => [country.code, country]));
assert.ok(byCode.has("DZ"), "Algeria should be represented by a dedicated carrier adapter");
assert.ok(
  byCode.get("DZ").carriers.some(carrier => carrier.id === "algerie-poste"),
  "Algerie Poste should be included in Algeria's direct carrier coverage"
);
const cambodia = byCode.get("KH");
assert.ok(cambodia, "Cambodia should be included through the ExportFlow custom adapter");
assert.ok(
  cambodia.carriers.some(carrier => carrier.id === "cambodia-post" && carrier.adapter === "direct"),
  "Cambodia Post custom adapter should be counted as direct country coverage"
);
assert.ok(
  payload.customCarriers.some(carrier => carrier.id === "cambodia-post" && carrier.country === "KH"),
  "Cambodia Post should be exposed in custom carrier metadata"
);
assert.ok(
  payload.dedicatedAdapterCountries.every(country =>
    /^[A-Z]{2}$/.test(country.code) && country.directCarrierCount > 0
  ),
  "Every directly covered country must have an ISO alpha-2 code and at least one carrier"
);

console.log(`Coverage smoke test passed: ${payload.countryCount} directly covered countries.`);
