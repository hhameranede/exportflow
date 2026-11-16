import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, script, build, trackRoute, wrangler] = await Promise.all([
  readFile("merchant/index.html", "utf8"),
  readFile("merchant-official-api.js", "utf8"),
  readFile("scripts/build.mjs", "utf8"),
  readFile("functions/api/merchant/carriers/[provider]/track.js", "utf8"),
  readFile("wrangler.toml", "utf8")
]);

assert.ok(html.includes('name="robots" content="noindex,nofollow,noarchive"'));
assert.ok(html.includes('id="merchantWorkspace"'));
assert.ok(wrangler.includes('MERCHANT_APP_ORIGIN = "https://integration-merchant-officia.exportflow-aja.pages.dev"'),
  "Preview OAuth and same-origin validation must use the current integration branch alias");
assert.ok(!wrangler.includes("feat-merchant-official-api-p.exportflow-aja.pages.dev"),
  "Do not keep the retired feature-branch Preview origin in Wrangler config");
assert.ok(html.includes('id="merchantSignIn"'));
assert.ok(html.includes('id="merchantSignOut"'));
assert.ok(html.includes('id="merchantTrackingForm"'));
assert.ok(html.includes('id="merchantTrackingCarrier"'));
assert.ok(html.includes('id="merchantTrackingNumber"'));
assert.ok(html.includes("existing carrier adapters"));
assert.ok(html.includes("You do not need to enter or store carrier API credentials."));
assert.ok(!/type="password"/i.test(html), "Merchant UI must not request carrier API keys");
assert.ok(!html.includes('name="consent"'), "Merchant UI must not ask for BYO carrier-key consent");
assert.ok(!html.includes("Save encrypted credentials"));
assert.ok(html.includes('merchant-official-api.js?v='));
assert.ok(build.includes('"merchant-official-api.js"'),
  "Cloudflare Pages build must publish the Merchant Workspace script");
assert.ok(!html.includes("SIMULATED TEST MODE"));
assert.ok(!html.includes("Run UPS simulated test"));
assert.ok(!html.includes("Run FedEx simulated test"));
assert.ok(!html.includes("Run Sandbox check"));

assert.ok(script.includes("/api/merchant/session"));
assert.ok(script.includes("/api/merchant/auth/google/start"));
assert.ok(!script.includes("/official-credentials"));
assert.ok(script.includes('"/api/merchant/carriers/" + provider + "/track"'));
assert.ok(script.includes('credentials: "same-origin"'));
assert.ok(!script.includes("localStorage"));
assert.ok(!script.includes("sessionStorage"));
assert.ok(!script.includes("console."));
assert.ok(script.includes("textContent"), "Remote status strings must be rendered as text");
assert.ok(script.includes("createElement"), "Shipment events must be rendered as text nodes, not HTML");
assert.ok(script.includes('new URL(result.authorizationUrl).origin !== "https://accounts.google.com"'),
  "OAuth redirects must be restricted to Google's authorization origin");

assert.ok(trackRoute.includes("createTracker"));
assert.ok(trackRoute.includes("resolveMerchantSession"));
assert.ok(trackRoute.includes("createCloudflareFetch"));
assert.ok(trackRoute.includes("providers: []"));
assert.ok(trackRoute.includes("env,"));
assert.ok(trackRoute.includes("EXPORTFLOW_TRAWL_URL"));
assert.ok(!trackRoute.includes("createSessionBoundOfficialApiCredentialVault"));
assert.ok(!trackRoute.includes("UPS_CLIENT_ID"));
assert.ok(!trackRoute.includes("FEDEX_API_KEY"));
assert.ok(!trackRoute.includes("adapterEnvironment"));

console.log("Merchant Workspace UI tests passed: Google merchant auth, existing ExportFlow adapters, no merchant credential forms and safe event rendering.");
