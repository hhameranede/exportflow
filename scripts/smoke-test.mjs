import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js, api] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("app.js", "utf8"),
  readFile("functions/api/track.js", "utf8")
]);

assert.match(html, /<html[^>]+lang="en"[^>]+dir="ltr"/i, "English LTR document should exist");
for (const id of ["trackingForm", "trackingNumber", "languageToggle", "resultPanel", "faq"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "Missing required element: " + id);
}
assert.match(js, /EXF-DEMO-001/, "Demo-only sample flow must stay explicit");
assert.match(js, /fetch\("\/api\/track"/, "Tracking form must call the server-side tracking API");
assert.match(js, /renderTimeline/, "Live scan history should be rendered into the timeline");
assert.match(api, /createTracker/, "Tracking API must use the upstream parcel engine");
assert.match(api, /Cache-Control/, "Tracking API must disable response caching");
assert.match(api, /MAX_CONCURRENT_LOOKUPS/, "Tracking API must bound concurrent lookups");
assert.match(css, /@media\s*\(max-width:\s*680px\)/, "Mobile breakpoint should exist");
assert.match(css, /@media\s*\(max-width:\s*380px\)/, "Small-phone breakpoint should exist");
assert.match(css, /html\[dir=rtl\]/, "RTL presentation rules should exist");
console.log("ExportFlow live tracking smoke tests passed.");
