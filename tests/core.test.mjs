import test from "node:test";
import assert from "node:assert/strict";
import { chooseExecutionPath } from "../src/core/router.js";
import { executeWebTask } from "../src/core/tasks.js";
import { EGRESS_POLICY, EgressPolicyError, validateEgressTarget } from "../src/core/egress-guard.js";
import { normalizeResult } from "../src/core/result.js";
import { registerAdapter, getAdapterCatalog, executeAdapter } from "../src/core/adapters.js";
import {
  FetchAdapterError,
  fetchPublicResource,
  validatePublicHttpUrl,
} from "../src/core/http-fetch.js";

function response(body, { status = 200, headers = { "content-type": "text/plain; charset=utf-8" } } = {}) {
  return new Response(body, { status, headers });
}

test("static tasks use direct HTTP", () => {
  assert.equal(chooseExecutionPath({}).path, "http");
  assert.equal(chooseExecutionPath({ requiresJavascript: false }).path, "http");
});

test("rendering or interaction selects browser", () => {
  assert.equal(chooseExecutionPath({ requiresJavascript: true }).path, "browser");
  assert.equal(chooseExecutionPath({ requiresInteraction: true }).path, "browser");
});

test("normalizes sources and warnings", () => {
  const result = normalizeResult({
    data: { price: 12 },
    sources: [{ url: "https://example.com/item" }],
    warnings: ["sample"],
  });
  assert.equal(result.status, "succeeded");
  assert.equal(result.sources.length, 1);
  assert.deepEqual(result.warnings, ["sample"]);
});

test("rejects unsafe source URLs and invalid status", () => {
  assert.throws(() => normalizeResult({ sources: [{ url: "javascript:alert(1)" }] }));
  assert.throws(() => normalizeResult({ status: "unknown" }));
});

test("adapter catalog omits executable functions", () => {
  registerAdapter({ id: "fixture-http", family: "http", capabilities: ["fetch"], execute: async () => ({}) });
  assert.equal(getAdapterCatalog().find((item) => item.id === "fixture-http").id, "fixture-http");
  assert.equal("execute" in getAdapterCatalog().find((item) => item.id === "fixture-http"), false);
});

test("URL policy accepts a public HTTP(S) hostname and strips fragments", () => {
  const url = validatePublicHttpUrl("https://example.com/path?q=1#private-fragment");
  assert.equal(url.href, "https://example.com/path?q=1");
});

test("URL policy rejects local names, IP literals, credentials, and unusual ports", () => {
  for (const value of [
    "http://localhost/",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://[::1]/",
    "http://service.internal/",
    "http://printer.local/",
    "http://user:pass@example.com/",
    "https://example.com:8443/",
    "file:///etc/passwd",
    "ftp://example.com/",
  ]) {
    assert.throws(() => validatePublicHttpUrl(value), FetchAdapterError, value);
  }
});


test("egress guard publishes a versioned Cloudflare public-egress policy", () => {
  assert.equal(EGRESS_POLICY.id, "cloudflare-public-egress-v1");
  assert.equal(validateEgressTarget("https://example.com/path").hostname, "example.com");
});

test("egress guard rejects private, reserved, and single-label hostname forms", () => {
  for (const value of [
    "http://localhost/",
    "http://printer.local/",
    "http://service.internal/",
    "http://host.cluster.local/",
    "http://pod.namespace.svc/",
    "http://test.example/",
    "http://service.home.arpa/",
    "http://metadata.google.internal/",
    "http://metadata.azure.internal/",
    "http://intranet/",
  ]) {
    assert.throws(() => validateEgressTarget(value), EgressPolicyError, value);
  }
});

test("egress guard blocks the ExportFlow zone and Worker origins", () => {
  for (const value of [
    "https://exportflow.me/",
    "https://www.exportflow.me/",
    "https://api.exportflow.me/",
    "https://internal.exportflow.me/",
    "https://exportflow-platform.hhameranede.workers.dev/",
  ]) {
    assert.throws(() => validateEgressTarget(value), EgressPolicyError, value);
  }
});

