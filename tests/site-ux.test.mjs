import test from "node:test";
import assert from "node:assert/strict";
import { handleWebsiteRequest } from "../src/site/router.js";
import { MARKETING_PATHS } from "../src/site/marketing.js";
import { MARKETING_JS } from "../src/site/marketing-client.js";

const ORIGIN = "https://exportflow.test";

test("FAQ is included in the marketing routes and renders seven accessible disclosures", async () => {
  assert.ok(MARKETING_PATHS.includes("/faq"));
  const response = await handleWebsiteRequest(new Request(ORIGIN + "/faq"), new URL(ORIGIN + "/faq"));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal((html.match(/data-faq-item/g) || []).length, 7);
  assert.match(html, /<details[^>]*open/);
  assert.match(html, /aria-label="Frequently asked questions"/);
  assert.match(html, /public REST Task contract/i);
});

test("marketing client bundle parses and protects the mobile drawer opening race", () => {
  assert.doesNotThrow(() => new Function(MARKETING_JS));
  assert.match(MARKETING_JS, /menuBtn\.getAttribute\("aria-expanded"\) !== "true"\) return/);
  assert.match(MARKETING_JS, /document\.addEventListener\("keydown"/);
  assert.match(MARKETING_JS, /e\.key !== "Escape"/);
});

