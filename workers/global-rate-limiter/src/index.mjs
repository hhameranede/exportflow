import {
  GLOBAL_RATE_IDLE_TTL_MS,
  GLOBAL_RATE_REQUESTS_PER_WINDOW,
  GLOBAL_RATE_WINDOW_MS
} from "../../../functions/lib/global-rate-limit-policy.mjs";

const MAX_BODY_BYTES = 256;
const CREATE_STATE_SQL = `
  CREATE TABLE IF NOT EXISTS global_rate_limit_state (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    window_start_ms INTEGER NOT NULL,
    request_count INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
  )
`;
const SELECT_STATE_SQL = `
  SELECT window_start_ms, request_count, updated_at_ms
  FROM global_rate_limit_state
  WHERE singleton = 1
  LIMIT 1
`;
const INSERT_STATE_SQL = `
  INSERT INTO global_rate_limit_state
    (singleton, window_start_ms, request_count, updated_at_ms)
  VALUES (1, ?, 1, ?)
  ON CONFLICT(singleton) DO UPDATE SET
    window_start_ms = excluded.window_start_ms,
    request_count = CASE
      WHEN global_rate_limit_state.window_start_ms = excluded.window_start_ms
        THEN global_rate_limit_state.request_count + 1
      ELSE 1
    END,
    updated_at_ms = excluded.updated_at_ms
`;
const UPDATE_STATE_SQL = `
  UPDATE global_rate_limit_state
  SET request_count = request_count + 1,
      updated_at_ms = ?
  WHERE singleton = 1
`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function readBoundedJson(request) {
  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return null;
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > MAX_BODY_BYTES || !request.body) return null;

  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

export class GlobalRateLimiter {
  constructor(ctx) {
    this.ctx = ctx;
    this.cleanupPromise = null;
  }

  ensureSchema() {
    this.ctx.storage.sql.exec(CREATE_STATE_SQL);
  }

  async ensureCleanupAlarm(now) {
    if (!this.cleanupPromise) {
      this.cleanupPromise = (async () => {
        const existing = await this.ctx.storage.getAlarm();
        if (existing === null) {
          await this.ctx.storage.setAlarm(now + GLOBAL_RATE_IDLE_TTL_MS);
        }
      })().catch(error => {
        this.cleanupPromise = null;
        throw error;
      });
    }
    await this.cleanupPromise;
  }

  consume(now) {
    this.ensureSchema();

    const currentWindowStart = Math.floor(now / GLOBAL_RATE_WINDOW_MS) * GLOBAL_RATE_WINDOW_MS;
    const rows = this.ctx.storage.sql.exec(SELECT_STATE_SQL).toArray();
    const state = rows[0] || null;

    if (
      state &&
      state.window_start_ms === currentWindowStart &&
      state.request_count >= GLOBAL_RATE_REQUESTS_PER_WINDOW
    ) {
      const resetAt = Math.floor((currentWindowStart + GLOBAL_RATE_WINDOW_MS) / 1000);
      return {
        allowed: false,
        limit: GLOBAL_RATE_REQUESTS_PER_WINDOW,
        remaining: 0,
        resetAt,
        resetAfterSeconds: Math.max(1, resetAt - Math.floor(now / 1000)),
        retryAfterSeconds: Math.max(1, resetAt - Math.floor(now / 1000))
      };
    }

    if (state && state.window_start_ms === currentWindowStart) {
      this.ctx.storage.sql.exec(UPDATE_STATE_SQL, now);
    } else {
      this.ctx.storage.sql.exec(INSERT_STATE_SQL, currentWindowStart, now);
    }

    const updated = this.ctx.storage.sql.exec(SELECT_STATE_SQL).toArray()[0];
    const resetAt = Math.floor((currentWindowStart + GLOBAL_RATE_WINDOW_MS) / 1000);
    return {
      allowed: true,
      limit: GLOBAL_RATE_REQUESTS_PER_WINDOW,
      remaining: Math.max(0, GLOBAL_RATE_REQUESTS_PER_WINDOW - updated.request_count),
      resetAt,
      resetAfterSeconds: Math.max(0, resetAt - Math.floor(now / 1000)),
      retryAfterSeconds: 0
    };
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/consume") {
      return json({ error: "not_found" }, 404);
    }

    const payload = await readBoundedJson(request);
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      Object.keys(payload).length !== 1 ||
      !Number.isSafeInteger(payload.now) ||
      payload.now < 0
    ) {
      return json({ error: "invalid_request" }, 400);
    }

    try {
      await this.ensureCleanupAlarm(payload.now);
      return json(this.consume(payload.now));
    } catch {
      // Fail closed. The Pages Function turns this into 503 instead of bypassing
      // a global quota when the coordinator or its storage is unavailable.
      return json({ error: "rate_limiter_unavailable" }, 503);
    }
  }

  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      this.ensureSchema();
      const rows = this.ctx.storage.sql.exec(SELECT_STATE_SQL).toArray();
      const state = rows[0] || null;
      const now = Date.now();

      if (state && now - state.updated_at_ms < GLOBAL_RATE_IDLE_TTL_MS) {
        await this.ctx.storage.setAlarm(state.updated_at_ms + GLOBAL_RATE_IDLE_TTL_MS);
        this.cleanupPromise = null;
        return;
      }

      // The object stores only a short-lived pseudonymous rate counter. Delete
      // the complete SQLite storage after inactivity so client hashes do not
      // become a permanent activity database.
      await this.ctx.storage.deleteAll();
      this.cleanupPromise = null;
    });
  }
}

export default {
  async fetch() {
    // The worker has no public HTTP API. Pages Functions reach the class only
    // through the bound Durable Object namespace.
    return json({ error: "not_found" }, 404);
  }
};
