import assert from "node:assert/strict";

function summarizeError(error) {
  const code = typeof error?.code === "string" ? error.code : null;
  const message = typeof error?.message === "string" ? error.message : String(error);
  return (code ? code + ": " : "") + message.replace(/[\r\n\t]/g, " ").slice(0, 240);
}

export async function collectDnsRebindingObservations({
  hostname,
  hostnameForResolver,
  expectedAddresses,
  resolvers,
  queryDnsBatches,
}) {
  if (typeof hostname !== "string" || !hostname) {
    throw new TypeError("A DNS-rebinding hostname is required.");
  }
  if (!Array.isArray(expectedAddresses) || expectedAddresses.length !== 2) {
    throw new TypeError("Exactly two expected DNS-rebinding addresses are required.");
  }
  if (!Array.isArray(resolvers) || resolvers.length === 0) {
    throw new TypeError("At least one DNS resolver is required.");
  }
  if (!resolvers.some((resolver) => resolver.required !== false)) {
    throw new TypeError("At least one authoritative DNS preflight resolver must be required.");
  }
  if (typeof queryDnsBatches !== "function") {
    throw new TypeError("A DNS batch query function is required.");
  }
  if (resolvers.length > 1 && typeof hostnameForResolver !== "function") {
    throw new TypeError("A resolver-specific DNS-rebinding hostname factory is required when checking multiple resolvers.");
  }

  const resolverHostnames = resolvers.map((resolver, index) => {
    const value = typeof hostnameForResolver === "function"
      ? hostnameForResolver(resolver, index)
      : hostname;
    if (typeof value !== "string" || !value) {
      throw new TypeError("Every DNS resolver must receive a valid rebinding hostname.");
    }
    return value;
  });
  if (new Set(resolverHostnames).size !== resolverHostnames.length) {
    throw new TypeError("Every DNS resolver must receive a unique rebinding hostname.");
  }

  const expected = [...new Set(expectedAddresses)].sort();
  return Promise.all(resolvers.map(async (resolver, index) => {
    const resolverHostname = resolverHostnames[index];
    try {
      const records = await queryDnsBatches(resolver, resolverHostname, 12);
      const observed = [...new Set(records.map((record) => record.ip))].sort();
      assert.deepEqual(
        observed,
        expected,
        resolver.name + " must observe both configured DNS-rebinding A answers for " + resolverHostname + ".",
      );
      assert.ok(
        records.every((record) => Number.isFinite(record.ttl) && record.ttl <= 5),
        resolver.name + " must observe short-lived DNS answers for " + resolverHostname + ".",
      );
      return {
        resolver: resolver.name,
        hostname: resolverHostname,
        status: "verified",
        queries: records.length,
        answers: observed,
      };
    } catch (error) {
      if (resolver.required !== false) throw error;
      return {
        resolver: resolver.name,
        hostname: resolverHostname,
        status: "inconclusive",
        error: summarizeError(error),
      };
    }
  }));
}
