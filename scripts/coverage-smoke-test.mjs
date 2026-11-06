import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/coverage.js";
import { COUNTRY_CODES } from "../functions/lib/country-codes.mjs";

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
  assert.ok(["direct", "browser-required", "universal-fallback", "link-only", "not-listed"].includes(country.status));
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

assert.equal(payload.summary.directCountryCount, payload.countries.filter(country => country.directCarrierCount > 0).length);
assert.equal(payload.summary.browserRequiredCountryCount, payload.countries.filter(country => country.browserRequiredCarrierCount > 0).length);
assert.ok(payload.summary.browserRequiredCarrierRecords > 0);
const algeria = payload.countries.find(country => country.code === "DZ");
assert.ok(algeria?.directCarriers.some(carrier => carrier.id === "algerie-poste"), "Algérie Poste should be a browser-free direct adapter");
assert.ok(algeria?.directCarriers.some(carrier => carrier.id === "zr-express"), "ZR Express should be a browser-free direct adapter");
assert.ok(algeria?.directCarriers.some(carrier => carrier.id === "noest"), "NOEST should be a browser-free direct adapter");
assert.ok(algeria?.browserRequiredCarriers.some(carrier => carrier.id === "yalidine"), "Yalidine must be flagged as browser-required");
assert.ok(!algeria?.directCarriers.some(carrier => carrier.id === "yalidine"), "Yalidine must not inflate server-ready direct coverage");
assert.equal(payload.summary.universalFallbackCountryCount, payload.countries.filter(country => country.fallbackCarrierCount > 0).length);
assert.equal(payload.summary.linkOnlyCountryCount, payload.countries.filter(country => country.status === "link-only").length);
assert.equal(payload.summary.countriesWithoutCatalogEntry, payload.countries.filter(country => country.status === "not-listed").length);
assert.ok(payload.summary.catalogEntries > 0);
assert.ok(payload.upstreamRevision);

console.log(`Coverage catalog tests passed: ${payload.summary.catalogEntries} catalog records across ${payload.summary.allCountries} ISO country/territory codes; ${payload.summary.directCountryCount} have at least one direct adapter.`);
