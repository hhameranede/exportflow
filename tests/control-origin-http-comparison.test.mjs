import test from "node:test";
import assert from "node:assert/strict";
import {
  buildControlOriginVariants,
  compareControlOrigin,
  isPublicIPv4,
  summarizeResponse,
  validateControlTarget,
} from "../scripts/acceptance/control-origin-http-comparison.mjs";

const publicIp = "188.184.67.127";
const hostname = "make-188.184.67.127-rebindfor2mafter6times-127.0.0.1-rr-diagnostic-20261126.1u.ms";

test("direct-origin diagnostic accepts only a public IP and a run-scoped 1u.ms origin hostname", () => {
  assert.equal(isPublicIPv4(publicIp), true);
  for (const ip of ["127.0.0.1", "10.0.0.1", "0.0.0.0", "192.168.1.1", "224.0.0.1", "not-an-ip"]) {
    assert.equal(isPublicIPv4(ip), false, ip);
  }
  assert.doesNotThrow(() => validateControlTarget({ publicIp, hostname, cfWorkerZone: "exportflow.me" }));
  assert.throws(() => validateControlTarget({ publicIp: "127.0.0.1", hostname, cfWorkerZone: "exportflow.me" }));
  assert.throws(() => validateControlTarget({ publicIp, hostname: "example.com", cfWorkerZone: "exportflow.me" }));
});

test("request variants isolate CF-Worker and explicit cache-header differences", () => {
  const variants = buildControlOriginVariants({ hostname, cfWorkerZone: "exportflow.me" });
  assert.equal(variants.length, 3);
  assert.equal(variants[0].headers["cf-worker"], undefined);
  assert.equal(variants[1].headers["cf-worker"], "exportflow.me");
  assert.equal(variants[0].headers["cache-control"], "no-cache");
  assert.equal(variants[0].headers.pragma, "no-cache");
  assert.equal(variants[1].headers["cache-control"], "no-cache");
  assert.equal(variants[1].headers.pragma, "no-cache");
  assert.equal(variants[2].headers["cache-control"], undefined);
  assert.equal(variants[2].headers.pragma, undefined);
  for (const variant of variants) {
    assert.equal(variant.headers.host, hostname);
    assert.equal(variant.headers.accept, "*/*");
    assert.equal(variant.headers["user-agent"], "ExportFlow-Acceptance/1.0 (+https://exportflow.me)");
  }
});

test("response summary retains Location and edge diagnostics with bounded values", () => {
  const longLocation = "https://example.test/" + "x".repeat(700);
  const summary = summarizeResponse(302, {
    Server: "cloudflare",
    Location: longLocation,
    "CF-Ray": "test-ray",
    "Content-Type": "application/x-perl",
    Via: "1.1 proxy",
  });
  assert.equal(summary.status, 302);
  assert.equal(summary.headers.server, "cloudflare");
  assert.equal(summary.headers.location.length, 512);
  assert.equal(summary.headers["cf-ray"], "test-ray");
  assert.equal(summary.headers.via, "1.1 proxy");
});

test("comparison performs control-origin HEAD requests sequentially and returns per-variant fingerprints", async () => {
  const calls = [];
  const fakeRequest = (options, callback) => {
    calls.push(options);
    const headers = {
      server: options.headers["cf-worker"] ? "apache-cf-worker-variant" : "apache",
      "content-type": "application/x-perl",
      location: "/redirect?source=" + (options.headers["cf-worker"] ? "worker" : "direct"),
      "cf-ray": options.headers["cf-worker"] ? "synthetic-test-ray" : undefined,
    };
    const response = {
      statusCode: 302,
      headers,
      resume() {},
    };
    queueMicrotask(() => callback(response));
    const listeners = new Map();
    return {
      setTimeout() {},
      on(name, fn) { listeners.set(name, fn); return this; },
      end() {},
      destroy(error) { listeners.get("error")?.(error); },
    };
  };
  const report = await compareControlOrigin({ publicIp, hostname, requestImpl: fakeRequest });
  assert.equal(report.results.length, 3);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.hostname === publicIp && call.port === 80 && call.method === "HEAD"));
  assert.ok(calls.every((call) => call.path === "/?exportflow_acceptance_control=1"));
  assert.equal(report.results[0].response.headers.location, "/redirect?source=direct");
  assert.equal(report.results[1].response.headers.location, "/redirect?source=worker");
  assert.equal(report.results[1].response.headers["cf-ray"], "synthetic-test-ray");
  assert.match(report.interpretation, /not a Cloudflare Worker runtime test/);
});