test("egress guard rejects legacy IP literals, credentials, and non-default ports", () => {
  for (const value of [
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://0177.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://user:pass@example.com/",
    "https://example.com:8443/",
    "file:///etc/passwd",
    "ftp://example.com/",
  ]) {
    assert.throws(() => validateEgressTarget(value), EgressPolicyError, value);
  }
});

test("egress guard normalizes trailing dots and strips URL fragments", () => {
  const url = validateEgressTarget("https://EXAMPLE.COM./path?q=1#fragment");
  assert.equal(url.hostname, "example.com");
  assert.equal(url.href, "https://example.com/path?q=1");
});

test("fetch returns bounded text and source metadata", async () => {
  const result = await fetchPublicResource("https://example.com/page", {
    fetchImpl: async (_url, init) => {
      assert.equal(init.method, "GET");
      assert.equal(init.redirect, "manual");
      assert.equal(init.headers.accept.includes("text/html"), true);
      return response("<h1>Hello</h1>", { headers: { "content-type": "text/html" } });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.body, "<h1>Hello</h1>");
  assert.equal(result.bytes, 14);
  assert.equal(result.finalUrl, "https://example.com/page");
});

test("fetch manually follows redirects and revalidates every destination", async () => {
  const seen = [];
  const result = await fetchPublicResource("https://example.com/start", {
    fetchImpl: async (url) => {
      seen.push(url);
      if (url.endsWith("/start")) {
        return response(null, { status: 302, headers: { location: "/final" } });
      }
      return response('{"ok":true}', { headers: { "content-type": "application/json" } });
    },
  });
  assert.deepEqual(seen, ["https://example.com/start", "https://example.com/final"]);
  assert.equal(result.redirects.length, 1);
  assert.equal(result.finalUrl, "https://example.com/final");
  assert.equal(result.body, '{"ok":true}');
});

test("fetch blocks redirects to local or non-HTTP destinations before a second request", async () => {
  let calls = 0;
  await assert.rejects(
    fetchPublicResource("https://example.com/start", {
      fetchImpl: async () => {
        calls++;
        return response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } });
      },
    }),
    (error) => error instanceof FetchAdapterError && error.code === "REDIRECT_NOT_ALLOWED",
  );
  assert.equal(calls, 1);
});

test("fetch blocks HTTPS to HTTP redirect downgrades", async () => {
  await assert.rejects(
    fetchPublicResource("https://example.com/start", {
      fetchImpl: async () => response(null, { status: 301, headers: { location: "http://example.com/next" } }),
    }),
    (error) => error instanceof FetchAdapterError && error.code === "REDIRECT_DOWNGRADE",
  );
});

test("fetch enforces redirect count", async () => {
  let count = 0;
  await assert.rejects(
    fetchPublicResource("https://example.com/0", {
      maxRedirects: 1,
      fetchImpl: async () => {
        count++;
        return response(null, { status: 302, headers: { location: "/next" } });
      },
    }),
    (error) => error instanceof FetchAdapterError && error.code === "TOO_MANY_REDIRECTS",
  );
  assert.equal(count, 2);
});

test("fetch rejects binary response types", async () => {
  await assert.rejects(
    fetchPublicResource("https://example.com/file", {
      fetchImpl: async () => response("binary", { headers: { "content-type": "application/octet-stream" } }),
    }),
    (error) => error instanceof FetchAdapterError && error.code === "UNSUPPORTED_CONTENT_TYPE",
  );
});

test("fetch enforces both declared and streamed response size limits", async () => {
  await assert.rejects(
    fetchPublicResource("https://example.com/large", {
      maxBytes: 4,
      fetchImpl: async () => response("12345", { headers: { "content-type": "text/plain", "content-length": "5" } }),
    }),
    (error) => error instanceof FetchAdapterError && error.code === "RESPONSE_TOO_LARGE",
  );
  await assert.rejects(
    fetchPublicResource("https://example.com/stream", {
      maxBytes: 4,
      fetchImpl: async () => response("12345", { headers: { "content-type": "text/plain" } }),
    }),
    (error) => error instanceof FetchAdapterError && error.code === "RESPONSE_TOO_LARGE",
  );
});

