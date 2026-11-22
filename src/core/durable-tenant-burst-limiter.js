const MAX_INTERNAL_BODY_CHARS = 1_024;
export const DEFAULT_TENANT_BURST_LIMIT = 60;
export const DEFAULT_TENANT_BURST_WINDOW_MS = 60_000;
const MAX_TENANT_BURST_WINDOW_MS = 3_600_000;

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function validLimiterConfig(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === 2 &&
    Number.isSafeInteger(value.limit) && value.limit >= 1 && value.limit <= 100_000 &&
    Number.isSafeInteger(value.windowMs) && value.windowMs >= 1_000 &&
    value.windowMs <= MAX_TENANT_BURST_WINDOW_MS;
}

function toRows(cursor) {
  if (!cursor || typeof cursor.toArray !== "function") {
    throw new TypeError("Durable Object SQL cursor does not support toArray().");
  }
  return cursor.toArray();
}

/**
 * A strict, persistent fixed-window counter for one tenant.
 * The single UPSERT ... RETURNING statement is the atomic allow/deny decision.
 */
export class TenantBurstRateLimiter {
  constructor(ctx) {
    const sql = ctx?.storage?.sql;
    if (!sql || typeof sql.exec !== "function") {
      throw new TypeError("TenantBurstRateLimiter requires SQLite-backed Durable Object storage.");
    }

    this.sql = sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS tenant_burst_window (
        singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
        requests INTEGER NOT NULL CHECK (requests >= 1),
        reset_at_ms INTEGER NOT NULL CHECK (reset_at_ms > 0)
      )
    `);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/consume") {
      return jsonResponse({ error: "not_found" }, 404);
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed" }, 405, { allow: "POST" });
    }

    let raw;
    try {
      raw = await request.text();
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    if (raw.length > MAX_INTERNAL_BODY_CHARS) {
      return jsonResponse({ error: "request_too_large" }, 413);
    }

    let config;
    try {
      config = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400);
    }
    if (!validLimiterConfig(config)) {
      return jsonResponse({ error: "invalid_limiter_config" }, 400);
    }

    const nowMs = Date.now();
    const nextResetAtMs = nowMs + config.windowMs;
    if (!Number.isSafeInteger(nextResetAtMs)) {
      return jsonResponse({ error: "invalid_limiter_config" }, 400);
    }

    try {
      const accepted = toRows(this.sql.exec(`
        INSERT INTO tenant_burst_window (singleton, requests, reset_at_ms)
        VALUES (1, 1, ?)
        ON CONFLICT(singleton) DO UPDATE SET
          requests = CASE
            WHEN tenant_burst_window.reset_at_ms <= ? THEN 1
            ELSE tenant_burst_window.requests + 1
          END,
          reset_at_ms = CASE
            WHEN tenant_burst_window.reset_at_ms <= ? THEN excluded.reset_at_ms
            ELSE tenant_burst_window.reset_at_ms
          END
        WHERE tenant_burst_window.reset_at_ms <= ?
           OR tenant_burst_window.requests < ?
        RETURNING requests, reset_at_ms
      `, nextResetAtMs, nowMs, nowMs, nowMs, config.limit));

      if (accepted.length === 1) {
        const row = accepted[0];
        const requests = Number(row.requests);
        const resetAtMs = Number(row.reset_at_ms);
        if (!Number.isSafeInteger(requests) || !Number.isSafeInteger(resetAtMs)) {
          throw new TypeError("Durable Object returned an invalid rate-limit row.");
        }
        return jsonResponse({
          allowed: true,
          remaining: Math.max(0, config.limit - requests),
          resetAtMs,
        });
      }

      const currentRows = toRows(this.sql.exec(
        "SELECT requests, reset_at_ms FROM tenant_burst_window WHERE singleton = 1",
      ));
      const current = currentRows[0];
      if (!current) throw new Error("Tenant burst counter row disappeared.");

      const resetAtMs = Number(current.reset_at_ms);
      if (!Number.isSafeInteger(resetAtMs)) {
        throw new TypeError("Durable Object returned an invalid reset timestamp.");
      }
      const retryAfterSec = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1_000));
      return jsonResponse({
        allowed: false,
        remaining: 0,
        resetAtMs,
        retryAfterSec,
      }, 200, { "retry-after": String(retryAfterSec) });
    } catch {
      return jsonResponse({ error: "rate_limiter_unavailable" }, 503);
    }
  }
}

async function durableObjectNameForTenant(tenantId) {
  if (typeof tenantId !== "string" || tenantId.length < 1 || tenantId.length > 256) {
    throw new TypeError("Tenant ID must be a non-empty string of at most 256 characters.");
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is unavailable.");
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode("exportflow:tenant-burst:v1\0" + tenantId),
  );
  return "tenant-v1-" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Async adapter for the shared tenant gateway. Callers must await check()
 * and fail closed if it throws; no isolate-local fallback is provided.
 */
export function createDurableTenantBurstLimiter(namespace, {
  limit = DEFAULT_TENANT_BURST_LIMIT,
  windowMs = DEFAULT_TENANT_BURST_WINDOW_MS,
} = {}) {
  if (!namespace || typeof namespace.idFromName !== "function" || typeof namespace.get !== "function") {
    throw new TypeError("A Durable Object namespace binding is required.");
  }
  if (!validLimiterConfig({ limit, windowMs })) {
    throw new TypeError("Invalid tenant burst-limit configuration.");
  }

  return Object.freeze({
    async check(tenantId) {
      const objectName = await durableObjectNameForTenant(tenantId);
      const id = namespace.idFromName(objectName);
      const stub = namespace.get(id);
      if (!stub || typeof stub.fetch !== "function") {
        throw new TypeError("Durable Object namespace returned an invalid stub.");
      }

      const response = await stub.fetch(new Request("https://tenant-burst.internal/consume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit, windowMs }),
      }));
      if (!response || !response.ok) {
        throw new Error("Durable tenant burst limiter is unavailable.");
      }

      const decision = await response.json();
      if (!decision || typeof decision.allowed !== "boolean" ||
          !Number.isSafeInteger(decision.remaining) || decision.remaining < 0 ||
          !Number.isSafeInteger(decision.resetAtMs) || decision.resetAtMs < 1) {
        throw new Error("Durable tenant burst limiter returned an invalid decision.");
      }
      if (!decision.allowed) {
        if (!Number.isSafeInteger(decision.retryAfterSec) || decision.retryAfterSec < 1) {
          throw new Error("Durable tenant burst limiter returned invalid retry metadata.");
        }
        return {
          allowed: false,
          remaining: 0,
          resetAtMs: decision.resetAtMs,
          retryAfterSec: decision.retryAfterSec,
        };
      }
      return {
        allowed: true,
        remaining: decision.remaining,
        resetAtMs: decision.resetAtMs,
      };
    },
  });
}
