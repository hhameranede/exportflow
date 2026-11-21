import test from "node:test";
import assert from "node:assert/strict";
import { chooseExecutionPath } from "../src/core/router.js";
import { executeWebTask } from "../src/core/tasks.js";
import { crawlWebsite, extractSitemapLocations, isAllowedByRobots, mapWebsite, parseRobotsTxt } from "../src/core/map-crawl.js";
import { ExtractionError, extractFromStructuredSources, extractStructuredData, validateExtractionSchema } from "../src/core/extract.js";
import { BrowserAdapterError, createBrowserAdapter } from "../src/core/browser-render.js";
import { SearchAdapterError, createSearchAdapter } from "../src/core/search.js";
import { ResearchPipelineError, createResearchPipeline } from "../src/core/research.js";
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
    assert.ok(task.result.warnings[0].includes("Browser Run binding is not configured"));
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
            body: "User-agent: *\\nSitemap: https://example.com/sitemap.xml",
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

test("map and crawl adapters publish bounded limits", () => {
  const catalog = getAdapterCatalog();
  const mapAdapter = catalog.find((item) => item.id === "web.map.v1");
  const crawlAdapter = catalog.find((item) => item.id === "web.crawl.v1");
  assert.equal(mapAdapter.limits.maxSitemaps, 2);
  assert.equal(crawlAdapter.limits.maxPages, 5);
  assert.ok(mapAdapter.restrictions.includes("robots.txt-respected"));
  assert.ok(crawlAdapter.restrictions.includes("same-origin-only"));
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


test("browser adapter requires an explicitly injected Browser Run binding", async () => {
  const adapter = createBrowserAdapter({
    fetchResource: async () => ({ status: 200, body: "", finalUrl: "https://example.com/robots.txt" }),
  });
  await assert.rejects(
    adapter.execute({ url: "https://example.com/" }),
    (error) => error instanceof BrowserAdapterError && error.code === "BROWSER_UNAVAILABLE",
  );
});

test("browser adapter rejects robots-disallowed navigation before creating a session", async () => {
  let launchCalls = 0;
  const adapter = createBrowserAdapter({
    browserBinding: {},
    puppeteer: { launch: async () => { launchCalls++; throw new Error("must not launch"); } },
    fetchResource: async (url) => ({
      status: 200, finalUrl: url, body: "User-agent: *\nDisallow: /private",
      contentType: "text/plain", bytes: 45,
    }),
  });
  await assert.rejects(
    adapter.execute({ url: "https://example.com/private/page" }),
    (error) => error instanceof BrowserAdapterError && error.code === "ROBOTS_DISALLOWED_TARGET",
  );
  assert.equal(launchCalls, 0);
});

test("browser adapter applies exact-host guardrails and blocks off-origin, private and robots-disallowed requests", async () => {
  const binding = { kind: "fake-browser-binding" };
  let launchOptions;
  let userAgent;
  let requestHandler;
  let closeCalls = 0;
  const browser = {
    newPage: async () => ({
      setUserAgent: async (value) => { userAgent = value; },
      setRequestInterception: async (enabled) => { assert.equal(enabled, true); },
      on: (eventName, handler) => {
        assert.equal(eventName, "request");
        requestHandler = handler;
      },
      goto: async (url, options) => {
        assert.equal(url, "https://example.com/");
        assert.equal(options.waitUntil, "domcontentloaded");
        assert.equal(options.timeout, 15_000);
        const makeRequest = (value) => {
          const calls = [];
          return {
            url: () => value,
            continue: async () => { calls.push("continue"); },
            abort: async () => { calls.push("abort"); },
            calls,
          };
        };
        const requests = [
          makeRequest("https://example.com/app.js"),
          makeRequest("https://cdn.example.net/lib.js"),
          makeRequest("http://127.0.0.1/admin"),
          makeRequest("https://example.com/private/secret.css"),
        ];
        for (const request of requests) await requestHandler(request);
        browser.requestResults = requests.map((item) => item.calls[0]);
        return { status: () => 200 };
      },
      url: () => "https://example.com/",
      content: async () => "<html><title>Rendered page</title><body>JS content</body></html>",
      title: async () => "Rendered page",
    }),
    close: async () => { closeCalls++; },
  };
  const adapter = createBrowserAdapter({
    browserBinding: binding,
    puppeteer: {
      launch: async (receivedBinding, options) => {
        assert.equal(receivedBinding, binding);
        launchOptions = options;
        return browser;
      },
    },
    fetchResource: async (url) => ({
      status: 200, finalUrl: url, body: "User-agent: *\nDisallow: /private",
      contentType: "text/plain", bytes: 40, retrievedAt: "2026-11-17T00:00:00.000Z",
    }),
    now: () => "2026-11-17T00:00:01.000Z",
  });
  const result = await adapter.execute({ url: "https://example.com/" });
  assert.deepEqual(launchOptions.guardrails, { allowedDomains: ["example.com"] });
  assert.equal(userAgent, "ExportFlowBot/0.1 (+https://exportflow.me)");
  assert.deepEqual(browser.requestResults, ["continue", "abort", "abort", "abort"]);
  assert.equal(result.status, "succeeded");
  assert.equal(result.data.url, "https://example.com/");
  assert.equal(result.data.title, "Rendered page");
  assert.equal(result.data.blockedRequests, 3);
  assert.equal(result.sources[0].evidence[0].type, "browser_rendered_page");
  assert.equal(closeCalls, 1);
});

test("browser adapter closes the browser session after navigation failure", async () => {
  let closeCalls = 0;
  const adapter = createBrowserAdapter({
    browserBinding: {},
    puppeteer: {
      launch: async () => ({
        newPage: async () => ({
          setUserAgent: async () => {},
          setRequestInterception: async () => {},
          on: () => {},
          goto: async () => { throw new Error("private session detail"); },
        }),
        close: async () => { closeCalls++; },
      }),
    },
    fetchResource: async (url) => ({
      status: 200, finalUrl: url, body: "", contentType: "text/plain", bytes: 0,
    }),
  });
  await assert.rejects(
    adapter.execute({ url: "https://example.com/" }),
    (error) => error instanceof BrowserAdapterError && error.code === "BROWSER_RENDER_FAILED" &&
      !error.message.includes("private session detail"),
  );
  assert.equal(closeCalls, 1);
});

test("task executor routes JavaScript rendering to an injected Browser adapter", async () => {
  let received;
  const task = await executeWebTask(
    { goal: "Render the dynamic page", url: "https://example.com/app", requiresJavascript: true },
    {
      idFactory: () => "task-browser-render-01",
      browserAdapter: {
        id: "web.browser.v1",
        execute: async (input) => {
          received = input;
          return { status: "succeeded", data: { title: "Rendered" }, sources: [], warnings: [] };
        },
      },
    },
  );
  assert.equal(task.state, "succeeded");
  assert.equal(task.execution.adapterId, "web.browser.v1");
  assert.equal(received.url, "https://example.com/app");
});

test("task executor keeps user-directed browser interactions unsupported", async () => {
  let called = false;
  const task = await executeWebTask(
    { goal: "Click through a multi-step workflow", url: "https://example.com/", requiresInteraction: true },
    {
      idFactory: () => "task-browser-action-01",
      browserAdapter: { execute: async () => { called = true; return { status: "succeeded" }; } },
    },
  );
  assert.equal(task.state, "unsupported");
  assert.equal(called, false);
  assert.equal(task.events.at(-1).type, "task.unsupported");
});

test("task executor reports a missing Browser Run binding as unsupported", async () => {
  const unavailableAdapter = createBrowserAdapter({});
  const task = await executeWebTask(
    { goal: "Render the page", url: "https://example.com/", requiresJavascript: true },
    {
      idFactory: () => "task-browser-no-binding",
      browserAdapter: unavailableAdapter,
    },
  );
  assert.equal(task.state, "unsupported");
  assert.equal(task.events.at(-1).type, "task.unsupported");
});


test("search adapter calls Cloudflare Web Search with a fixed provider and bounded result limit", async () => {
  let request;
  const adapter = createSearchAdapter({
    webSearch: async (input) => {
      request = input;
      return {
        items: [
          { url: "https://example.com/one", title: "One", description: "First result" },
          { url: "https://example.com/two", title: "Two", description: "Second result" },
        ],
        metadata: { requestId: "req-123", latencyMs: 42 },
      };
    },
    now: () => "2026-11-17T00:00:00.000Z",
  });
  const result = await adapter.execute({ query: "  cloudflare workers  ", limit: 2 });
  assert.deepEqual(request, {
    gatewayId: "default",
    query: "cloudflare workers",
    provider: "ceramic",
    limit: 2,
  });
  assert.equal(result.status, "succeeded");
  assert.equal(result.data.resultCount, 2);
  assert.equal(result.data.requestId, "req-123");
  assert.equal(result.data.results[0].rank, 1);
  assert.equal(result.sources[0].evidence[0].query, "cloudflare workers");
  assert.equal(result.sources[0].url, "https://example.com/one");
});

test("search adapter drops unsafe and duplicate result URLs", async () => {
  const adapter = createSearchAdapter({
    webSearch: async () => ({
      items: [
        { url: "https://example.com/page", title: "Valid" },
        { url: "https://example.com/page#fragment", title: "Duplicate after normalization" },
        { url: "http://127.0.0.1/admin", title: "Local" },
        { url: "javascript:alert(1)", title: "Unsafe" },
      ],
    }),
  });
  const result = await adapter.execute({ query: "sample query" });
  assert.equal(result.data.resultCount, 1);
  assert.equal(result.data.results[0].title, "Valid");
  assert.ok(result.warnings.some((warning) => warning.includes("invalid, unsafe, or duplicate")));
});

test("search adapter accepts zero results as a successful search operation", async () => {
  const adapter = createSearchAdapter({ webSearch: async () => ({ items: [], metadata: {} }) });
  const result = await adapter.execute({ query: "no matching pages" });
  assert.equal(result.status, "succeeded");
  assert.equal(result.data.resultCount, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("no usable")));
});

test("search adapter validates queries, limits, and configured providers", async () => {
  const adapter = createSearchAdapter({ webSearch: async () => ({ items: [] }) });
  await assert.rejects(
    adapter.execute({ query: "" }),
    (error) => error instanceof SearchAdapterError && error.code === "INVALID_QUERY",
  );
  await assert.rejects(
    adapter.execute({ query: "valid", limit: 11 }),
    (error) => error instanceof SearchAdapterError && error.code === "INVALID_LIMIT",
  );
  assert.throws(
    () => createSearchAdapter({ provider: "unknown", webSearch: async () => ({ items: [] }) }),
    (error) => error instanceof SearchAdapterError && error.code === "INVALID_PROVIDER",
  );
});

test("search adapter returns a clear unavailable error without a Worker AI binding", async () => {
  const adapter = createSearchAdapter({});
  await assert.rejects(
    adapter.execute({ query: "cloudflare workers" }),
    (error) => error instanceof SearchAdapterError && error.code === "SEARCH_UNAVAILABLE",
  );
});

test("search adapter does not leak upstream error details", async () => {
  const adapter = createSearchAdapter({
    webSearch: async () => { throw new Error("sensitive provider credential detail"); },
  });
  await assert.rejects(
    adapter.execute({ query: "cloudflare" }),
    (error) => error instanceof SearchAdapterError &&
      error.code === "SEARCH_PROVIDER_FAILED" &&
      !error.message.includes("sensitive provider credential detail"),
  );
});

test("task executor dispatches query-only search operations to an injected Search adapter", async () => {
  let received;
  const task = await executeWebTask(
    { goal: "Find official Cloudflare docs", operation: "search", query: "Cloudflare Workers docs", limit: 4 },
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
  assert.deepEqual(received, { query: "Cloudflare Workers docs", limit: 4 });
});

test("task executor keeps search unsupported when its AI binding is not configured", async () => {
  const task = await executeWebTask(
    { goal: "Search for a public website", operation: "search", query: "some topic" },
    { idFactory: () => "task-search-disabled" },
  );
  assert.equal(task.state, "unsupported");
  assert.equal(task.events.at(-1).type, "task.unsupported");
});


test("research pipeline completes Search to Fetch to Extract through the registered HTTP adapter", async () => {
  const originalFetch = globalThis.fetch;
  let outboundCalls = 0;
  globalThis.fetch = async (url, init) => {
    outboundCalls++;
    assert.equal(url, "https://shop.example.com/item/42");
    assert.equal(init.method, "GET");
    return new Response(
      '<html><head><script type="application/ld+json">{"@type":"Product","name":"Fixture Item","offers":{"price":"12.50","priceCurrency":"USD"}}</script></head></html>',
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  };
  try {
    const searchAdapter = createSearchAdapter({
      webSearch: async () => ({
        items: [{ url: "https://shop.example.com/item/42", title: "Example product", description: "Untrusted search snippet" }],
        metadata: { requestId: "search-fixture", latencyMs: 8 },
      }),
    });
    const pipeline = createResearchPipeline({
      searchAdapter,
      now: () => "2026-11-17T00:00:01.000Z",
    });
    const result = await pipeline.execute({
      query: "example fixture product",
      schema: {
        type: "object",
        properties: {
          name: { type: "string", "x-source": "jsonld:name" },
          price: { type: "number", "x-source": "jsonld:offers.price" },
          currency: { type: "string", "x-source": "jsonld:offers.priceCurrency" },
        },
        required: ["name", "price"],
      },
    });
    assert.equal(result.status, "succeeded");
    assert.equal(result.data.provider, "ceramic");
    assert.equal(result.data.searchRequestId, "search-fixture");
    assert.deepEqual(result.data.fields, { name: "Fixture Item", price: 12.5, currency: "USD" });
    assert.equal(result.data.attempts.length, 1);
    assert.equal(outboundCalls, 1);
    assert.equal(result.sources[0].url, "https://shop.example.com/item/42");
    assert.ok(result.sources[0].evidence.some((item) => item.type === "search_result"));
    assert.ok(result.sources[0].evidence.some((item) => item.type === "http_response"));
    assert.equal(result.sources[0].evidence.filter((item) => item.type === "extracted_field").length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("research pipeline tries the next bounded search result when the first source cannot be fetched", async () => {
  const searchAdapter = createSearchAdapter({
    webSearch: async () => ({
      items: [
        { url: "https://first.example.com/item", title: "First" },
        { url: "https://second.example.com/item", title: "Second" },
      ],
    }),
  });
  const calls = [];
  const pipeline = createResearchPipeline({
    searchAdapter,
    runAdapter: async (id, input) => {
      calls.push(input.url);
      if (input.url === "https://first.example.com/item") throw new Error("private upstream detail");
      return {
        status: "succeeded",
        data: {
          status: 200,
          contentType: "application/json",
          body: '{"id":"second-item"}',
          finalUrl: input.url,
        },
        sources: [],
        warnings: [],
      };
    },
  });
  const result = await pipeline.execute({
    query: "find item",
    candidateLimit: 2,
    schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  });
  assert.deepEqual(calls, ["https://first.example.com/item", "https://second.example.com/item"]);
  assert.equal(result.status, "succeeded");
  assert.equal(result.data.selectedUrl, "https://second.example.com/item");
  assert.equal(result.data.fields.id, "second-item");
  assert.equal(result.data.attempts[0].reason, "UPSTREAM_FETCH_FAILED");
});

test("research pipeline escalates to an injected Browser adapter only when required fields are missing", async () => {
  const searchAdapter = createSearchAdapter({
    webSearch: async () => ({ items: [{ url: "https://app.example.com/", title: "Dynamic app" }] }),
  });
  let browserCalls = 0;
  const pipeline = createResearchPipeline({
    searchAdapter,
    runAdapter: async (_id, input) => ({
      status: "succeeded",
      data: { status: 200, contentType: "text/html", body: "<html><body>Loading</body></html>", finalUrl: input.url },
      sources: [],
      warnings: [],
    }),
    browserAdapter: {
      execute: async ({ url }) => {
        browserCalls++;
        return {
          status: "succeeded",
          data: {
            url,
            html: '<script type="application/ld+json">{"name":"Rendered item","sku":"SKU-9"}</script>',
            title: "Rendered",
          },
          sources: [{ url, evidence: [{ type: "browser_rendered_page" }] }],
          warnings: [],
        };
      },
    },
  });
  const result = await pipeline.execute({
    query: "find rendered item",
    schema: {
      type: "object",
      properties: { name: { type: "string" }, sku: { type: "string" } },
      required: ["name", "sku"],
    },
  });
  assert.equal(browserCalls, 1);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.data.fields, { name: "Rendered item", sku: "SKU-9" });
  assert.equal(result.data.browserEscalated, true);
  assert.ok(result.sources[0].evidence.some((item) => item.type === "browser_rendered_page"));
});

test("research pipeline does not attempt Browser escalation when no Browser adapter is injected", async () => {
  const searchAdapter = createSearchAdapter({
    webSearch: async () => ({ items: [{ url: "https://example.com/", title: "Page" }] }),
  });
  const pipeline = createResearchPipeline({
    searchAdapter,
    runAdapter: async (_id, input) => ({
      status: "succeeded",
      data: { status: 200, contentType: "text/html", body: "<html></html>", finalUrl: input.url },
      sources: [],
      warnings: [],
    }),
  });
  const result = await pipeline.execute({
    query: "find page",
    schema: { type: "object", properties: { requiredValue: { type: "string" } }, required: ["requiredValue"] },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.data.browserEscalated, false);
  assert.ok(result.warnings.some((warning) => warning.includes("Browser rendering is not configured")));
});

test("research pipeline validates schema before calling Search", async () => {
  let called = false;
  const pipeline = createResearchPipeline({
    searchAdapter: { execute: async () => { called = true; return { data: { results: [] } }; } },
    runAdapter: async () => { throw new Error("must not fetch"); },
  });
  await assert.rejects(
    pipeline.execute({ query: "find", schema: { type: "object", properties: { value: { type: "unknown" } } } }),
    (error) => error instanceof ResearchPipelineError && error.code === "INVALID_SCHEMA",
  );
  assert.equal(called, false);
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
  assert.deepEqual(received, { query: "sample product", schema, limit: undefined, candidateLimit: 2 });
});

test("task executor keeps research unsupported when no pipeline is configured", async () => {
  const task = await executeWebTask(
    { goal: "Research a topic", operation: "research", query: "some topic", schema: { type: "object", properties: { title: { type: "string" } } } },
    { idFactory: () => "task-research-disabled" },
  );
  assert.equal(task.state, "unsupported");
  assert.equal(task.events.at(-1).type, "task.unsupported");
});


test("research pipeline attempts Browser escalation only once after comparing static candidates", async () => {
  const searchAdapter = createSearchAdapter({
    webSearch: async () => ({
      items: [
        { url: "https://first.example.com/", title: "First" },
        { url: "https://second.example.com/", title: "Second" },
      ],
    }),
  });
  const fetchCalls = [];
  let browserCalls = 0;
  const pipeline = createResearchPipeline({
    searchAdapter,
    runAdapter: async (_id, input) => {
      fetchCalls.push(input.url);
      return {
        status: "succeeded",
        data: {
          status: 200,
          contentType: "text/html",
          body: "<html></html>",
          finalUrl: input.url,
        },
        sources: [],
        warnings: [],
      };
    },
    browserAdapter: {
      execute: async ({ url }) => {
        browserCalls++;
        return {
          status: "succeeded",
          data: {
            url,
            html: '<script type="application/ld+json">{"name":"Browser value"}</script>',
          },
          sources: [],
          warnings: [],
        };
      },
    },
  });
  const result = await pipeline.execute({
    query: "find a name",
    candidateLimit: 2,
    schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  });
  assert.equal(fetchCalls.length, 2);
  assert.equal(browserCalls, 1);
  assert.equal(result.status, "succeeded");
  assert.equal(result.data.browserEscalated, true);
});
