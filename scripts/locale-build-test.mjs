import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const locales = ["en", "ar", "es", "zh", "hi", "pt", "fr", "bn"];
const translationSource = await readFile("translations.js", "utf8");
const translationMatch = translationSource.match(/window\.EXPORTFLOW_TRANSLATIONS\s*=\s*([\s\S]*);\s*$/);
assert.ok(translationMatch, "Source locale dictionaries must be parseable JSON.");
const translations = JSON.parse(translationMatch[1]);
const carrierDirectoryKeys = [
  "carrierEvidenceCatalogCountLabel", "carrierEvidenceAdapterCountLabel",
  "carrierEvidenceResearchCountLabel", "carrierEvidenceUpstreamNote",
  "carrierEvidenceAdapterFilter", "carrierEvidenceAdapterAll",
  "carrierEvidenceAdapterDedicated", "carrierEvidenceAdapterUniversal",
  "carrierEvidenceAdapterLinkOnly", "carrierEvidenceAdapterNone",
  "carrierEvidencePrevious", "carrierEvidenceNext", "carrierEvidencePageInfo",
  "carrierEvidenceCountryLabel", "carrierEvidenceAliasesLabel"
];
for (const locale of locales) {
  assert.ok(translations[locale], "Missing locale dictionary: " + locale);
  for (const key of carrierDirectoryKeys) {
    assert.equal(typeof translations[locale][key], "string", locale + " is missing " + key);
  }
}
const localizedUrl = (locale, route) =>
  "https://exportflow.me/" + (locale === "en" ? "" : locale + "/") +
  (route === "/" ? "" : route.replace(/^\//, ""));

for (const locale of locales) {
  const prefix = locale === "en" ? "" : locale + "/";
  const home = await readFile("dist/" + prefix + "index.html", "utf8");
  const coverage = await readFile("dist/" + prefix + "coverage/index.html", "utf8");
  const direction = locale === "ar" ? "rtl" : "ltr";

  assert.match(home, new RegExp('<html lang="' + locale + '" dir="' + direction + '">'));
  assert.match(coverage, new RegExp('<html lang="' + locale + '" dir="' + direction + '">'));
  assert.ok(home.includes('<link rel="canonical" href="' + localizedUrl(locale, "/") + '">'));
  assert.ok(coverage.includes('<link rel="canonical" href="' + localizedUrl(locale, "/coverage/") + '">'));
  assert.ok(coverage.includes('id="carrierEvidenceList"'), locale + " carrier directory container must exist");
  assert.ok(coverage.includes('id="carrierEvidenceNext"'), locale + " carrier directory pagination must exist");
  for (const html of [home, coverage]) {
    assert.equal((html.match(/rel="alternate" hreflang=/g) || []).length, 9, locale + " page must publish eight languages plus x-default");
    for (const alternate of locales) {
      assert.ok(html.includes('hreflang="' + alternate + '"'), locale + " page is missing " + alternate + " hreflang");
    }
  }
}

const trustPageNames = ["about", "contact", "privacy", "terms", "cookies", "security", "disclaimer"];
const developerPage = await readFile("dist/developers/index.html", "utf8");
const merchantPage = await readFile("dist/merchant/index.html", "utf8");
assert.ok(developerPage.includes("Developers — ExportFlow Shipment API"));
assert.ok(developerPage.includes("/api/openapi"));
assert.ok(developerPage.includes("/exportflow-sdk.mjs"));
assert.ok(merchantPage.includes('name="robots" content="noindex,nofollow,noarchive"'));
assert.ok(merchantPage.includes('canonical" href="https://exportflow.me/merchant/"'));
assert.ok(merchantPage.includes("/merchant.js?v="));
await readFile("dist/merchant.js", "utf8");
for (const pageName of trustPageNames) {
  const page = await readFile("dist/" + pageName + "/index.html", "utf8");
  assert.ok(page.includes('<link rel="canonical"'), pageName + " page must retain its canonical URL");
  assert.ok(page.includes("/styles.css?v=ef-ui-refresh-20261106-01"), pageName + " page must load the shared design stylesheet");
}

const sitemap = await readFile("dist/sitemap.xml", "utf8");
const locations = [...sitemap.matchAll(/<loc>(https:\/\/exportflow\.me\/[^<]*)<\/loc>/g)].map(match => match[1]);
assert.equal(locations.length, 24, "Built sitemap must include sixteen localized routes, seven trust pages and the developer guide");
assert.ok(sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));
assert.ok(locations.includes("https://exportflow.me/privacy/"));
assert.ok(locations.includes("https://exportflow.me/terms/"));
assert.ok(locations.includes("https://exportflow.me/developers/"));
assert.ok(!locations.includes("https://exportflow.me/merchant/"));
for (const pageName of trustPageNames) {
  assert.ok(locations.includes("https://exportflow.me/" + pageName + "/"), "Built sitemap must include " + pageName);
}
assert.ok(!sitemap.includes("/api/") && !sitemap.includes("trackingNumber="));

console.log("Localized page artifacts, canonical URLs and hreflang sitemap verified.");