test("HTTP fetch adapter is registered and returns normalized evidence", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response("plain page", { headers: { "content-type": "text/plain" } });
  try {
    const result = await executeAdapter("http.fetch.v1", { url: "https://example.com/resource" });
    assert.equal(result.status, "succeeded");
    assert.equal(result.data.body, "plain page");
    assert.equal(result.sources[0].url, "https://example.com/resource");
    assert.equal(result.sources[0].evidence[0].type, "http_response");
    assert.ok(getAdapterCatalog().some((item) => item.id === "http.fetch.v1"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("internal HTTP task executor runs the direct adapter and returns lifecycle evidence", async () => {
  const originalFetch = globalThis.fetch;
  const times = ["2026-11-17T14:10:00.000Z", "2026-11-17T14:10:01.000Z", "2026-11-17T14:10:02.000Z"];
  globalThis.fetch = async () => response("research content", {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
  try {
    const task = await executeWebTask(
      { goal: "Read the public page", url: "https://example.com/research" },
      { idFactory: () => "task-test-0001", now: () => times.shift() },
    );
    assert.equal(task.id, "task-test-0001");
    assert.equal(task.state, "succeeded");
    assert.equal(task.execution.path, "http");
    assert.equal(task.execution.adapterId, "http.fetch.v1");
    assert.equal(task.result.data.body, "research content");
    assert.equal(task.result.sources[0].url, "https://example.com/research");
    assert.deepEqual(task.events.map((item) => item.type), [
      "task.accepted", "task.started", "task.succeeded",
    ]);
    assert.equal(task.timestamps.completedAt, "2026-11-17T14:10:02.000Z");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("internal task executor reports Browser work as unsupported without making a request", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    return response("should not run");
  };
  try {
    const task = await executeWebTask(
      { goal: "Render the dynamic page", url: "https://example.com/app", requiresJavascript: true },
      { idFactory: () => "task-browser-0001" },
    );
    assert.equal(task.state, "unsupported");
    assert.equal(task.execution.path, "browser");
    assert.equal(task.execution.adapterId, null);
    assert.equal(task.result.status, "failed");
    assert.equal(fetchCalls, 0);
    assert.ok(task.result.warnings[0].includes("Browser execution is not connected"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("internal task executor fails closed for disallowed URLs before fetching", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    return response("should not run");
  };
  try {
    const task = await executeWebTask(
      { goal: "Read a local destination", url: "http://127.0.0.1/" },
      { idFactory: () => "task-unsafe-0001" },
    );
    assert.equal(task.state, "failed");
    assert.equal(task.result.data.errorCode, "URL_NOT_ALLOWED");
    assert.equal(fetchCalls, 0);
    assert.equal(task.events.at(-1).type, "task.failed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("internal task executor sanitizes upstream failures and does not expose exception text", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("sensitive upstream detail");
  };
  try {
    const task = await executeWebTask(
      { goal: "Read the public page", url: "https://example.com/" },
      { idFactory: () => "task-error-0001" },
    );
    assert.equal(task.state, "failed");
    assert.equal(task.result.data.errorCode, "UPSTREAM_FETCH_FAILED");
    assert.equal(JSON.stringify(task).includes("sensitive upstream detail"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("internal task executor validates the goal and boolean routing flags", async () => {
  const missingGoal = await executeWebTask(
    { url: "https://example.com/" },
    { idFactory: () => "task-invalid-0001" },
  );
  const invalidFlag = await executeWebTask(
    { goal: "Read page", url: "https://example.com/", requiresJavascript: "true" },
    { idFactory: () => "task-invalid-0002" },
  );
  assert.equal(missingGoal.result.data.errorCode, "INVALID_GOAL");
  assert.equal(invalidFlag.result.data.errorCode, "INVALID_TASK");
});
