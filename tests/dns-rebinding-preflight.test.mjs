import assert from "node:assert/strict";
import test from "node:test";
import {
  assertInitialDnsRebindingSequence,
  collectDnsRebindingObservations,
  createStageScopedDnsRebindingSuffix,
} from "../scripts/acceptance/dns-rebinding-preflight.mjs";

const hostname = "make-172.66.147.243-rebindfor2mafter2times-10.0.0.1-rr-test-acceptance.1u.ms";
const publicIp = "172.66.147.243";
const privateIp = "10.0.0.1";
const validRecords = [
  { ip: publicIp, ttl: 1 },
  { ip: privateIp, ttl: 1 },
];

test("CI runner and Worker runtime use separate 1u.ms hostname namespaces", () => {
  const shared = { runId: "45850198837", targetIndex: 1, resolverId: "google-doh" };
  const ciSuffix = createStageScopedDnsRebindingSuffix({ ...shared, stage: "ci" });
  const runtimeSuffix = createStageScopedDnsRebindingSuffix({ ...shared, stage: "runtime" });

  assert.notEqual(ciSuffix, runtimeSuffix);
  assert.match(ciSuffix, /^ci-/);
  assert.match(runtimeSuffix, /^runtime-/);
});

test("1u.ms after2times requires the first A answer to be public and the second to be private", () => {
  const sequence = assertInitialDnsRebindingSequence({
    answers: validRecords,
    publicIp,
    privateIp,
  });

  assert.equal(sequence.firstPublicAnswer.ip, publicIp);
  assert.equal(sequence.secondPrivateAnswer.ip, privateIp);
});

test("the initial sequence rejects two public answers before the private target", () => {
  assert.throws(
    () => assertInitialDnsRebindingSequence({
      answers: [
        { ip: publicIp, ttl: 1 },
        { ip: publicIp, ttl: 1 },
        { ip: privateIp, ttl: 1 },
      ],
      publicIp,
      privateIp,
    }),
    /after2times must return the public A answer first, then the private target/,
  );
});

test("the initial sequence rejects a private-first or missing-private A answer", () => {
  for (const answers of [
    [{ ip: privateIp, ttl: 1 }, { ip: publicIp, ttl: 1 }],
    [{ ip: publicIp, ttl: 1 }, { ip: publicIp, ttl: 1 }],
  ]) {
    assert.throws(
      () => assertInitialDnsRebindingSequence({ answers, publicIp, privateIp }),
      /after2times must return the public A answer first, then the private target/,
    );
  }
});

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
  assert.equal(observations[0].hostname, hostname);
});

test("multiple resolvers use independent hostnames so the first public answer cannot be consumed by another resolver", async () => {
  const requestedHostnames = [];
  const observations = await collectDnsRebindingObservations({
    hostname,
    hostnameForResolver: (resolver) => hostname + (resolver.system ? "-system" : "-google-doh"),
    expectedAddresses: [publicIp, privateIp],
    resolvers: [
      { name: "Google Public DNS DoH", required: true },
      { name: "GitHub runner system DNS", system: true, required: false },
    ],
    queryDnsBatches: async (resolver, resolverHostname, count) => {
      assert.equal(count, 12);
      requestedHostnames.push(resolverHostname);
      if (resolver.system) {
        const error = new Error("queryA ESERVFAIL for rebinding test name");
        error.code = "ESERVFAIL";
        throw error;
      }
      return validRecords;
    },
  });

  assert.equal(new Set(requestedHostnames).size, 2);
  assert.deepEqual(observations.map((item) => item.status), ["verified", "inconclusive"]);
  assert.notEqual(observations[0].hostname, observations[1].hostname);
  assert.match(observations[1].error, /ESERVFAIL/);
});

test("multiple resolvers cannot share the first-answer rebinding hostname", async () => {
  await assert.rejects(
    collectDnsRebindingObservations({
      hostname,
      expectedAddresses: [publicIp, privateIp],
      resolvers: [
        { name: "Google Public DNS DoH", required: true },
        { name: "runner DNS", required: false },
      ],
      queryDnsBatches: async () => validRecords,
    }),
    /resolver-specific DNS-rebinding hostname factory is required/i,
  );
});

test("the preflight fails closed when different resolvers are assigned the same hostname", async () => {
  await assert.rejects(
    collectDnsRebindingObservations({
      hostname,
      hostnameForResolver: () => hostname,
      expectedAddresses: [publicIp, privateIp],
      resolvers: [
        { name: "Google Public DNS DoH", required: true },
        { name: "runner DNS", required: false },
      ],
      queryDnsBatches: async () => validRecords,
    }),
    /must receive a unique rebinding hostname/i,
  );
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
