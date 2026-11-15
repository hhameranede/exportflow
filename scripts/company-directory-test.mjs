import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../companies/index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../company-directory.js", import.meta.url), "utf8");
const cards = [...html.matchAll(/<article class="directory-card"/g)];
const links = [...html.matchAll(/<a class="directory-company-link" href="([^"]+)"/g)];

const expectedCompanies = [
  "India Post", "YunExpress", "China Post", "Yanwen", "Singapore Post (SingPost)",
  "Correos", "Emirates Post", "Cainiao", "La Poste / Colissimo", "PostNL",
  "Australia Post", "Japan Post", "Canada Post", "USPS", "UPS", "FedEx",
  "DPD / Geopost", "DHL Express", "SF Express", "GLS", "Royal Mail", "Aramex",
  "AJEX Logistics", "Blue Dart", "Bring / Posten Bring", "Maystro Delivery",
  "Yalidine El Djazair Services", "Bosta", "TrackingMore", "Ship24", "AfterShip", "17TRACK"
];

assert.equal(cards.length, expectedCompanies.length, "all company profiles should be present");
assert.equal(links.length, expectedCompanies.length, "each profile should have one company information link");
for (const company of expectedCompanies) assert.ok(html.includes(company), "missing company: " + company);
for (const [, href] of links) assert.match(href, /^https:\/\//, "company links must use HTTPS");
assert.ok(html.includes('href="/companies/"'));
assert.ok(html.includes('rel="noopener noreferrer"'));
assert.ok(html.includes('id="companySearch"'));
assert.ok(html.includes('id="companyCategory"'));
assert.ok(html.includes('id="companyNoResults"'));
assert.doesNotMatch(html, /TRAWL|Universal Parcel Scraper|plhery\/universal-parcel-scraper/i);
assert.doesNotMatch(html, /not partnered|not contracted|contract status|researching|relationship status|official partnership/i);
assert.doesNotMatch(html, /we provide these carriers|supported carriers|available integrations/i);
assert.match(script, /addEventListener\("input"/);
assert.match(script, /addEventListener\("change"/);

console.log("Company directory checks passed: " + expectedCompanies.length + " company profiles, HTTPS company links, search and category filters.");
