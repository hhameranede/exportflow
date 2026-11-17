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

// FedEx without carrier API credentials uses the installed adapter's browser
// route through ExportFlow's configured Trawl service. The Trawl HTTP boundary
// is mocked here; the pinned FedEx adapter and response parser are real.
const FEDEX_TRACKING_NUMBER = "449044304137821";
const FEDEX_TRACKING_PAGE = `https://www.fedex.com/fedextrack/?trknbr=${FEDEX_TRACKING_NUMBER}`;
const FEDEX_PAGE_API = "https://api.fedex.com/track/v2/shipments";
const TRAWL_ORIGIN = "https://trawl-preview.example.test";
const FEDEX_PAGE_RESPONSE = {
  output: {
    packages: [{
      trackingNbr: FEDEX_TRACKING_NUMBER,
      trackingQualifier: "",
      trackingCarrierCd: "FDXE",
      displayTrackingNbr: FEDEX_TRACKING_NUMBER,
      keyStatus: "Delivered",
      keyStatusCD: "DL",
      statusWithDetails: "Delivered",
      actDeliveryDt: "2026-09-02T11:58:00+02:00",
      estDeliveryDt: "2026-09-02T18:00:00+02:00",
      scanEventList: [{
        date: "2026-09-02",
        time: "11:58:00",
        gmtOffset: "+02:00",
        scanLocation: "ZUERICH, CH",
        status: "Delivered",
        statusCD: "DL",
        scanDetails: ""
      }]
    }]
  }
};

const trawlCalls = [];
const fedexAdapterEnv = {
  MERCHANT_APP_ORIGIN: ORIGIN,
  EXPORTFLOW_TRAWL_URL: TRAWL_ORIGIN
};
const fedexAdapterHandler = createMerchantAdapterTrackHandler({
  resolveSession: async request => request.headers.get("Cookie") === "test-session=merchant-alpha"
    ? { user: { id: "merchant_alpha" } }
    : null,
  consumeRateLimit: async () => quota,
  fetchFactory: () => async (input, init = {}) => {
    const url = new URL(String(input));
    trawlCalls.push({ url: url.toString(), method: init.method || "GET", body: String(init.body || "") });
    assert.equal(url.origin, TRAWL_ORIGIN, "The Worker must call ExportFlow's configured browser adapter service");
    assert.equal(url.pathname, "/scrape");
    assert.equal(init.method, "POST");

    const scrape = JSON.parse(String(init.body || "{}"));
    assert.equal(scrape.url, FEDEX_TRACKING_PAGE);
    assert.equal(scrape.skipHttp, true);
    assert.equal(scrape.maxTier, 3);
    assert.ok(scrape.captureResponses.includes(FEDEX_PAGE_API));

    return Response.json({
      tier: 3,
      statusCode: 200,
      url: FEDEX_TRACKING_PAGE,
      html: "<html><body>FedEx tracking</body></html>",
      cookies: [],
      userAgent: "Mozilla/5.0 (fixture browser)",
      capturedResponses: [{
        url: FEDEX_PAGE_API,
        status: 200,
        headers: {},
        body: JSON.stringify(FEDEX_PAGE_RESPONSE),
        truncated: false,
        base64Encoded: false,
        error: null
      }]
    });
  }
});

const fedexAdapterResponse = await fedexAdapterHandler({
  request: new Request(ORIGIN + "/api/merchant/carriers/fedex/track", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Cookie: "test-session=merchant-alpha",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ number: FEDEX_TRACKING_NUMBER })
  }),
  env: fedexAdapterEnv,
  params: { provider: "fedex" }
});

assert.equal(fedexAdapterResponse.status, 200);
assert.equal(fedexAdapterResponse.headers.get("Cache-Control"), "no-store, private");
const fedexAdapterBody = await fedexAdapterResponse.json();
assert.equal(fedexAdapterBody.provider, "fedex");
assert.equal(fedexAdapterBody.status, "delivered");
assert.equal(fedexAdapterBody.events.length, 1);
assert.equal(fedexAdapterBody.events[0].stage, "delivered");
assert.equal(fedexAdapterBody.events[0].description, "Delivered");
assert.equal(fedexAdapterBody.events[0].location, "ZUERICH, CH");
assert.equal(fedexAdapterBody.events[0].time, "2026-09-02T11:58:00+02:00");
assert.equal(JSON.stringify(fedexAdapterBody).includes(FEDEX_TRACKING_NUMBER), false,
  "The Merchant response must not echo the FedEx parcel identifier");
assert.deepEqual(trawlCalls.map(call => ({ url: call.url, method: call.method })), [
  { url: TRAWL_ORIGIN + "/scrape", method: "POST" }
], "Without FedEx API credentials, the selected FedEx adapter must use only Trawl");
assert.equal(Object.keys(fedexAdapterEnv).some(key => /^FEDEX_(?:API_KEY|SECRET_KEY|API_URL)$/.test(key)), false,
  "The direct-adapter path must not require carrier API credentials");

console.log("Merchant FedEx direct-adapter integration fixture passed: authenticated route -> real ExportFlow facade -> pinned FedEx adapter -> Trawl browser capture fixture, with no carrier API keys.");
