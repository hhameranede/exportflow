import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, script, build, headers, sitemap] = await Promise.all([
  readFile("merchant/index.html", "utf8"),
  readFile("merchant.js", "utf8"),
  readFile("scripts/build.mjs", "utf8"),
  readFile("_headers", "utf8"),
  readFile("sitemap.xml", "utf8")
]);

assert.ok(html.includes('name="robots" content="noindex,nofollow,noarchive"'));
assert.ok(html.includes("https://exportflow.me/merchant/"));
assert.ok(html.includes("Device-only storage"));
assert.ok(html.includes('id="exportCsv"'));
assert.ok(html.includes('id="metricTotal"'));
assert.ok(html.includes('id="metricDelivered"'));
assert.ok(html.includes("merchant.js?v="));
assert.ok(script.includes("localStorage.getItem(STORAGE_KEY)"));
assert.ok(script.includes("localStorage.setItem(STORAGE_KEY"));
assert.ok(script.includes("client.batchTrack"));
assert.ok(script.includes("offset += 5"));
assert.ok(script.includes("createObjectURL"));
assert.ok(script.includes("replaceAll"));
assert.ok(script.includes("text = \"'\" + text"), "CSV formula neutralization must be present");
assert.ok(script.includes("textContent"));
assert.ok(!script.includes(".innerHTML ="), "Carrier and user data must never be interpolated as HTML");
assert.ok(build.includes('"merchant.js"'));
assert.ok(build.includes('"merchant"'));
assert.ok(headers.includes("/merchant/"));
assert.ok(headers.includes("X-Robots-Tag: noindex, nofollow, noarchive"));
assert.ok(!sitemap.includes("https://exportflow.me/merchant/"), "Device-only workspace must not be in the indexable sitemap");

console.log("Merchant workspace privacy, local storage, batch limits, safe rendering and CSV export verified.");
