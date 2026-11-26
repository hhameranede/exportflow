import assert from "node:assert/strict";
import test from "node:test";
import {
  captureAuthoritativeDnsLog,
  createAuthoritativeDnsLogUrl,
} from "../scripts/acceptance/authoritative-dns-log.mjs";

const sessionId = "worker-45889105483-1";
const hostname = "make-188.184.67.127-rebindfor2mafter6times-127.0.0.1-rr-" + sessionId + ".1u.ms";

test("authoritative DNS log URL is scoped to the exact 1u.ms Worker session", () => {
  const url = createAuthoritativeDnsLogUrl(hostname, sessionId);
  assert.equal(url.origin, "http://1u.ms");
  assert.equal(url.pathname, "/log");
  assert.equal(url.searchParams.get("grep"), sessionId);
  assert.throws(() => createAuthoritativeDnsLogUrl("example.com", sessionId), /1u.ms hostname/);
  assert.throws(() => createAuthoritativeDnsLogUrl(hostname, "worker-45889105483-2"), /belong to the requested Worker session/);
  assert.throws(() => createAuthoritativeDnsLogUrl(hostname, sessionId, "http://example.com/log"), /restricted to the 1u.ms/);
});

test("authoritative DNS log capture retains raw A/AAAA query records without interpreting them", async () => {
  const rawLog = "A make.example.1u.ms -> 188.184.67.127\nAAAA make.example.1u.ms -> 2001:db8::1\n";
  let requestedUrl = "";
  let requestedOptions;
  const result = await captureAuthoritativeDnsLog({
    hostname,
    sessionId,
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return new Response(rawLog, {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    },
  });
  assert.equal(result.status, "captured");
  assert.equal(result.httpStatus, 200);
  assert.equal(result.body, rawLog);
  assert.equal(result.truncated, false);
  assert.equal(new URL(requestedUrl).searchParams.get("grep"), sessionId);
  assert.equal(requestedOptions.redirect, "manual");
  assert.equal(requestedOptions.cache, "no-store");
  assert.match(requestedOptions.headers.accept, /text\/plain/);
});

test("authoritative DNS log capture bounds oversized responses", async () => {
  const result = await captureAuthoritativeDnsLog({
    hostname,
    sessionId,
    fetchImpl: async () => new Response("x".repeat(70_000), { status: 200 }),
  });
  assert.equal(result.status, "captured");
  assert.equal(result.body.length, 64_000);
  assert.equal(result.truncated, true);
});

test("authoritative DNS log HTTP and transport failures remain diagnostics, not false passes", async () => {
  const httpError = await captureAuthoritativeDnsLog({
    hostname,
    sessionId,
    fetchImpl: async () => new Response("temporary upstream error", { status: 503 }),
  });
  assert.equal(httpError.status, "http_error");
  assert.equal(httpError.httpStatus, 503);
  assert.equal(httpError.body, "temporary upstream error");

  const unavailable = await captureAuthoritativeDnsLog({
    hostname,
    sessionId,
    fetchImpl: async () => { throw new Error("proxy unavailable"); },
  });
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.error.message, "proxy unavailable");
});
