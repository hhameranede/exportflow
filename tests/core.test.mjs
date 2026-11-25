import test from "node:test";
import assert from "node:assert/strict";
import { chooseExecutionPath } from "../src/core/router.js";
import { executeWebTask } from "../src/core/tasks.js";
import { crawlWebsite, extractSitemapLocations, isAllowedByRobots, mapWebsite, parseRobotsTxt } from "../src/core/map-crawl.js";
import { ExtractionError, extractFromStructuredSources, extractStructuredData, validateExtractionSchema } from "../src/core/extract.js";
import { SearchAdapterError, createSearchAdapter } from "../src/core/search.js";
import { ResearchPipelineError, createResearchPipeline } from "../src/core/research.js";
import { EGRESS_POLICY, EgressPolicyError, validateEgressTarget } from "../src/core/egress-guard.js";
import { normalizeResult } from "../src/core/result.js";
import { registerAdapter, getAdapterCatalog, executeAdapter } from "../src/core/adapters.js";
import {
  FetchAdapterError,
  HTTP_FETCH_LIMITS,
  fetchPublicResource,
  validatePublicHttpUrl,
} from "../src/core/http-fetch.js";

function response(body, { status = 200, headers = { "content-type": "text/plain; charset=utf-8" } } = {}) {
  return new Response(body, { status, headers });
}

