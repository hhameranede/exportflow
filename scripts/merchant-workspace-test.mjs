import assert from "node:assert/strict";
import { escapeCsvCell } from "../merchant-utils.mjs";
import { readFile } from "node:fs/promises";

const [html, script, utility, build, headers, sitemap] = await Promise.all([
  readFile("merchant/index.html", "utf8"),
  readFile("merchant.js", "utf8"),
  readFile("merchant-utils.mjs", "utf8"),
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
assert.ok(script.includes("let refreshing = false"));
assert.ok(script.includes("if (items.length === 0 || refreshing) return"));
assert.ok(script.includes("refreshing || items.length === 0"), "Refresh and clear actions must stay disabled while a batch is running");
assert.ok(script.includes("createObjectURL"));
assert.ok(script.includes("setTimeout(() => URL.revokeObjectURL(url), 0"));
assert.equal(escapeCsvCell("ordinary value"), '"ordinary value"');
assert.equal(escapeCsvCell('A "quoted" value'), '"A ""quoted"" value"');
assert.equal(escapeCsvCell("=1+1"), '"\'=1+1"');
assert.equal(escapeCsvCell("  =1+1"), '"\'  =1+1"');
assert.equal(escapeCsvCell("\t=1+1"), '"\'\t=1+1"');
assert.equal(escapeCsvCell("\n@SUM(1,1)"), '"\'\n@SUM(1,1)"');
assert.ok(utility.includes("FORMULA_PREFIX"));
assert.ok(utility.includes("replaceAll"));
assert.ok(script.includes("escapeCsvCell"), "Merchant CSV export must use the tested escaping utility");
assert.ok(script.includes("textContent"));
assert.ok(script.includes('delayLevel === "possible"'), "Merchant UI must surface only explicit carrier delay signals");
assert.ok(script.includes('customsState === "hold"'), "Merchant UI must surface explicit customs hold signals");
assert.ok(script.includes('"delay_signal", "customs_state"'), "CSV export must include evidence-based shipment insights");
assert.ok(!script.includes(".innerHTML ="), "Carrier and user data must never be interpolated as HTML");
assert.ok(build.includes('"merchant.js"'));
assert.ok(build.includes('"merchant-utils.mjs"'));
assert.ok(build.includes('"merchant"'));
assert.ok(headers.includes("/merchant/"));
assert.ok(headers.includes("X-Robots-Tag: noindex, nofollow, noarchive"));
assert.ok(!sitemap.includes("https://exportflow.me/merchant/"), "Device-only workspace must not be in the indexable sitemap");

console.log("Merchant workspace privacy, local storage, batch limits, safe rendering and CSV export verified.");
