import assert from "node:assert/strict";
import test from "node:test";
import {
  assertObservedDnsRebindingTransition,
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

test("the resolver-observed transition accepts public then private", () => {
  const transition = assertObservedDnsRebindingTransition({
    answers: validRecords,
    publicIp,
    privateIp,
  });

  assert.equal(transition.firstPublicAnswer.ip, publicIp);
  assert.equal(transition.firstPrivateAnswer.ip, privateIp);
  assert.equal(transition.privateAnswerIndex, 1);
});

test("the resolver-observed transition also accepts two public responses before private", () => {
  const transition = assertObservedDnsRebindingTransition({
    answers: [
      { ip: publicIp, ttl: 0 },
      { ip: publicIp, ttl: 0 },
      { ip: privateIp, ttl: 0 },
      { ip: privateIp, ttl: 0 },
    ],
    publicIp,
    privateIp,
  });

  assert.equal(transition.firstPublicAnswer.ip, publicIp);
  assert.equal(transition.firstPrivateAnswer.ip, privateIp);
  assert.equal(transition.privateAnswerIndex, 2);
});

test("the resolver-observed transition rejects private-first and missing-private responses", () => {
  for (const answers of [
    [{ ip: privateIp, ttl: 0 }, { ip: publicIp, ttl: 0 }],
    [{ ip: publicIp, ttl: 0 }, { ip: publicIp, ttl: 0 }],
  ]) {
    assert.throws(
      () => assertObservedDnsRebindingTransition({ answers, publicIp, privateIp }),
      /first resolver-observed A response must be the public control IP|private target must appear after the first public/,
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

test("explicit runner-diagnostic mode records a missing DNS answer as inconclusive", async () => {
  const observations = await collectDnsRebindingObservations({
    hostname,
    expectedAddresses: [publicIp, privateIp],
    resolvers: [{ name: "Google Public DNS DoH", required: false }],
    queryDnsBatches: async () => [{ ip: publicIp, ttl: 0 }],
    allowAllOptionalResolvers: true,
  });

  assert.deepEqual(observations.map((item) => item.status), ["inconclusive"]);
  assert.match(observations[0].error, /must observe both configured DNS-rebinding A answers/);
});

test("all-optional runner-diagnostic mode cannot contain a required resolver", async () => {
  await assert.rejects(
    collectDnsRebindingObservations({
      hostname,
      expectedAddresses: [publicIp, privateIp],
      resolvers: [{ name: "Google Public DNS DoH", required: true }],
      queryDnsBatches: async () => validRecords,
      allowAllOptionalResolvers: true,
    }),
    /all-optional diagnostic mode requires every DNS resolver to be marked optional/i,
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