test("all supported tasks use the bounded HTTP request route", () => {
  const route = chooseExecutionPath();
  assert.equal(route.path, "http");
  assert.equal(route.escalationAllowed, false);
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

test("web.map adapter enforces the caller's maxUrls limit", async () => {
  const originalFetch = globalThis.fetch;
  const links = Array.from({ length: 12 }, (_, index) =>
    '<a href="/item-' + index + '">Item ' + index + '</a>'
  ).join("");
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/robots.txt") {
      return response("User-agent: *", { headers: { "content-type": "text/plain" } });
    }
    if (url.pathname === "/sitemap.xml") {
      return response("", { status: 404, headers: { "content-type": "text/plain" } });
    }
    if (url.pathname === "/start") {
      return response(links, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    throw new Error("Unexpected map request: " + url.href);
  };

  try {
    const result = await executeAdapter("web.map.v1", {
      url: "https://example.com/start",
      maxUrls: 4,
    });
    assert.equal(result.status, "succeeded");
    assert.equal(result.data.urls.length, 4);
    assert.ok(result.data.urls.every((item) => item.url.startsWith("https://example.com/item-")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("web.crawl adapter enforces caller maxPages and maxDepth limits", async () => {
  const originalFetch = globalThis.fetch;
  const pages = {
    "/start": '<a href="/one">One</a><a href="/two">Two</a><a href="/three">Three</a>',
    "/one": '<a href="/deep-one">Deep one</a><p>One</p>',
    "/two": '<a href="/deep-two">Deep two</a><p>Two</p>',
    "/three": '<a href="/deep-three">Deep three</a><p>Three</p>',
    "/deep-one": "<p>Deep one</p>",
    "/deep-two": "<p>Deep two</p>",
    "/deep-three": "<p>Deep three</p>",
  };
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/robots.txt") {
      return response("User-agent: *", { headers: { "content-type": "text/plain" } });
    }
    if (url.pathname === "/sitemap.xml") {
      return response("", { status: 404, headers: { "content-type": "text/plain" } });
    }
    if (Object.hasOwn(pages, url.pathname)) {
      return response(pages[url.pathname], { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    throw new Error("Unexpected crawl request: " + url.href);
  };

  try {
    const cappedPages = await executeAdapter("web.crawl.v1", {
      url: "https://example.com/start",
      maxPages: 2,
      maxDepth: 1,
    });
    assert.equal(cappedPages.status, "succeeded");
    assert.equal(cappedPages.data.pageCount, 2);
    assert.ok(cappedPages.data.pages.every((page) => page.depth <= 1));

    const depthZero = await executeAdapter("web.crawl.v1", {
      url: "https://example.com/start",
      maxPages: 5,
      maxDepth: 0,
    });
    assert.equal(depthZero.status, "succeeded");
    assert.equal(depthZero.data.pageCount, 1);
    assert.equal(depthZero.data.pages[0].depth, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("fetch returns bounded text and leaves Cloudflare default cache policy unset", async () => {
  const receipts = [];
  const result = await fetchPublicResource("https://example.com/page", {
    onUsageReceipt: (receipt) => receipts.push(receipt),
    fetchImpl: async (_url, init) => {
      assert.equal(init.method, "GET");
      assert.equal(init.redirect, "manual");
      assert.equal(Object.hasOwn(init, "cache"), false);
      assert.equal(Object.hasOwn(init, "cf"), false);
      assert.equal(init.headers.accept.includes("text/html"), true);
      return response("<h1>Hello</h1>", {
        headers: {
          "content-type": "text/html",
          "cf-cache-status": "HIT",
          "cache-control": "public, max-age=300",
        },
      });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.body, "<h1>Hello</h1>");
  assert.equal(result.bytes, 14);
  assert.equal(result.finalUrl, "https://example.com/page");
  assert.equal(result.cacheStatus, "HIT");
  assert.equal(receipts[0].cacheStatus, "HIT");
});

test("fetch accepts the supported public text media types", async () => {
  const contentTypes = [
    "text/html; charset=utf-8",
    "application/xhtml+xml; charset=utf-8",
    "application/json; charset=utf-8",
    "application/ld+json; charset=utf-8",
    "application/xml; charset=utf-8",
    "application/atom+xml; charset=utf-8",
    "text/plain; charset=utf-8",
  ];
  for (const contentType of contentTypes) {
    const result = await fetchPublicResource("https://example.com/resource", {
      fetchImpl: async () => response("<root>ok</root>", { headers: { "content-type": contentType } }),
    });
    assert.equal(result.ok, true, contentType);
    assert.equal(result.body, "<root>ok</root>", contentType);
  }
});

test("fetch decodes response text with its declared charset", async () => {
  const legacyBytes = new Uint8Array([0x63, 0x61, 0x66, 0xe9]);
  const result = await fetchPublicResource("https://example.com/legacy", {
    fetchImpl: async () => response(legacyBytes, {
      headers: { "content-type": "text/plain; charset=windows-1252" },
    }),
  });
  assert.equal(result.body, "café");
  assert.equal(result.bytes, 4);
});

test("fetch rejects a declared charset unsupported by the runtime", async () => {
  await assert.rejects(
    fetchPublicResource("https://example.com/unknown-charset", {
      fetchImpl: async () => response("body", {
        headers: { "content-type": "text/plain; charset=x-exportflow-unknown" },
      }),
    }),
    (error) => error instanceof FetchAdapterError &&
      error.code === "UNSUPPORTED_CHARSET" &&
      error.httpStatus === 415,
  );
});

test("fetch cache mode can explicitly bypass edge cache without changing outbound safety", async () => {
  let initSeen;
  const result = await fetchPublicResource("https://example.com/fresh", {
    cacheMode: "bypass",
    fetchImpl: async (_url, init) => {
      initSeen = init;
      return response("fresh", {
        headers: { "content-type": "text/plain", "cf-cache-status": "BYPASS" },
      });
    },
  });
  assert.equal(initSeen.method, "GET");
  assert.equal(initSeen.cache, "no-store");
  assert.equal(Object.hasOwn(initSeen, "cf"), false);
  assert.equal(result.cacheStatus, "BYPASS");
});

test("fetch rejects unsupported cache modes", async () => {
  await assert.rejects(
    fetchPublicResource("https://example.com/page", {
      cacheMode: "force",
      fetchImpl: async () => response("unexpected"),
    }),
    (error) => error instanceof FetchAdapterError && error.code === "INVALID_LIMIT",
  );
});

test("map revalidates robots.txt while sitemap and pages use origin-governed caching", async () => {
  const observed = [];
  await mapWebsite({ url: "https://example.com/start" }, {
    maxUrls: 5,
    parseHtmlLinks: async () => [],
    fetchResource: async (url, options = {}) => {
      const pathname = new URL(url).pathname;
      observed.push({ pathname, cacheMode: options.cacheMode });
      if (pathname === "/robots.txt") {
        return {
          status: 200, body: "User-agent: *", bytes: 14,
          contentType: "text/plain", finalUrl: url, retrievedAt: "2026-11-24T00:00:00.000Z",
        };
      }
      if (pathname === "/sitemap.xml") {
        return {
          status: 404, body: "", bytes: 0,
          contentType: "text/plain", finalUrl: url, retrievedAt: "2026-11-24T00:00:00.000Z",
        };
      }
      if (pathname === "/start") {
        return {
          status: 200, body: "<html></html>", bytes: 13,
          contentType: "text/html", finalUrl: url, retrievedAt: "2026-11-24T00:00:00.000Z",
        };
      }
      throw new Error("Unexpected test URL: " + url);
    },
  });
  assert.deepEqual(observed, [
    { pathname: "/robots.txt", cacheMode: "bypass" },
    { pathname: "/sitemap.xml", cacheMode: "default" },
    { pathname: "/start", cacheMode: "default" },
  ]);
});

test("structured extraction propagates cache policy and returns cache evidence", async () => {
  let observedOptions;
  const result = await extractStructuredData({
    url: "https://example.com/product",
    cacheMode: "bypass",
    schema: {
      type: "object",
      properties: { title: { type: "string", "x-source": "page:title" } },
      required: ["title"],
    },
  }, {
    fetchResource: async (_url, options) => {
      observedOptions = options;
      return {
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: "<html><head><title>Cached title</title></head><body></body></html>",
        bytes: 68,
        finalUrl: "https://example.com/product",
        retrievedAt: "2026-11-24T00:00:00.000Z",
        cacheStatus: "BYPASS",
      };
    },
  });

  assert.equal(observedOptions.cacheMode, "bypass");
  assert.equal(result.status, "succeeded");
  assert.equal(result.data.cacheStatus, "BYPASS");
  assert.equal(result.sources[0].evidence[0].cacheStatus, "BYPASS");
});

test("fetch rejects an already-cancelled caller signal before starting outbound work", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    fetchPublicResource("https://example.com/page", {
      signal: controller.signal,
      fetchImpl: async () => { calls++; return response("unexpected"); },
    }),
    (error) => error instanceof FetchAdapterError && error.code === "TASK_CANCELLED",
  );
  assert.equal(calls, 0);
});

test("fetch distinguishes caller cancellation from its own request timeout", async () => {
  const controller = new AbortController();
  let requestSignal;
  const pending = fetchPublicResource("https://example.com/page", {
    signal: controller.signal,
    timeoutMs: 1_000,
    fetchImpl: async (_url, init) => {
      requestSignal = init.signal;
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  controller.abort();
  await assert.rejects(pending, (error) => error instanceof FetchAdapterError && error.code === "TASK_CANCELLED");
  assert.equal(requestSignal.aborted, true);

  await assert.rejects(
    fetchPublicResource("https://example.com/slow", {
      timeoutMs: 10,
      fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    }),
    (error) => error instanceof FetchAdapterError && error.code === "UPSTREAM_TIMEOUT",
  );
});

test("fetch rejects a late response after its own timeout has fired", async () => {
  await assert.rejects(
    fetchPublicResource("https://example.com/late", {
      timeoutMs: 1,
      fetchImpl: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return response(null);
      },
    }),
    (error) => error instanceof FetchAdapterError && error.code === "UPSTREAM_TIMEOUT",
  );
});

test("fetch stops before following a redirect when the caller cancels", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    fetchPublicResource("https://example.com/start", {
      signal: controller.signal,
      fetchImpl: async () => {
        calls++;
        controller.abort();
        return response(null, { status: 302, headers: { location: "/next" } });
      },
    }),
    (error) => error instanceof FetchAdapterError && error.code === "TASK_CANCELLED",
  );
  assert.equal(calls, 1);
});

test("fetch preserves caller cancellation while reading a streamed response body", async () => {
  const controller = new AbortController();
  let streamController;
  const pending = fetchPublicResource("https://example.com/stream", {
    signal: controller.signal,
    timeoutMs: 1_000,
    fetchImpl: async (_url, init) => {
      const body = new ReadableStream({ start(stream) { streamController = stream; } });
      init.signal.addEventListener("abort", () => {
        streamController.error(new DOMException("Aborted", "AbortError"));
      }, { once: true });
      return new Response(body, { headers: { "content-type": "text/plain" } });
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  controller.abort();
  await assert.rejects(pending, (error) => error instanceof FetchAdapterError && error.code === "TASK_CANCELLED");
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

test("internal task executor rejects properties outside the task contract", async () => {
  for (const extra of [{ scriptMode: "client" }, { runtime: "unsupported" }]) {
    const task = await executeWebTask({ goal: "Read page", url: "https://example.com/", ...extra },
      { idFactory: () => "task-extra-field" });
    assert.equal(task.state, "failed");
    assert.equal(task.errors[0].code, "INVALID_TASK");
  }
});


test("robots parser merges matching groups and applies longest match with Allow tie-break", () => {
  const policy = parseRobotsTxt([
    "User-agent: *",
    "Disallow: /wildcard-only",
    "User-agent: ExportFlowBot",
    "Disallow: /private/",
    "Allow: /private/public/",
    "Disallow: /same",
    "Allow: /same",
    "Disallow: /bot-only/",
    "User-agent: ExportFlow",
    "Disallow: /extra/",
    "Sitemap: https://example.com/sitemap.xml",
  ].join("\n"));
  assert.equal(isAllowedByRobots("https://example.com/private/item", policy), false);
  assert.equal(isAllowedByRobots("https://example.com/private/public/item", policy), true);
  assert.equal(isAllowedByRobots("https://example.com/same", policy), true);
  assert.equal(isAllowedByRobots("https://example.com/bot-only/item", policy), false);
  assert.equal(isAllowedByRobots("https://example.com/extra/item", policy), false);
  assert.equal(isAllowedByRobots("https://example.com/wildcard-only", policy), true);
  assert.deepEqual(policy.sitemaps, ["https://example.com/sitemap.xml"]);
});

test("robots parser uses wildcard group when no product-token group matches", () => {
  const policy = parseRobotsTxt("User-agent: OtherBot\nDisallow: /secret\n\nUser-agent: *\nDisallow: /hidden");
  assert.equal(isAllowedByRobots("https://example.com/secret", policy), true);
  assert.equal(isAllowedByRobots("https://example.com/hidden", policy), false);
});

test("robots rules support wildcard and end-anchor patterns", () => {
  const policy = parseRobotsTxt("User-agent: *\nDisallow: /private/*.pdf$");
  assert.equal(isAllowedByRobots("https://example.com/private/a.pdf", policy), false);
  assert.equal(isAllowedByRobots("https://example.com/private/a.pdf?download=1", policy), true);
});

test("empty Disallow is ignored", () => {
  const policy = parseRobotsTxt("User-agent: *\nDisallow:");
  assert.equal(isAllowedByRobots("https://example.com/anywhere", policy), true);
});

test("sitemap parser decodes XML entities and filters off-origin and unsafe URLs", () => {
  const xml = "<urlset><url><loc>https://example.com/a&amp;b</loc></url><url><loc>https://outside.example/page</loc></url><url><loc>javascript:alert(1)</loc></url></urlset>";
  assert.deepEqual(extractSitemapLocations(xml, "https://example.com/", 10), ["https://example.com/a&b"]);
});

test("mapWebsite discovers sitemap URLs and allowed same-origin links", async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    if (url.endsWith("/robots.txt")) return {
      status: 200,
      body: "User-agent: *\nDisallow: /blocked\nSitemap: https://example.com/sitemap.xml",
      bytes: 70, contentType: "text/plain", finalUrl: url, retrievedAt: "2026-11-17T00:00:00.000Z",
    };
    if (url.endsWith("/sitemap.xml")) return {
      status: 200,
      body: "<urlset><url><loc>https://example.com/from-sitemap</loc></url><url><loc>https://example.com/blocked/page</loc></url></urlset>",
      bytes: 120, contentType: "application/xml", finalUrl: url, retrievedAt: "2026-11-17T00:00:01.000Z",
    };
    if (url.endsWith("/start")) return {
      status: 200,
      body: '<a href="/from-link">Link</a><a href="/blocked/page">No</a><a href="https://outside.example/page">Offsite</a>',
      bytes: 100, contentType: "text/html", finalUrl: url, retrievedAt: "2026-11-17T00:00:02.000Z",
    };
    throw new Error("Unexpected URL " + url);
  };
  const result = await mapWebsite({ url: "https://example.com/start" }, { fetchResource: fakeFetch });
  assert.deepEqual(result.urls.map((item) => item.url), [
    "https://example.com/from-sitemap",
    "https://example.com/from-link",
  ]);
  assert.equal(result.urls[0].discoveredBy, "sitemap");
  assert.equal(result.urls[1].discoveredBy, "link");
  assert.equal(calls.length, 3);
});

test("mapWebsite propagates cancellation to every fetch and does not continue to the homepage", async () => {
  const controller = new AbortController();
  const calls = [];
  await assert.rejects(
    mapWebsite({ url: "https://example.com/" }, {
      signal: controller.signal,
      fetchResource: async (url, options = {}) => {
        calls.push(url);
        assert.equal(options.signal, controller.signal);
        if (url.endsWith("/robots.txt")) {
          return {
            status: 200,
            body: "User-agent: *\nSitemap: https://example.com/sitemap.xml",
            bytes: 60,
            contentType: "text/plain",
            finalUrl: url,
          };
        }
        controller.abort();
        throw new Error("simulated abort");
      },
    }),
    (error) => error.code === "TASK_CANCELLED",
  );
  assert.deepEqual(calls, [
    "https://example.com/robots.txt",
    "https://example.com/sitemap.xml",
  ]);
});

test("mapWebsite fails closed when robots.txt is unreachable", async () => {
  let pageFetched = false;
  await assert.rejects(
    mapWebsite({ url: "https://example.com/" }, {
      fetchResource: async (url) => {
        if (url.endsWith("/robots.txt")) throw new Error("network unavailable");
        pageFetched = true;
        return {};
      },
    }),
    (error) => error.code === "ROBOTS_UNREACHABLE",
  );
  assert.equal(pageFetched, false);
});

test("mapWebsite fails closed when robots.txt denies or rate-limits", async () => {
  for (const status of [401, 403, 429, 503]) {
    await assert.rejects(
      mapWebsite({ url: "https://example.com/" }, {
        fetchResource: async () => ({ status, body: "", bytes: 0, contentType: "text/plain" }),
      }),
      (error) => error.code === "ROBOTS_UNREACHABLE",
    );
  }
});

test("mapWebsite refuses cross-origin redirects of robots.txt and start page", async () => {
  await assert.rejects(
    mapWebsite({ url: "https://example.com/" }, {
      fetchResource: async (url) => url.endsWith("/robots.txt")
        ? { status: 200, body: "", bytes: 0, contentType: "text/plain", finalUrl: "https://external-test.com/robots.txt" }
        : { status: 200, body: "", bytes: 0, contentType: "text/html", finalUrl: url },
    }),
    (error) => error.code === "ROBOTS_REDIRECT_OUT_OF_SCOPE",
  );
  await assert.rejects(
    mapWebsite({ url: "https://example.com/" }, {
      fetchResource: async (url) => {
        if (url.endsWith("/robots.txt")) return { status: 200, body: "", bytes: 0, contentType: "text/plain", finalUrl: url };
        if (url.endsWith("/sitemap.xml")) return { status: 404, body: "", bytes: 0, contentType: "text/plain", finalUrl: url };
        return { status: 200, body: "", bytes: 0, contentType: "text/html", finalUrl: "https://external-test.com/" };
      },
    }),
    (error) => error.code === "PAGE_REDIRECT_OUT_OF_SCOPE",
  );
});

test("mapWebsite validates URL before network requests", async () => {
  let calls = 0;
  await assert.rejects(
    mapWebsite({ url: "http://127.0.0.1/" }, {
      fetchResource: async () => { calls++; return {}; },
    }),
    (error) => error.code === "URL_NOT_ALLOWED",
  );
  assert.equal(calls, 0);
});

test("crawlWebsite respects robots, seeds sitemap pages, and bounds traversal", async () => {
  const pages = {
    "https://example.com/robots.txt": {
      status: 200,
      body: "User-agent: *\nDisallow: /blocked\nSitemap: https://example.com/sitemap.xml",
      bytes: 70, contentType: "text/plain",
    },
    "https://example.com/sitemap.xml": {
      status: 200,
      body: "<urlset><url><loc>https://example.com/from-sitemap</loc></url></urlset>",
      bytes: 80, contentType: "application/xml",
    },
    "https://example.com/": {
      status: 200,
      body: '<a href="/one">One</a><a href="/two">Two</a><a href="/blocked">Blocked</a><a href="https://outside.example/x">Offsite</a>',
      bytes: 100, contentType: "text/html",
    },
    "https://example.com/from-sitemap": {
      status: 200, body: "<p>Sitemap entry</p>", bytes: 40, contentType: "text/html",
    },
    "https://example.com/one": {
      status: 200, body: '<a href="/three">Three</a>', bytes: 70, contentType: "text/html",
    },
    "https://example.com/two": {
      status: 200, body: "<p>Two</p>", bytes: 50, contentType: "text/html",
    },
  };
  const result = await crawlWebsite({ url: "https://example.com/" }, {
    maxPages: 3,
    maxDepth: 2,
    fetchResource: async (url) => {
      if (!pages[url]) throw new Error("Unexpected URL " + url);
      return { ...pages[url], finalUrl: url, retrievedAt: "2026-11-17T00:00:00.000Z" };
    },
  });
  assert.equal(result.pageCount, 3);
  assert.deepEqual(result.pages.map((page) => page.url), [
    "https://example.com/",
    "https://example.com/from-sitemap",
    "https://example.com/one",
  ]);
  assert.ok(result.totalBytes <= 1_048_576);
  assert.equal(result.pages.some((page) => page.url.includes("/blocked")), false);
  assert.equal(result.pages.some((page) => page.url.includes("outside.example")), false);
});

test("crawlWebsite does not swallow cancellation while fetching discovered pages", async () => {
  const controller = new AbortController();
  const calls = [];
  await assert.rejects(
    crawlWebsite({ url: "https://example.com/" }, {
      signal: controller.signal,
      maxPages: 3,
      maxDepth: 1,
      fetchResource: async (url, options = {}) => {
        calls.push(url);
        assert.equal(options.signal, controller.signal);
        if (url.endsWith("/robots.txt")) {
          return { status: 200, body: "", bytes: 0, contentType: "text/plain", finalUrl: url };
        }
        if (url.endsWith("/sitemap.xml")) {
          return { status: 404, body: "", bytes: 0, contentType: "text/plain", finalUrl: url };
        }
        if (url === "https://example.com/") {
          return {
            status: 200,
            body: '<a href="/child">Child</a>',
            bytes: 30,
            contentType: "text/html",
            finalUrl: url,
          };
        }
        controller.abort();
        throw new Error("simulated abort");
      },
    }),
    (error) => error.code === "TASK_CANCELLED",
  );
  assert.deepEqual(calls, [
    "https://example.com/robots.txt",
    "https://example.com/sitemap.xml",
    "https://example.com/",
    "https://example.com/child",
  ]);
});

test("map and crawl adapters publish bounded limits", () => {
  const catalog = getAdapterCatalog();
  const mapAdapter = catalog.find((item) => item.id === "web.map.v1");
  const crawlAdapter = catalog.find((item) => item.id === "web.crawl.v1");
  assert.equal(mapAdapter.limits.maxSitemaps, 2);
  assert.equal(crawlAdapter.limits.maxPages, 5);
  assert.ok(mapAdapter.restrictions.includes("robots.txt-respected"));
  assert.ok(crawlAdapter.restrictions.includes("same-origin-only"));
});

test("task executor forwards AbortSignal to the selected adapter", async () => {
  const controller = new AbortController();
  let receivedSignal = null;
  const task = await executeWebTask(
    { goal: "Map the website", url: "https://example.com/", operation: "map" },
    {
      idFactory: () => "task-cancel-0001",
      signal: controller.signal,
      executeAdapter: async (_id, _input, options = {}) => {
        receivedSignal = options.signal;
        return { status: "succeeded", data: {}, sources: [], warnings: [] };
      },
    },
  );
  assert.equal(task.state, "succeeded");
  assert.ok(receivedSignal instanceof AbortSignal);
  assert.notEqual(receivedSignal, controller.signal);
});

test("task executor enforces an overall timeout and aborts the adapter signal", async () => {
  let receivedSignal;
  const task = await executeWebTask(
    { goal: "Wait for a slow adapter", url: "https://example.com/" },
    {
      idFactory: () => "task-timeout-0001",
      taskTimeoutMs: 10,
      executeAdapter: async (_id, _input, options = {}) => {
        receivedSignal = options.signal;
        return new Promise(() => {});
      },
    },
  );
  assert.equal(task.state, "failed");
  assert.equal(task.errors[0].code, "TASK_TIMEOUT");
  assert.equal(receivedSignal.aborted, true);
});

test("task executor immediately settles when caller cancels an active adapter", async () => {
  const controller = new AbortController();
  let receivedSignal;
  const pending = executeWebTask(
    { goal: "Wait for a cancellable adapter", url: "https://example.com/" },
    {
      idFactory: () => "task-abort-0001",
      signal: controller.signal,
      taskTimeoutMs: 5_000,
      executeAdapter: async (_id, _input, options = {}) => {
        receivedSignal = options.signal;
        return new Promise(() => {});
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 5));
  controller.abort();
  const task = await pending;
  assert.equal(task.state, "cancelled");
  assert.equal(task.events.at(-1).type, "task.cancelled");
  assert.equal(task.errors[0].code, "TASK_CANCELLED");
  assert.equal(receivedSignal.aborted, true);
});

test("task executor stops pre-cancelled work before invoking an adapter", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const task = await executeWebTask(
    { goal: "Fetch the page", url: "https://example.com/" },
    {
      idFactory: () => "task-cancel-early",
      signal: controller.signal,
      executeAdapter: async () => { calls++; return { status: "succeeded", data: {}, sources: [], warnings: [] }; },
    },
  );
  assert.equal(calls, 0);
  assert.equal(task.state, "cancelled");
  assert.equal(task.events.at(-1).type, "task.cancelled");
  assert.equal(task.errors[0].code, "TASK_CANCELLED");
});

test("task executor dispatches map and crawl to internal adapters", async () => {
  const seen = [];
  const runAdapter = async (id, input) => {
    seen.push({ id, input });
    return { status: "succeeded", data: { operation: id }, sources: [], warnings: [] };
  };
  const mapTask = await executeWebTask(
    { goal: "Map the website", url: "https://example.com", operation: "map", maxUrls: 10 },
    { idFactory: () => "task-map-0001", executeAdapter: runAdapter },
  );
  const crawlTask = await executeWebTask(
    { goal: "Crawl a small section", url: "https://example.com", operation: "crawl", maxPages: 3, maxDepth: 1 },
    { idFactory: () => "task-crawl-0001", executeAdapter: runAdapter },
  );
  assert.equal(mapTask.execution.adapterId, "web.map.v1");
  assert.equal(crawlTask.execution.adapterId, "web.crawl.v1");
  assert.deepEqual(seen.map((item) => item.id), ["web.map.v1", "web.crawl.v1"]);
  assert.equal(seen[0].input.maxUrls, 10);
  assert.equal(seen[1].input.maxPages, 3);
});


test("HTTP fetch can pin redirects to the requested origin", async () => {
  let calls = 0;
  await assert.rejects(
    fetchPublicResource("https://example.com/start", {
      allowedOrigin: "https://example.com",
      fetchImpl: async () => {
        calls++;
        return response(null, { status: 302, headers: { location: "https://outside.example/final" } });
      },
    }),
    (error) => error instanceof FetchAdapterError && error.code === "REDIRECT_NOT_ALLOWED",
  );
  assert.equal(calls, 1);
});

test("HTTP fetch rejects an initial URL outside the pinned origin", async () => {
  let calls = 0;
  await assert.rejects(
    fetchPublicResource("https://outside.example/start", {
      allowedOrigin: "https://example.com",
      fetchImpl: async () => { calls++; return response("no"); },
    }),
    (error) => error instanceof FetchAdapterError && error.code === "URL_NOT_ALLOWED",
  );
  assert.equal(calls, 0);
});

test("HTTP fetch applies the bounded crawler User-Agent option", async () => {
  let seenHeaders;
  await fetchPublicResource("https://example.com/robots.txt", {
    userAgent: "ExportFlowBot/0.1 (+https://exportflow.me)",
    fetchImpl: async (_url, init) => {
      seenHeaders = init.headers;
      return response("User-agent: *", { headers: { "content-type": "text/plain" } });
    },
  });
  assert.equal(seenHeaders["user-agent"], "ExportFlowBot/0.1 (+https://exportflow.me)");
});


test("schema extraction reads JSON-LD, OpenGraph, title and canonical with field-level evidence", () => {
  const html = [
    "<html><head>",
    "<title>Fallback title</title>",
    '<meta property="og:title" content="Widget overview">',
    '<link rel="canonical" href="/products/widget">',
    '<script type="application/ld+json">{"@type":"Product","name":"Widget","description":"A test item","offers":{"price":"19.95","priceCurrency":"USD"}}</script>',
    "</head><body><p>Untrusted page instructions are just content.</p></body></html>",
  ].join("");
  const result = extractFromStructuredSources({
    html,
    url: "https://shop.example.com/products/widget",
    contentType: "text/html",
    schema: {
      type: "object",
      properties: {
        name: { type: "string", "x-source": "jsonld:name" },
        price: { type: "number", "x-source": "jsonld:offers.price" },
        currency: { type: "string", "x-source": "jsonld:offers.priceCurrency" },
        title: { type: "string", "x-source": "meta:og:title" },
        canonical: { type: "string", "x-source": "page:canonical" },
      },
      required: ["name", "price"],
    },
  });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.data, {
    name: "Widget",
    price: 19.95,
    currency: "USD",
    title: "Widget overview",
    canonical: "https://shop.example.com/products/widget",
  });
  assert.equal(result.fieldEvidence.length, 5);
  assert.equal(result.fieldEvidence[0].sourceType, "jsonld");
  assert.equal(result.fieldEvidence[0].blockIndex, 0);
  assert.equal(result.fieldEvidence[1].path, "offers.price");
});

test("schema extraction resolves JSON-LD graphs and array-valued nested offers", () => {
  const result = extractFromStructuredSources({
    json: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Product", "name": "Graph item", "offers": [{ "price": "5.25" }] },
      ],
    },
    url: "https://example.com/product",
    contentType: "application/json",
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        price: { type: "number", "x-source": "jsonld:offers.price" },
      },
      required: ["name", "price"],
    },
  });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.data, { name: "Graph item", price: 5.25 });
  assert.equal(result.fieldEvidence[1].sourceType, "jsonld");
});

test("schema extraction uses page metadata aliases but never guesses missing values", () => {
  const result = extractFromStructuredSources({
    html: "<title>Example title</title><meta name=\"description\" content=\"Short summary\"><p>Text says price is 99</p>",
    url: "https://example.com/",
    contentType: "text/html",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        price: { type: "number" },
      },
      required: ["title", "price"],
    },
  });
  assert.equal(result.status, "partial");
  assert.deepEqual(result.data, { title: "Example title", description: "Short summary" });
  assert.deepEqual(result.missingFields, ["price"]);
  assert.deepEqual(result.missingRequired, ["price"]);
});

test("schema validation rejects unsupported types, unsafe source paths and oversized schemas", () => {
  assert.throws(
    () => validateExtractionSchema({ type: "object", properties: { value: { type: "function" } } }),
    (error) => error instanceof ExtractionError && error.code === "INVALID_SCHEMA",
  );
  assert.throws(
    () => validateExtractionSchema({ type: "object", properties: { value: { type: "string", "x-source": "jsonld:__proto__.polluted" } } }),
    (error) => error instanceof ExtractionError && error.code === "INVALID_SCHEMA",
  );
  const hugeSchema = {
    type: "object",
    properties: { value: { type: "string", description: "x".repeat(17_000) } },
  };
  assert.throws(
    () => validateExtractionSchema(hugeSchema),
    (error) => error instanceof ExtractionError && error.code === "INVALID_SCHEMA",
  );
});

test("schema extraction returns normalized result and field-level source evidence", async () => {
  const schema = {
    type: "object",
    properties: { name: { type: "string", "x-source": "jsonld:name" } },
    required: ["name"],
  };
  const result = await extractStructuredData(
    { url: "https://example.com/item", schema },
    {
      fetchResource: async (url) => ({
        status: 200,
        finalUrl: url,
        contentType: "text/html; charset=utf-8",
        body: '<script type="application/ld+json">{"name":"Test item"}</script>',
        bytes: 50,
        retrievedAt: "2026-11-17T00:00:00.000Z",
      }),
    },
  );
  assert.equal(result.status, "succeeded");
  assert.equal(result.data.fields.name, "Test item");
  assert.equal(result.sources[0].url, "https://example.com/item");
  assert.equal(result.sources[0].evidence[1].type, "extracted_field");
  assert.equal(result.sources[0].evidence[1].field, "name");
});

test("Extract adapter propagates Task cancellation through the source fetch", async () => {
  const controller = new AbortController();
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const pending = executeAdapter("web.extract.v1", {
    url: "https://example.com/item",
    schema: {
      type: "object",
      properties: { name: { type: "string", "x-source": "jsonld:name" } },
      required: ["name"],
    },
  }, {
    signal: controller.signal,
    fetchResource: async (_url, options = {}) => {
      assert.equal(options.signal, controller.signal);
      markStarted();
      return new Promise((_resolve, reject) => {
        if (options.signal.aborted) {
          reject(Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" }));
          return;
        }
        options.signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" }));
        }, { once: true });
      });
    },
  });

  await started;
  controller.abort();
  await assert.rejects(pending, (error) => error?.code === "TASK_CANCELLED");
});

test("schema extraction handles JSON endpoints without HTML parsing", async () => {
  const result = await extractStructuredData(
    {
      url: "https://api.example.com/product",
      schema: { type: "object", properties: { sku: { type: "string" } }, required: ["sku"] },
    },
    {
      fetchResource: async (url) => ({
        status: 200, finalUrl: url, contentType: "application/json",
        body: '{"sku":"SKU-123"}', bytes: 15, retrievedAt: "2026-11-17T00:00:00.000Z",
      }),
    },
  );
  assert.equal(result.status, "succeeded");
  assert.equal(result.data.fields.sku, "SKU-123");
});

test("schema extraction reports HTTP failures without fabricating fields", async () => {
  const result = await extractStructuredData(
    {
      url: "https://example.com/missing",
      schema: { type: "object", properties: { title: { type: "string" } } },
    },
    {
      fetchResource: async (url) => ({
        status: 404, finalUrl: url, contentType: "text/html", body: "Not found",
        bytes: 9, retrievedAt: "2026-11-17T00:00:00.000Z",
      }),
    },
  );
  assert.equal(result.status, "failed");
  assert.deepEqual(result.data.fields, {});
  assert.deepEqual(result.data.missingFields, ["title"]);
});

test("schema extraction rejects invalid JSON sources and unsupported content types", async () => {
  await assert.rejects(
    extractStructuredData(
      { url: "https://example.com/data", schema: { type: "object", properties: { id: { type: "string" } } } },
      { fetchResource: async (url) => ({ status: 200, finalUrl: url, contentType: "application/json", body: "{", bytes: 1 }) },
    ),
    (error) => error instanceof ExtractionError && error.code === "INVALID_JSON_SOURCE",
  );
  await assert.rejects(
    extractStructuredData(
      { url: "https://example.com/file", schema: { type: "object", properties: { id: { type: "string" } } } },
      { fetchResource: async (url) => ({ status: 200, finalUrl: url, contentType: "application/octet-stream", body: "data", bytes: 4 }) },
    ),
    (error) => error instanceof ExtractionError && error.code === "UNSUPPORTED_CONTENT_TYPE",
  );
});

test("schema extraction validates schema before network access", async () => {
  let calls = 0;
  await assert.rejects(
    extractStructuredData(
      { url: "https://example.com/", schema: { type: "object", properties: { value: { type: "unknown" } } } },
      { fetchResource: async () => { calls++; return {}; } },
    ),
    (error) => error instanceof ExtractionError && error.code === "INVALID_SCHEMA",
  );
  assert.equal(calls, 0);
});

test("extract adapter is registered with deterministic bounded capabilities", () => {
  const adapter = getAdapterCatalog().find((item) => item.id === "web.extract.v1");
  assert.ok(adapter);
  assert.ok(adapter.capabilities.includes("field-evidence"));
  assert.ok(adapter.restrictions.includes("no-LLM-inference"));
  assert.equal(adapter.limits.maxProperties, 20);
});

test("task executor dispatches extract operations with the caller schema", async () => {
  let seen;
  const schema = { type: "object", properties: { name: { type: "string" } } };
  const task = await executeWebTask(
    { goal: "Extract product name", url: "https://example.com/product", operation: "extract", schema },
    {
      idFactory: () => "task-extract-0001",
      executeAdapter: async (id, input) => {
        seen = { id, input };
        return { status: "succeeded", data: { fields: { name: "Example" } }, sources: [], warnings: [] };
      },
    },
  );
  assert.equal(task.execution.adapterId, "web.extract.v1");
  assert.equal(seen.id, "web.extract.v1");
  assert.deepEqual(seen.input.schema, schema);
});


test("task executor preserves partial extraction results as a partial task state", async () => {
  const task = await executeWebTask(
    { goal: "Extract product details", url: "https://example.com/product", operation: "extract", schema: {
      type: "object", properties: { name: { type: "string" } },
    } },
    {
      idFactory: () => "task-partial-0001",
      executeAdapter: async () => ({
        status: "partial",
        data: { fields: { name: "Product" }, missingFields: ["price"] },
        sources: [],
        warnings: ["price was not found"],
      }),
    },
  );
  assert.equal(task.state, "partial");
  assert.equal(task.result.status, "partial");
  assert.equal(task.events.at(-1).type, "task.partial");
});


test("task executor dispatches query-only search operations to an injected Search adapter", async () => {
  let received;
  const task = await executeWebTask(
    { goal: "Find official Cloudflare docs", operation: "search", query: "Cloudflare Workers docs", source: "openalex", limit: 4 },
    {
      idFactory: () => "task-search-0001",
      searchAdapter: {
        id: "web.search.v1",
        execute: async (input) => {
          received = input;
          return { status: "succeeded", data: { resultCount: 0 }, sources: [], warnings: [] };
        },
      },
    },
  );
  assert.equal(task.state, "succeeded");
  assert.equal(task.execution.adapterId, "web.search.v1");
  assert.equal(received.query, "Cloudflare Workers docs");
  assert.equal(received.limit, 4);
  assert.ok(received.signal instanceof AbortSignal);
});

test("task executor dispatches query-only research tasks to an injected Research pipeline", async () => {
  let received;
  const schema = { type: "object", properties: { name: { type: "string" } } };
  const task = await executeWebTask(
    { goal: "Find and understand a product", operation: "research", query: "sample product", schema, candidateLimit: 2 },
    {
      idFactory: () => "task-research-0001",
      researchAdapter: {
        id: "web.research.v1",
        execute: async (input) => {
          received = input;
          return { status: "partial", data: { fields: { name: "Product" } }, sources: [], warnings: [] };
        },
      },
    },
  );
  assert.equal(task.state, "partial");
  assert.equal(task.execution.adapterId, "web.research.v1");
  assert.equal(received.query, "sample product");
  assert.equal(received.schema, schema);
  assert.equal(received.limit, undefined);
  assert.equal(received.candidateLimit, 2);
  assert.ok(received.signal instanceof AbortSignal);
});

test("oversized upstream body does not wait for a stalled reader cancellation", { timeout: 1500 }, async () => {
  let cancelCalls = 0;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("12345"));
    },
    cancel() {
      cancelCalls += 1;
      return new Promise(() => {});
    },
  });

  await assert.rejects(
    fetchPublicResource("https://example.com/oversized", {
      maxBytes: 4,
      fetchImpl: async () => new Response(stream, {
        headers: { "content-type": "text/plain" },
      }),
    }),
    (error) => error instanceof FetchAdapterError && error.code === "RESPONSE_TOO_LARGE",
  );
  assert.equal(cancelCalls, 1);
});

test("declared oversized upstream body does not wait for a stalled body cancellation", { timeout: 1500 }, async () => {
  let cancelCalls = 0;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("large body"));
    },
    cancel() {
      cancelCalls += 1;
      return new Promise(() => {});
    },
  });

  await assert.rejects(
    fetchPublicResource("https://example.com/declared-large", {
      maxBytes: 4,
      fetchImpl: async () => new Response(stream, {
        headers: { "content-type": "text/plain", "content-length": "10" },
      }),
    }),
    (error) => error instanceof FetchAdapterError && error.code === "RESPONSE_TOO_LARGE",
  );
  assert.equal(cancelCalls, 1);
});

