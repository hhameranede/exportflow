import assert from "node:assert/strict";
import { runProductionSmoke } from "./production-smoke-test.mjs";

function fixtureFetch({ openApiVersion = "3.1.0" } = {}) {
  const calls = [];
  const html = (locale, direction) =>
    `<!doctype html><html lang="${locale}" dir="${direction}"><head><link rel="canonical" href="https://exportflow.me/"></head><body><span data-i18n="supportedCarriersHeading">CARRIER CATALOG</span><text data-i18n="illustrativeRouteLabel">ILLUSTRATIVE ROUTE · NOT LIVE SHIPMENT DATA</text></body></html>`;

  const fetchImpl = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method || "GET";
    calls.push({ path, method, body: init.body || null });

    if (method === "POST" && path === "/api/track") {
      return new Response(JSON.stringify({ error: "invalid_tracking_number" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    if (method === "POST" && path === "/api/batch-track") {
      return new Response(JSON.stringify({ error: "invalid_batch_size" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const payloads = {
      "/": html("en", "ltr"),
      "/ar/": html("ar", "rtl"),
      "/bn/": html("bn", "ltr"),
      "/api/health": { ok: true, service: "exportflow-tracking-api" },
      "/api/carriers": {
        catalogEntries: 10,
        carriers: ["carrier-a"],
        carrierRecords: [{ id: "carrier-a" }],
        metadataNotice: "Catalog metadata is not a live availability check, successful tracking guarantee or carrier partnership claim.",
      },
      "/api/coverage": {
        source: "installed-universal-parcel-scraper-catalog",
        summary: { allCountries: 249 },
        countries: Array.from({ length: 249 }, (_, index) => ({ code: String(index) })),
      },
      "/api/openapi": {
        openapi: openApiVersion,
        paths: { "/api/track": {}, "/api/batch-track": {}, "/api/mcp": {} },
      },
    };
    if (!(path in payloads)) return new Response("not found", { status: 404 });
    const value = payloads[path];
    if (typeof value === "string") {
      return new Response(value, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return new Response(JSON.stringify(value), {
      status: 200, headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };
  return { fetchImpl, calls };
}

const successFixture = fixtureFetch();
const success = await runProductionSmoke({
  baseUrl: "https://preview.exportflow.pages.dev",
  fetchImpl: successFixture.fetchImpl,
  log: () => {},
});
assert.equal(success.passed, 9);
assert.equal(success.failed, 0);
assert.equal(success.results.length, 9);
assert.equal(successFixture.calls.length, 9);
const trackingProbe = successFixture.calls.find(call => call.path === "/api/track");
const batchProbe = successFixture.calls.find(call => call.path === "/api/batch-track");
assert.deepEqual(JSON.parse(trackingProbe.body), { number: "x" });
assert.deepEqual(JSON.parse(batchProbe.body), { shipments: [] });
assert.ok(successFixture.calls.every(call =>
  call.path !== "/api/mcp" && call.path !== "/api/track" || call.method === "POST"
));

const failingFixture = fixtureFetch({ openApiVersion: "3.0.3" });
const failure = await runProductionSmoke({
  baseUrl: "https://preview.exportflow.pages.dev",
  fetchImpl: failingFixture.fetchImpl,
  log: () => {},
});
assert.equal(failure.failed, 1);
assert.equal(failure.passed, 8);
assert.equal(failure.results.length, 9, "Smoke checks should continue after an individual failure.");
assert.equal(failingFixture.calls.length, 9, "Every endpoint should be checked even when one response is invalid.");

await assert.rejects(runProductionSmoke({ baseUrl: "http://example.com" }), /HTTPS/);
await assert.rejects(runProductionSmoke({ baseUrl: "https://example.com/path" }), /origin only/);
console.log("Production smoke test fixtures passed.");
