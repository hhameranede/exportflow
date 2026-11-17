import assert from "node:assert/strict";
import { createMerchantAdapterTrackHandler } from "../functions/api/merchant/carriers/[provider]/track.js";

const ORIGIN = "https://merchant-preview.example.test";
const TRACKING_NUMBER = "ZZ000000014GB";
const quota = {
  allowed: true,
  limit: 12,
  remaining: 11,
  retryAfterSeconds: 0,
  resetAt: 1_800_000_060,
  resetAfterSeconds: 60
};

// Synthetic EMS page fixture. The real createTracker facade and the installed
// Algérie Poste adapter parse this response; only the upstream HTTP boundary is stubbed.
const carrierPage = `<!doctype html>
<html lang="fr">
  <body>
    <section class="cd-timeline js-cd-timeline">
      <div class="main-heading text-center">
        <h2>Détails d'envoi Nº: <font color="#f47334">${TRACKING_NUMBER}</font></h2>
      </div>
      <div class="cd-timeline__container">
        <div class="cd-timeline__block js-cd-block">
          <div class="cd-timeline__content js-cd-content">
            <h2>Distribué</h2>
            <p>SAMPLE TOWN EMS</p>
            <span class="cd-timeline__date">2026-05-14 11:20</span>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>`;

const outbound = [];
const handler = createMerchantAdapterTrackHandler({
  resolveSession: async request => request.headers.get("Cookie") === "test-session=merchant-alpha"
    ? { user: { id: "merchant_alpha" } }
    : null,
  consumeRateLimit: async () => quota,
  fetchFactory: () => async (input, init = {}) => {
    const url = new URL(String(input));
    outbound.push({
      origin: url.origin,
      pathname: url.pathname,
      trackingNumber: url.searchParams.get("icd"),
      method: init.method || "GET",
      userAgent: new Headers(init.headers).get("User-Agent")
    });
    assert.equal(url.origin, "https://ems.dz", "The selected adapter must call only its own carrier endpoint");
    assert.equal(url.pathname, "/track/index.php");
    assert.equal(url.searchParams.get("icd"), TRACKING_NUMBER);
    return new Response(carrierPage, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    });
  }
});

const response = await handler({
  request: new Request(ORIGIN + "/api/merchant/carriers/algerie-poste/track", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Cookie: "test-session=merchant-alpha",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ number: TRACKING_NUMBER })
  }),
  env: { MERCHANT_APP_ORIGIN: ORIGIN },
  params: { provider: "algerie-poste" }
});

assert.equal(response.status, 200);
assert.equal(response.headers.get("Cache-Control"), "no-store, private");
const body = await response.json();
assert.equal(body.provider, "algerie-poste");
assert.equal(body.status, "delivered");
assert.equal(body.events.length, 1);
assert.equal(body.events[0].stage, "delivered");
assert.equal(body.events[0].description, "Distribué");
assert.equal(body.events[0].location, "SAMPLE TOWN EMS");
assert.match(body.events[0].time, /^2026-05-14T11:20:00(?:[+-]\d{2}:\d{2})?$/,
  "The EMS wall-clock time must be preserved, with an optional resolved offset");
assert.equal(JSON.stringify(body).includes(TRACKING_NUMBER), false,
  "The projected merchant response must not echo the parcel identifier");
assert.deepEqual(outbound, [{
  origin: "https://ems.dz",
  pathname: "/track/index.php",
  trackingNumber: TRACKING_NUMBER,
  method: "GET",
  userAgent: "ExportFlow-Merchant/1.0"
}], "One real direct-adapter parse must run; no universal-provider fallback is enabled");

console.log("Merchant adapter integration passed: authenticated route -> real ExportFlow facade -> installed Algérie Poste adapter -> parsed carrier fixture.");

// FedEx's official API adapter must use the explicitly configured Sandbox origin.
// This is a deterministic route/facade/adapter integration fixture, not a live FedEx call.
const FEDEX_TRACKING_NUMBER = "449044304137821";
const FEDEX_SANDBOX_ORIGIN = "https://apis-sandbox.fedex.com";
const FEDEX_API_RESPONSE = {
  transactionId: "00000000-0000-4000-8000-000000000000",
  output: {
    completeTrackResults: [{
      trackingNumber: FEDEX_TRACKING_NUMBER,
      trackResults: [{
        trackingNumberInfo: { trackingNumber: FEDEX_TRACKING_NUMBER, carrierCode: "FDXE" },
        latestStatusDetail: { code: "DL", description: "Delivered" },
        dateAndTimes: [{
          type: "ACTUAL_DELIVERY",
          dateTime: "2026-09-02T11:58:00+02:00"
        }],
        scanEvents: [{
          date: "2026-09-02T11:58:00+02:00",
          eventType: "DL",
          eventDescription: "Delivered",
          scanLocation: {
            city: "ZUERICH",
            countryCode: "CH",
            countryName: "Switzerland"
          }
        }]
      }]
    }]
  }
};

