import assert from "node:assert/strict";
import {
  createExportFlowClient,
  ExportFlowApiError
} from "../exportflow-sdk.mjs";

const calls = [];
const fetchImpl = async (url, init = {}) => {
  calls.push({ url, init });
  if (url.endsWith("/api/track")) {
    return Response.json({ status: "in_transit", carrier: "example" });
  }
  if (url.endsWith("/api/batch-track")) {
    return Response.json({ summary: { requested: 1, succeeded: 1, failed: 0 }, results: [] });
  }
  if (url.endsWith("/api/carriers")) return Response.json({
    catalogEntries: 2,
    selectableCarrierRecords: 1,
    directAdapterCatalogRecords: 1,
    universalFallbackCatalogRecords: 0,
    linkOnlyCatalogRecords: 0,
    carriers: ["example", "postal"],
    carrierRecords: [{ id: "example", name: "Example Carrier", countries: ["US"], tracking: { mode: "automatic", adapter: "example" } }]
  });
  if (url.endsWith("/api/coverage")) return Response.json({ summary: { allCountries: 249 }, countries: [] });
  if (url.endsWith("/api/openapi")) return Response.json({ openapi: "3.1.0" });
  return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
};

const client = createExportFlowClient({ fetchImpl, baseUrl: "https://api.example.test/" });
const tracked = await client.track({ number: "ABCD1234", language: "bn" });
assert.equal(tracked.status, "in_transit");
assert.equal(calls[0].url, "https://api.example.test/api/track");
assert.deepEqual(JSON.parse(calls[0].init.body), { number: "ABCD1234", language: "bn" });
assert.equal(calls[0].init.headers["Content-Type"], "application/json");

const batch = await client.batchTrack([{ id: "merchant-order-1", number: "EFGH5678" }]);
assert.equal(batch.summary.requested, 1);
assert.equal(calls[1].url, "https://api.example.test/api/batch-track");

const carrierCatalog = await client.listCarriers();
assert.deepEqual(carrierCatalog.carriers, ["example", "postal"]);
assert.equal(carrierCatalog.carrierRecords[0].tracking.adapter, "example");
assert.equal((await client.getCoverage()).summary.allCountries, 249);
assert.equal((await client.getOpenApi()).openapi, "3.1.0");

assert.throws(() => createExportFlowClient({ fetchImpl, baseUrl: "javascript:alert(1)" }), TypeError);
assert.throws(() => createExportFlowClient({ fetchImpl, baseUrl: "https://user:pass@example.test" }), TypeError);
assert.throws(() => createExportFlowClient({ fetchImpl, timeoutMs: 100 }), RangeError);
await assert.rejects(() => client.track({ number: "abc" }), TypeError);
await assert.rejects(() => client.track({ number: "ABCD1234", unknown: true }), TypeError);
await assert.rejects(() => client.track({ number: "ABCD1234", language: "ru" }), TypeError);
await assert.rejects(() => client.batchTrack([]), TypeError);
await assert.rejects(() => client.batchTrack([
  { id: "same", number: "ABCD1234" },
  { id: "same", number: "EFGH5678" }
]), TypeError);

const failingClient = createExportFlowClient({
  baseUrl: "https://api.example.test",
  fetchImpl: async () => new Response(JSON.stringify({
    error: "invalid_tracking_number",
    number: "DO_NOT_ECHO"
  }), { status: 400 })
});
await assert.rejects(failingClient.track({ number: "ABCD1234" }), error => {
  assert.ok(error instanceof ExportFlowApiError);
  assert.equal(error.status, 400);
  assert.equal(error.code, "invalid_tracking_number");
  assert.ok(!error.message.includes("DO_NOT_ECHO"));
  return true;
});

console.log("ExportFlow SDK URL handling, schemas, methods and safe errors verified.");
