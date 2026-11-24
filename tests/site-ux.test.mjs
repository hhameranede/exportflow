import test from "node:test";
import assert from "node:assert/strict";
import { handleWebsiteRequest } from "../src/site/router.js";
import { MARKETING_PATHS } from "../src/site/marketing.js";
import { MARKETING_JS } from "../src/site/marketing-client.js";
import { MARKETING_CSS } from "../src/site/marketing-styles.js";

const ORIGIN = "https://exportflow.test";

async function fetchHtml(path) {
  const response = await handleWebsiteRequest(new Request(ORIGIN + path), new URL(ORIGIN + path));
  assert.ok(response, `${path} should resolve`);
  assert.equal(response.status, 200, `${path} should return HTTP 200`);
  return response.text();
}

test("FAQ is included in the marketing routes and renders seven accessible disclosures", async () => {
  assert.ok(MARKETING_PATHS.includes("/faq"));
  const html = await fetchHtml("/faq");
  assert.equal((html.match(/data-faq-item/g) || []).length, 7);
  assert.match(html, /<details[^>]*open/);
  assert.match(html, /aria-label="Frequently asked questions"/);
  assert.match(html, /public REST Task contract/i);
});

test("marketing hierarchy removes decorative overlines and keeps meaningful process context", async () => {
  for (const path of ["/", "/platform", "/use-cases", "/developers", "/demo", "/faq", "/contact", "/signin", "/signup", "/account"]) {
    const html = await fetchHtml(path);
    assert.doesNotMatch(html, /class="ef-kicker(?:\s|")/, path + " should not render decorative overlines");
    assert.doesNotMatch(html, /class="ef-section-glyph"/, path + " should not render repeated heading icon tiles");
    assert.doesNotMatch(html, /class="ef-auth-brand-badge"/, path + " should not repeat the brand mark beside page titles");
    assert.doesNotMatch(html, /assets\/aistudio\//, path + " should not reference generated Studio assets");
  }

  const homeHtml = await fetchHtml("/");
  assert.doesNotMatch(homeHtml, /class="ef-cap-num"/, "capability cards are not a numbered sequence");
  assert.doesNotMatch(homeHtml, /EF\/01/, "decorative graph identifiers should not be shown");
  assert.match(homeHtml, /data-step-trigger="0"/, "the actual execution sequence remains interactive");
  assert.match(homeHtml, /class="ef-timeline-dot"/, "the meaningful process timeline remains numbered");

  const platformHtml = await fetchHtml("/platform");
  assert.match(platformHtml, /class="ef-layer-step"/, "ordered architecture layers retain their step context");
});

