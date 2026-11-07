import assert from "node:assert/strict";
import { UPSApiClient, upsApiCredentials } from "../node_modules/universal-parcel-scraper/dist/carriers/ups/api.js";
import { FedExApiClient, fedexApiCredentials } from "../node_modules/universal-parcel-scraper/dist/carriers/fedex/api.js";
import { DhlTrackingApi } from "../node_modules/universal-parcel-scraper/dist/carriers/dhl-express/api.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function requestRecord(input, init = {}) {
  return {
    url: String(input),
    method: init.method || "GET",
    headers: new Headers(init.headers || {}),
    body: typeof init.body === "string" ? init.body : ""
  };
}

// These credential values and endpoints are CI-only placeholders. Every request
// is intercepted by a mock fetcher; this test never contacts a carrier network.
const signal = () => AbortSignal.timeout(10_000);

assert.deepEqual(
  upsApiCredentials({ UPS_CLIENT_ID: " ci-ups-id ", UPS_CLIENT_SECRET: " ci-ups-secret " }),
  { id: "ci-ups-id", secret: "ci-ups-secret", url: "https://onlinetools.ups.com" }
);
assert.deepEqual(
  fedexApiCredentials({ FEDEX_API_KEY: " ci-fedex-key ", FEDEX_SECRET_KEY: " ci-fedex-secret " }),
  { key: "ci-fedex-key", secret: "ci-fedex-secret", url: "https://apis.fedex.com" }
);

// UPS: verify OAuth client credentials and the authenticated Track API request.
const upsCalls = [];
const upsFetcher = async (input, init = {}) => {
  const request = requestRecord(input, init);
  upsCalls.push(request);
  const url = new URL(request.url);
  if (url.pathname === "/security/v1/oauth/token") {
    return jsonResponse({ access_token: "ci-ups-access-token", expires_in: "3600" });
  }
  if (url.pathname.startsWith("/api/track/v1/details/")) {
    return jsonResponse({ trackResponse: { shipment: [] } });
  }
  throw new Error("Unexpected mocked UPS URL: " + url.pathname);
};
const ups = new UPSApiClient(
  { id: "ci-ups-id", secret: "ci-ups-secret", url: "https://ups.invalid" },
  upsFetcher
);
const upsReply = await ups.track("1Z999AA10123456784", signal(), 8_000);
assert.deepEqual(upsReply, { trackResponse: { shipment: [] } });
assert.equal(upsCalls.length, 2);
assert.equal(upsCalls[0].method, "POST");
assert.match(upsCalls[0].url, /\/security\/v1\/oauth\/token$/);
assert.equal(
  upsCalls[0].headers.get("authorization"),
  "Basic " + Buffer.from("ci-ups-id:ci-ups-secret").toString("base64")
);
assert.equal(upsCalls[0].body, "grant_type=client_credentials");
assert.equal(upsCalls[1].method, "GET");
assert.match(upsCalls[1].url, /\/api\/track\/v1\/details\/1Z999AA10123456784/);
assert.equal(upsCalls[1].headers.get("authorization"), "Bearer ci-ups-access-token");
assert.ok(upsCalls[1].headers.get("transid"), "UPS requests should carry a transaction id");

// FedEx: verify its OAuth form body and POST Track API contract.
const fedexCalls = [];
const fedexFetcher = async (input, init = {}) => {
  const request = requestRecord(input, init);
  fedexCalls.push(request);
  const url = new URL(request.url);
  if (url.pathname === "/oauth/token") {
    return jsonResponse({ access_token: "ci-fedex-access-token", expires_in: 3600 });
  }
  if (url.pathname === "/track/v1/trackingnumbers") {
    return jsonResponse({ output: { completeTrackResults: [] } });
  }
  throw new Error("Unexpected mocked FedEx URL: " + url.pathname);
};
const fedex = new FedExApiClient(
  { key: "ci-fedex-key", secret: "ci-fedex-secret", url: "https://fedex.invalid" },
  fedexFetcher
);
const fedexReply = await fedex.track("999999999999", signal(), 8_000);
assert.deepEqual(fedexReply, { output: { completeTrackResults: [] } });
assert.equal(fedexCalls.length, 2);
assert.equal(fedexCalls[0].method, "POST");
assert.match(fedexCalls[0].url, /\/oauth\/token$/);
assert.match(fedexCalls[0].body, /grant_type=client_credentials/);
assert.match(fedexCalls[0].body, /client_id=ci-fedex-key/);
assert.match(fedexCalls[0].body, /client_secret=ci-fedex-secret/);
assert.equal(fedexCalls[1].method, "POST");
assert.match(fedexCalls[1].url, /\/track\/v1\/trackingnumbers$/);
assert.equal(fedexCalls[1].headers.get("authorization"), "Bearer ci-fedex-access-token");
assert.deepEqual(JSON.parse(fedexCalls[1].body), {
  includeDetailedScans: true,
  trackingInfo: [{ trackingNumberInfo: { trackingNumber: "999999999999" } }]
});

// DHL Express: verify the API key header and bounded GET request.
const dhlCalls = [];
const dhlFetcher = async (input, init = {}) => {
  const request = requestRecord(input, init);
  dhlCalls.push(request);
  return jsonResponse({ shipments: [] });
};
const dhl = new DhlTrackingApi({
  env: { DHL_API_KEY: "ci-dhl-api-key" },
  fetcher: dhlFetcher
});
const dhlReply = await dhl.shipments("CI-TEST-SHIPMENT", {
  signal: signal(),
  remainingMs: () => 8_000
});
assert.deepEqual(dhlReply, { shipments: [] });
assert.equal(dhlCalls.length, 1);
assert.equal(dhlCalls[0].method, "GET");
assert.match(dhlCalls[0].url, /^https:\/\/api-eu\.dhl\.com\/track\/shipments\?/);
assert.equal(dhlCalls[0].headers.get("dhl-api-key"), "ci-dhl-api-key");
assert.match(dhlCalls[0].url, /trackingNumber=CI-TEST-SHIPMENT/);

console.log("Official carrier API client contract tests passed: UPS OAuth/Track, FedEx OAuth/Track and DHL Express API-key lookup (all mocked; zero external requests).");
