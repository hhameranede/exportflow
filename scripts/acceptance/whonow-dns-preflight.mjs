import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { request as httpRequest } from "node:http";

const DNS_RESOLVERS = Object.freeze([
  { name: "Google Public DNS DoH", endpoint: "https://dns.google/resolve" },
  { name: "Cloudflare DNS DoH", endpoint: "https://cloudflare-dns.com/dns-query" },
  { name: "AdGuard DNS DoH", endpoint: "https://dns.adguard-dns.com/resolve" },
]);
const PUBLIC_ORIGIN_IP = "185.199.108.153";
const PRIVATE_TARGET_IP = "127.0.0.1";
const QUERY_COUNT = 4;
const QUERY_INTERVAL_MS = 1_200;

function recordsFromPayload(payload, resolverName, hostname) {
  if (Number(payload.Status) !== 0 || !Array.isArray(payload.Answer)) {
    throw new Error(resolverName + " returned DNS status " + payload.Status + " for " + hostname + ".");
  }
  const records = payload.Answer
    .filter((answer) => answer.type === 1 && typeof answer.data === "string")
    .map((answer) => ({ ip: answer.data, ttl: Number(answer.TTL) }));
  if (records.length === 0) throw new Error(resolverName + " returned no A records for " + hostname + ".");
  return records;
}

async function queryDohA(resolver, hostname) {
  const url = new URL(resolver.endpoint);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", "A");
  const response = await fetch(url, {
    headers: { accept: "application/dns-json" },
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) throw new Error(resolver.name + " returned HTTP " + response.status + ".");
  return recordsFromPayload(await response.json(), resolver.name, hostname);
}

function createSystemResolver() {
  const resolver = new Resolver();
  return {
    name: "GitHub runner system DNS",
    query: async (hostname) => {
      const answers = await resolver.resolve4(hostname, { ttl: true });
      return answers.map((answer) => ({ ip: answer.address, ttl: Number(answer.ttl) }));
    },
  };
}

async function queryRepeated(query, hostname) {
  const records = [];
  for (let index = 0; index < QUERY_COUNT; index += 1) {
    records.push(...await query(hostname));
    if (index + 1 < QUERY_COUNT) {
      await new Promise((resolve) => setTimeout(resolve, QUERY_INTERVAL_MS));
    }
  }
  return records;
}

async function requestDirectHttpControl(hostname) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: PUBLIC_ORIGIN_IP,
      port: 80,
      method: "HEAD",
      path: "/?exportflow_acceptance_control=1",
      headers: { host: hostname, accept: "*/*", connection: "close" },
      timeout: 8_000,
    }, (response) => {
      response.resume();
      response.once("end", () => resolve({
        status: response.statusCode || 0,
        server: String(response.headers.server || ""),
        contentType: String(response.headers["content-type"] || ""),
        contentLength: String(response.headers["content-length"] || ""),
        etag: String(response.headers.etag || ""),
      }));
    });
    request.once("timeout", () => request.destroy(new Error("HTTP control timed out.")));
    request.once("error", reject);
    request.end();
  });
}

async function verifyWithResolver(resolver) {
  const session = randomUUID();
  const controlHostname = "A." + PUBLIC_ORIGIN_IP + ".forever." + session + "-control.rebind.network";
  const mixedHostname = "A." + PUBLIC_ORIGIN_IP + ".1time." + PRIVATE_TARGET_IP +
    ".forever." + session + "-mixed.rebind.network";

  const query = resolver.query
    ? resolver.query
    : (hostname) => queryDohA(resolver, hostname);

  const controlRecords = await query(controlHostname);
  assert.deepEqual(
    [...new Set(controlRecords.map((record) => record.ip))],
    [PUBLIC_ORIGIN_IP],
    resolver.name + " public-only whonow control did not resolve to the fixed public origin: " + JSON.stringify(controlRecords),
  );

  const mixedRecords = await queryRepeated(query, mixedHostname);
  const expected = [PUBLIC_ORIGIN_IP, PRIVATE_TARGET_IP].sort();
  const observed = [...new Set(mixedRecords.map((record) => record.ip))].sort();
  assert.deepEqual(
    observed,
    expected,
    resolver.name + " did not observe both whonow public/private answers: " +
      JSON.stringify({ mixedHostname, expected, observed, mixedRecords }),
  );
  assert.equal(mixedRecords[0].ip, PUBLIC_ORIGIN_IP,
    "Whonow must return the public address first before rebinding to the private address.");
  assert.ok(mixedRecords.slice(1).some((record) => record.ip === PRIVATE_TARGET_IP),
    "Whonow never returned the private address after the first public answer.");
  assert.ok(
    [...controlRecords, ...mixedRecords].every((record) => Number.isFinite(record.ttl) && record.ttl <= 5),
    "Whonow control and rebinding answers must have a short TTL (<=5s).",
  );

  const httpControl = await requestDirectHttpControl(controlHostname);
  assert.ok(httpControl.status >= 200 && httpControl.status < 500,
    "Direct public HTTP control returned an unusable status: " + JSON.stringify(httpControl));
  assert.ok(httpControl.server && httpControl.server.toLowerCase() !== "cloudflare",
    "Direct public HTTP control must reach the non-Cloudflare GitHub Pages origin: " + JSON.stringify(httpControl));

  return {
    resolver: resolver.name,
    controlHostname,
    mixedHostname,
    httpControl,
    observedDnsAnswers: observed,
    ttlMax: Math.max(...mixedRecords.map((record) => record.ttl)),
  };
}

const candidates = [...DNS_RESOLVERS, createSystemResolver()];
const failures = [];
let verified;
for (const resolver of candidates) {
  try {
    verified = await verifyWithResolver(resolver);
    break;
  } catch (error) {
    failures.push({ resolver: resolver.name, error: String(error?.message || error).slice(0, 320) });
  }
}
assert.ok(verified, "No resolver could verify the public whonow DNS rebinding service: " + JSON.stringify(failures));
console.log("Whonow DNS rebinding preflight passed: " + JSON.stringify({ ...verified, rejectedResolvers: failures }));
