import assert from "node:assert/strict";
import test from "node:test";
import { assertSuccessfulFetchTask, SUCCESS_FIXTURE } from "../scripts/acceptance/shared-tenant-burst-assertions.mjs";

function task(overrides = {}) {
  return {
    state: "succeeded",
    result: {
      status: "succeeded",
      data: {
        httpStatus: 200,
        body: `<h1>${SUCCESS_FIXTURE.marker}</h1>`,
      },
    },
    errors: [],
    ...overrides,
  };
}

test("accepts only a succeeded task with a 2xx response and the expected content marker", () => {
  const evidence = assertSuccessfulFetchTask(task(), "REST");
  assert.deepEqual(evidence, {
    state: "succeeded",
    resultStatus: "succeeded",
    upstreamStatus: 200,
    hasBody: true,
    contentMarkerMatched: true,
    errorCodes: [],
  });
});

test("rejects failed tasks even when an HTTP response body exists", () => {
  const failed = task({
    state: "failed",
    result: {
      status: "failed",
      data: { httpStatus: 404, body: `<h1>${SUCCESS_FIXTURE.marker}</h1>` },
    },
    errors: [{ code: "UPSTREAM_HTTP_ERROR" }],
  });
  assert.throws(() => assertSuccessfulFetchTask(failed, "REST"), /REST Fetch did not complete/);
});

test("rejects partial task results", () => {
  const partial = task({
    state: "partial",
    result: {
      status: "partial",
      data: { httpStatus: 200, body: `<h1>${SUCCESS_FIXTURE.marker}</h1>` },
    },
  });
  assert.throws(() => assertSuccessfulFetchTask(partial, "MCP"), /MCP Fetch did not complete/);
});

test("rejects non-2xx responses and successful pages without the fixture marker", () => {
  const notFound = task({
    state: "failed",
    result: { status: "failed", data: { httpStatus: 404, body: "Not found" } },
  });
  const wrongContent = task({
    result: { status: "succeeded", data: { httpStatus: 200, body: "<h1>Different page</h1>" } },
  });
  assert.throws(() => assertSuccessfulFetchTask(notFound, "REST"), /REST Fetch did not complete/);
  const error = assert.throws(() => assertSuccessfulFetchTask(wrongContent, "MCP"), /MCP Fetch did not complete/);
  assert.equal(error.message.includes(SUCCESS_FIXTURE.marker), false);
});
