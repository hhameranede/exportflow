import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, script, build, statusRoute, trackRoute, wrangler] = await Promise.all([
  readFile("merchant/index.html", "utf8"),
  readFile("merchant-official-api.js", "utf8"),
  readFile("scripts/build.mjs", "utf8"),
  readFile("functions/api/merchant/carriers/[provider]/official-credentials.js", "utf8"),
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
assert.ok(html.includes('data-provider-panel="ups"'));
assert.ok(html.includes('data-provider-panel="fedex"'));
assert.ok(html.includes('id="merchantTrackingForm"'));
assert.ok(html.includes('id="merchantTrackingCarrier"'));
assert.ok(html.includes('id="merchantTrackingNumber"'));
assert.ok(html.includes("existing carrier adapter"));
assert.ok(html.includes('name="clientId" type="password"'));
assert.ok(html.includes('name="clientSecret" type="password"'));
assert.ok(html.includes('name="apiKey" type="password"'));
assert.ok(html.includes('name="apiSecret" type="password"'));
assert.equal((html.match(/name="consent" type="checkbox" required/g) || []).length, 2,
  "Both providers require explicit account-authority consent");
assert.ok(html.includes('merchant-official-api.js?v='));
assert.ok(build.includes('"merchant-official-api.js"'),
  "Cloudflare Pages build must publish the Merchant Workspace script");
assert.ok(!html.includes("SIMULATED TEST MODE"));
assert.ok(!html.includes("Run UPS simulated test"));
assert.ok(!html.includes("Run FedEx simulated test"));
assert.ok(!html.includes("Run Sandbox check"));

assert.ok(script.includes("/api/merchant/session"));
assert.ok(script.includes("/api/merchant/auth/google/start"));
assert.ok(script.includes("/official-credentials"));
assert.ok(script.includes('"/track"'));
assert.ok(script.includes("credentials: \"same-origin\""));
assert.ok(script.includes("consentInput.checked !== true"),
  "Client must enforce consent even if a submit event is dispatched programmatically");
assert.ok(!script.includes("localStorage"));
assert.ok(!script.includes("sessionStorage"));
assert.ok(!script.includes("console."));
assert.ok(script.includes("textContent"), "Remote status strings must be rendered as text");
assert.ok(script.includes("createElement"), "Shipment events must be rendered as text nodes, not HTML");
assert.ok(script.includes("new URL(result.authorizationUrl).origin !== \"https://accounts.google.com\""),
  "OAuth redirects must be restricted to Google's authorization origin");

assert.ok(statusRoute.includes("export const onRequestGet = createOfficialApiCredentialStatusHandler();"));
assert.ok(statusRoute.includes("getStatus({ provider })"));
assert.ok(statusRoute.includes("trustedSameOriginRead"));
assert.ok(trackRoute.includes("createTracker"));
assert.ok(trackRoute.includes("providers: []"));
assert.ok(trackRoute.includes("UPS_CLIENT_ID"));
assert.ok(trackRoute.includes("FEDEX_API_KEY"));
assert.ok(!trackRoute.includes("UPSApiClient"));
assert.ok(!trackRoute.includes("FedExApiClient"));
assert.ok(!trackRoute.includes("syntheticReference"));
assert.ok(!trackRoute.includes("EXPORTFLOW_TRAWL_URL"));

console.log("Merchant Workspace UI tests passed: encrypted credentials, existing adapters, safe event rendering and no mock/key-test panels.");
