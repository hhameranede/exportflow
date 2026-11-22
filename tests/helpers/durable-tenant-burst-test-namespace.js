import { TenantBurstRateLimiter } from "../../src/core/durable-tenant-burst-limiter.js";

// Deterministic SQLite SQL shim around the real DO class; not Cloudflare runtime proof.
export function createDurableTenantBurstTestNamespace() {
  const objects = new Map();
  function createStorage() {
    let row = null;
    return { sql: { exec(statement, ...params) {
      if (statement.includes("CREATE TABLE")) return { toArray: () => [] };
      if (statement.includes("INSERT INTO tenant_burst_window")) {
        const [nextResetAtMs, _firstNow, _secondNow, nowMs, limit] = params;
        if (!row || row.resetAtMs <= nowMs) {
          row = { requests: 1, resetAtMs: nextResetAtMs };
          return { toArray: () => [{ requests: 1, reset_at_ms: nextResetAtMs }] };
        }
        if (row.requests < limit) {
          row.requests += 1;
          return { toArray: () => [{ requests: row.requests, reset_at_ms: row.resetAtMs }] };
        }
        return { toArray: () => [] };
      }
      if (statement.includes("SELECT requests, reset_at_ms")) {
        return { toArray: () => row ? [{ requests: row.requests, reset_at_ms: row.resetAtMs }] : [] };
      }
      throw new Error("Unexpected SQL in Durable Object test namespace.");
    } } };
  }
  return Object.freeze({
    idFromName(name) { return Object.freeze({ name }); },
    get(id) {
      if (!id || typeof id.name !== "string") throw new TypeError("Invalid test Durable Object ID.");
      let instance = objects.get(id.name);
      if (!instance) { instance = new TenantBurstRateLimiter({ storage: createStorage() }); objects.set(id.name, instance); }
      return Object.freeze({ async fetch(request) { return instance.fetch(request); } });
    },
  });
}
