import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestGet } from "../functions/api/coverage.js";
import { collectDirectCarriers, renderCompanyDirectory } from "./company-directory-data.mjs";

const template = await readFile(new URL("../companies/index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../company-directory.js", import.meta.url), "utf8");
const response = await onRequestGet();
assert.equal(response.status, 200, "the public coverage route should build successfully");

const payload = await response.json();
const carriers = collectDirectCarriers(payload);
const html = renderCompanyDirectory(template, payload);
const cards = [...html.matchAll(/<article class="directory-card"/g)];
const ids = carriers.map(carrier => carrier.id);

assert.equal(cards.length, payload.summary.directCarrierRecords,
  "every public direct-adapter carrier record should have one profile");
assert.equal(new Set(ids).size, ids.length, "carrier profiles should be deduplicated by carrier ID");
assert.ok(cards.length > 32, "the directory should exceed the old 32-profile list");
assert.ok(html.includes(payload.summary.directCountryCount + " countries with direct routes"));
assert.ok(html.includes('id="companySearch"'));
assert.ok(html.includes('id="companyCountry"'));
assert.ok(ids.includes("algerie-poste"), "the direct Algerie Poste adapter should be included");
assert.ok(html.includes("ExportFlow provides carrier information and shipment-tracking lookups"));
assert.ok(html.includes("carrier-specific tracking route"));
assert.ok(html.includes('href="/companies/"'));
assert.doesNotMatch(html, /TRAWL|Universal Parcel Scraper|plhery\/universal-parcel-scraper/i);
assert.doesNotMatch(html, /not partnered|not contracted|contract status|relationship status|official partnership/i);

for (const id of ["china-post", "india-post", "singapore-post", "usps", "yunexpress"]) {
  assert.ok(!ids.includes(id), "quarantined public carrier should not appear: " + id);
}
for (const carrier of carriers) {
  assert.ok(html.includes('data-carrier-id="' + carrier.id + '"'),
    "missing carrier profile for " + carrier.id);
}

assert.match(script, /addEventListener\("input"/);
assert.match(script, /addEventListener\("change"/);
assert.match(script, /companyCountry/);

console.log(
  "Company directory checks passed: " + carriers.length +
  " unique direct-adapter carrier profiles across " +
  payload.summary.directCountryCount + " countries."
);
