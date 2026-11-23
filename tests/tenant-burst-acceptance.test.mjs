import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSuccessfulFetchTask,
  getSafeFetchDiagnostic,
} from "../scripts/acceptance/fetch-assertions.mjs";

const expectedContent = "User-agent: *";
const expectedHost = "cloudflare.com";

function makeTask(overrides = {}) {
  return {
    id: "acceptance-task-0001",
    state: "succeeded",
    errors: [],
    result: {
      status: "succeeded",
      data: {
        status: 200,
        httpStatus: 200,
        body: "# Robots.txt for www.cloudflare.com\n\nUser-agent: *\nAllow: /\n",
        bytes: 65,
        finalUrl: "https://www.cloudflare.com/robots.txt",
      },
      sources: [{ url: "https://www.cloudflare.com/robots.txt" }],
    },
    ...overrides,
  };
}

function assertFetchPass(task = makeTask(), extra = {}) {
  return assertSuccessfulFetchTask({
    transport: "REST",
    httpStatus: 200,
    task,
    expectedContent,
    expectedHost,
    ...extra,
  });
}

test("Acceptance requires a successful upstream HTTP fetch and verified content", () => {
  const evidence = assertFetchPass();
  assert.equal(evidence.taskState, "succeeded");
  assert.equal(evidence.resultStatus, "succeeded");
  assert.equal(evidence.transportHttpStatus, 200);
  assert.equal(evidence.upstreamHttpStatus, 200);
  assert.equal(evidence.expectedContentVerified, true);
  assert.equal(evidence.sourceHostVerified, true);
  assert.equal(evidence.sourceCount, 1);
});

test("Acceptance rejects failed tasks even when the REST route returns a response", () => {
  const task = makeTask({
    state: "failed",
    errors: [{ code: "UPSTREAM_FETCH_FAILED", message: "internal origin detail" }],
    result: {
      status: "failed",
      data: { errorCode: "UPSTREAM_FETCH_FAILED", body: "" },
      sources: [],
    },
  });
  assert.throws(() => assertFetchPass(task), /task_state/);
});

test("Acceptance rejects partial task outcomes", () => {
  const task = makeTask({
    state: "partial",
    result: { status: "partial", data: { httpStatus: 200, body: "User-agent: *", bytes: 14 }, sources: [] },
  });
  assert.throws(() => assertFetchPass(task), /task_state/);
});

test("Acceptance rejects upstream HTTP errors even when task state is incorrectly marked successful", () => {
  const task = makeTask({
    result: {
      status: "succeeded",
      data: { status: 404, httpStatus: 404, body: "User-agent: *", bytes: 14 },
      sources: [{ url: "https://www.cloudflare.com/robots.txt" }],
    },
  });
  assert.throws(() => assertFetchPass(task), /upstream_http_status/);
});

test("Acceptance rejects missing expected content and missing provenance", () => {
  const task = makeTask({
    result: {
      status: "succeeded",
      data: { status: 200, httpStatus: 200, body: "unrelated page content", bytes: 21 },
      sources: [{ url: "https://example.net/robots.txt" }],
    },
  });
  assert.throws(() => assertFetchPass(task), /expected_content_missing/);
});

test("MCP tool errors cannot be counted as successful Fetch results", () => {
  assert.throws(
    () => assertSuccessfulFetchTask({
      transport: "MCP",
      httpStatus: 200,
      toolIsError: true,
      task: makeTask({ state: "failed" }),
      expectedContent,
      expectedHost,
    }),
    /mcp_tool_error/,
  );
});

test("failure diagnostics contain only bounded status and code metadata, never body or raw error text", () => {
  const secretBody = "response-body-secret-should-not-appear";
  const task = makeTask({
    state: "failed",
    errors: [{ code: "UPSTREAM_FETCH_FAILED", message: "raw-secret-message-should-not-appear" }],
    result: {
      status: "failed",
      data: { errorCode: "UPSTREAM_FETCH_FAILED", body: secretBody, bytes: secretBody.length },
      sources: [],
    },
  });
  const diagnostic = getSafeFetchDiagnostic({
    transport: "MCP",
    httpStatus: 200,
    toolIsError: true,
    task,
    expectedContent,
    expectedHost,
  });
  assert.deepEqual(diagnostic.taskErrorCodes, ["UPSTREAM_FETCH_FAILED"]);
  assert.equal(diagnostic.resultErrorCode, "UPSTREAM_FETCH_FAILED");
  assert.equal(JSON.stringify(diagnostic).includes(secretBody), false);
  assert.equal(JSON.stringify(diagnostic).includes("raw-secret-message"), false);
  assert.equal(JSON.stringify(diagnostic).includes("response-body-secret"), false);
});
