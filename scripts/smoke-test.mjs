import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { COUNTRY_CODES } from "../functions/lib/country-codes.mjs";

const [
  html, css, js, translationsSource, coverageHtml, coverageJs, trackApi, coverageApi, build,
  robots, sitemap, headers, carriersApi
] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("app.js", "utf8"),
  readFile("translations.js", "utf8"),
  readFile("coverage/index.html", "utf8"),
  readFile("coverage.js", "utf8"),
  readFile("functions/api/track.js", "utf8"),
  readFile("functions/api/coverage.js", "utf8"),
  readFile("scripts/build.mjs", "utf8"),
  readFile("robots.txt", "utf8"),
  readFile("sitemap.xml", "utf8"),
  readFile("_headers", "utf8"),
  readFile("functions/api/carriers.js", "utf8")
]);

assert.match(html, /<html[^>]+lang="en"[^>]+dir="ltr"/i, "English LTR homepage should exist");
for (const id of [
  "trackingForm", "trackingNumber", "postcodeInput", "languageToggle", "resultPanel",
  "shipmentMap", "mapNote", "eventCount", "faq", "catalogEntryCount",
  "directCountryCount", "isoCountryCount"
]) {
  assert.match(html, new RegExp('id="' + id + '"'), "Missing required homepage element: " + id);
}

