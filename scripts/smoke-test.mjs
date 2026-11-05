import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("app.js", "utf8")
]);

assert.match(html, /<html[^>]+lang="en"[^>]+dir="ltr"/i, "English LTR document should exist");
for (const id of ["trackingForm", "trackingNumber", "languageToggle", "resultPanel", "faq"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "Missing required element: " + id);
}
assert.match(js, /EXF-DEMO-001/, "Demo-only sample flow must stay explicit");
assert.match(js, /localStorage\.setItem\(["']exportflow-language["']/, "Language preference should persist locally");
assert.match(css, /@media\s*\(max-width:\s*680px\)/, "Mobile breakpoint should exist");
assert.match(css, /@media\s*\(max-width:\s*380px\)/, "Small-phone breakpoint should exist");
assert.match(css, /html\[dir=rtl\]/, "RTL presentation rules should exist");
console.log("ExportFlow smoke tests passed.");