test("HTTP response reader bounds zero-byte chunk floods", async () => {
  let chunksRead = 0;
  let cancelCalls = 0;
  const stream = new ReadableStream({
    pull(controller) {
      chunksRead += 1;
      controller.enqueue(new Uint8Array(0));
    },
    cancel() {
      cancelCalls += 1;
    },
  }, { highWaterMark: 0 });

  await assert.rejects(
    fetchPublicResource("https://example.com/empty-chunks", {
      fetchImpl: async () => new Response(stream, {
        headers: { "content-type": "text/plain" },
      }),
    }),
    (error) => error instanceof FetchAdapterError && error.code === "RESPONSE_TOO_LARGE",
  );
  assert.equal(chunksRead, HTTP_FETCH_LIMITS.maxResponseChunks + 1);
  assert.equal(cancelCalls, 1);
});

test("fetch follows a safe redirect without waiting for a stalled redirect-body cancellation", { timeout: 1500 }, async () => {
  let cancelCalls = 0;
  const redirectBody = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
    },
    cancel() {
      cancelCalls += 1;
      return new Promise(() => {});
    },
  });

  const result = await fetchPublicResource("https://example.com/start", {
    fetchImpl: async (url) => {
      if (url.endsWith("/start")) {
        return new Response(redirectBody, {
          status: 302,
          headers: { location: "/final" },
        });
      }
      return new Response("done", {
        headers: { "content-type": "text/plain" },
      });
    },
  });

  assert.equal(result.body, "done");
  assert.equal(result.redirects.length, 1);
  assert.equal(cancelCalls, 1);
});

