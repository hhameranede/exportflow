import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { HTTP_FETCH_LIMITS, validatePublicHttpUrl } from "../src/core/http-fetch.js";
import { assertAcceptanceEndpointsArePinned, assertPinnedAcceptanceConfigs } from "../scripts/acceptance/stage1-fetch-corpus.mjs";

const corpus = JSON.parse(readFileSync(new URL("./fixtures/stage1-fetch-corpus.v1.json", import.meta.url), "utf8"));

test("Stage 1 corpus pins its standards sources and license provenance", () => {
  assert.equal(corpus.version, "1.0.0");
  assert.equal(corpus.sources.find((source) => source.id === "wpt-url")?.license, "BSD-3-Clause");
  assert.match(corpus.sources.find((source) => source.id === "wpt-url")?.commit || "", /^[a-f0-9]{40}$/);
  assert.ok(corpus.urlParsing.length >= 8);
  assert.ok(corpus.idna.length >= 6);
});

test("WPT URL parser subset matches the WHATWG URL serializer", () => {
  for (const entry of corpus.urlParsing) {
    assert.equal(new URL(entry.input).href, entry.expectedHref, entry.id);
  }
});

test("WPT IDNA subset matches WHATWG host processing", () => {
  for (const entry of corpus.idna) {
    if (entry.expectedAsciiHost === null) {
      assert.throws(() => new URL("https://" + entry.inputHost + "/"), undefined, entry.id);
    } else {
      assert.equal(new URL("https://" + entry.inputHost + "/").hostname, entry.expectedAsciiHost, entry.id);
    }
  }
});

test("WPT legacy encoding byte samples decode to their recorded code points", () => {
  for (const entry of corpus.legacyCharsetFixtures) {
    const bytes = Uint8Array.from(entry.bytesHex.split(" ").map((value) => Number.parseInt(value, 16)));
    assert.equal(new TextDecoder(entry.encoding).decode(bytes), entry.expectedText, entry.id);
  }
});

test("every live corpus target is HTTPS, public, and below the Fetch response ceiling", () => {
  assert.ok(corpus.liveFetch.length >= 9);
  const hosts = new Set();
  for (const entry of corpus.liveFetch) {
    const target = validatePublicHttpUrl(entry.url);
    assert.equal(target.protocol, "https:", entry.id);
    assert.equal(target.hostname, entry.expectedHost, entry.id);
    assert.ok(entry.maxObservedBodyBytes === undefined || entry.maxObservedBodyBytes <= HTTP_FETCH_LIMITS.maxResponseBytes, entry.id);
    hosts.add(target.hostname);
  }
  assert.ok(hosts.size >= 4, "Corpus must represent multiple independent public hosts.");
});

test("corpus contains live non-UTF-8 charset and compression coverage", () => {
  const liveCharsets = corpus.liveFetch.filter((entry) => entry.expectedCharset);
  assert.deepEqual(liveCharsets.map((entry) => entry.expectedCharset).sort(), ["euc-jp", "euc-kr", "shift-jis"]);
  assert.ok(corpus.liveFetch.some((entry) => entry.class === "gzip-compressed-json"));
  assert.ok(corpus.liveFetch.some((entry) => entry.class === "deflate-compressed-json"));
  assert.ok(corpus.liveFetch.some((entry) => entry.minimumRedirects >= 1));
  assert.ok(corpus.liveFetch.some((entry) => entry.expectedHttpStatus === 404));
});

test("the Stage 1 live runner is pinned to dedicated Acceptance Workers only", () => {
  assert.equal(assertAcceptanceEndpointsArePinned(), true);
  assert.equal(assertPinnedAcceptanceConfigs(), true);
  assert.throws(() => assertAcceptanceEndpointsArePinned({
    platformUrl: "https://exportflow.me",
    mcpUrl: "https://mcp.exportflow.me/mcp",
  }));
});
