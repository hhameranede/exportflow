import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefuddleAdapter,
  DEFUDDLE_LIMITS,
  DEFUDDLE_VERSION,
  DefuddleAdapterError,
} from "../src/core/defuddle.js";

const sourceUrl = "https://docs.example.org/articles/agentic-web";
const html = "<!doctype html><html><head><title>Agentic web overview</title></head><body><article><h1>Agentic web overview</h1><p>ExportFlow separates network retrieval from content parsing and preserves source evidence.</p></article></body></html>";

function fetchedPage(overrides = {}) {
  return {
    ok: true,
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: html,
    bytes: new TextEncoder().encode(html).byteLength,
    originalUrl: sourceUrl,
    finalUrl: sourceUrl,
    redirects: [],
    retrievedAt: "2026-11-17T20:00:00.000Z",
    ...overrides,
  };
}

test("Defuddle adapter fetches through its injected boundary and returns normalized evidence", async () => {
  let fetchCalls = 0;
  let parseInput;
  const adapter = createDefuddleAdapter({
    fetchResource: async (url) => {
      fetchCalls++;
      assert.equal(url, sourceUrl);
      return fetchedPage({ finalUrl: "https://docs.example.org/guides/agentic-web" });
    },
    parseHtml: async (body, url) => {
      parseInput = { body, url };
      return {
        markdown: "# Agentic web overview\n\nReadable content.",
        title: "Agentic web overview",
        description: "An overview.",
        wordCount: 4,
        parseTimeMs: 3,
      };
    },
  });

  const result = await adapter.execute({ url: sourceUrl });
  assert.equal(fetchCalls, 1);
  assert.equal(parseInput.body, html);
  assert.equal(parseInput.url, "https://docs.example.org/guides/agentic-web");
  assert.equal(result.status, "succeeded");
  assert.equal(result.data.parser.name, "Defuddle");
  assert.equal(result.data.parser.version, DEFUDDLE_VERSION);
  assert.equal(result.data.markdown, "# Agentic web overview\n\nReadable content.");
  assert.equal(result.sources[0].url, parseInput.url);
  assert.equal(result.sources[0].retrievedAt, "2026-11-17T20:00:00.000Z");
  assert.deepEqual(result.sources[0].evidence.map((item) => item.type), ["http_response", "content_extraction"]);
});

test("Defuddle adapter validates the source URL before invoking a fetcher", async () => {
  let called = false;
  const adapter = createDefuddleAdapter({
    fetchResource: async () => { called = true; return fetchedPage(); },
    parseHtml: async () => ({ markdown: "never" }),
  });
  await assert.rejects(adapter.execute({ url: "http://127.0.0.1/admin" }));
  assert.equal(called, false);
});

test("Defuddle adapter rejects non-HTML responses before parsing", async () => {
  let parseCalled = false;
  const adapter = createDefuddleAdapter({
    fetchResource: async () => fetchedPage({ contentType: "application/pdf" }),
    parseHtml: async () => { parseCalled = true; return { markdown: "" }; },
  });
  await assert.rejects(
    adapter.execute({ url: sourceUrl }),
    (error) => error instanceof DefuddleAdapterError && error.code === "UNSUPPORTED_CONTENT_TYPE",
  );
  assert.equal(parseCalled, false);
});

test("Defuddle adapter enforces the bounded input size before parsing", async () => {
  let parseCalled = false;
  const oversized = "x".repeat(DEFUDDLE_LIMITS.maxInputBytes + 1);
  const adapter = createDefuddleAdapter({
    fetchResource: async () => fetchedPage({ body: oversized, bytes: oversized.length }),
    parseHtml: async () => { parseCalled = true; return { markdown: "" }; },
  });
  await assert.rejects(
    adapter.execute({ url: sourceUrl }),
    (error) => error instanceof DefuddleAdapterError && error.code === "INPUT_TOO_LARGE",
  );
  assert.equal(parseCalled, false);
});