test("public search adapter calls only the explicitly selected free source", async () => {
  const calls = [];
  const fixtures = {
    wikipedia: { query: { search: [{ pageid: 42, title: "Example result", snippet: "<span>Public</span> result" }] } },
    openalex: { results: [{ id: "https://openalex.org/W1", title: "Research paper", publication_year: 2024, primary_location: { landing_page_url: "https://papers.example.org/one" }, cited_by_count: 7 }] },
    crossref: { message: { items: [{ DOI: "10.1000/example", title: ["DOI paper"], URL: "https://doi.org/10.1000/example", type: "journal-article" }] } },
  };
  const adapter = createSearchAdapter({ fetchResource: async (url, options) => {
    calls.push({ url, options });
    const host = new URL(url).hostname;
    const source = host === "en.wikipedia.org" ? "wikipedia" : host === "api.openalex.org" ? "openalex" : "crossref";
    return { ok: true, status: 200, contentType: "application/json", body: JSON.stringify(fixtures[source]),
      bytes: 256, finalUrl: url, retrievedAt: "2026-11-24T10:00:00.000Z", cacheStatus: "HIT" };
  }});
  for (const source of ["wikipedia", "openalex", "crossref"]) {
    const result = await adapter.execute({ query: "test subject", source, limit: 3 });
    assert.equal(result.status, "succeeded");
    assert.equal(result.data.source, source);
    assert.equal(result.data.resultCount, 1);
    assert.equal(result.data.cacheStatus, "HIT");
    assert.equal(result.data.results[0].rank, 1);
    assert.ok(result.sources[0].url.startsWith("https://"));
    assert.ok(result.data.coverage.length > 20);
  }
  assert.equal(calls.length, 3);
  assert.ok(calls.some((call) => new URL(call.url).hostname === "en.wikipedia.org"));
  assert.ok(calls.some((call) => new URL(call.url).hostname === "api.openalex.org"));
  assert.ok(calls.some((call) => new URL(call.url).hostname === "api.crossref.org"));
  assert.ok(calls.every((call) => call.options.userAgent.startsWith("ExportFlow/")));
  const crossrefCall = calls.find((call) => new URL(call.url).hostname === "api.crossref.org");
  assert.equal(new URL(crossrefCall.url).searchParams.get("mailto"), "hhameranede@gmail.com");
});

