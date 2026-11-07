import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  GlobalRateLimiter,
  default as limiterWorker
} from "../workers/global-rate-limiter/src/index.mjs";
import {
  consumeGlobalRateLimit,
  globalRateLimitHeaders,
  GlobalRateLimiterUnavailableError
} from "../functions/lib/global-rate-limiter.mjs";
import {
  GLOBAL_RATE_IDLE_TTL_MS,
  GLOBAL_RATE_REQUESTS_PER_WINDOW,
  GLOBAL_RATE_WINDOW_MS
} from "../functions/lib/global-rate-limit-policy.mjs";

function createFakeDurableObjectContext() {
  let row = null;
  let alarm = null;
  let deleteAllCalls = 0;
  const calls = [];

  const sql = {
    exec(statement, ...values) {
      calls.push({ statement, values });
      const normalized = statement.trim().toUpperCase();
      if (normalized.startsWith("CREATE TABLE")) {
        return { toArray: () => [] };
      }
      if (normalized.startsWith("SELECT")) {
        return { toArray: () => row ? [{ ...row }] : [] };
      }
      if (normalized.startsWith("INSERT INTO")) {
        const [windowStartMs, updatedAtMs] = values;
        row = {
          singleton: 1,
          window_start_ms: windowStartMs,
          request_count: row && row.window_start_ms === windowStartMs
            ? row.request_count + 1
            : 1,
          updated_at_ms: updatedAtMs
        };
        return { toArray: () => [] };
      }
      if (normalized.startsWith("UPDATE")) {
        const [updatedAtMs] = values;
        if (row) {
          row.request_count += 1;
          row.updated_at_ms = updatedAtMs;
        }
        return { toArray: () => [] };
      }
      throw new Error("Unexpected fake SQLite statement: " + statement);
    }
  };

  return {
    calls,
    storage: {
      sql,
      async getAlarm() { return alarm; },
      async setAlarm(value) { alarm = value; },
      async deleteAll() {
        row = null;
        alarm = null;
        deleteAllCalls += 1;
      }
    },
    get state() { return row ? { ...row } : null; },
    get alarmAt() { return alarm; },
    get deleteAllCalls() { return deleteAllCalls; },
    async blockConcurrencyWhile(callback) { return callback(); }
  };
}

function consumeRequest(now = Date.now()) {
  return new Request("https://global-rate-limiter.internal/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ now })
  });
}

async function callLimiter(limiter, now) {
  return limiter.fetch(consumeRequest(now));
}

function createNamespace({ responseFactory, throwOnFetch = false } = {}) {
  const names = [];
  const requests = [];
  return {
    names,
    requests,
    namespace: {
      idFromName(name) {
        names.push(name);
        return { name };
      },
      get(id) {
        return {
          async fetch(url, init) {
            requests.push({ url, init, objectName: id.name });
            if (throwOnFetch) throw new Error("synthetic Durable Object outage");
            return responseFactory
              ? responseFactory(url, init, id.name)
              : Response.json({
                  allowed: true,
                  limit: 12,
                  remaining: 11,
                  resetAt: Math.floor(Date.now() / 1000) + 60,
                  resetAfterSeconds: 60,
                  retryAfterSeconds: 0
                });
          }
        };
      }
    }
  };
}

