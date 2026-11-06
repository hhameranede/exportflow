import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js, api] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("app.js", "utf8"),
  readFile("functions/api/track.js", "utf8")
]);

assert.match(html, /<html[^>]+lang="en"[^>]+dir="ltr"/i, "English LTR document should exist");
for (const id of ["trackingForm", "trackingNumber", "postcodeInput", "languageToggle", "resultPanel", "shipmentMap", "mapNote", "eventCount", "faq"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "Missing required element: " + id);
}
assert.match(js, /EXF-DEMO-001/, "Demo-only sample flow must stay explicit");
assert.match(js, /fetch\("\/api\/track"/, "Tracking form must call the server-side tracking API");
assert.match(js, /postcode: postcodeInput\.value\.trim\(\)/, "Optional postcode should be submitted to the API");
assert.match(js, /renderTimeline/, "Live scan history should be rendered into the timeline");
assert.match(js, /state: "complete"/, "Demo timeline events should use renderable event objects");
assert.match(api, /createTracker/, "Tracking API must use the upstream parcel engine");
assert.match(api, /safeEventPoint\(event\.point\)/, "Carrier scan coordinates should be validated before projection");
assert.match(js, /renderShipmentMap/, "Live tracking should render its map panel");
assert.match(js, /https:\/\/tile\.openstreetmap\.org/, "The map should use the OpenStreetMap tile endpoint");
assert.match(css, /\.shipment-map/, "The result map should have responsive dimensions");
assert.match(api, /readBoundedBody/, "Tracking API must stream and cap request bodies");
assert.match(api, /Cache-Control/, "Tracking API must disable response caching");
assert.match(api, /MAX_CONCURRENT_LOOKUPS/, "Tracking API must bound concurrent lookups");
assert.match(css, /\.postcode-field/, "Optional postcode input should be styled");
assert.match(css, /@media\s*\(max-width:\s*680px\)/, "Mobile breakpoint should exist");
assert.match(css, /@media\s*\(max-width:\s*380px\)/, "Small-phone breakpoint should exist");
assert.match(css, /html\[dir=rtl\]/, "RTL presentation rules should exist");

assert.match(css, /\.hero-gridline\{position:absolute;inset:0/, "Hero decorative layer must not occupy a grid column");
assert.match(css, /@media \(max-width:680px\)[\s\S]*?\.postcode-field\{display:grid/, "Mobile postcode field should stack label and input");
assert.match(css, /\.header-cta\{[^}]*white-space:nowrap/, "Responsive header CTA must keep its label on one line");
assert.match(css, /\.step-card p\{font-size:14px/, "Mobile step-card copy must remain readable");


assert.match(css, /\.language-picker select\s*\{[^}]*max-width:\s*50px;[^}]*font-size:\s*13px/, "Compact mobile language name must remain comfortably readable");
assert.match(css, /\.language-picker:after\s*\{[^}]*content:\s*"";[^}]*border-right:/, "Language selector must use one consistent custom chevron");
assert.match(css, /\.header-cta span:first-child\s*\{[^}]*white-space:\s*nowrap;[^}]*flex:\s*0 0 auto;/, "Header CTA label must not wrap or shrink");
assert.match(css, /\.announcement\s*\{[^}]*font-size:\s*12px/, "Announcement copy must meet the revised type scale");


assert.ok(html.includes('href="/styles.css?v=ef-header-20261106-3"'), "The stylesheet URL must be versioned to invalidate stale mobile browser caches");
assert.match(css, /\.language-picker select\s*\{[^}]*max-width:\s*54px;[^}]*font-size:\s*14px/, "Mobile language label must be clearly readable");
assert.match(css, /\.header-cta\s*\{[^}]*min-width:\s*114px;[^}]*font-size:\s*13px/, "Mobile tracking CTA must retain a generous touch target and readable label");

console.log("ExportFlow live tracking smoke tests passed.");
