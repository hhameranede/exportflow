import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, script, build, statusRoute, sandboxRoute] = await Promise.all([
  readFile("merchant/index.html", "utf8"),
  readFile("merchant-official-api.js", "utf8"),
  readFile("scripts/build.mjs", "utf8"),
  readFile("functions/api/merchant/carriers/[provider]/official-credentials.js", "utf8"),
  readFile("functions/api/merchant/carriers/[provider]/sandbox.js", "utf8")
]);

assert.ok(html.includes('name="robots" content="noindex,nofollow,noarchive"'));
assert.ok(html.includes('id="officialApiSandbox"'));
assert.ok(html.includes('id="officialApiSignIn"'));
assert.ok(html.includes('id="officialApiSignOut"'));
assert.ok(html.includes('data-provider-panel="ups"'));
assert.ok(html.includes('data-provider-panel="fedex"'));
assert.ok(html.includes('name="clientId" type="password"'));
assert.ok(html.includes('name="clientSecret" type="password"'));
assert.ok(html.includes('name="apiKey" type="password"'));
assert.ok(html.includes('name="apiSecret" type="password"'));
assert.equal((html.match(/name="consent" type="checkbox" required/g) || []).length, 2,
  "Both providers require explicit account-authority consent");
assert.ok(html.includes('merchant-official-api.js?v='));
assert.ok(build.includes('"merchant-official-api.js"'),
  "Cloudflare Pages build must publish the console script");

assert.ok(script.includes("/api/merchant/session"));
assert.ok(script.includes("/api/merchant/auth/google/start"));
assert.ok(script.includes("/official-credentials"));
assert.ok(script.includes('"/sandbox"'));
assert.ok(script.includes('credentials: "same-origin"'));
assert.ok(script.includes('consentInput.checked !== true'),
  "Client must enforce consent even if a submit event is dispatched programmatically");
assert.ok(!script.includes("localStorage"));
assert.ok(!script.includes("sessionStorage"));
assert.ok(!script.includes("console."));
assert.ok(script.includes("textContent"), "Remote status strings must be rendered as text");
assert.ok(script.includes("new URL(result.authorizationUrl).origin !== \"https://accounts.google.com\""),
  "OAuth redirects must be restricted to Google's authorization origin");

assert.ok(statusRoute.includes("export async function onRequestGet"));
assert.ok(statusRoute.includes("getStatus({ provider })"));
assert.ok(statusRoute.includes("trustedSameOriginRead"));
assert.ok(sandboxRoute.includes('endpoint: "https://wwwcie.ups.com"'));
assert.ok(sandboxRoute.includes('endpoint: "https://apis-sandbox.fedex.com"'));
assert.ok(sandboxRoute.includes("syntheticReference"));
assert.ok(!sandboxRoute.includes("request.url" + "Body"),
  "The Sandbox endpoint must not accept a caller-supplied outbound URL");

console.log("Merchant official API console tests passed: authenticated controls, explicit consent, no browser secret storage and fixed official Sandbox destinations.");