async function main() {
  // Durable Object's fixed-window counter.
  const ctx = createFakeDurableObjectContext();
  const limiter = new GlobalRateLimiter(ctx);
  const windowStart = Math.floor(Date.now() / GLOBAL_RATE_WINDOW_MS) * GLOBAL_RATE_WINDOW_MS + 1000;

  const allowed = [];
  for (let index = 0; index < GLOBAL_RATE_REQUESTS_PER_WINDOW; index += 1) {
    const response = await callLimiter(limiter, windowStart + index);
    assert.equal(response.status, 200);
    allowed.push(await response.json());
  }
  assert.equal(allowed.filter(result => result.allowed).length, 12);
  assert.equal(allowed[0].remaining, 11);
  assert.equal(allowed.at(-1).remaining, 0);

  const blockedResponse = await callLimiter(limiter, windowStart + 20);
  assert.equal(blockedResponse.status, 200);
  const blocked = await blockedResponse.json();
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.equal(blocked.resetAfterSeconds, blocked.retryAfterSeconds);
  assert.equal(ctx.state.request_count, 12, "Rejected requests must not increment the counter");

  // The next fixed window begins with a fresh allowance.
  const nextWindow = Math.ceil((windowStart + 1) / GLOBAL_RATE_WINDOW_MS) * GLOBAL_RATE_WINDOW_MS + 1;
  const nextResponse = await callLimiter(limiter, nextWindow);
  assert.equal(nextResponse.status, 200);
  const next = await nextResponse.json();
  assert.equal(next.allowed, true);
  assert.equal(next.remaining, 11);

  // Many concurrent calls to the same object cannot exceed the shared budget.
  const concurrentContext = createFakeDurableObjectContext();
  const concurrentLimiter = new GlobalRateLimiter(concurrentContext);
  const concurrentWindow = Math.floor(Date.now() / GLOBAL_RATE_WINDOW_MS) * GLOBAL_RATE_WINDOW_MS + 2_000;
  const concurrentResults = await Promise.all(
    Array.from({ length: 60 }, (_, index) => callLimiter(concurrentLimiter, concurrentWindow + index))
  );
  const concurrentBodies = await Promise.all(concurrentResults.map(response => response.json()));
  assert.equal(concurrentBodies.filter(result => result.allowed).length, 12);
  assert.equal(concurrentBodies.filter(result => !result.allowed).length, 48);
  assert.equal(concurrentContext.state.request_count, 12);

  // The object uses a bounded one-row store and schedules one idle cleanup alarm.
  assert.equal(concurrentContext.calls.filter(call => call.statement.trim().startsWith("CREATE TABLE")).length > 0, true);
  assert.equal(concurrentContext.alarmAt, concurrentWindow + GLOBAL_RATE_IDLE_TTL_MS);

  // Active clients are retained briefly; inactive clients have their entire DO storage deleted.
  const alarmContext = createFakeDurableObjectContext();
  const alarmLimiter = new GlobalRateLimiter(alarmContext);
  const alarmNow = Date.now();
  await callLimiter(alarmLimiter, alarmNow);
  const recentState = alarmContext.state;
  await alarmLimiter.alarm();
  assert.equal(alarmContext.deleteAllCalls, 0, "Recently active state must not be deleted");
  assert.equal(alarmContext.alarmAt, recentState.updated_at_ms + GLOBAL_RATE_IDLE_TTL_MS);

  alarmContext.storage.sql.exec(
    "UPDATE global_rate_limit_state SET updated_at_ms = ? WHERE singleton = 1",
    Date.now() - GLOBAL_RATE_IDLE_TTL_MS - 1
  );
  await alarmLimiter.alarm();
  assert.equal(alarmContext.deleteAllCalls, 1);
  assert.equal(alarmContext.state, null);
  assert.equal(alarmContext.alarmAt, null);

  // Internal DO endpoint rejects invalid routes, methods, oversized and malformed bodies.
  assert.equal((await limiter.fetch(new Request("https://x.invalid/not-consume", { method: "POST" }))).status, 404);
  assert.equal((await limiter.fetch(new Request("https://x.invalid/consume", { method: "GET" }))).status, 404);
  assert.equal((await limiter.fetch(new Request("https://x.invalid/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{"
  }))).status, 400);
  assert.equal((await limiter.fetch(new Request("https://x.invalid/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ now: Date.now(), extra: true })
  }))).status, 400);
  assert.equal((await limiter.fetch(new Request("https://x.invalid/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": "300" },
    body: JSON.stringify({ now: Date.now() })
  }))).status, 400);
  assert.equal(typeof limiterWorker.fetch, "function");

  // Pages integration: DO object names contain an HMAC digest, never a raw IP address.
  const hmacSecret = "synthetic-test-only-secret-with-more-than-32-bytes";
  const now = Date.now();
  const first = createNamespace();
  const request = new Request("https://preview.exportflow.me/api/track", {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.77" }
  });
  const result = await consumeGlobalRateLimit(request, {
    GLOBAL_RATE_LIMITER: first.namespace,
    GLOBAL_RATE_LIMITER_HMAC_SECRET: hmacSecret,
    EXPORTFLOW_ENV: "preview"
  }, { cryptoApi: webcrypto, now: () => now });

  assert.equal(result.allowed, true);
  assert.equal(result.limit, 12);
  assert.equal(first.names.length, 1);
  assert.match(first.names[0], /^v1:preview:/);
  assert.equal(first.names[0].includes("203.0.113.77"), false);
  assert.equal(first.requests.length, 1);
  assert.equal(first.requests[0].url, "https://global-rate-limiter.internal/consume");
  assert.deepEqual(JSON.parse(first.requests[0].init.body), { now });
  assert.equal(first.requests[0].init.body.includes("203.0.113.77"), false);

  // The same client has a stable ID in the same environment; prod and preview are isolated.
  const second = createNamespace();
  await consumeGlobalRateLimit(request, {
    GLOBAL_RATE_LIMITER: second.namespace,
    GLOBAL_RATE_LIMITER_HMAC_SECRET: hmacSecret,
    EXPORTFLOW_ENV: "preview"
  }, { cryptoApi: webcrypto, now: () => now });
  assert.equal(second.names[0], first.names[0]);

  const production = createNamespace();
  await consumeGlobalRateLimit(request, {
    GLOBAL_RATE_LIMITER: production.namespace,
    GLOBAL_RATE_LIMITER_HMAC_SECRET: hmacSecret,
    EXPORTFLOW_ENV: "production"
  }, { cryptoApi: webcrypto, now: () => now });
  assert.notEqual(production.names[0], first.names[0]);
  assert.match(production.names[0], /^v1:production:/);

  // A different client IP maps to a different object, but raw addresses never leave Pages.
  const otherIp = createNamespace();
  await consumeGlobalRateLimit(new Request(request.url, {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.88" }
  }), {
    GLOBAL_RATE_LIMITER: otherIp.namespace,
    GLOBAL_RATE_LIMITER_HMAC_SECRET: hmacSecret,
    EXPORTFLOW_ENV: "preview"
  }, { cryptoApi: webcrypto, now: () => now });
  assert.notEqual(otherIp.names[0], first.names[0]);

  // No DO binding is a deliberate staged rollout path; configured failures fail closed.
  assert.equal(await consumeGlobalRateLimit(request, {}, { cryptoApi: webcrypto }), null);
  await assert.rejects(
    () => consumeGlobalRateLimit(request, { GLOBAL_RATE_LIMITER: first.namespace }, { cryptoApi: webcrypto }),
    error => error instanceof GlobalRateLimiterUnavailableError &&
      error.code === "global_rate_limiter_not_configured"
  );

  const failed = createNamespace({ throwOnFetch: true });
  await assert.rejects(
    () => consumeGlobalRateLimit(request, {
      GLOBAL_RATE_LIMITER: failed.namespace,
      GLOBAL_RATE_LIMITER_HMAC_SECRET: hmacSecret
    }, { cryptoApi: webcrypto }),
    error => error instanceof GlobalRateLimiterUnavailableError &&
      error.code === "global_rate_limiter_unavailable"
  );

  const invalid = createNamespace({
    responseFactory: () => Response.json({
      allowed: true,
      limit: 999,
      remaining: 1,
      resetAt: 1,
      resetAfterSeconds: 1,
      retryAfterSeconds: 0
    })
  });
  await assert.rejects(
    () => consumeGlobalRateLimit(request, {
      GLOBAL_RATE_LIMITER: invalid.namespace,
      GLOBAL_RATE_LIMITER_HMAC_SECRET: hmacSecret
    }, { cryptoApi: webcrypto }),
    error => error instanceof GlobalRateLimiterUnavailableError &&
      error.code === "global_rate_limiter_invalid_response"
  );

  // RFC RateLimit metadata uses a delta in RateLimit-Reset and epoch in X-RateLimit-Reset.
  const headers = globalRateLimitHeaders({
    limit: 12,
    remaining: 0,
    resetAt: 1_800_000_060,
    resetAfterSeconds: 60,
    retryAfterSeconds: 60
  });
  assert.equal(headers["RateLimit-Limit"], "12");
  assert.equal(headers["RateLimit-Remaining"], "0");
  assert.equal(headers["RateLimit-Reset"], "60");
  assert.equal(headers["X-RateLimit-Reset"], "1800000060");
  assert.equal(headers["X-RateLimit-Scope"], "global-client");
  assert.equal(headers["Retry-After"], "60");

  console.log("Global Cloudflare Durable Object rate limiter tests passed.");
}

await main();
