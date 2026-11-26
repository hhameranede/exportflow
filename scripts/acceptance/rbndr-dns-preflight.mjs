import assert from "node:assert/strict";
import { Resolver } from "node:dns/promises";
import { collectDnsRebindingObservations } from "./dns-rebinding-preflight.mjs";

const DNS_RESOLVERS = Object.freeze([
  { name: "Google Public DNS DoH", endpoint: "https://dns.google/resolve", required: true },
  { name: "GitHub runner system DNS", system: true, required: false },
]);
const PUBLIC_CONTROL_IPS = Object.freeze(["185.199.108.153", "185.199.109.153"]);
const PRIVATE_TARGETS = Object.freeze([
  { name: "loopback", ip: "127.0.0.1" },
  { name: "unspecified", ip: "0.0.0.0" },
  { name: "private-10", ip: "10.0.0.1" },
]);
const QUERY_COUNT = 12;
const QUERY_INTERVAL_MS = 1_100;

function ipv4ToHex(value) {
  const octets = value.split(".");
  assert.equal(octets.length, 4, "DNS rebinding IP must be IPv4.");
  return octets.map((octet) => {
    const number = Number(octet);
    assert.ok(Number.isInteger(number) && number >= 0 && number <= 255, "DNS rebinding IP octets must be valid.");
    return number.toString(16).padStart(2, "0");
  }).join("");
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

const systemResolver = createSystemResolver();

async function queryDnsA(resolver, hostname) {
  if (resolver.system === true) return systemResolver.query(hostname);
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
  const records = payload.Answer
    .filter((answer) => answer.type === 1 && typeof answer.data === "string")
    .map((answer) => ({ ip: answer.data, ttl: Number(answer.TTL) }));
  if (records.length === 0) throw new Error(resolver.name + " returned no A records for " + hostname + ".");
  return records;
}

function isRetryableDnsError(error) {
  const code = String(error?.code || "").toUpperCase();
  return ["ESERVFAIL", "ETIMEOUT", "EAI_AGAIN", "ECONNREFUSED", "EDNS", "ETEMPFAIL"].includes(code) ||
    ["AbortError", "TimeoutError"].includes(error?.name) ||
    /DNS status 2|SERVFAIL|temporarily unavailable/i.test(String(error?.message || ""));
}

async function queryDnsAWithRetry(resolver, hostname) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await queryDnsA(resolver, hostname);
    } catch (error) {
      if (!isRetryableDnsError(error) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(resolver.name + " exhausted DNS retries for " + hostname + ".");
}

async function queryDnsBatches(resolver, hostname, count) {
  const records = [];
  for (let index = 0; index < count; index += 1) {
    records.push(...await queryDnsAWithRetry(resolver, hostname));
    if (index + 1 < count) {
      await new Promise((resolve) => setTimeout(resolve, QUERY_INTERVAL_MS));
    }
  }
  return records;
}

const pairs = [
  { name: "public-control", first: PUBLIC_CONTROL_IPS[0], second: PUBLIC_CONTROL_IPS[1] },
  ...PRIVATE_TARGETS.map((target) => ({
    name: target.name,
    first: PUBLIC_CONTROL_IPS[0],
    second: target.ip,
  })),
];

const verified = [];
for (const pair of pairs) {
  const hostname = ipv4ToHex(pair.first) + "." + ipv4ToHex(pair.second) + ".rbndr.us";
  const observations = await collectDnsRebindingObservations({
    hostname,
    expectedAddresses: [pair.first, pair.second],
    resolvers: DNS_RESOLVERS,
    queryDnsBatches,
  });
  verified.push({ target: pair.name, hostname, observations });
}

assert.equal(verified.length, 1 + PRIVATE_TARGETS.length);
console.log("rbndr.us DNS rebinding preflight passed: " + JSON.stringify({
  queryCountPerPair: QUERY_COUNT,
  intervalMs: QUERY_INTERVAL_MS,
  verified,
}));
