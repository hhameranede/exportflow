import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/batch-track.js";

const endpoint = "https://example.test/api/batch-track";
const post = (body, headers = {}) => new Request(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body)
});
const send = request => onRequestPost({ request, env: {} });

const method = await onRequestPost({ request: new Request(endpoint), env: {} });
assert.equal(method.status, 405);

const contentType = await send(new Request(endpoint, {
  method: "POST",
  headers: { "Content-Type": "text/plain" },
  body: "{}"
}));
assert.equal(contentType.status, 415);

const origin = await send(post({ shipments: [{ id: "one", number: "abc" }] }, {
  Origin: "https://attacker.test"
}));
assert.equal(origin.status, 403);

const invalidJson = await send(post("{"));
assert.equal(invalidJson.status, 400);
assert.equal((await invalidJson.json()).error, "invalid_json");

const missingItems = await send(post({}));
assert.equal(missingItems.status, 400);
assert.equal((await missingItems.json()).error, "invalid_batch_size");

const oversizedLength = await send(post({ shipments: [{ id: "one", number: "abc" }] }, {
  "Content-Length": "13000"
}));
assert.equal(oversizedLength.status, 413);

const tooMany = await send(post({
  shipments: Array.from({ length: 6 }, (_, index) => ({ id: "s" + index, number: "abc" }))
}));
assert.equal(tooMany.status, 400);
assert.equal((await tooMany.json()).error, "invalid_batch_size");

const invalidItem = await send(post({ shipments: [{ id: "bad id", number: "abc" }] }));
assert.equal(invalidItem.status, 400);
assert.equal((await invalidItem.json()).error, "invalid_shipment_item");

const duplicateIds = await send(post({
  shipments: [
    { id: "same", number: "abc" },
    { id: "same", number: "def" }
  ]
}));
assert.equal(duplicateIds.status, 400);
assert.equal((await duplicateIds.json()).error, "duplicate_shipment_id");

const mixedBatch = await send(post({
  shipments: [
    { id: "order_1", number: "abc" },
    { id: "order_2", number: "de" }
  ]
}));
assert.equal(mixedBatch.status, 200);
assert.equal(mixedBatch.headers.get("Cache-Control"), "no-store");
const mixedPayload = await mixedBatch.json();
assert.equal(mixedPayload.summary.requested, 2);
assert.equal(mixedPayload.summary.succeeded, 0);
assert.equal(mixedPayload.summary.failed, 2);
assert.deepEqual(mixedPayload.results.map(result => result.id), ["order_1", "order_2"]);
assert.ok(mixedPayload.results.every(result => result.status === 400));
assert.ok(mixedPayload.results.every(result => result.data.error === "invalid_tracking_number"));
assert.ok(!JSON.stringify(mixedPayload).includes('"abc"'), "Batch responses must never echo tracking numbers");

console.log("Batch tracking endpoint validation, limits, isolation and redaction verified.");