const fedexOutbound = [];
const fedexHandler = createMerchantAdapterTrackHandler({
  resolveSession: async request => request.headers.get("Cookie") === "test-session=merchant-alpha"
    ? { user: { id: "merchant_alpha" } }
    : null,
  consumeRateLimit: async () => quota,
  fetchFactory: () => async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    fedexOutbound.push({
      url: url.toString(),
      method: init.method || "GET",
      authorization: headers.get("Authorization"),
      body: typeof init.body === "string" ? init.body : ""
    });

    assert.equal(url.origin, FEDEX_SANDBOX_ORIGIN,
      "FedEx test credentials and requests must never leave the official Sandbox origin");

    if (url.pathname === "/oauth/token") {
      assert.equal(init.method, "POST");
      const tokenForm = new URLSearchParams(String(init.body || ""));
      assert.equal(tokenForm.get("grant_type"), "client_credentials");
      assert.equal(tokenForm.get("client_id"), "sandbox-test-client-id");
      assert.equal(tokenForm.get("client_secret"), "sandbox-test-client-secret");
      return Response.json({
        access_token: "synthetic-sandbox-access-token",
        token_type: "bearer",
        expires_in: 3600
      });
    }

    if (url.pathname === "/track/v1/trackingnumbers") {
      assert.equal(init.method, "POST");
      assert.equal(headers.get("Authorization"), "Bearer synthetic-sandbox-access-token");
      const payload = JSON.parse(String(init.body || "{}"));
      assert.equal(payload.includeDetailedScans, true);
      assert.equal(
        payload.trackingInfo?.[0]?.trackingNumberInfo?.trackingNumber,
        FEDEX_TRACKING_NUMBER
      );
      return Response.json(FEDEX_API_RESPONSE);
    }

    throw new Error("Unexpected FedEx Sandbox endpoint: " + url.pathname);
  }
});

const fedexResponse = await fedexHandler({
  request: new Request(ORIGIN + "/api/merchant/carriers/fedex/track", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Cookie: "test-session=merchant-alpha",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ number: FEDEX_TRACKING_NUMBER })
  }),
  env: {
    MERCHANT_APP_ORIGIN: ORIGIN,
    FEDEX_API_KEY: "sandbox-test-client-id",
    FEDEX_SECRET_KEY: "sandbox-test-client-secret",
    FEDEX_API_URL: FEDEX_SANDBOX_ORIGIN
  },
  params: { provider: "fedex" }
});

assert.equal(fedexResponse.status, 200);
assert.equal(fedexResponse.headers.get("Cache-Control"), "no-store, private");
const fedexBody = await fedexResponse.json();
assert.equal(fedexBody.provider, "fedex");
assert.equal(fedexBody.status, "delivered");
assert.equal(fedexBody.events.length, 1);
assert.equal(fedexBody.events[0].stage, "delivered");
assert.equal(fedexBody.events[0].description, "Delivered");
assert.equal(fedexBody.events[0].location, "ZUERICH, CH");
assert.equal(fedexBody.events[0].time, "2026-09-02T11:58:00+02:00");
assert.equal(JSON.stringify(fedexBody).includes(FEDEX_TRACKING_NUMBER), false,
  "The Merchant response must not echo the FedEx parcel identifier");
assert.deepEqual(fedexOutbound.map(item => ({
  url: item.url,
  method: item.method
})), [
  { url: FEDEX_SANDBOX_ORIGIN + "/oauth/token", method: "POST" },
  { url: FEDEX_SANDBOX_ORIGIN + "/track/v1/trackingnumbers", method: "POST" }
], "The selected FedEx adapter must call only the Sandbox token and Track API endpoints");

console.log("Merchant FedEx Sandbox integration fixture passed: authenticated route -> real ExportFlow facade -> pinned FedEx direct adapter -> Sandbox-origin token and Track API fixtures.");

