import test from "node:test";
import assert from "node:assert/strict";
import { fetchPublicResource } from "../src/core/http-fetch.js";
import { executeWebTask } from "../src/core/tasks.js";

test("Fetch usage receipts are immutable, sanitized and observational", async () => {
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

test("executeWebTask forwards Fetch receipts through the internal observer only", async () => {
  const receipts = [];
  const task = await executeWebTask(
    { goal: "Read a public text resource", url: "https://example.com/data" },
    {
      idFactory: () => "usage-receipt-task-01",
      fetchImpl: async () => new Response("ok", {
        status: 200,
        headers: { "content-type": "text/plain", "content-length": "2" },
      }),
      onUsageReceipt(receipt) { receipts.push(receipt); },
    },
  );

  assert.equal(task.state, "succeeded");
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].outcome, "response");
  assert.equal(receipts[0].responseBodyBytesRead, 2);
  assert.equal(Object.isFrozen(receipts[0]), true);
});
