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

test("unified design system serves /platform, /use-cases, /developers, /demo, and /index.html with interactive rich content", async () => {
  for (const path of ["/", "/index.html", "/platform", "/use-cases", "/developers", "/demo", "/product", "/pricing", "/integrations", "/solutions", "/about"]) {
    const html = await fetchHtml(path);
    assert.match(html, /<link rel="stylesheet" href="\/assets\/marketing\.css\?v=2">/);
    assert.match(html, /<script src="\/assets\/marketing\.js" defer><\/script>/);
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
  assert.match(MARKETING_CSS, /min-height:\s*44px;/);
});

