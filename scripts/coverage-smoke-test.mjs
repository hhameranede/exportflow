import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/coverage.js";
import { COUNTRY_CODES } from "../functions/lib/country-codes.mjs";
import { onRequestGet as getCarrierCatalog } from "../functions/api/carriers.js";

const response = await onRequestGet();
assert.equal(response.status, 200);
assert.match(response.headers.get("Cache-Control") || "", /max-age=3600/);
const payload = await response.json();

assert.equal(payload.source, "installed-universal-parcel-scraper-catalog");
assert.equal(payload.summary.allCountries, 249);
assert.equal(COUNTRY_CODES.length, 249);
assert.equal(payload.countries.length, 249);
assert.equal(new Set(payload.countries.map(country => country.code)).size, 249);
assert.deepEqual(payload.countries.map(country => country.code).sort(), [...COUNTRY_CODES].sort());

for (const country of payload.countries) {
  assert.match(country.code, /^[A-Z]{2}$/);
  assert.ok(["direct", "universal-fallback", "link-only", "not-listed"].includes(country.status));
  assert.ok(Array.isArray(country.carriers));
  assert.equal(country.carrierCount, country.carriers.length);
  assert.ok(country.carriers.every(carrier => typeof carrier.id === "string" && typeof carrier.name === "string"));
  if (country.status === "direct") {
    assert.ok(country.directCarrierCount > 0);
    assert.ok(country.directCarriers.some(carrier => typeof carrier.adapter === "string" && carrier.adapter.length > 0));
  }
  if (country.status === "universal-fallback") assert.ok(country.fallbackCarrierCount > 0);
  if (country.status === "link-only") assert.ok(country.linkOnlyCarrierCount > 0);
  if (country.status === "not-listed") assert.equal(country.carrierCount, 0);
}

assert.equal(payload.summary.directCountryCount, payload.countries.filter(country => country.status === "direct").length);
assert.equal(payload.summary.universalFallbackCountryCount, payload.countries.filter(country => country.fallbackCarrierCount > 0).length);
assert.equal(payload.summary.linkOnlyCountryCount, payload.countries.filter(country => country.status === "link-only").length);
assert.equal(payload.summary.countriesWithoutCatalogEntry, payload.countries.filter(country => country.status === "not-listed").length);
assert.ok(payload.summary.catalogEntries > 0);
assert.ok(payload.upstreamRevision);
const quarantinedIds = ["china-post", "india-post", "singapore-post", "yunexpress"];
assert.equal(payload.summary.quarantinedCarrierCount, quarantinedIds.length);
assert.ok(payload.countries.every(country =>
  country.carriers.every(carrier => !quarantinedIds.includes(carrier.id))
));

const catalogResponse = await getCarrierCatalog();
assert.equal(catalogResponse.status, 200);
const publicCatalog = await catalogResponse.json();
assert.equal(publicCatalog.catalogEntries, publicCatalog.carriers.length);
for (const id of quarantinedIds) assert.ok(!publicCatalog.carriers.includes(id), id + " must be absent from the public carrier catalog");
assert.ok(publicCatalog.carriers.includes("ups"));

console.log(`Coverage catalog tests passed: ${payload.summary.catalogEntries} catalog records across ${payload.summary.allCountries} ISO country/territory codes; ${payload.summary.directCountryCount} have at least one direct adapter.`);
