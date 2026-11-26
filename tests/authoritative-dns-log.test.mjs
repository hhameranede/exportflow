import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthoritativeDnsLogUrl,
  hasAuthoritativeAAnswer,
  startAuthoritativeDnsLogCapture,
} from "../scripts/acceptance/authoritative-dns-log.mjs";

const sessionId = "worker-45889105483-1";
const hostname = "make-188.184.67.127-rebindfor2mafter6times-127.0.0.1-rr-" + sessionId + ".1u.ms";

function openLogStream(initialText) {
  const encoder = new TextEncoder();
  let controller;
  let cancelled = false;
  const body = new ReadableStream({
    start(value) {
      controller = value;
      if (initialText) controller.enqueue(encoder.encode(initialText));
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    body,
    push(text) { controller.enqueue(encoder.encode(text)); },
    get cancelled() { return cancelled; },
  };
}

test("authoritative DNS log URL is filtered to the exact run-scoped session", () => {
  const url = createAuthoritativeDnsLogUrl(hostname, sessionId);
  assert.equal(url.origin, "http://1u.ms");
  assert.equal(url.pathname, "/log");
  assert.equal(url.searchParams.get("grep"), sessionId);
  assert.throws(() => createAuthoritativeDnsLogUrl("example.com", sessionId), /1u.ms hostname/);
  assert.throws(() => createAuthoritativeDnsLogUrl(hostname, "worker-45889105483-2"), /belong to the requested Worker session/);
  assert.throws(() => createAuthoritativeDnsLogUrl(hostname, sessionId, "http://example.com/log"), /filtered 1u.ms/);
  assert.throws(() => createAuthoritativeDnsLogUrl(hostname, sessionId, "http://1u.ms/last"), /filtered 1u.ms/);
  assert.throws(() => createAuthoritativeDnsLogUrl(hostname, sessionId, "http://1u.ms/log?grep=.*"), /filtered 1u.ms/);
});

test("stream capture retains only exact Worker hostname A/AAAA records and cancels the infinite stream", async () => {
  const captureStream = openLogStream([
    '[2026-11-26 20:52:50.000] 203.0.113.2 A "' + hostname + '." -> 188.184.67.127',
    '[2026-11-26 20:52:51.000] 203.0.113.2 A "unrelated.1u.ms." -> 192.0.2.10',
    '[2026-11-26 20:52:52.000] 203.0.113.2 AAAA "' + hostname + '." -> <nil>',
    '[2026-11-26 20:52:53.000] 203.0.113.2 A "make-188.184.67.127-rebindfor2mafter6times-127.0.0.1-rr-' + sessionId + '-capture.1u.ms." -> 188.184.67.127',
    "",
  ].join("\n"));
  let requestedUrl = "";
  let requestedOptions;

  const capture = await startAuthoritativeDnsLogCapture({
    hostname,
    sessionId,
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return new Response(captureStream.body, {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    },
  });
  const result = await capture.finish();

  assert.equal(result.status, "captured");
  assert.equal(result.httpStatus, 200);
  assert.equal(result.streamRecordCount, 4);
  assert.equal(result.matchingRecordCount, 2);
  assert.equal(result.matchingRecords.length, 2);
  assert.match(result.matchingRecords[0], / A /);
  assert.match(result.matchingRecords[1], / AAAA /);
  assert.equal(result.matchingRecords.some((record) => record.includes("unrelated.1u.ms")), false);
  assert.equal(result.matchingRecords.some((record) => record.includes("-capture.1u.ms")), false);
  assert.equal(new URL(requestedUrl).searchParams.get("grep"), sessionId);
  assert.equal(new URL(requestedUrl).pathname, "/log");
  assert.equal(requestedOptions.redirect, "manual");
  assert.equal(requestedOptions.cache, "no-store");
  assert.match(requestedOptions.headers.accept, /text\/plain/);
  assert.equal(captureStream.cancelled, true);
});

test("stream capture collects live records arriving after the stream opens", async () => {
  const captureStream = openLogStream("");
  const capture = await startAuthoritativeDnsLogCapture({
    hostname,
    sessionId,
    fetchImpl: async () => new Response(captureStream.body, {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
  });

  captureStream.push('[2026-11-26 20:52:54.000] 203.0.113.2 A "' + hostname + '." -> 188.184.67.127\n');
  const result = await capture.finish();
  assert.equal(result.status, "captured");
  assert.equal(result.matchingRecordCount, 1);
  assert.match(result.matchingRecords[0], / A /);
});

test("authoritative DNS stream bounds oversized responses", async () => {
  const captureStream = openLogStream(
    '[2026-11-26 20:52:50.000] 203.0.113.2 A "' + hostname + '." -> 188.184.67.127\n' +
    "x".repeat(70_000),
  );
  const capture = await startAuthoritativeDnsLogCapture({
    hostname,
    sessionId,
    fetchImpl: async () => new Response(captureStream.body, {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
  });
  const result = await capture.finish();
  assert.equal(result.status, "captured");
  assert.equal(result.truncated, true);
  assert.equal(result.matchingRecordCount, 1);
});

test("private DNS evidence parses only the actual A-record RDATA, not an IP embedded in the hostname", () => {
  const privateIp = "127.0.0.1";
  const publicAnswer = '[2026-11-26 20:52:50.000] 104.22.73.72:28589 A "' +
    hostname + '." -> &{[' + hostname + '. 0 IN A 188.184.67.127] false}';
  const emptyIpv6Answer = '[2026-11-26 20:52:51.000] 104.22.73.72:28589 AAAA "' +
    hostname + '." -> &{[] false}';
  const unrelatedPrivateAnswer = '[2026-11-26 20:52:52.000] 104.22.73.72:28589 A "unrelated.1u.ms." -> &{[unrelated.1u.ms. 0 IN A ' +
    privateIp + '] false}';

  // The hostname itself contains 127.0.0.1, while the returned A RDATA is public.
  assert.equal(hasAuthoritativeAAnswer([publicAnswer], hostname, privateIp), false);
  assert.equal(hasAuthoritativeAAnswer([emptyIpv6Answer], hostname, privateIp), false);
  assert.equal(hasAuthoritativeAAnswer([unrelatedPrivateAnswer], hostname, privateIp), false);

  const actualPrivateAnswer = '[2026-11-26 20:52:53.000] 104.22.73.72:28589 A "' +
    hostname + '." -> &{[' + hostname + '. 0 IN A ' + privateIp + '] false}';
  assert.equal(hasAuthoritativeAAnswer([actualPrivateAnswer], hostname, privateIp), true);
  assert.equal(hasAuthoritativeAAnswer([actualPrivateAnswer], hostname + "-other", privateIp), false);
});

test("authoritative DNS stream HTTP and transport failures are diagnostics, not false passes", async () => {
  const httpError = await startAuthoritativeDnsLogCapture({
    hostname,
    sessionId,
    fetchImpl: async () => new Response("temporary upstream error", { status: 503 }),
  });
  const httpResult = await httpError.finish();
  assert.equal(httpResult.status, "unavailable");
  assert.match(httpResult.error.message, /HTTP 503/);

  const unavailable = await startAuthoritativeDnsLogCapture({
    hostname,
    sessionId,
    fetchImpl: async () => { throw new Error("stream endpoint unavailable"); },
  });
  const unavailableResult = await unavailable.finish();
  assert.equal(unavailableResult.status, "unavailable");
  assert.equal(unavailableResult.error.message, "stream endpoint unavailable");
});
