import assert from "node:assert/strict";
import test from "node:test";
import {
  readBoundedJsonBody,
  TaskContractError,
  TASK_REQUEST_LIMITS,
} from "../src/core/task-contract.js";

function makeRequest(body, headers = {}) {
  return new Request("https://api.exportflow.local/api/v1/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body,
    duplex: "half",
  });
}

test("bounded JSON reader accepts a valid body split across multiple chunks", async () => {
  const bytes = new TextEncoder().encode('{"ok":true}');
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, 4));
      controller.enqueue(bytes.slice(4));
      controller.close();
    },
  });

  assert.deepEqual(await readBoundedJsonBody(makeRequest(stream)), { ok: true });
});

test("bounded JSON reader rejects empty-chunk floods within the chunk ceiling", async () => {
  const stream = new ReadableStream({
    start(controller) {
      for (let index = 0; index <= TASK_REQUEST_LIMITS.maxBodyChunks; index += 1) {
        controller.enqueue(new Uint8Array(0));
      }
      controller.enqueue(new TextEncoder().encode('{"ok":true}'));
      controller.close();
    },
  });

  await assert.rejects(
    readBoundedJsonBody(makeRequest(stream)),
    (error) => error instanceof TaskContractError &&
      error.code === "PAYLOAD_TOO_LARGE" &&
      error.httpStatus === 413,
  );
});

test("oversized REST body does not wait for a stalled cancellation callback", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(TASK_REQUEST_LIMITS.maxBodyBytes + 1));
    },
    cancel() {
      return new Promise(() => {});
    },
  });

  const result = await Promise.race([
    readBoundedJsonBody(makeRequest(stream)).then(
      () => ({ resolved: true }),
      (error) => ({ error }),
    ),
    new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 150)),
  ]);

  assert.equal(result.timedOut, undefined, "body rejection must not await source cancellation");
  assert.ok(result.error instanceof TaskContractError);
  assert.equal(result.error.code, "PAYLOAD_TOO_LARGE");
  assert.equal(result.error.httpStatus, 413);
});

test("oversized REST body preserves the 413 response when cancellation rejects", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(TASK_REQUEST_LIMITS.maxBodyBytes + 1));
    },
    cancel() {
      return Promise.reject(new Error("synthetic cancellation failure"));
    },
  });

  await assert.rejects(
    readBoundedJsonBody(makeRequest(stream)),
    (error) => error instanceof TaskContractError &&
      error.code === "PAYLOAD_TOO_LARGE" &&
      error.httpStatus === 413,
  );
});

test("malformed Content-Length is rejected before reading the request body", async () => {
  const request = makeRequest('{"ok":true}', { "content-length": "1e3" });

  await assert.rejects(
    readBoundedJsonBody(request),
    (error) => error instanceof TaskContractError &&
      error.code === "INVALID_CONTENT_LENGTH" &&
      error.httpStatus === 400,
  );
});