test("public search adapter rejects unknown sources and invalid queries before network access", async () => {
  let calls = 0;
  const adapter = createSearchAdapter({ fetchResource: async () => { calls++; throw new Error("must not fetch"); } });
  await assert.rejects(adapter.execute({ query: "valid", source: "general-web" }), (error) => error instanceof SearchAdapterError && error.code === "INVALID_SEARCH_SOURCE");
  await assert.rejects(adapter.execute({ query: "", source: "openalex" }), (error) => error instanceof SearchAdapterError && error.code === "INVALID_QUERY");
  await assert.rejects(adapter.execute({ query: "valid", source: "openalex", limit: 11 }), (error) => error instanceof SearchAdapterError && error.code === "INVALID_LIMIT");
  assert.equal(calls, 0);
});

test("public search adapter honours cancellation before the source request", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const adapter = createSearchAdapter({ fetchResource: async () => { calls++; return {}; } });
  await assert.rejects(adapter.execute({ query: "valid", source: "openalex", signal: controller.signal }),
    (error) => error instanceof SearchAdapterError && error.code === "TASK_CANCELLED");
  assert.equal(calls, 0);
});

test("task executor uses the registered public search adapter without an injected AI binding", async () => {
  const task = await executeWebTask(
    { goal: "Find a scholarly source", operation: "search", query: "edge computing", source: "openalex" },
    { idFactory: () => "task-free-search-01", fetchImpl: async (url) => {
      assert.equal(new URL(url).hostname, "api.openalex.org");
      return new Response(JSON.stringify({ results: [{
        id: "https://openalex.org/W1", title: "Edge computing paper",
        primary_location: { landing_page_url: "https://papers.example.org/edge" },
      }] }), { headers: { "content-type": "application/json" } });
    }},
  );
  assert.equal(task.state, "succeeded");
  assert.equal(task.execution.adapterId, "web.search.v1");
  assert.equal(task.result.data.results[0].title, "Edge computing paper");
});

