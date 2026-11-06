import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { COUNTRY_CODES } from "../functions/lib/country-codes.mjs";
const [html, css, js, translationsSource, coverageHtml, coverageJs, trackApi, coverageApi, build, robots, sitemap, headers, carriersApi] = await Promise.all([
  readFile("index.html", "utf8"), readFile("styles.css", "utf8"), readFile("app.js", "utf8"), readFile("translations.js", "utf8"),
  readFile("coverage/index.html", "utf8"), readFile("coverage.js", "utf8"), readFile("functions/api/track.js", "utf8"), readFile("functions/api/coverage.js", "utf8"),
  readFile("scripts/build.mjs", "utf8"), readFile("robots.txt", "utf8"), readFile("sitemap.xml", "utf8"), readFile("_headers", "utf8"), readFile("functions/api/carriers.js", "utf8")
]);
assert.match(html, /<html[^>]+lang="en"[^>]+dir="ltr"/i, "English LTR homepage should exist");
for (const id of ["trackingForm","trackingNumber","postcodeInput","languageToggle","resultPanel","shipmentMap","mapNote","eventCount","faq","catalogEntryCount","directCountryCount","isoCountryCount"]) assert.match(html, new RegExp('id="' + id + '"'), "Missing required homepage element: " + id);
const localeMatch = translationsSource.match(/window\.EXPORTFLOW_TRANSLATIONS\s*=\s*([\s\S]*);\s*$/);
assert.ok(localeMatch, "Translation bundle must expose a JSON-compatible locale dictionary");
const translations = JSON.parse(localeMatch[1]); const locales = ["en","ar","es","zh","hi","pt","fr","ru"];
assert.deepEqual(Object.keys(translations).sort(), [...locales].sort(), "Exactly eight selectable locales must have translation dictionaries");
const expectedKeys = Object.keys(translations.en).sort(); assert.ok(expectedKeys.length >= 90, "The homepage and coverage UI translation bundle should be complete");
for (const locale of locales) { assert.deepEqual(Object.keys(translations[locale]).sort(), expectedKeys, locale + " must provide every translation key"); assert.ok(translations[locale].metaDescription, locale + " must include translated SEO description"); }
for (const locale of locales) assert.match(html, new RegExp('<option value="' + locale + '"'), "Language selector is missing " + locale);
for (const [pageName,pageHtml] of [["homepage",html],["coverage page",coverageHtml]]) { const keys=[...pageHtml.matchAll(/data-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g)].map(m=>m[1]); for (const key of keys) assert.ok(expectedKeys.includes(key),pageName+" references a missing translation key: "+key); }
assert.match(js,/supportedLocales\s*=\s*\["en","ar","es","zh","hi","pt","fr","ru"\]/); assert.match(trackApi,/\^\(en\|ar\|es\|zh\|hi\|pt\|fr\|ru\)\$/i);
assert.match(js,/html\.dir\s*=\s*locale === "ar" \? "rtl" : "ltr"/); assert.match(js,/localStorage\.setItem\("exportflow-language"/);
assert.doesNotMatch(js,/EXF-DEMO-001/); assert.doesNotMatch(html,/98\.4%|200\+ carriers worldwide/i);
assert.match(js,/fetch\("\/api\/track"/); assert.match(js,/postcodeInput\.value\.trim\(\)/); assert.match(js,/renderTimeline/); assert.match(trackApi,/createTracker/); assert.match(trackApi,/safeEventPoint\(event\.point\)/); assert.match(js,/renderShipmentMap/); assert.match(js,/https:\/\/tile\.openstreetmap\.org/); assert.match(trackApi,/readBoundedBody/); assert.match(trackApi,/Cache-Control/); assert.match(trackApi,/MAX_CONCURRENT_LOOKUPS/);
assert.match(html,/href="https:\/\/exportflow\.me\/"|href="\/"/); assert.match(html,/name="robots" content="index,follow/); assert.match(html,/application\/ld\+json/); assert.match(html,/property="og:title"/);
for (const asset of ["favicon.svg","favicon-32x32.png","apple-touch-icon.png","site.webmanifest","og-image-20261106.png"]) assert.ok(build.includes('"'+asset+'"'),"Build must copy brand asset: "+asset);
assert.ok(headers.includes("/og-image-20261106.png\n  Cache-Control: public, max-age=31536000, immutable"));
assert.match(html,/href="\/coverage\//); assert.match(robots,/User-agent: \*/); assert.match(robots,/Allow: \/api\/coverage/); assert.match(robots,/Disallow: \/api\/track/); assert.doesNotMatch(robots,/Disallow: \/api\/coverage/);
assert.match(coverageApi,/X-Robots-Tag/); assert.match(robots,/Sitemap: https:\/\/exportflow\.me\/sitemap\.xml/); assert.match(sitemap,/https:\/\/exportflow\.me\//); assert.match(sitemap,/https:\/\/exportflow\.me\/coverage\//); assert.doesNotMatch(sitemap,/\/api\/|trackingNumber=/);
assert.equal(COUNTRY_CODES.length,249);
assert.match(coverageHtml,/href="https:\/\/exportflow\.me\/coverage\//); assert.match(coverageHtml,/application\/ld\+json/); assert.match(coverageHtml,/id="coverageSearch"/); assert.match(coverageHtml,/id="coverageFilter"/); assert.equal((coverageHtml.match(/data-country-code="/g)||[]).length,249);
assert.match(coverageHtml,/not a guarantee that every parcel can be tracked/i); assert.match(coverageJs,/fetch\("\/api\/coverage"/); assert.match(coverageJs,/Intl\.DisplayNames/); assert.match(coverageJs,/row\.dataset\.carriersSearch = names\.join\(" "\)/); assert.match(coverageJs,/row\.dataset\.carriersSearch/);
for (const key of ["coverageStatusDirect","coverageStatusFallback","coverageStatusLink","coverageStatusNone"]) assert.match(coverageHtml,new RegExp(key));
assert.match(coverageApi,/CARRIERS/); assert.match(coverageApi,/universal-fallback/); assert.match(coverageApi,/link-only/); assert.match(coverageApi,/not-listed/); assert.match(coverageApi,/SOURCE_REVISION/); assert.match(carriersApi,/CARRIER_IDS/);
assert.match(css,/\.shipment-map/); assert.match(css,/@media\s*\(max-width:\s*680px\)/); assert.match(css,/@media\s*\(max-width:\s*380px\)/); assert.match(css,/html\[dir=rtl\]/); assert.match(css,/\.hero-gridline\{position:absolute;inset:0/); assert.match(css,/\.catalog-stats/); assert.match(css,/\.coverage-country-list/);
const trustPages=["about","contact","privacy","terms","cookies","security","disclaimer"];
for (const page of trustPages) { const pageHtml=await readFile(page+"/index.html","utf8"); assert.match(pageHtml,new RegExp('rel="canonical" href="https://exportflow\\.me/'+page+'/')); assert.match(pageHtml,/hhameranede@gmail\.com/); assert.match(pageHtml,/href="\/privacy\//); assert.ok(build.includes('"'+page+'"'),"Build must include trust page "+page); assert.ok(sitemap.includes('https://exportflow.me/'+page+'/'),"Sitemap must include "+page); assert.ok(headers.includes("/"+page+"/*"),"Headers must include "+page); }
assert.match(html,/href="\/about\//); assert.match(html,/href="\/contact\//); assert.match(html,/href="\/privacy\//);
assert.match(css,/\.trust-page/); assert.match(css,/\.trust-contact-grid/);
console.log("ExportFlow tracking, SEO, coverage, trust pages and build smoke tests passed.");
