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
assert.equal(body.events[0].time, "2026-05-14T11:20:00");
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
