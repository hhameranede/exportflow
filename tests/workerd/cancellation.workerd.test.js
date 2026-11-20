import { describe, expect, it } from "vitest";
import { createWorker } from "../../src/index.js";

const TEST_TOKEN = "ef_workerd_test_token_synthetic_1234567890";
const env = { EXPORTFLOW_API_TOKEN: TEST_TOKEN };

function makeTaskRequest(body, signal) {
  return new Request("https://api.exportflow.test/api/v1/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TEST_TOKEN}`,
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
}

describe("public Fetch Task cancellation in Cloudflare Workerd", () => {
  it("rejects a request whose caller signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let fetchCalls = 0;
    const worker = createWorker({
      fetchImpl: async () => {
        fetchCalls++;
        return new Response("unexpected");
      },
    });

    const response = await worker.fetch(
      makeTaskRequest({ goal: "Fetch page", url: "https://example.com" }, controller.signal),
      env,
    );

    expect(response.status).toBe(499);
    expect(await response.json()).toMatchObject({
      error: { code: "TASK_CANCELLED" },
    });
    expect(fetchCalls).toBe(0);
  });

  it("maps caller abort during outbound Fetch to a cancelled Task", async () => {
    const controller = new AbortController();
    let notifyFetchStarted;
    const fetchStarted = new Promise((resolve) => {
      notifyFetchStarted = resolve;
    });
    const worker = createWorker({
      fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
        notifyFetchStarted();
      }),
    });

    const pendingResponse = worker.fetch(
      makeTaskRequest({ goal: "Cancel Fetch", url: "https://example.com/slow" }, controller.signal),
      env,
    );
    await fetchStarted;
    controller.abort();
    const response = await pendingResponse;
    const task = await response.json();

    expect(response.status).toBe(499);
    expect(task.state).toBe("cancelled");
    expect(task.errors[0].code).toBe("TASK_CANCELLED");
    expect(task.events.map((item) => item.type)).toEqual([
      "task.accepted",
      "task.started",
      "task.cancelled",
    ]);
  });

  it("keeps caller cancellation distinct from timeout while reading a response stream", async () => {
    const controller = new AbortController();
    let notifyStreamReady;
    const streamReady = new Promise((resolve) => {
      notifyStreamReady = resolve;
    });
    const worker = createWorker({
      fetchImpl: async (_url, init) => new Response(new ReadableStream({
        start(streamController) {
          init.signal.addEventListener("abort", () => {
            streamController.error(new DOMException("Aborted", "AbortError"));
          }, { once: true });
          notifyStreamReady();
        },
      }), {
        headers: { "content-type": "text/plain" },
      }),
    });

    const pendingResponse = worker.fetch(
      makeTaskRequest({ goal: "Cancel response stream", url: "https://example.com/stream" }, controller.signal),
      env,
    );
    await streamReady;
    controller.abort();
    const response = await pendingResponse;
    const task = await response.json();

    expect(response.status).toBe(499);
    expect(task.state).toBe("cancelled");
    expect(task.errors[0].code).toBe("TASK_CANCELLED");
  });

  it("keeps adapter timeout classified as UPSTREAM_TIMEOUT", async () => {
    const worker = createWorker({
      fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      }),
    });

    const response = await worker.fetch(
      makeTaskRequest({
        goal: "Timeout Fetch",
        url: "https://example.com/slow",
        limits: { timeoutMs: 25 },
      }),
      env,
    );
    const task = await response.json();

    expect(response.status).toBe(504);
    expect(task.state).toBe("failed");
    expect(task.errors[0].code).toBe("UPSTREAM_TIMEOUT");
  });

  it("does not follow a redirect after caller cancellation", async () => {
    const controller = new AbortController();
    let fetchCalls = 0;
    const worker = createWorker({
      fetchImpl: async () => {
        fetchCalls++;
        controller.abort();
        return new Response(null, {
          status: 302,
          headers: { location: "https://example.com/next" },
        });
      },
    });

    const response = await worker.fetch(
      makeTaskRequest({ goal: "Cancel redirect", url: "https://example.com/start" }, controller.signal),
      env,
    );
    const task = await response.json();

    expect(response.status).toBe(499);
    expect(task.state).toBe("cancelled");
    expect(fetchCalls).toBe(1);
  });

  it("cancels a pending inbound request-body reader on caller abort", async () => {
    const controller = new AbortController();
    let notifyPull;
    const pullStarted = new Promise((resolve) => {
      notifyPull = resolve;
    });
    let bodyCancelled = false;
    let fetchCalls = 0;
    const body = new ReadableStream({
      pull() {
        notifyPull();
      },
      cancel() {
        bodyCancelled = true;
      },
    }, { highWaterMark: 0 });

    const request = new Request("https://api.exportflow.test/api/v1/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body,
      duplex: "half",
      signal: controller.signal,
    });
    const worker = createWorker({
      fetchImpl: async () => {
        fetchCalls++;
        return new Response("unexpected");
      },
    });

    const pendingResponse = worker.fetch(request, env);
    await pullStarted;
    controller.abort();
    const response = await pendingResponse;
    const responseBody = await response.json();

    expect(response.status).toBe(499);
    expect(responseBody.error.code).toBe("TASK_CANCELLED");
    expect(bodyCancelled).toBe(true);
    expect(fetchCalls).toBe(0);
  });
});
