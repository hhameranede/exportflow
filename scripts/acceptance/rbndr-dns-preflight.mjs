import assert from "node:assert/strict";
import { Resolver } from "node:dns/promises";
import { collectDnsRebindingObservations, createStageScopedDnsRebindingSuffix } from "./dns-rebinding-preflight.mjs";

const DNS_RESOLVERS = Object.freeze([
  { id: "google-doh", name: "Google Public DNS DoH", endpoint: "https://dns.google/resolve", required: true },
  { id: "runner-system", name: "GitHub runner system DNS", system: true, required: false },
]);
const PUBLIC_IP = "185.199.108.153";
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
  return "make-" + PUBLIC_IP + "-rebindfor2mafter2times-" + privateIp + "-rr-" + suffix + ".1u.ms";
}

const systemResolver = new Resolver();

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


async function assertPublicAnswersBeforeRebind() {
  const target = PRIVATE_TARGETS[0];
  const hostname = createHostname(target.ip, createStageScopedDnsRebindingSuffix({
    stage: "ci", runId: RUN_ID, targetIndex: 1, resolverId: "sequence",
  }));
  const answers = await queryDnsBatches(DNS_RESOLVERS[0], hostname, 4);
  const firstTwo = answers.slice(0, 2).map((answer) => answer.ip);
  assert.deepEqual(firstTwo, [PUBLIC_IP, PUBLIC_IP],
    "1u.ms must return the public control IP twice before rebinding: " + JSON.stringify(answers));
  assert.ok(answers.slice(2).some((answer) => answer.ip === target.ip),
    "1u.ms must return the private target after the two public answers: " + JSON.stringify(answers));
  console.log("1u.ms initial DNS sequence verified: " + JSON.stringify({
    hostname, firstTwoPublicAnswers: firstTwo, laterPrivateAnswer: target.ip,
    answers,
  }));
}

await assertPublicAnswersBeforeRebind();

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
  authority: "1u.ms", publicIp: PUBLIC_IP, publicAnswersBeforeRebind: 2,
  rebindingWindow: "2m", queriesPerResolverAndTarget: 12,
  intervalMs: QUERY_INTERVAL_MS, verified,
}));