test("default research pipeline performs search, static fetch and deterministic schema extraction", async () => {
  const calls = [];
  const task = await executeWebTask({
    goal: "Research and extract a public field", operation: "research",
    query: "test research", source: "openalex", cacheMode: "bypass",
    schema: { type: "object", properties: { name: { type: "string", "x-source": "jsonld:name" } }, required: ["name"] },
    candidateLimit: 1,
  }, {
    idFactory: () => "task-free-research",
    fetchImpl: async (url, init) => {
      calls.push({ url, cache: init?.cache });
      if (new URL(url).hostname === "api.openalex.org") {
        return new Response(JSON.stringify({ results: [{
          id: "https://openalex.org/W1", title: "Research page",
          primary_location: { landing_page_url: "https://papers.example.org/one" },
        }] }), { headers: { "content-type": "application/json" } });
      }
      return new Response('<html><head><script type="application/ld+json">{"@type":"Thing","name":"Verified from static JSON-LD"}</script></head></html>',
        { headers: { "content-type": "text/html; charset=utf-8" } });
    },
  });
  assert.equal(task.state, "succeeded");
  assert.equal(task.execution.adapterId, "web.research.v1");
  assert.equal(task.result.data.fields.name, "Verified from static JSON-LD");
  assert.equal(task.result.data.rendering, "static-http-only");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.cache), ["no-store", "no-store"]);
});
