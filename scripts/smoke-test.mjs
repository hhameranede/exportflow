import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { COUNTRY_CODES } from "../functions/lib/country-codes.mjs";
import { localeForCountry, localeForVisitor, onRequest } from "../functions/_middleware.js";

const [
  html, css, js, translationsSource, coverageHtml, coverageJs, trackApi, coverageApi, build,
  robots, sitemap, headers, carriersApi, privacyHtml, termsHtml, middleware
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
  readFile("functions/api/carriers.js", "utf8"),
  readFile("privacy/index.html", "utf8"),
  readFile("terms/index.html", "utf8"),
  readFile("functions/_middleware.js", "utf8")
]);

const trustPageNames = ["about", "contact", "privacy", "terms", "cookies", "security", "disclaimer"];
const trustPages = await Promise.all(
  trustPageNames.map(page => readFile(page + "/index.html", "utf8"))
);

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
assert.match(trackApi, /\^\(en\|ar\|es\|zh\|hi\|pt\|fr\|ru\)\$/i, "Tracking API must accept exactly the eight supported locales");
assert.match(js, /html\.dir\s*=\s*locale === "ar" \? "rtl" : "ltr"/, "Arabic must switch the page to RTL");
assert.match(js, /localStorage\.setItem\("exportflow-language"/, "Language choice must persist");
assert.doesNotMatch(js, /EXF-DEMO-001/, "The fake sample parcel flow must not be presented as live tracking");
assert.doesNotMatch(html, /98\.4%|200\+ carriers worldwide/i, "Unverified homepage statistics must be removed");

assert.match(js, /fetch\("\/api\/track"/, "Tracking form must call the server-side tracking API");
assert.match(js, /postcodeInput\.value\.trim\(\)/, "Optional postcode should be submitted to the API");
assert.match(js, /renderTimeline/, "Live scan history should be rendered into the timeline");
assert.match(trackApi, /createExportFlowCarrierEngine/, "Tracking API must use the ExportFlow carrier engine facade");
assert.match(trackApi, /resolveShipmentTruth/, "Tracking API must use the shipment truth engine");
assert.match(trackApi, /truth\./, "Tracking API must return truth object with latestReceived, latestTrusted, conflicts, and insights");
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
assert.match(html, /styles\.css\?v=ef-ui-refresh-20261106-01/, "Homepage CSS must use a fresh cache-busting release URL");
assert.match(html, /translations\.js\?v=ef-ui-refresh-20261106-01/, "Translations must use a fresh cache-busting release URL");
assert.match(html, /app\.js\?v=ef-ui-refresh-20261106-01/, "Homepage application JS must use fresh locale-routing code");
assert.ok(headers.includes("/app.js\n  Cache-Control: public, max-age=0, must-revalidate"), "Homepage app JavaScript must be revalidated");
assert.match(robots, /User-agent: \*/);
assert.match(robots, /Allow: \/api\/coverage/, "Search engines must be allowed to load the directory data");
assert.match(robots, /Disallow: \/api\/track/);
assert.doesNotMatch(robots, /Disallow: \/api\/coverage/);
assert.match(coverageApi, /X-Robots-Tag/);
assert.match(robots, /Sitemap: https:\/\/exportflow\.me\/sitemap\.xml/);
const sitemapLocations = [...sitemap.matchAll(/<loc>(https:\/\/exportflow\.me\/[^<]*)<\/loc>/g)].map(match => match[1]);
const expectedLocalizedUrls = locales.flatMap(locale => [
  locale === "en" ? "https://exportflow.me/" : "https://exportflow.me/" + locale + "/",
  locale === "en" ? "https://exportflow.me/coverage/" : "https://exportflow.me/" + locale + "/coverage/"
]).concat(["https://exportflow.me/about/", "https://exportflow.me/contact/", "https://exportflow.me/privacy/", "https://exportflow.me/terms/", "https://exportflow.me/cookies/", "https://exportflow.me/security/", "https://exportflow.me/disclaimer/"]);
assert.equal(sitemapLocations.length, 23, "Sitemap must contain sixteen localized URLs and seven trust pages");
assert.deepEqual(sitemapLocations.sort(), expectedLocalizedUrls.sort(), "Sitemap must list every public locale route exactly once");
assert.match(sitemap, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/, "Sitemap must declare the hreflang namespace");
for (const locale of locales) assert.ok(sitemap.includes('hreflang="' + locale + '"'), "Sitemap must include hreflang for " + locale);
assert.doesNotMatch(sitemap, /\/api\/|trackingNumber=/, "Private/API and per-shipment URLs must not enter the sitemap");
assert.equal(localeForCountry("DZ"), "ar", "Algeria must default to Arabic");
assert.equal(localeForCountry("SA"), "ar", "Arabic-speaking countries must default to Arabic");
assert.equal(localeForCountry("FR"), "fr", "France must default to French");
assert.equal(localeForCountry("SN"), "fr", "Francophone countries must default to French");
assert.equal(localeForCountry("ES"), "es", "Spain must default to Spanish");
assert.equal(localeForCountry("BR"), "pt", "Brazil must default to Portuguese");
assert.equal(localeForCountry("CN"), "zh", "China must default to Chinese");
assert.equal(localeForCountry("IN"), "hi", "India must default to Hindi");
assert.equal(localeForCountry("RU"), "ru", "Russia must default to Russian");
assert.equal(localeForCountry("US"), "en", "Countries without a supported locale must fall back to English");
assert.equal(localeForVisitor("CA", "en-CA,en;q=0.9,fr;q=0.8"), "en", "English-preferring visitors in bilingual countries should keep English");
assert.equal(localeForVisitor("CA", "fr-CA,fr;q=0.9,en;q=0.8"), "fr", "French-preferring visitors in bilingual countries should receive French");
assert.equal(localeForVisitor("SG", "zh-SG,zh;q=0.9,en;q=0.8"), "zh", "Chinese-preferring visitors in Singapore should receive Chinese");

const algeriaRedirect = await onRequest({
  request: { method: "GET", url: "https://exportflow.me/", headers: new Headers(), cf: { country: "DZ" } },
  next: () => new Response("next")
});
assert.equal(algeriaRedirect.status, 302);
assert.equal(algeriaRedirect.headers.get("Location"), "https://exportflow.me/ar/");
assert.match(algeriaRedirect.headers.get("Set-Cookie") || "", /ef-locale=ar/);

const franceCoverageRedirect = await onRequest({
  request: { method: "GET", url: "https://exportflow.me/coverage/?source=test", headers: new Headers(), cf: { country: "FR" } },
  next: () => new Response("next")
});
assert.equal(franceCoverageRedirect.headers.get("Location"), "https://exportflow.me/fr/coverage/?source=test");

let englishPreferencePassedThrough = false;
const englishPreference = await onRequest({
  request: { method: "GET", url: "https://exportflow.me/", headers: new Headers({ Cookie: "ef-locale=en" }), cf: { country: "DZ" } },
  next: () => { englishPreferencePassedThrough = true; return new Response("next"); }
});
assert.equal(englishPreference.status, 200);
assert.equal(englishPreferencePassedThrough, true, "An explicit English preference must override the visitor's country");

let crawlerPassedThrough = false;
await onRequest({
  request: { method: "GET", url: "https://exportflow.me/", headers: new Headers({ "User-Agent": "Googlebot" }), cf: { country: "FR" } },
  next: () => { crawlerPassedThrough = true; return new Response("next"); }
});
assert.equal(crawlerPassedThrough, true, "Search crawlers must not be geo-redirected away from the canonical entry point");
assert.match(middleware, /request\.cf\?\.country/, "First-visit locale detection must use Cloudflare's country code");
assert.match(middleware, /ef-locale/, "An explicit user language preference must override geolocation");
assert.match(middleware, /Cache-Control.*private, no-store/, "Geo redirects must not be cached between visitors");
assert.match(js, /window\.history\.replaceState/, "Homepage language choices must update the locale URL");
assert.match(coverageJs, /window\.history\.replaceState/, "Coverage language choices must update the locale URL");
assert.match(js, /ef-locale=/, "Homepage must persist language choice in a cookie");
assert.match(coverageJs, /ef-locale=/, "Coverage page must persist language choice in a cookie");
assert.match(build, /generateLocalizedPages/, "Build must generate static locale pages");
assert.match(build, /hreflang/, "Generated locale pages must contain hreflang alternates");
assert.match(privacyHtml, /<link rel="canonical" href="https:\/\/exportflow\.me\/privacy\/"\s*\/?>/);
assert.match(termsHtml, /<link rel="canonical" href="https:\/\/exportflow\.me\/terms\/"\s*\/?>/);

assert.equal(COUNTRY_CODES.length, 249, "ISO 3166-1 assigned country/territory list should contain 249 alpha-2 codes");
assert.match(coverageHtml, /coverage\.js\?v=ef-ui-refresh-20261106-01/, "Coverage client must use fresh locale-routing code");
assert.match(coverageHtml, /<link rel="canonical" href="https:\/\/exportflow\.me\/coverage\/"\s*\/?>/);
assert.match(coverageHtml, /application\/ld\+json/);
assert.match(coverageHtml, /id="coverageSearch"/);
assert.match(coverageHtml, /id="coverageFilter"/);
assert.equal((coverageHtml.match(/data-country-code="/g) || []).length, 249, "Coverage directory must statically list all 249 country/territory codes");
assert.match(coverageHtml, /not a guarantee that every parcel can be tracked/i, "Coverage page must explain that catalog presence is not a guarantee");
assert.match(coverageJs, /fetch\("\/api\/coverage"/);
assert.match(coverageJs, /Intl\.DisplayNames/, "Country names should be localized");
assert.match(coverageJs, /row\.dataset\.carriersSearch = names\.join\(" "\)/, "Directory search must include every carrier, not only displayed names");
assert.match(coverageJs, /row\.dataset\.carriersSearch/, "Carrier search index must be used when filtering countries");
assert.match(coverageJs, /coverageStatusDirect/);
assert.match(coverageJs, /coverageStatusFallback/);
assert.match(coverageJs, /coverageStatusLink/);
assert.match(coverageJs, /coverageStatusNone/);
assert.match(coverageApi, /CARRIERS/);
assert.match(coverageApi, /universal-fallback/);
assert.match(coverageApi, /link-only/);
assert.match(coverageApi, /not-listed/);
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
assert.match(build, /localizedPageSpecs/, "Build must generate localized copies of the homepage and coverage directory");

console.log("ExportFlow geo-language routing, localized SEO pages, tracking, coverage and sitemap tests passed.");

for (const id of ["journeyCard", "journeyProgressTrack", "stepInfo", "stepTransit", "stepDelivery", "stepDelivered"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "New tracking journey UI is missing: " + id);
}
for (const pageName of trustPageNames) {
  assert.match(html, new RegExp('href="/' + pageName + '/"'), "Homepage footer must link to " + pageName);
  assert.match(sitemap, new RegExp("https://exportflow\\.me/" + pageName + "/"), "Sitemap must include " + pageName);
  assert.ok(build.includes('"' + pageName + '"'), "Build must copy the " + pageName + " page");
}
for (let index = 0; index < trustPageNames.length; index += 1) {
  const pageName = trustPageNames[index];
  const pageHtml = trustPages[index];
  assert.match(pageHtml, /<link rel="canonical"/, pageName + " must include a canonical URL");
  assert.ok(pageHtml.includes("/styles.css?v=ef-ui-refresh-20261106-01"), pageName + " must load the new shared stylesheet");
}
assert.match(build, /const publicPageDirectories/, "Cloudflare build must include all seven trust pages");
assert.match(css, /\.trust-page/, "Trust Center pages must share the new site theme");
assert.match(css, /\.trust-hero/, "Trust Center hero styling must exist");
assert.match(css, /body\.coverage-page \.legal-container/, "Privacy and terms pages must share the new card layout");
assert.match(html, /data-count-up/, "Catalog values must be marked for count-up animation");
assert.match(js, /function animateCatalogMetric/, "Catalog counts must use the animated counter");
assert.match(js, /IntersectionObserver/, "Counters should animate when visible");
assert.match(js, /history\.scrollRestoration = "manual"/, "Fresh homepage visits must disable stale scroll restoration");
assert.match(js, /addEventListener\("pageshow"/, "Homepage must re-check initial scroll position after page display");
console.log("ExportFlow Hi design, trust pages, counters and scroll restoration verified.");