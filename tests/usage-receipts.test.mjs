import test from "node:test";
import assert from "node:assert/strict";
import { fetchPublicResource } from "../src/core/http-fetch.js";

test("usage receipt observers are immutable, sanitized and cannot change Fetch success", async () => {
  let receiptCalls = 0;
  let observedReceipt = null;
  const result = await fetchPublicResource("https://example.com/public-data", {
    fetchImpl: async () => new Response("safe-body", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-length": "9",
        "set-cookie": "session=must-not-leak",
      },
    }),
    onUsageReceipt(receipt) {
      receiptCalls += 1;
      observedReceipt = receipt;
      throw new Error("observer failure must not escape");
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body, "safe-body");
  assert.equal(receiptCalls, 1);
  assert.ok(Object.isFrozen(observedReceipt));
  assert.equal(observedReceipt.schemaVersion, 1);
  assert.equal(observedReceipt.attempt, 1);
  assert.equal(observedReceipt.outcome, "response");
  assert.equal(observedReceipt.httpStatus, 200);
  assert.equal(observedReceipt.contentType, "text/plain");
  assert.equal(observedReceipt.declaredResponseBytes, 9);
  assert.equal(observedReceipt.responseBodyBytesRead, 9);
  assert.equal(observedReceipt.bytesSource, "stream_reader_observed");
  assert.equal(observedReceipt.elapsedBasis, "io_inclusive_wall_elapsed_not_cpu");
  assert.equal(observedReceipt.elapsedMs >= 0, true);

  const serialized = JSON.stringify(observedReceipt);
  assert.equal(serialized.includes("https://"), false);
  assert.equal(serialized.includes("session=must-not-leak"), false);
  assert.equal(serialized.includes("safe-body"), false);
});
