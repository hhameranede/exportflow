import test from "node:test";
import assert from "node:assert/strict";
import { handleWebsiteRequest } from "../src/site/router.js";
import { MARKETING_PATHS, renderMarketingNotFoundPage } from "../src/site/marketing.js";
import { SEOManager } from "../src/site/seo-manager.js";

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

test("SEOManager emits canonical links, hreflang alternates, dynamic OG tags, and JSON-LD across pages", async () => {
  for (const [path, expectedCanonical, expectedHreflangCount, expectedSchemaTypes] of [
    ["/", `${ORIGIN}/`, 9, ["Organization", "WebSite", "SoftwareApplication"]],
    ["/ar/", `${ORIGIN}/ar`, 9, ["Organization", "WebSite", "SoftwareApplication"]],
    ["/product", `${ORIGIN}/product`, 9, ["WebPage", "BreadcrumbList"]],
    ["/developers", `${ORIGIN}/developers`, 9, ["TechArticle", "BreadcrumbList"]],
    ["/demo", `${ORIGIN}/demo`, 0, ["WebPage", "BreadcrumbList"]],
    ["/platform", `${ORIGIN}/platform`, 0, ["WebPage", "BreadcrumbList"]],
  ]) {
    const response = getWebsiteResponse(path);
    assert.ok(response, `${path} should resolve`);
    const html = await response.text();

    assert.match(html, new RegExp(`<link rel="canonical" href="${expectedCanonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">`));
    assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">/);

    const hreflangs = html.match(/<link rel="alternate" hreflang="[^"]+" href="[^"]+">/g) ?? [];
    assert.equal(hreflangs.length, expectedHreflangCount, `${path} hreflang count`);
    if (expectedHreflangCount > 0) {
      assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/exportflow\.test\/[^"]*">/);
    }

    const ogImageMatch = /<meta property="og:image" content="([^"]+)">/.exec(html);
    assert.ok(ogImageMatch, `${path} should include og:image`);
    assert.match(ogImageMatch[1], /\/assets\/og-card\.svg\?/);
    assert.match(html, /<meta property="og:image:width" content="1200">/);
    assert.match(html, /<meta property="og:image:height" content="630">/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);

    const jsonLdMatch = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
    assert.ok(jsonLdMatch, `${path} should include Schema.org JSON-LD`);
    const parsed = JSON.parse(jsonLdMatch[1]);
    const types = (parsed["@graph"] ?? [parsed]).map((node) => node["@type"]);
    for (const expectedType of expectedSchemaTypes) {
      assert.ok(types.includes(expectedType), `${path} JSON-LD should include ${expectedType}`);
    }
  }
});

test("dynamic Open Graph SVG route reflects query params and escapes XML safely", async () => {
  const res = getWebsiteResponse("/assets/og-card.svg?title=Developers+%3Cscript%3E&eyebrow=EXPORTFLOW+%2F+DOCS&path=%2Fdevelopers");
  assert.ok(res);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /image\/svg\+xml/i);
  const svg = await res.text();
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /Developers &lt;script&gt;/);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /EXPORTFLOW \/ DOCS/);
  assert.match(svg, /\/developers/);
});

test("404 pages omit canonical links and emit noindex nofollow", () => {
  const html = renderMarketingNotFoundPage(`${ORIGIN}/missing`, "en");
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(html, /<link rel="canonical"/);
  assert.doesNotMatch(html, /<link rel="alternate" hreflang=/);
  assert.doesNotMatch(html, /<script type="application\/ld\+json">/);
  assert.ok(SEOManager.buildAlternates({ path: "/404", includeAlternates: false }).length === 0);
});

test("light-first design system and interactive UX components are served cleanly", async () => {
  const home = getWebsiteResponse("/");
  assert.ok(home);
  const html = await home.text();

  assert.match(html, /<meta name="theme-color" content="#F8FAFC">/);
  assert.match(html, /Plus\+Jakarta\+Sans/);
  assert.match(html, /data-graph-scenario="http"/);
  assert.match(html, /data-graph-scenario="search"/);
  assert.match(html, /data-graph-scenario="browser"/);
  assert.match(html, /data-cap-filter="all"/);
  assert.match(html, /data-cap-filter="available"/);
  assert.match(html, /data-step-inspector/);
  assert.match(html, /data-code-tab="request"/);
  assert.match(html, /data-code-tab="response"/);
  assert.match(html, /data-code-tab="guard"/);

  const cssRes = getWebsiteResponse("/assets/marketing.css");
  const css = await cssRes.text();
  assert.match(css, /:root\s*\{\s*color-scheme:\s*light;/);
  assert.match(css, /--bg:\s*#F8FAFC;/);
  assert.match(css, /\.ef-step-inspector\b/);
  assert.match(css, /\.ef-cap-filter-bar\b/);
  assert.match(css, /\.ef-graph-scenarios\b/);
  assert.match(css, /\.ef-code-tabs\b/);

  const jsRes = getWebsiteResponse("/assets/marketing.js");
  const js = await jsRes.text();
  assert.match(js, /function getActiveTheme\(\)[\s\S]*return "light";/);
  assert.ok(js.includes("get-session"));
  assert.ok(js.includes("sign-in/social"));
  assert.ok(js.includes("authReady"));
  assert.ok(js.includes("authentication tables are not initialized"));
  assert.ok(js.includes('requestError.code = data &&'));
  assert.ok(js.includes('sessionError.code === "SESSION_NOT_FRESH"'));
  assert.ok(js.includes('data-auth-session-status'));
  assert.ok(js.includes('Sign in again before managing active sessions.'));
  assert.doesNotMatch(js, /ef_auth_preview|window[.]ExportFlowAuth/);
});

test("account routes render real-auth UI, stay noindex, and are excluded from the sitemap", async () => {
  for (const [path, expectedNeedle] of [
    ["/signin", /data-auth-google/],
    ["/signup", /data-auth-form="signup"/],
    ["/forgot-password", /data-auth-form="forgot"/],
    ["/reset-password", /data-auth-form="reset"/],
    ["/account", /data-account-workspace/],
    ["/ar/signin", /dir="rtl"/],
    ["/ar/account", /data-auth-session-list/],
    ["/ar/reset-password", /dir="rtl"/],
  ]) {
    const res = getWebsiteResponse(path);
    assert.ok(res, path + " should resolve");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const html = await res.text();
    assert.match(html, expectedNeedle);
    if (path === "/account" || path === "/ar/account") {
      assert.match(html, /data-auth-session-status/);
      assert.match(html, /data-session-reauth-href="[^"]*signin"/);
    }
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    assert.doesNotMatch(html, /UI Blueprint|Google Consent Preview|samer\.dev@gmail\.com/);
  }

  const signinResponse = getWebsiteResponse("/signin");
  const signinHtml = await signinResponse.text();
  assert.match(signinHtml, /data-auth-page/);
  assert.match(signinHtml, /data-auth-config-status/);
  assert.match(signinHtml, /data-auth-google/);
  assert.doesNotMatch(signinHtml, /data-google-modal|data-google-preset/);

  for (const path of ["/signin", "/signup", "/forgot-password", "/reset-password", "/account"]) {
    assert.equal(MARKETING_PATHS.includes(path), false, path + " must not appear in sitemap paths");
  }

  const sitemapResponse = getWebsiteResponse("/sitemap.xml");
  const sitemap = await sitemapResponse.text();
  assert.doesNotMatch(sitemap, /<loc>https:\/\/exportflow\.test\/(?:ar\/)?(?:signin|signup|forgot-password|reset-password|account)<\/loc>/);
});


