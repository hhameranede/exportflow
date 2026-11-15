import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const locales = ["en", "ar", "es", "zh", "hi", "pt", "fr", "ru"];
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
  for (const html of [home, coverage]) {
    assert.equal((html.match(/rel="alternate" hreflang=/g) || []).length, 9, locale + " page must publish eight languages plus x-default");
    for (const alternate of locales) {
      assert.ok(html.includes('hreflang="' + alternate + '"'), locale + " page is missing " + alternate + " hreflang");
    }
  }
}

const trustPageNames = ["about", "contact", "privacy", "terms", "cookies", "security", "disclaimer", "companies"];
for (const pageName of trustPageNames) {
  const page = await readFile("dist/" + pageName + "/index.html", "utf8");
  assert.ok(page.includes('<link rel="canonical"'), pageName + " page must retain its canonical URL");
  assert.ok(page.includes("/styles.css?v=ef-ui-refresh-20261106-01"), pageName + " page must load the shared design stylesheet");
}

const licensesPage = await readFile("dist/licenses/index.html", "utf8");
assert.ok(licensesPage.includes('<link rel="canonical" href="https://exportflow.me/licenses/">'));
assert.ok(licensesPage.includes("/licenses/manifest.json"));

const sitemap = await readFile("dist/sitemap.xml", "utf8");
const locations = [...sitemap.matchAll(/<loc>(https:\/\/exportflow\.me\/[^<]*)<\/loc>/g)].map(match => match[1]);
assert.equal(locations.length, 25, "Built sitemap must include sixteen localized routes, eight company/trust pages and the license notices page");
assert.ok(sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));
assert.ok(locations.includes("https://exportflow.me/privacy/"));
assert.ok(locations.includes("https://exportflow.me/terms/"));
assert.ok(locations.includes("https://exportflow.me/licenses/"));
assert.ok(locations.includes("https://exportflow.me/companies/"));
for (const pageName of trustPageNames) {
  assert.ok(locations.includes("https://exportflow.me/" + pageName + "/"), "Built sitemap must include " + pageName);
}
assert.ok(!sitemap.includes("/api/") && !sitemap.includes("trackingNumber="));

console.log("Localized page artifacts, canonical URLs and hreflang sitemap verified.");