const localeMatch = translationsSource.match(/window\.EXPORTFLOW_TRANSLATIONS\s*=\s*([\s\S]*);\s*$/);
assert.ok(localeMatch, "Translation bundle must expose a JSON-compatible locale dictionary");
const translations = JSON.parse(localeMatch[1]);
const locales = ["en", "ar", "es", "zh", "hi", "pt", "fr", "ru"];
assert.deepEqual(Object.keys(translations).sort(), [...locales].sort(), "Exactly eight selectable locales must have translation dictionaries");
const expectedKeys = Object.keys(translations.en).sort();
assert.ok(expectedKeys.length >= 90, "The homepage and coverage UI translation bundle should be complete");
for (const locale of locales) {
  assert.deepEqual(Object.keys(translations[locale]).sort(), expectedKeys, locale + " must provide every translation key");
  assert.ok(translations[locale].metaDescription, locale + " must include translated SEO description");
  assert.ok(translations[locale].resultLiveEyebrow && translations[locale].liveLabel, locale + " must label carrier responses");
}
for (const locale of locales) assert.match(html, new RegExp('<option value="' + locale + '"'), "Language selector is missing " + locale);
for (const [pageName, pageHtml] of [["homepage", html], ["coverage page", coverageHtml]]) {
  const referencedKeys = [
    ...pageHtml.matchAll(/data-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g)
  ].map(match => match[1]);
  for (const key of referencedKeys) {
    assert.ok(expectedKeys.includes(key), pageName + " references a missing translation key: " + key);
  }
}
assert.match(js, /supportedLocales\s*=\s*\["en", "ar", "es", "zh", "hi", "pt", "fr", "ru"\]/);
assert.equal(translations.en.resultLiveEyebrow, "CARRIER RESPONSE", "A returned carrier lookup must not imply a continuously live connection");
assert.equal(translations.en.liveLabel, "Received", "The result badge must describe receipt, not live freshness");
assert.match(trackApi, /\^\(en\|ar\|es\|zh\|hi\|pt\|fr\|ru\)\$/i, "Tracking API must accept exactly the eight supported locales");
assert.match(js, /html\.dir\s*=\s*locale === "ar" \? "rtl" : "ltr"/, "Arabic must switch the page to RTL");
assert.match(js, /localStorage\.setItem\("exportflow-language"/, "Language choice must persist");
assert.doesNotMatch(js, /EXF-DEMO-001/, "The fake sample parcel flow must not be presented as live tracking");
assert.doesNotMatch(html, /98\.4%|200\+ carriers worldwide/i, "Unverified homepage statistics must be removed");

assert.match(js, /fetch\("\/api\/track"/, "Tracking form must call the server-side tracking API");
assert.match(js, /postcodeInput\.value\.trim\(\)/, "Optional postcode should be submitted to the API");
assert.match(js, /renderTimeline/, "Live scan history should be rendered into the timeline");
assert.match(trackApi, /createTracker/, "Tracking API must use the upstream parcel engine");
assert.match(trackApi, /safeEventPoint\(event\.point\)/, "Carrier scan coordinates should be validated before projection");
assert.match(js, /renderShipmentMap/, "Live tracking should render its map panel");
assert.match(js, /https:\/\/tile\.openstreetmap\.org/, "The map should use the OpenStreetMap tile endpoint");
assert.match(trackApi, /readBoundedBody/, "Tracking API must stream and cap request bodies");
assert.match(trackApi, /Cache-Control/, "Tracking API must disable response caching");
assert.match(trackApi, /MAX_CONCURRENT_LOOKUPS/, "Tracking API must bound concurrent lookups");

assert.match(html, /<link rel="canonical" href="https:\/\/exportflow\.me\/"\s*\/?>/);
assert.match(html, /name="robots" content="index,follow/);
assert.match(html, /application\/ld\+json/);
assert.match(html, /property="og:title"/);
assert.ok(html.includes('href="/favicon.svg?v=20261106"'), "SVG favicon must be linked");
assert.ok(html.includes('href="/apple-touch-icon.png?v=20261106"'), "Apple touch icon must be linked");
assert.ok(html.includes('href="/site.webmanifest"'), "Web manifest must be linked");
assert.ok(html.includes('content="https://exportflow.me/og-image-20261106.png"'), "Social preview image must use the production asset");
assert.match(html, /name="twitter:card" content="summary_large_image"/);
for (const asset of ["favicon.svg", "favicon-32x32.png", "apple-touch-icon.png", "site.webmanifest", "og-image-20261106.png"]) {
  assert.ok(build.includes('"' + asset + '"'), "Build must copy the brand asset: " + asset);
}
assert.ok(headers.includes("/og-image-20261106.png\n  Cache-Control: public, max-age=31536000, immutable"), "Versioned social preview image must have immutable caching");

assert.match(html, /href="\/coverage\//, "Homepage must link to the global carrier directory");
assert.match(html, /ef-global-coverage-20261106/, "Homepage stylesheet URL must be cache-busted for this release");
assert.match(robots, /User-agent: \*/);
assert.match(robots, /Allow: \/api\/coverage/, "Search engines must be allowed to load the directory data");
assert.match(robots, /Disallow: \/api\/track/);
assert.doesNotMatch(robots, /Disallow: \/api\/coverage/);
assert.match(coverageApi, /X-Robots-Tag/);
assert.match(robots, /Sitemap: https:\/\/exportflow\.me\/sitemap\.xml/);
assert.match(sitemap, /<loc>https:\/\/exportflow\.me\/<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/exportflow\.me\/coverage\/<\/loc>/);
assert.doesNotMatch(sitemap, /\/api\/|trackingNumber=/, "Private/API and per-shipment URLs must not enter the sitemap");

assert.equal(COUNTRY_CODES.length, 249, "ISO 3166-1 assigned country/territory list should contain 249 alpha-2 codes");
assert.match(coverageHtml, /<link rel="canonical" href="https:\/\/exportflow\.me\/coverage\/"\s*\/?>/);
assert.match(coverageHtml, /application\/ld\+json/);
assert.match(coverageHtml, /id="coverageSearch"/);
assert.match(coverageHtml, /id="coverageFilter"/);
assert.match(coverageHtml, /value="browser-required"/);
assert.equal((coverageHtml.match(/data-country-code="/g) || []).length, 249, "Coverage directory must statically list all 249 country/territory codes");
assert.match(coverageHtml, /not a guarantee that every parcel can be tracked/i, "Coverage page must explain that catalog presence is not a guarantee");
assert.match(coverageJs, /fetch\("\/api\/coverage"/);
assert.match(coverageJs, /Intl\.DisplayNames/, "Country names should be localized");
assert.match(coverageJs, /row\.dataset\.carriersSearch = names\.join\(" "\)/, "Directory search must include every carrier, not only displayed names");
assert.match(coverageJs, /row\.dataset\.carriersSearch/, "Carrier search index must be used when filtering countries");
assert.match(coverageJs, /coverageStatusDirect/);
assert.match(coverageJs, /coverageStatusBrowserRequired/);
assert.match(coverageJs, /carrier\.requiresBrowser/);
assert.match(coverageJs, /coverageStatusFallback/);
assert.match(coverageJs, /coverageStatusLink/);
assert.match(coverageJs, /coverageStatusNone/);
assert.match(coverageApi, /CARRIERS/);
assert.match(coverageApi, /CARRIER_DEFINITIONS/);
assert.match(coverageApi, /browser-required/);
assert.match(coverageApi, /universal-fallback/);
assert.match(coverageApi, /link-only/);
assert.match(coverageApi, /not-listed/);
assert.match(coverageApi, /browserRequiredCountryCount/);
assert.match(coverageApi, /SOURCE_REVISION/);
assert.match(carriersApi, /CARRIER_IDS/);

assert.match(css, /\.shipment-map/, "The result map should have responsive dimensions");
assert.match(css, /@media\s*\(max-width:\s*680px\)/, "Mobile breakpoint should exist");
assert.match(css, /@media\s*\(max-width:\s*380px\)/, "Small-phone breakpoint should exist");
assert.match(css, /html\[dir=rtl\]/, "RTL presentation rules should exist");
assert.match(css, /\.hero-gridline\{position:absolute;inset:0/, "Hero decorative layer must not occupy a grid column");
assert.match(css, /@media \(max-width:680px\)[\s\S]*?\.postcode-field\{display:grid/, "Mobile postcode field should stack label and input");
assert.match(css, /\.header-cta\{[^}]*white-space:nowrap/, "Responsive header CTA must keep its label on one line");
assert.match(css, /\.step-card p\{font-size:14px/, "Mobile step-card copy must remain readable");
assert.match(css, /\.catalog-stats/, "Catalog-backed metric layout styles must exist");
assert.match(css, /\.coverage-country-list/, "Worldwide directory styles must exist");

assert.match(build, /"translations\.js"/);
assert.match(build, /"coverage\.js"/);
assert.match(build, /"robots\.txt"/);
assert.match(build, /"sitemap\.xml"/);
assert.match(build, /coverage\/index\.html/, "Build must include the nested country directory page");

console.log("ExportFlow eight-language, tracking, coverage and SEO smoke tests passed.");
