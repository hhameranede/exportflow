import assert from "node:assert/strict";
import test from "node:test";
import {
  createDurableTenantBurstLimiter,
  TenantBurstRateLimiter,
} from "../src/core/durable-tenant-burst-limiter.js";

function makeSqlStorage() {
  let row = null;
  const calls = [];
  const sql = {
    exec(statement, ...params) {
      calls.push({ statement, params });
      if (statement.includes("CREATE TABLE")) return { toArray: () => [] };
      if (statement.includes("INSERT INTO tenant_burst_window")) {
        const [nextResetAtMs, _firstNow, _secondNow, whereNow, limit] = params;
        if (!row || row.resetAtMs <= whereNow) {
          row = { requests: 1, resetAtMs: nextResetAtMs };
          return { toArray: () => [{ requests: row.requests, reset_at_ms: row.resetAtMs }] };
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
      throw new Error("Unexpected SQL statement in test fixture.");
    },
  };
  return { sql, calls, get row() { return row; } };
}

function makeRequest(body, { method = "POST", path = "/consume" } = {}) {
  return new Request("https://tenant-burst.internal" + path, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
}

async function withFakeNow(value, run) {
  const original = Date.now;
  Date.now = () => value;
  try {
    return await run();
  } finally {
    Date.now = original;
  }
}

function makeDurableLimiterNamespace() {
  const names = [];
  const buckets = new Map();
  const namespace = {
    idFromName(name) {
      names.push(name);
      return { name };
    },
    get(id) {
      let object = buckets.get(id.name);
      if (!object) {
        const storage = makeSqlStorage();
        const instance = new TenantBurstRateLimiter({ storage });
        object = { instance, storage };
        buckets.set(id.name, object);
      }
      return {
        async fetch(request) {
          return object.instance.fetch(request);
        },
      };
    },
  };
  return { namespace, names, buckets };
}

test("Durable Object accepts exactly the configured number of requests in a fixed window", async () => {
  const storage = makeSqlStorage();
  const limiter = new TenantBurstRateLimiter({ storage });
  await withFakeNow(1_000, async () => {
    const decisions = [];
    for (let i = 0; i < 4; i++) {
      const response = await limiter.fetch(makeRequest(JSON.stringify({ limit: 3, windowMs: 60_000 })));
      decisions.push({ status: response.status, body: await response.json() });
    }
    assert.deepEqual(decisions.map((item) => item.body.allowed), [true, true, true, false]);
    assert.deepEqual(decisions.slice(0, 3).map((item) => item.body.remaining), [2, 1, 0]);
    assert.equal(decisions[3].body.retryAfterSec, 60);
    assert.equal(decisions[3].status, 200);
    assert.equal(storage.row.requests, 3);
  });
});

test("Durable Object resets the stored counter at the exact window boundary", async () => {
  const limiter = new TenantBurstRateLimiter({ storage: makeSqlStorage() });
  await withFakeNow(5_000, async () => {
    const first = await limiter.fetch(makeRequest(JSON.stringify({ limit: 1, windowMs: 10_000 })));
    assert.equal((await first.json()).allowed, true);
  });
  await withFakeNow(14_999, async () => {
    const blocked = await limiter.fetch(makeRequest(JSON.stringify({ limit: 1, windowMs: 10_000 })));
    assert.equal((await blocked.json()).allowed, false);
  });
  await withFakeNow(15_000, async () => {
    const reset = await limiter.fetch(makeRequest(JSON.stringify({ limit: 1, windowMs: 10_000 })));
    const body = await reset.json();
    assert.equal(body.allowed, true);
    assert.equal(body.remaining, 0);
    assert.equal(body.resetAtMs, 25_000);
  });
});

test("concurrent calls against one Durable Object cannot over-allocate the fixed window", async () => {
  const limiter = new TenantBurstRateLimiter({ storage: makeSqlStorage() });
  await withFakeNow(10_000, async () => {
    const responses = await Promise.all(Array.from({ length: 30 }, () =>
      limiter.fetch(makeRequest(JSON.stringify({ limit: 7, windowMs: 60_000 }))),
    ));
    const bodies = await Promise.all(responses.map((response) => response.json()));
    assert.equal(bodies.filter((body) => body.allowed).length, 7);
    assert.equal(bodies.filter((body) => !body.allowed).length, 23);
  });
});

test("Durable Object rejects unsupported methods, paths, malformed JSON, and invalid config", async () => {
  const limiter = new TenantBurstRateLimiter({ storage: makeSqlStorage() });
  assert.equal((await limiter.fetch(makeRequest(undefined, { method: "GET" }))).status, 405);
  assert.equal((await limiter.fetch(makeRequest("{}", { path: "/other" }))).status, 404);
  assert.equal((await limiter.fetch(makeRequest("{"))).status, 400);
  assert.equal((await limiter.fetch(makeRequest(JSON.stringify({ limit: 0, windowMs: 60_000 })))).status, 400);
  assert.equal((await limiter.fetch(makeRequest(JSON.stringify({ limit: 1, windowMs: 60_000, tenantId: "spoof" })))).status, 400);
});

test("Durable Object storage failures during a request fail closed with HTTP 503", async () => {
  const storage = makeSqlStorage();
  const limiter = new TenantBurstRateLimiter({ storage });
  storage.sql.exec = () => { throw new Error("synthetic storage failure"); };

  const response = await limiter.fetch(makeRequest(JSON.stringify({ limit: 1, windowMs: 60_000 })));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "rate_limiter_unavailable" });
});

test("adapter hashes tenant identity, reuses one object per tenant, and does not send the raw tenant ID", async () => {
  const fixture = makeDurableLimiterNamespace();
  const limiter = createDurableTenantBurstLimiter(fixture.namespace, { limit: 12, windowMs: 30_000 });
  const first = await limiter.check("tenant_alpha");
  const second = await limiter.check("tenant_alpha");
  await limiter.check("tenant_beta");

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(fixture.names.length, 3);
  assert.equal(fixture.names[0], fixture.names[1]);
  assert.notEqual(fixture.names[0], fixture.names[2]);
  assert.equal(fixture.names.some((name) => name.includes("tenant_alpha") || name.includes("tenant_beta")), false);
  assert.equal(fixture.buckets.size, 2);
  const sqlCalls = [...fixture.buckets.values()].flatMap((item) => item.storage.calls);
  assert.equal(sqlCalls.some((call) => call.params.includes("tenant_alpha") || call.params.includes("tenant_beta")), false);
});

test("adapter reports a blocked decision and propagates backend failures for fail-closed callers", async () => {
  const fixture = makeDurableLimiterNamespace();
  const limiter = createDurableTenantBurstLimiter(fixture.namespace, { limit: 1 });
  await limiter.check("tenant_alpha");
  const blocked = await limiter.check("tenant_alpha");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSec >= 1);

  const unavailable = createDurableTenantBurstLimiter({
    idFromName: () => "id",
    get: () => ({ async fetch() { return new Response("down", { status: 503 }); } }),
  });
  await assert.rejects(() => unavailable.check("tenant_alpha"), /unavailable/);
});

test("adapter validates namespace, tenant identity, and configuration", async () => {
  assert.throws(() => createDurableTenantBurstLimiter(null), /namespace binding/);
  assert.throws(() => createDurableTenantBurstLimiter({ idFromName() {}, get() {} }, { limit: 0 }), /configuration/);
  const limiter = createDurableTenantBurstLimiter({ idFromName() {}, get() {} });
  await assert.rejects(() => limiter.check(""), /Tenant ID/);
});
