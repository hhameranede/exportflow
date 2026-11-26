import assert from "node:assert/strict";
import { resolve4 } from "node:dns/promises";

const DOH_ENDPOINT = "https://dns.google/resolve";
const PRIVATE_TARGET = "127.0.0.1";
const QUERY_COUNT = 12;
const QUERY_INTERVAL_MS = 1_100;

function isPublicIpv4(value) {
  if (typeof value !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^(0|[1-9]\\d{0,2})$/.test(part))) return false;
  const [a, b, c, d] = parts.map(Number);
  if ([a, b, c, d].some((octet) => octet < 0 || octet > 255)) return false;
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 2 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function ipv4ToHex(value) {
  return value.split(".").map((octet) => Number(octet).toString(16).padStart(2, "0")).join("");
}

async function queryA(hostname) {
  const url = new URL(DOH_ENDPOINT);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", "A");
  const response = await fetch(url, {
    headers: { accept: "application/dns-json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Google Public DNS returned HTTP " + response.status + " for " + hostname + ".");
  const payload = await response.json();
  if (Number(payload.Status) !== 0 || !Array.isArray(payload.Answer)) {
    throw new Error("Google Public DNS returned status " + payload.Status + " for " + hostname + ".");
  }
  const records = payload.Answer
    .filter((answer) => answer.type === 1 && typeof answer.data === "string")
    .map((answer) => ({ ip: answer.data, ttl: Number(answer.TTL) }));
  if (records.length === 0) throw new Error("No A records returned for " + hostname + ".");
  return records;
}

async function queryRepeated(hostname, count) {
  const records = [];
  for (let index = 0; index < count; index += 1) {
    records.push(...await queryA(hostname));
    if (index + 1 < count) {
      await new Promise((resolve) => setTimeout(resolve, QUERY_INTERVAL_MS));
    }
  }
  return records;
}

const attackerRecords = await queryA("d.rebind.it");
const attackerIp = attackerRecords.map((record) => record.ip).find(isPublicIpv4);
assert.ok(attackerIp, "Singularity d.rebind.it must resolve to a globally routable IPv4 address.");
const attackerHex = ipv4ToHex(attackerIp);
const session = String(Date.now()) + String(process.pid).padStart(6, "0");
const controlHostname = "s-" + attackerHex + "." + attackerHex + "-" + session + "0-fs-e.d.rebind.it";
const mixedHostname = "s-" + attackerHex + "." + ipv4ToHex(PRIVATE_TARGET) + "-" + session + "1-rr-e.d.rebind.it";

const controlRecords = await queryRepeated(controlHostname, 2);
assert.deepEqual(
  [...new Set(controlRecords.map((record) => record.ip))],
  [attackerIp],
  "The all-public Singularity control must resolve only to its public attacker IP: " + JSON.stringify(controlRecords),
);

const mixedRecords = await queryRepeated(mixedHostname, QUERY_COUNT);
const expected = [attackerIp, PRIVATE_TARGET].sort();
const observed = [...new Set(mixedRecords.map((record) => record.ip))].sort();
assert.deepEqual(
  observed,
  expected,
  "Singularity round-robin DNS must return both the public and private answers: " + JSON.stringify({ mixedHostname, expected, observed, mixedRecords }),
);
assert.ok(
  mixedRecords.every((record) => Number.isFinite(record.ttl) && record.ttl <= 5),
  "Singularity mixed DNS answers must have a short TTL (<=5s): " + JSON.stringify(mixedRecords),
);

const controlResponse = await fetch("http://" + controlHostname + "/?exportflow_acceptance_control=1", {
  method: "HEAD",
  redirect: "manual",
  cache: "no-store",
  headers: { accept: "*/*" },
  signal: AbortSignal.timeout(10_000),
});
const server = controlResponse.headers.get("server") || "";
assert.ok(
  controlResponse.status >= 200 && controlResponse.status < 500,
  "Singularity public HTTP control returned an unusable status: " + controlResponse.status,
);
assert.ok(server && server.toLowerCase() !== "cloudflare",
  "Singularity public HTTP control must reach a direct non-Cloudflare origin; got server=" + JSON.stringify(server));

console.log("Singularity DNS preflight passed: " + JSON.stringify({
  attackerIp,
  controlHostname,
  mixedHostname,
  controlStatus: controlResponse.status,
  controlServer: server,
  mixedAnswers: observed,
  queries: mixedRecords.length,
  maxTtl: Math.max(...mixedRecords.map((record) => record.ttl)),
}));