test("marketing client bundle parses, protects the mobile drawer, and avoids native alert/confirm", () => {
  assert.doesNotThrow(() => new Function(MARKETING_JS));
  assert.match(MARKETING_JS, /menuBtn\.getAttribute\("aria-expanded"\) !== "true"\) return/);
  assert.match(MARKETING_JS, /document\.addEventListener\("keydown"/);
  assert.match(MARKETING_JS, /e\.key !== "Escape"/);
  assert.doesNotMatch(MARKETING_JS, /\bwindow\.confirm\s*\(/);
  assert.doesNotMatch(MARKETING_JS, /\bwindow\.alert\s*\(/);
  assert.match(MARKETING_JS, /function showInlineConfirm\(/);
  assert.match(MARKETING_JS, /data-tab-group/);
  assert.match(MARKETING_JS, /data-demo-workbench/);
  assert.match(MARKETING_JS, /e\.key === "Enter" \|\| e\.key === " "/);
});

test("quick jump palette labels its search field and supports modal keyboard focus behavior", async () => {
  const html = await fetchHtml("/");
  assert.match(html, /<input type="search"[^>]*data-cmd-input[^>]*aria-label="Jump to a page or workspace tool…"/);
  assert.match(MARKETING_JS, /var returnFocusTarget = null;/);
  assert.match(MARKETING_JS, /returnFocusTarget\.isConnected && typeof returnFocusTarget\.focus/);
  assert.match(MARKETING_JS, /if \(backdrop\.hidden \|\| e\.key !== "Tab"\) return;/);
});

test("unified design system serves /platform, /use-cases, /developers, /demo, and /index.html with interactive rich content", async () => {
  for (const path of ["/", "/index.html", "/platform", "/use-cases", "/developers", "/demo", "/product", "/pricing", "/integrations", "/solutions", "/about"]) {
    const html = await fetchHtml(path);
    assert.match(html, /<link rel="stylesheet" href="\/assets\/marketing\.css\?v=\d+">/);
    assert.match(html, /<script src="\/assets\/marketing\.js\?v=6" defer><\/script>/);
    assert.doesNotMatch(html, /\/assets\/site\.(?:css|js)/);
    assert.doesNotMatch(html, /EXPORTFLOW_API_TOKEN/);
  }

  const platformHtml = await fetchHtml("/platform");
  assert.match(platformHtml, /data-tab-group="platform-layers"/);
  assert.equal((platformHtml.match(/data-tab-trigger="/g) || []).length, 7);
  assert.equal((platformHtml.match(/role="tabpanel"/g) || []).length, 7);

  const useCasesHtml = await fetchHtml("/use-cases");
  assert.equal((useCasesHtml.match(/class="ef-uc-card"/g) || []).length, 5);
  assert.equal((useCasesHtml.match(/data-copy-source="uc-json-/g) || []).length, 5);

  const developersHtml = await fetchHtml("/developers");
  assert.match(developersHtml, /INSUFFICIENT_SCOPE/);
  assert.match(developersHtml, /QUOTA_EXCEEDED/);
  assert.match(developersHtml, /URL_NOT_ALLOWED/);
  assert.match(developersHtml, /BROWSER_UNAVAILABLE/);
  assert.match(developersHtml, /TenantBurstRateLimiter/);

  const demoHtml = await fetchHtml("/demo");
  assert.match(demoHtml, /data-demo-workbench/);
  assert.match(demoHtml, /Simulation only · 0 external network requests/);
  assert.equal((demoHtml.match(/data-demo-preset="/g) || []).length, 5);
  assert.equal((demoHtml.match(/data-demo-stage="/g) || []).length, 5);
  assert.equal((demoHtml.match(/data-demo-out="/g) || []).length, 4);
});

test("execution graph and contact form expose accessible roles, states, and RTL-ready styles", async () => {
  const homeHtml = await fetchHtml("/");
  assert.match(homeHtml, /class="ef-graph-tooltip"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(homeHtml, /<button type="button" class="ef-m-node" data-graph-node="agent" aria-pressed=/);
  assert.match(homeHtml, /<button type="button" class="ef-m-engine[^"]*" data-graph-node="http" aria-pressed=/);

  const contactHtml = await fetchHtml("/contact");
  assert.doesNotMatch(contactHtml, /class="ef-field-error"[^>]*role="alert"/);
  assert.match(contactHtml, /data-form-status/);

  assert.match(MARKETING_CSS, /html\[dir="rtl"\] \.ef-nav a::after\s*\{\s*transform-origin:\s*right;/);
  assert.match(MARKETING_CSS, /\.ef-faq-summary\s*\{[\s\S]*padding-inline-start:\s*22px;[\s\S]*padding-inline-end:\s*52px;/);
  assert.match(MARKETING_CSS, /html\[data-motion="paused"\] \.ef-reveal/);
  assert.match(MARKETING_CSS, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.ef-main\s*\{\s*animation:\s*none;/);
  assert.match(MARKETING_CSS, /min-height:\s*44px;/);
  assert.match(MARKETING_CSS, /--text: #172338/);
  assert.match(MARKETING_CSS, /--bg: #0B1322/);
  assert.match(MARKETING_CSS, /\.ef-account-settings-nav/);
  assert.match(MARKETING_CSS, /\.ef-legal-progress/);
});

test("every declared marketing route renders its shared navigation and page shell", async () => {
  for (const path of MARKETING_PATHS) {
    const html = await fetchHtml(path);
    assert.match(html, /<main id="main-content"/u, path + " should have a main landmark");
    assert.match(html, /<h1(?:\s|>)/u, path + " should have a page heading");
    assert.match(html, /aria-label="Primary navigation"/u, path + " should have primary navigation");
  }
});

test("legal routes expose readable section navigation without changing review-gated copy", async () => {
  for (const path of ["/legal/terms", "/legal/privacy", "/legal/cookies", "/legal/refund-policy", "/legal/acceptable-use", "/legal/security"]) {
    const html = await fetchHtml(path);
    assert.match(html, /data-legal-document/u, path + " should use the legal reading layout");
    assert.match(html, /data-reading-progress/u, path + " should expose reading progress");
    assert.equal((html.match(/data-legal-toc-link/g) || []).length, 4, path + " should link every document section");
    assert.match(html, /Review required before publication/u, path + " must retain the legal review notice");
    assert.match(html, /It is not legal advice/u, path + " must retain the existing legal disclaimer");
  }
});


test("capability cards keep icons beside titles and preserve mobile metrics, filters, and CTA clearance", async () => {
  for (const path of ["/", "/ar/"]) {
    const html = await fetchHtml(path);
    const rows = [...html.matchAll(/<div class="ef-title-icon-row">([\s\S]*?)<\/div>/gu)].map((match) => match[1]);
    const cards = html.match(/\bdata-cap-card(?:\s|>)/gu) ?? [];

    assert.ok(rows.length > 0, path + " should render capability title rows");
    assert.equal(rows.length, cards.length, path + " should render one icon/title row per capability card");
    for (const row of rows) {
      assert.match(row, /<span class="ef-feature-icon"[^>]*>[\s\S]*?<h3>/u,
        path + " should place the feature icon before its heading in the same row");
    }
  }

  assert.match(MARKETING_CSS,
    /\.ef-title-icon-row\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*row;[^}]*align-items:\s*center;/su,
    "feature icon and title must share a horizontal, vertically centered flex row");
  assert.match(MARKETING_CSS, /\.ef-feature-icon\s*\{[^}]*flex:\s*0 0 38px;/su,
    "feature icons must keep a stable 38px basis and must not shrink");
  assert.match(MARKETING_CSS,
    /\.ef-title-icon-row h3\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-width:\s*0;[^}]*margin:\s*0;/su,
    "feature titles must use the remaining row width and wrap without pushing the icon");

  assert.match(MARKETING_CSS,
    /\.ef-spec-strip dd,\s*\.ef-spec-value\s*\{[^}]*white-space:\s*nowrap;/su,
    "metric number and unit must remain on one line");
  assert.match(MARKETING_CSS, /\.ef-spec-num\s*\{[^}]*flex:\s*0 0 auto;[^}]*white-space:\s*nowrap;/su);
  assert.match(MARKETING_CSS, /\.ef-spec-unit\s*\{[^}]*flex:\s*0 0 auto;[^}]*white-space:\s*nowrap;/su);

  assert.match(MARKETING_CSS,
    /\.ef-cap-filter-bar\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;/su,
    "mobile category filters must stay in one horizontally scrollable row");
  assert.match(MARKETING_CSS,
    /\.ef-filter-pill\s*\{[^}]*flex:\s*0 0 auto;[^}]*white-space:\s*nowrap;/su);

  assert.match(MARKETING_CSS,
    /body:has\(\.ef-mobile-sticky-cta\.is-visible\)\s*\{[^}]*padding-bottom:\s*calc\(76px \+ env\(safe-area-inset-bottom, 0px\)\);/su,
    "page content must retain clearance above the fixed mobile CTA");
  assert.match(MARKETING_CSS,
    /@media \(max-width: 767px\)\s*\{[\s\S]*?\.ef-mobile-sticky-cta\s*\{[^}]*position:\s*fixed;/su,
    "mobile CTA must remain fixed to the viewport after content clearance is reserved");

  assert.match(MARKETING_CSS,
    /\.ef-demo-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/su,
    "the single-column demo grid must suppress intrinsic track expansion on narrow screens");
  assert.match(MARKETING_CSS,
    /\.ef-demo-grid\s*>\s*\*\s*\{\s*min-width:\s*0;/su,
    "demo grid children must be allowed to shrink below their intrinsic content width");
  assert.match(MARKETING_CSS,
    /@media\s*\(max-width:\s*480px\)\s*\{[^}]*\.ef-badge\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/su,
    "long capability and status badges must wrap on narrow mobile screens");
  assert.match(MARKETING_CSS,
    /\.ef-header-actions\s*\{[^}]*flex-shrink:\s*1;[^}]*min-width:\s*0;/su,
    "header actions must shrink on 320px phone viewports");

  const home = await fetchHtml("/");
  assert.match(home, /marketing\.css\?v=9/u,
    "the stylesheet URL must be versioned so mobile clients do not keep stale CSS");
});

test("account settings navigation points only to existing profile, identity, security, and session controls", async () => {
  const html = await fetchHtml("/account");
  for (const section of ["profile", "connected", "security", "sessions"]) {
    assert.match(html, new RegExp('href="#account-' + section + '"', "u"));
    assert.match(html, new RegExp('id="account-' + section + '"', "u"));
  }
  assert.match(html, /data-profile-reset/u);
  assert.match(html, /data-profile-unsaved/u);
  assert.match(MARKETING_JS, /function syncProfileDirtyState\(/u);
  assert.match(MARKETING_JS, /beforeunload/u);
  assert.match(MARKETING_JS, /data-theme-preference/u);
  assert.match(MARKETING_JS, /systemTheme\.addEventListener\("change"/u);
  assert.match(MARKETING_JS, /data-legal-toc-link/u);
});

