import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { HTTP_FETCH_LIMITS, validatePublicHttpUrl } from "../src/core/http-fetch.js";
import {
  ACCEPTANCE_WORKER_PINS,
  assertAcceptanceEndpointsArePinned,
  assertExpectedResponseCharset,
  assertPinnedAcceptanceConfigs,
  assertPinnedAcceptanceWorkerState,
  isMcpRateLimitedResponse,
  getRequestIntervalWaitMs,
} from "../scripts/acceptance/stage1-fetch-corpus.mjs";

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


test("live legacy charset assertions require an exact declared response charset", () => {
  assert.equal(
    assertExpectedResponseCharset("text/html; charset=shift-jis", "shift-jis", "Shift_JIS"),
    "shift-jis",
  );
  assert.equal(
    assertExpectedResponseCharset('text/html; charset="EUC-JP"', "euc-jp", "EUC-JP"),
    "EUC-JP",
  );
  assert.throws(
    () => assertExpectedResponseCharset("text/html; charset=utf-8", "shift-jis", "Shift_JIS"),
    /expected shift-jis/,
  );
  assert.throws(
    () => assertExpectedResponseCharset("text/html", "euc-kr", "EUC-KR"),
    /did not declare/,
  );
});

test("REST request pacing respects the shared tenant burst interval", () => {
  assert.equal(getRequestIntervalWaitMs(1_000, 1_500, 2_500), 2_000);
  assert.equal(getRequestIntervalWaitMs(1_000, 3_500, 2_500), 0);
  assert.equal(getRequestIntervalWaitMs(1_000, 1_000, 2_500), 2_500);
});

test("MCP rate-limit responses are distinguished from task errors", () => {
  assert.equal(isMcpRateLimitedResponse({
    result: { isError: true, structuredContent: { error: "rate_limited" } },
  }), true);
  assert.equal(isMcpRateLimitedResponse({
    result: { isError: true, structuredContent: { error: "TASK_NOT_FOUND" } },
  }), false);
  assert.equal(isMcpRateLimitedResponse({
    result: { isError: false, structuredContent: { state: "succeeded" } },
  }), false);
});

test("Acceptance runtime preflight pins active version, script ETag, public Fetch and exact bindings", () => {
  for (const workerName of Object.keys(ACCEPTANCE_WORKER_PINS)) {
    const pin = ACCEPTANCE_WORKER_PINS[workerName];
    const deployments = [{
      created_on: "2026-11-27T14:44:40.000Z",
      strategy: "percentage",
      versions: [{ version_id: pin.versionId, percentage: 100 }],
    }];
    const bindings = Object.entries(pin.bindings).map(([name, value]) => ({ name, ...value }));
    const version = {
      id: pin.versionId,
      number: pin.versionNumber,
      resources: {
        script: { etag: pin.scriptEtag },
        script_runtime: { compatibility_flags: ["global_fetch_strictly_public"] },
        bindings,
      },
    };
    const result = assertPinnedAcceptanceWorkerState({ workerName, deployments, version });
    assert.equal(result.trafficPercent, 100);
    assert.equal(result.databaseId, pin.bindings.EXPORTFLOW_AUTH_DB.database_id);

    assert.throws(
      () => assertPinnedAcceptanceWorkerState({
        workerName,
        deployments,
        version: { ...version, id: "unreviewed-version" },
      }),
      /does not match the reviewed pin/,
    );
    assert.throws(
      () => assertPinnedAcceptanceWorkerState({
        workerName,
        deployments: [{
          ...deployments[0],
          versions: [{ version_id: pin.versionId, percentage: 50 }],
        }],
        version,
      }),
      /100%/,
    );

    assert.throws(
      () => assertPinnedAcceptanceWorkerState({
        workerName,
        deployments,
        version: {
          ...version,
          resources: {
            ...version.resources,
            bindings: [...bindings, { name: "UNREVIEWED_BINDING", type: "plain_text", text: "unexpected" }],
          },
        },
      }),
      /binding inventory differs/,
    );
  }
});
