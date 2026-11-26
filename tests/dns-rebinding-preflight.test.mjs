import assert from "node:assert/strict";
import test from "node:test";
import { collectDnsRebindingObservations } from "../scripts/acceptance/dns-rebinding-preflight.mjs";

const hostname = "make-172.66.147.243-rebindfor30safter1times-10.0.0.1-rr-test-acceptance.1u.ms";
const publicIp = "172.66.147.243";
const privateIp = "10.0.0.1";
const validRecords = [
  { ip: publicIp, ttl: 1 },
  { ip: privateIp, ttl: 1 },
];

test("the required DoH resolver must observe both configured DNS answers", async () => {
  const observations = await collectDnsRebindingObservations({
    hostname,
    expectedAddresses: [publicIp, privateIp],
    resolvers: [{ name: "Google Public DNS DoH", required: true }],
    queryDnsBatches: async (_resolver, _hostname, count) => {
      assert.equal(count, 12);
      return validRecords;
    },
  });

  assert.equal(observations[0].status, "verified");
  assert.deepEqual(observations[0].answers, [privateIp, publicIp]);
});

test("runner system DNS SERVFAIL is diagnostic and does not block the Worker probe", async () => {
  const observations = await collectDnsRebindingObservations({
    hostname,
    expectedAddresses: [publicIp, privateIp],
    resolvers: [
      { name: "Google Public DNS DoH", required: true },
      { name: "GitHub runner system DNS", system: true, required: false },
    ],
    queryDnsBatches: async (resolver) => {
      if (resolver.system) {
        const error = new Error("queryA ESERVFAIL for rebinding test name");
        error.code = "ESERVFAIL";
        throw error;
      }
      return validRecords;
    },
  });

  assert.deepEqual(observations.map((item) => item.status), ["verified", "inconclusive"]);
  assert.match(observations[1].error, /ESERVFAIL/);
});

test("the preflight fails closed when the required resolver misses one address", async () => {
  await assert.rejects(
    collectDnsRebindingObservations({
      hostname,
      expectedAddresses: [publicIp, privateIp],
      resolvers: [{ name: "Google Public DNS DoH", required: true }],
      queryDnsBatches: async () => [{ ip: publicIp, ttl: 1 }],
    }),
    /must observe both configured DNS-rebinding A answers/,
  );
});

test("the preflight fails closed when required DNS answers have an excessive TTL", async () => {
  await assert.rejects(
    collectDnsRebindingObservations({
      hostname,
      expectedAddresses: [publicIp, privateIp],
      resolvers: [{ name: "Google Public DNS DoH", required: true }],
      queryDnsBatches: async () => [
        { ip: publicIp, ttl: 30 },
        { ip: privateIp, ttl: 1 },
      ],
    }),
    /must observe short-lived DNS answers/,
  );
});

test("at least one required resolver must remain configured", async () => {
  await assert.rejects(
    collectDnsRebindingObservations({
      hostname,
      expectedAddresses: [publicIp, privateIp],
      resolvers: [{ name: "runner DNS", required: false }],
      queryDnsBatches: async () => validRecords,
    }),
    /at least one authoritative DNS preflight resolver must be required/i,
  );
});
