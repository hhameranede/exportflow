import test from "node:test";
import assert from "node:assert/strict";
import { handleWebsiteRequest } from "../src/site/router.js";
import { MARKETING_PATHS } from "../src/site/marketing.js";

const ORIGIN = "https://exportflow.test";
const LOCALIZED_PATH = /^\/(en|ar|fr|es|de|pt|zh|ja)\//;

function getWebsiteResponse(path) {
  const request = new Request(new URL(path, ORIGIN));
  return handleWebsiteRequest(request, new URL(request.url));
}

test("every marketing sitemap route renders one marketing client script and stylesheet", async () => {
  const paths = [...new Set(MARKETING_PATHS)];
  assert.ok(paths.length > 0, "marketing sitemap should expose routes");

  for (const path of paths) {
    const response = getWebsiteResponse(path);
    assert.ok(response, `${path} should resolve to a marketing page`);
    assert.equal(response.status, 200, `${path} should return HTTP 200`);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/i);

    const html = await response.text();
    const scripts = html.match(/<script src="\/assets\/marketing\.js(?:\?[^"]*)?" defer><\/script>/g) ?? [];
    const stylesheets = html.match(/<link rel="stylesheet" href="\/assets\/marketing\.css(?:\?v=2)?">/g) ?? [];
    assert.equal(scripts.length, 1, `${path} should include the marketing client exactly once`);
    assert.equal(stylesheets.length, 1, `${path} should include the marketing stylesheet exactly once`);
    assert.doesNotMatch(html, /<script src="\/assets\/site\.js"/);

    const locale = LOCALIZED_PATH.exec(path)?.[1] ?? "en";
    if (locale === "ar") {
      assert.match(html, /<html lang="ar" dir="rtl">/);
    } else {
      assert.match(html, new RegExp(`<html lang="${locale}">`));
    }
  }
});

test("localized root routes set document language and Arabic text direction", async () => {
  for (const [path, locale] of [["/ar/", "ar"], ["/fr/", "fr"], ["/zh/", "zh"]]) {
    const response = getWebsiteResponse(path);
    assert.ok(response, `${path} should resolve`);
    const html = await response.text();

    if (locale === "ar") {
      assert.match(html, /<html lang="ar" dir="rtl">/);
    } else {
      assert.match(html, new RegExp(`<html lang="${locale}">`));
      assert.doesNotMatch(html, new RegExp(`<html lang="${locale}" dir=`));
    }
  }
});

test("marketing JavaScript, CSS, and sitemap are served by the website router", async () => {
  const script = getWebsiteResponse("/assets/marketing.js");
  assert.ok(script);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type") ?? "", /javascript/i);

  const stylesheet = getWebsiteResponse("/assets/marketing.css");
  assert.ok(stylesheet);
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get("content-type") ?? "", /text\/css/i);

  const sitemap = getWebsiteResponse("/sitemap.xml");
  assert.ok(sitemap);
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type") ?? "", /xml/i);
  const xml = await sitemap.text();
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(([, value]) => new URL(value).pathname);
  assert.deepEqual(locations, [...new Set(MARKETING_PATHS)]);
});

test("unknown website paths do not fall through to a marketing page", () => {
  assert.equal(getWebsiteResponse("/not-a-marketing-route"), null);
});
