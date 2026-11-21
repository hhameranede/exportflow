import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { SITE_JS } from "../src/site/client.js";
import {
  DEMO_POLICY_SOURCE,
  evaluateDemoLimits,
  validateUrlForPreview,
} from "../src/site/demo-policy.js";

const worker = createWorker();
const ORIGIN = "https://exportflow.test";

test("Demo URL policy normalizes a trailing DNS root dot before validation", () => {
  assert.deepEqual(
    validateUrlForPreview("https://Example.COM./docs#section"),
    { ok: true, href: "https://example.com/docs" },
  );
});

test("Demo URL policy rejects trailing-dot localhost and reserved destinations", () => {
  for (const url of [
    "http://localhost./admin",
    "http://service.localhost./",
    "https://metadata.google.internal./",
    "http://127.0.0.1/admin",
    "ftp://example.com/",
    "https://user:pass@example.com/",
    "https://example.com:8443/",
  ]) assert.equal(validateUrlForPreview(url).ok, false, url);
});

test("Demo redirect, timeout, and UTF-8 byte limits drive the displayed outcome", () => {
  assert.equal(evaluateDemoLimits({
    timeoutMs: 8000, maxBytes: 1024, maxRedirects: 0,
    durationMs: 76, responseBytes: 100, redirectCount: 1,
  }).code, "TOO_MANY_REDIRECTS");
  assert.equal(evaluateDemoLimits({
    timeoutMs: 75, maxBytes: 1024, maxRedirects: 1,
    durationMs: 76, responseBytes: 100, redirectCount: 1,
  }).code, "UPSTREAM_TIMEOUT");

  const utf8Bytes = new TextEncoder().encode("é").byteLength;
  assert.equal(utf8Bytes, 2);
  assert.equal(evaluateDemoLimits({
    timeoutMs: 76, maxBytes: 1, maxRedirects: 1,
    durationMs: 76, responseBytes: utf8Bytes, redirectCount: 1,
  }).code, "RESPONSE_TOO_LARGE");
  assert.equal(evaluateDemoLimits({
    timeoutMs: 76, maxBytes: 2, maxRedirects: 1,
    durationMs: 76, responseBytes: utf8Bytes, redirectCount: 1,
  }), null);
});

test("browser Demo script embeds the same tested policy functions and measures UTF-8 bytes", () => {
  assert.ok(SITE_JS.includes(DEMO_POLICY_SOURCE));
  assert.match(SITE_JS, /evaluateDemoLimits\(/);
  assert.match(SITE_JS, /new TextEncoder\(\)\.encode\(body\)\.byteLength/);
});

test("all six public pages render with canonical metadata and restrictive security headers", async () => {
  for (const path of ["/", "/platform", "/use-cases", "/developers", "/demo", "/faq"]) {
    const response = await worker.fetch(new Request(ORIGIN + path), {});
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("content-security-policy"), /script-src 'self'/);
    assert.match(response.headers.get("content-security-policy"), /style-src 'self'/);
    assert.doesNotMatch(response.headers.get("content-security-policy"), /unsafe-inline|unsafe-eval/);

    const html = await response.text();
    assert.ok(html.includes('<link rel="canonical" href="' + ORIGIN + (path === "/" ? "/" : path) + '">'), path);
    assert.ok(
      html.includes('href="/assets/site.css"') ||
      html.includes('href="/assets/marketing.css"') ||
      html.includes('href="/assets/marketing.css?v=2"'),
      path,
    );
    assert.ok(
      html.includes('<script src="/assets/site.js" defer></script>') ||
      html.includes('<script src="/assets/marketing.js" defer></script>'),
      path,
    );
    assert.doesNotMatch(html, /\son(?:click|input|change|submit|load|error)\s*=/i);
  }
});

test("website assets, robots, and sitemap are available with expected content types", async () => {
  const assets = [
    ["/assets/site.css", /text\/css/, "ef-"],
    ["/assets/site.js", /javascript/, "validateUrlForPreview"],
    ["/assets/mark.svg", /image\/svg\+xml/, "<svg"],
    ["/assets/og-card.svg", /image\/svg\+xml/, "<svg"],
    ["/robots.txt", /text\/plain/, "Sitemap: https://exportflow.test/sitemap.xml"],
    ["/sitemap.xml", /application\/xml/, "https://exportflow.test/demo"],
  ];
  for (const [path, typePattern, marker] of assets) {
    const response = await worker.fetch(new Request(ORIGIN + path), {});
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type"), typePattern, path);
    assert.ok((await response.text()).includes(marker), path);
  }
});

test("website HEAD routes return headers without a response body", async () => {
  for (const path of ["/demo", "/assets/site.css", "/sitemap.xml"]) {
    const response = await worker.fetch(new Request(ORIGIN + path, { method: "HEAD" }), {});
    assert.equal(response.status, 200, path);
    assert.equal(await response.text(), "", path);
  }
});

test("unknown website routes remain 404 and foundation API routes remain available", async () => {
  assert.equal((await worker.fetch(new Request(ORIGIN + "/not-a-route"), {})).status, 404);
  const health = await worker.fetch(new Request(ORIGIN + "/api/v1/health"), {});
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");
  assert.equal((await worker.fetch(new Request(ORIGIN + "/api/v1/tasks"), {})).status, 405);
});