test("Defuddle adapter returns partial when the parser finds no main content", async () => {
  const adapter = createDefuddleAdapter({
    fetchResource: async () => fetchedPage(),
    parseHtml: async () => ({ markdown: "", wordCount: 0 }),
  });
  const result = await adapter.execute({ url: sourceUrl });
  assert.equal(result.status, "partial");
  assert.equal(result.data.markdown, "");
  assert.ok(result.warnings.some((warning) => warning.includes("did not find readable main content")));
});

test("Defuddle adapter hides parser internals behind a stable error", async () => {
  const adapter = createDefuddleAdapter({
    fetchResource: async () => fetchedPage(),
    parseHtml: async () => { throw new Error("private parser stack or page data"); },
  });
  await assert.rejects(
    adapter.execute({ url: sourceUrl }),
    (error) => error instanceof DefuddleAdapterError &&
      error.code === "PARSER_FAILED" &&
      !error.message.includes("private parser stack"),
  );
});

test("Defuddle full-bundle integration parses locally without making extra network calls", {
  skip: process.env.EXPORTFLOW_DEFUDDLE_INTEGRATION !== "1",
}, async () => {
  const articleText = "This is the primary article paragraph. " + Array.from({ length: 45 }, (_, index) =>
    "This paragraph " + (index + 1) + " explains bounded web retrieval, evidence provenance, and safe content conversion.",
  ).join(" ");
  const fixture = [
    "<!doctype html><html><head><title>Agentic Web Reference</title>",
    '<meta name="description" content="A parser-only integration fixture."></head>',
    "<body><nav>Home | About | Contact</nav><main><article>",
    "<h1>Agentic Web Reference</h1><p>", articleText, "</p>",
    "<p>هذا نص عربي للتأكد من الحفاظ على المحتوى متعدد اللغات.</p>",
    "<ul><li>Fetch through ExportFlow</li><li>Parse locally</li></ul>",
    "<table><thead><tr><th>Layer</th><th>Role</th></tr></thead><tbody>",
    "<tr><td>Fetcher</td><td>Network and redirects</td></tr>",
    "<tr><td>Parser</td><td>Content cleanup</td></tr></tbody></table>",
    '<p><a href="javascript:alert(1)" onclick="alert(2)">Unsafe link</a></p>',
    "<script>window.__page_script_executed = true;</script>",
    '<template><img src="x" onerror="alert(3)"></template>',
    "</article></main><footer>Footer navigation should be removed.</footer></body></html>",
  ].join("");

  const originalFetch = globalThis.fetch;
  let unexpectedNetworkCalls = 0;
  globalThis.fetch = async () => {
    unexpectedNetworkCalls++;
    throw new Error("Defuddle parser attempted unexpected network access");
  };
  try {
    const adapter = createDefuddleAdapter({
      fetchResource: async () => fetchedPage({ body: fixture, bytes: new TextEncoder().encode(fixture).byteLength }),
    });
    const result = await adapter.execute({ url: sourceUrl });
    assert.equal(result.status, "succeeded");
    assert.match(result.data.markdown, /This is the primary article paragraph/);
    assert.match(result.data.markdown, /هذا نص عربي/);
    assert.match(result.data.markdown, /Fetch through ExportFlow/);
    assert.match(result.data.markdown, /\| Layer \| Role \|/);
    assert.doesNotMatch(result.data.markdown, /javascript:|onclick=|onerror=|<script/i);
    assert.equal(unexpectedNetworkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("default fetch path uses ExportFlow GET and manual redirect handling", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, sourceUrl);
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "manual");
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };
  try {
    const adapter = createDefuddleAdapter({
      parseHtml: async () => ({ markdown: "# Locally parsed", title: "Locally parsed", wordCount: 2 }),
    });
    const result = await adapter.execute({ url: sourceUrl });
    assert.equal(calls, 1);
    assert.equal(result.status, "succeeded");
    assert.equal(result.data.markdown, "# Locally parsed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("default fetch path blocks a redirect to a private destination before a second request", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "manual");
    return new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/admin" },
    });
  };
  try {
    const adapter = createDefuddleAdapter({
      parseHtml: async () => ({ markdown: "must not parse" }),
    });
    await assert.rejects(
      adapter.execute({ url: sourceUrl }),
      (error) => error.code === "REDIRECT_NOT_ALLOWED",
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
