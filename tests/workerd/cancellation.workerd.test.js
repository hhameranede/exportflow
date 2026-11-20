import { describe, expect, it } from "vitest";
import { createWorker } from "../../src/index.js";
import { executeWebTask } from "../../src/core/tasks.js";
import { createSearchAdapter } from "../../src/core/search.js";
import { createResearchPipeline } from "../../src/core/research.js";
import { createBrowserAdapter } from "../../src/core/browser-render.js";
import { createTaskCancelledError } from "../../src/core/cancellation.js";

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


const INTERNAL_SCHEMA = {
  type: "object",
  properties: { title: { type: "string" } },
  required: ["title"],
};

function expectCancelledTask(task) {
  expect(task.state).toBe("cancelled");
  expect(task.errors[0].code).toBe("TASK_CANCELLED");
  expect(task.events.at(-1).type).toBe("task.cancelled");
}

describe("internal adapter cancellation in Cloudflare Workerd", () => {
  it.each(["map", "crawl"])("%s stops when cancellation interrupts a sitemap request", async (operation) => {
    const controller = new AbortController();
    let notifySitemapStarted;
    const sitemapStarted = new Promise((resolve) => {
      notifySitemapStarted = resolve;
    });
    const requested = [];

    const pendingTask = executeWebTask(
      { goal: `Cancel internal ${operation}`, operation, url: "https://example.com/" },
      {
        signal: controller.signal,
        fetchImpl: async (url, init) => {
          requested.push(String(url));
          if (String(url).endsWith("/robots.txt")) {
            return new Response("User-agent: *\nAllow: /\n", {
              headers: { "content-type": "text/plain" },
            });
          }
          if (String(url).endsWith("/sitemap.xml")) {
            notifySitemapStarted();
            return new Promise((_resolve, reject) => {
              init.signal.addEventListener("abort", () => {
                reject(new DOMException("Aborted", "AbortError"));
              }, { once: true });
            });
          }
          throw new Error("Unexpected request after cancelled sitemap");
        },
      },
    );

    await sitemapStarted;
    controller.abort();
    const task = await pendingTask;

    expectCancelledTask(task);
    expect(requested).toHaveLength(2);
  });

  it("stops structured extraction when the source Fetch is cancelled", async () => {
    const controller = new AbortController();
    let notifyFetchStarted;
    const fetchStarted = new Promise((resolve) => {
      notifyFetchStarted = resolve;
    });
    const pendingTask = executeWebTask(
      {
        goal: "Cancel structured extraction",
        operation: "extract",
        url: "https://example.com/item",
        schema: INTERNAL_SCHEMA,
      },
      {
        signal: controller.signal,
        fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
          notifyFetchStarted();
          init.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        }),
      },
    );

    await fetchStarted;
    controller.abort();
    const task = await pendingTask;
    expectCancelledTask(task);
  });

  it("stops waiting for Cloudflare Web Search when its caller cancels", async () => {
    const controller = new AbortController();
    let notifySearchStarted;
    const searchStarted = new Promise((resolve) => {
      notifySearchStarted = resolve;
    });
    let searchCalls = 0;
    const searchAdapter = createSearchAdapter({
      webSearch: () => {
        searchCalls++;
        notifySearchStarted();
        return new Promise(() => {});
      },
    });

    const pendingTask = executeWebTask(
      { goal: "Cancel web search", operation: "search", query: "synthetic query" },
      { signal: controller.signal, searchAdapter },
    );
    await searchStarted;
    controller.abort();
    const task = await pendingTask;

    expectCancelledTask(task);
    expect(searchCalls).toBe(1);
  });

  it("propagates cancellation through Research into its candidate Fetch stage", async () => {
    const controller = new AbortController();
    let notifyFetchStarted;
    const fetchStarted = new Promise((resolve) => {
      notifyFetchStarted = resolve;
    });
    const researchAdapter = createResearchPipeline({
      searchAdapter: {
        execute: async () => ({
          status: "succeeded",
          data: {
            results: [{ url: "https://example.com/product", title: "Synthetic product" }],
          },
          sources: [],
          warnings: [],
        }),
      },
      runAdapter: async (_adapterId, _input, options) => new Promise((_resolve, reject) => {
        expect(options.signal).toBe(controller.signal);
        notifyFetchStarted();
        options.signal.addEventListener("abort", () => {
          reject(createTaskCancelledError());
        }, { once: true });
      }),
    });

    const pendingTask = executeWebTask(
      {
        goal: "Cancel Research fetch stage",
        operation: "research",
        query: "synthetic product",
        schema: INTERNAL_SCHEMA,
      },
      { signal: controller.signal, researchAdapter },
    );
    await fetchStarted;
    controller.abort();
    const task = await pendingTask;

    expectCancelledTask(task);
  });

  it("closes the Browser session when caller cancellation interrupts navigation", async () => {
    const controller = new AbortController();
    let notifyNavigationStarted;
    const navigationStarted = new Promise((resolve) => {
      notifyNavigationStarted = resolve;
    });
    let rejectNavigation;
    let browserClosed = false;
    const browser = {
      newPage: async () => ({
        setUserAgent: async () => {},
        setRequestInterception: async () => {},
        on: () => {},
        goto: () => new Promise((_resolve, reject) => {
          rejectNavigation = reject;
          notifyNavigationStarted();
        }),
        content: async () => "<html></html>",
        title: async () => "Synthetic",
        url: () => "https://example.com/",
      }),
      close: async () => {
        browserClosed = true;
        rejectNavigation?.(new Error("Browser session closed"));
      },
    };
    const browserAdapter = createBrowserAdapter({
      browserBinding: {},
      puppeteer: { launch: async () => browser },
      fetchResource: async (url) => ({
        status: 200,
        finalUrl: url,
        contentType: "text/plain",
        body: "User-agent: *\nAllow: /\n",
        bytes: 22,
        retrievedAt: "2026-11-20T00:00:00.000Z",
      }),
    });

    const pendingTask = executeWebTask(
      {
        goal: "Cancel Browser navigation",
        url: "https://example.com/",
        requiresJavascript: true,
      },
      { signal: controller.signal, browserAdapter },
    );
    await navigationStarted;
    controller.abort();
    const task = await pendingTask;

    expectCancelledTask(task);
    expect(browserClosed).toBe(true);
  });
});
