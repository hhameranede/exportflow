import assert from "node:assert/strict";
import { Resolver } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { collectDnsRebindingObservations, createStageScopedDnsRebindingSuffix } from "./dns-rebinding-preflight.mjs";

const DNS_RESOLVERS = Object.freeze([
  { id: "google-doh", name: "Google Public DNS DoH", endpoint: "https://dns.google/resolve", required: true },
  { id: "runner-system", name: "GitHub runner system DNS", system: true, required: false },
]);
const PUBLIC_IP = "93.184.216.34";
const PRIVATE_TARGETS = Object.freeze([
  { name: "loopback", ip: "127.0.0.1" },
  { name: "unspecified", ip: "0.0.0.0" },
  { name: "private-10", ip: "10.0.0.1" },
]);
const QUERY_INTERVAL_MS = 1_100;
const RUN_ID = String(process.env.GITHUB_RUN_ID || process.env.CI_RUN_ID || Date.now())
  .replace(/[^a-zA-Z0-9-]/g, "-")
  .slice(0, 32);

function createHostname(privateIp, suffix) {
  return "make-" + PUBLIC_IP + "-rebindfor2mafter1times-" + privateIp + "-rr-" + suffix + ".1u.ms";
}

const systemResolver = new Resolver();

function verifyPublicControlOrigin(hostname) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: PUBLIC_IP,
      port: 80,
      method: "HEAD",
      path: "/?exportflow_acceptance_control=1",
      headers: {
        host: hostname,
        accept: "*/*",
        "user-agent": "ExportFlow-Acceptance/1.0 (+https://exportflow.me)",
        connection: "close",
      },
      signal: AbortSignal.timeout(8_000),
    }, (response) => {
      const fingerprint = {
        status: response.statusCode || 0,
        server: response.headers.server || null,
        contentType: response.headers["content-type"] || null,
        contentLength: response.headers["content-length"] || null,
        etag: response.headers.etag || null,
        cfRay: response.headers["cf-ray"] || null,
      };
      response.resume();
      response.once("end", () => resolve(fingerprint));
    });
    request.once("error", reject);
    request.end();
  });
}

async function assertPublicControlOrigin() {
  const hostname = createHostname(PRIVATE_TARGETS[0].ip, createStageScopedDnsRebindingSuffix({
    stage: "ci", runId: RUN_ID, targetIndex: 1, resolverId: "public-control",
  }));
  const fingerprint = await verifyPublicControlOrigin(hostname);
  assert.ok(fingerprint.status >= 200 && fingerprint.status < 500,
    "The direct public control origin must return an HTTP response below 500: " + JSON.stringify(fingerprint));
  assert.ok(typeof fingerprint.server === "string" && fingerprint.server.length > 0,
    "The direct public control origin must expose a Server fingerprint: " + JSON.stringify(fingerprint));
  assert.notEqual(fingerprint.server.toLowerCase(), "cloudflare",
    "The direct public control origin must not be served by Cloudflare: " + JSON.stringify(fingerprint));
  console.log("Direct public control origin verified (fixed IP + rebinding Host header): " + JSON.stringify(fingerprint));
}

async function queryDnsA(resolver, hostname) {
  if (resolver.system === true) {
    const answers = await systemResolver.resolve4(hostname, { ttl: true });
    return answers.map((answer) => ({ ip: answer.address, ttl: Number(answer.ttl) }));
  }
  const url = new URL(resolver.endpoint);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", "A");
  const response = await fetch(url, {
    headers: { accept: "application/dns-json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    const error = new Error(resolver.name + " returned HTTP " + response.status + " for " + hostname + ".");
    if (response.status >= 500 || response.status === 429) error.code = "ETEMPFAIL";
    throw error;
  }
  const payload = await response.json();
  const status = Number(payload.Status);
  if (status !== 0 || !Array.isArray(payload.Answer)) {
    const error = new Error(resolver.name + " returned DNS status " + status + " for " + hostname + ".");
    if (status === 2) error.code = "ESERVFAIL";
    throw error;
  }
  const records = payload.Answer.filter((answer) => answer.type === 1 && typeof answer.data === "string")
    .map((answer) => ({ ip: answer.data, ttl: Number(answer.TTL) }));
  if (records.length === 0) throw new Error(resolver.name + " returned no A records for " + hostname + ".");
  return records;
}

async function queryDnsAWithRetry(resolver, hostname) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await queryDnsA(resolver, hostname);
    } catch (error) {
      const transient = ["ESERVFAIL", "ETIMEOUT", "EAI_AGAIN", "ECONNREFUSED", "EDNS", "ETEMPFAIL"]
        .includes(String(error?.code || "").toUpperCase()) ||
        ["AbortError", "TimeoutError"].includes(error?.name) ||
        /DNS status 2|SERVFAIL|temporarily unavailable/i.test(String(error?.message || ""));
      if (!transient || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_100));
    }
  }
  throw new Error(resolver.name + " exhausted DNS retries for " + hostname + ".");
}

async function queryDnsBatches(resolver, hostname, count) {
  const records = [];
  for (let index = 0; index < count; index += 1) {
    records.push(...await queryDnsAWithRetry(resolver, hostname));
    if (index + 1 < count) await new Promise((resolve) => setTimeout(resolve, QUERY_INTERVAL_MS));
  }
  return records;
}

await assertPublicControlOrigin();

const verified = [];
for (const [index, target] of PRIVATE_TARGETS.entries()) {
  const targetIndex = index + 1;
  const hostname = createHostname(target.ip, createStageScopedDnsRebindingSuffix({
    stage: "ci", runId: RUN_ID, targetIndex, resolverId: "base",
  }));
  const observations = await collectDnsRebindingObservations({
    hostname,
    hostnameForResolver: (resolver) => createHostname(target.ip, createStageScopedDnsRebindingSuffix({
      stage: "ci", runId: RUN_ID, targetIndex, resolverId: resolver.id,
    })),
    expectedAddresses: [PUBLIC_IP, target.ip],
    resolvers: DNS_RESOLVERS,
    queryDnsBatches,
  });
  verified.push({ target: target.name, observations });
}

assert.equal(verified.length, PRIVATE_TARGETS.length);
console.log("1u.ms DNS rebinding preflight passed: " + JSON.stringify({
  authority: "1u.ms", publicIp: PUBLIC_IP, rebindingWindow: "2m",
  queriesPerResolverAndTarget: 12, intervalMs: QUERY_INTERVAL_MS, verified,
}));
