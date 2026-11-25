import { getAuthInstance, getAuthFeatureStatus } from "./auth-app.js";
import { readBoundedJsonBody, TaskContractError, validateTaskRequest } from "./task-contract.js";
import { chooseExecutionPath } from "./router.js";
import { executeWebTask } from "./tasks.js";

const MAX_ACTIVE_KEYS_PER_USER = 10;
const MAX_HISTORY_ROWS = 25;
const ALLOWED_KEY_SCOPES = new Set(["tasks:fetch", "workspace:read"]);

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(digest);
}

function randomHex(byteCount) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isSameOriginMutation(request, env = {}) {
  const originHeader = request.headers.get("origin");
  if (!originHeader) return false;
  let origin;
  try {
    origin = new URL(originHeader).origin;
  } catch {
    return false;
  }
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protoHeader = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  if (hostHeader) {
    const derivedOrigin = `${protoHeader}://${hostHeader}`;
    if (origin === derivedOrigin) return true;
  }
  if (typeof env.BETTER_AUTH_URL === "string" && env.BETTER_AUTH_URL.trim()) {
    try {
      if (origin === new URL(env.BETTER_AUTH_URL.trim()).origin) return true;
    } catch {
      // Ignore malformed BETTER_AUTH_URL
    }
  }
  if (env.LOCAL_DEV_RUNTIME === true) {
    try {
      const parsed = new URL(origin);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname.endsWith(".run.app")) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

async function ensureWorkspaceSchema(db) {
  if (!db || typeof db.prepare !== "function") return false;
  if (typeof db.exec === "function") {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        scopes_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        revoked_at TEXT
      );
      CREATE TABLE IF NOT EXISTS workspace_executions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        goal TEXT NOT NULL,
        requested_url TEXT NOT NULL,
        operation TEXT NOT NULL,
        mode TEXT NOT NULL,
        adapter_id TEXT,
        state TEXT NOT NULL,
        http_status INTEGER,
        duration_ms INTEGER,
        response_bytes INTEGER,
        final_url TEXT,
        error_code TEXT,
        created_at TEXT NOT NULL
      );
    `);
    return true;
  }
  try {
    await db.prepare("SELECT id FROM workspace_api_keys LIMIT 0").first();
    await db.prepare("SELECT id FROM workspace_executions LIMIT 0").first();
    return true;
  } catch {
    return false;
  }
}

async function requireAuthenticatedSession(request, env) {
  const status = getAuthFeatureStatus(env);
  if (!status.authConfigured) {
    return { ok: false, response: json({ error: { code: "AUTH_NOT_CONFIGURED", message: "Workspace authentication is not configured." } }, 503) };
  }
  const auth = getAuthInstance(env);
  if (!auth) {
    return { ok: false, response: json({ error: { code: "AUTH_NOT_CONFIGURED", message: "Workspace authentication is unavailable." } }, 503) };
  }
  let session;
  try {
    session = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true },
    });
  } catch {
    return { ok: false, response: json({ error: { code: "AUTH_SESSION_UNAVAILABLE", message: "Unable to verify user session." } }, 503) };
  }
  if (!session?.user?.id || !session?.session?.id) {
    return { ok: false, response: json({ error: { code: "UNAUTHORIZED", message: "Sign in is required to access ExportFlow workspace features." } }, 401) };
  }
  if (session.user.emailVerified !== true) {
    return { ok: false, response: json({ error: { code: "EMAIL_VERIFICATION_REQUIRED", message: "Verify your email address before using workspace features." } }, 403) };
  }
  return { ok: true, session };
}

function taskStatusToHttp(task) {
  if (task.state === "unsupported") return 501;
  if (task.state === "failed" || task.state === "cancelled") {
    const code = task.result?.data?.errorCode || task.errors?.[0]?.code;
    if (code === "URL_NOT_ALLOWED" || code === "INVALID_TASK" || code === "INVALID_GOAL" || code === "INVALID_LIMIT") return 400;
    if (code === "RESPONSE_TOO_LARGE") return 413;
    if (code === "UNSUPPORTED_CONTENT_TYPE" || code === "UNSUPPORTED_CHARSET") return 415;
    if (code === "TASK_TIMEOUT" || code === "UPSTREAM_TIMEOUT") return 504;
    return 502;
  }
  return 200;
}

export async function handleWorkspaceRequest(request, env = {}, options = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/v1/workspace")) return null;

  if (request.method !== "GET" && request.method !== "POST" && request.method !== "DELETE") {
    return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, 405, { allow: "GET, POST, DELETE" });
  }

  if ((request.method === "POST" || request.method === "DELETE") && !isSameOriginMutation(request, env)) {
    return json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "Cross-origin workspace mutation is not allowed." } }, 403);
  }

  const authCheck = await requireAuthenticatedSession(request, env);
  if (!authCheck.ok) return authCheck.response;

  const { user } = authCheck.session;
  const db = env.AUTH_DB;
  const schemaOk = await ensureWorkspaceSchema(db);
  if (!schemaOk) {
    return json({ error: { code: "WORKSPACE_STORAGE_UNAVAILABLE", message: "Workspace storage tables are not initialized." } }, 503);
  }

  if (url.pathname === "/api/v1/workspace/overview" && request.method === "GET") {
    const [keyStats, execStats] = await Promise.all([
      db.prepare(
        "SELECT COUNT(*) AS activeCount FROM workspace_api_keys WHERE user_id = ?1 AND revoked_at IS NULL",
      ).bind(user.id).first(),
      db.prepare(
        "SELECT COUNT(*) AS totalCount, COALESCE(SUM(CASE WHEN state = 'succeeded' THEN 1 ELSE 0 END), 0) AS succeededCount FROM workspace_executions WHERE user_id = ?1",
      ).bind(user.id).first(),
    ]);
    return json({
      user: {
        id: user.id,
        name: user.name || "",
        email: user.email || "",
        emailVerified: user.emailVerified === true,
        twoFactorEnabled: user.twoFactorEnabled === true,
        createdAt: user.createdAt || null,
      },
      stats: {
        activeKeys: Number(keyStats?.activeCount || 0),
        totalExecutions: Number(execStats?.totalCount || 0),
        succeededExecutions: Number(execStats?.succeededCount || 0),
      },
      bounds: {
        timeoutMsMax: 8000,
        maxBytesMax: 1048576,
        maxRedirectsMax: 3,
      },
    });
  }

  if (url.pathname === "/api/v1/workspace/keys") {
    if (request.method === "GET") {
      const rows = await db.prepare(
        "SELECT id, name, key_prefix, scopes_json, created_at, last_used_at, revoked_at FROM workspace_api_keys WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 30",
      ).bind(user.id).all();
      const keys = (rows?.results || []).map((row) => ({
        id: row.id,
        name: row.name,
        keyPrefix: row.key_prefix,
        scopes: (() => { try { return JSON.parse(row.scopes_json); } catch { return ["tasks:fetch"]; } })(),
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        revokedAt: row.revoked_at,
      }));
      return json({ keys });
    }

    if (request.method === "POST") {
      let body;
      try {
        body = await readBoundedJsonBody(request, 2048);
      } catch (error) {
        if (error instanceof TaskContractError) {
          return json({ error: { code: error.code, message: error.message } }, error.httpStatus);
        }
        return json({ error: { code: "INVALID_JSON", message: "Invalid JSON body." } }, 400);
      }

      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 60) {
        return json({ error: { code: "INVALID_KEY_NAME", message: "Key name must be 2 to 60 characters." } }, 400);
      }

      const requestedScopes = Array.isArray(body?.scopes) && body.scopes.length
        ? body.scopes.filter((s) => typeof s === "string" && ALLOWED_KEY_SCOPES.has(s))
        : ["tasks:fetch"];
      const scopes = requestedScopes.length ? [...new Set(requestedScopes)] : ["tasks:fetch"];

      const countRow = await db.prepare(
        "SELECT COUNT(*) AS activeCount FROM workspace_api_keys WHERE user_id = ?1 AND revoked_at IS NULL",
      ).bind(user.id).first();
      if (Number(countRow?.activeCount || 0) >= MAX_ACTIVE_KEYS_PER_USER) {
        return json({ error: { code: "KEY_LIMIT_REACHED", message: "Revoke an unused key before creating another (max 10 active keys)." } }, 400);
      }

      const id = crypto.randomUUID();
      const keyId = randomHex(8);
      const secretPart = randomHex(20);
      const rawKey = `ef_ws_${keyId}_${secretPart}`;
      const keyPrefix = `ef_ws_${keyId}_••••${secretPart.slice(-4)}`;
      const keyHash = await sha256Hex(rawKey);
      const createdAt = new Date().toISOString();

      await db.prepare(
        "INSERT INTO workspace_api_keys (id, user_id, name, key_prefix, key_hash, scopes_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      ).bind(id, user.id, name, keyPrefix, keyHash, JSON.stringify(scopes), createdAt).run();

      return json({
        key: { id, name, keyPrefix, scopes, createdAt, revokedAt: null },
        rawKey,
      }, 201);
    }

    if (request.method === "DELETE") {
      const id = url.searchParams.get("id") || "";
      if (!id) {
        return json({ error: { code: "INVALID_KEY_ID", message: "Key id query parameter is required." } }, 400);
      }
      const revokedAt = new Date().toISOString();
      const result = await db.prepare(
        "UPDATE workspace_api_keys SET revoked_at = ?1 WHERE id = ?2 AND user_id = ?3 AND revoked_at IS NULL",
      ).bind(revokedAt, id, user.id).run();
      if (!result?.meta?.changes) {
        return json({ error: { code: "KEY_NOT_FOUND", message: "Active API key not found." } }, 404);
      }
      return json({ revoked: true, id, revokedAt });
    }
  }

  if (url.pathname === "/api/v1/workspace/history") {
    if (request.method === "GET") {
      const rows = await db.prepare(
        `SELECT id, goal, requested_url, operation, mode, adapter_id, state, http_status, duration_ms, response_bytes, final_url, error_code, created_at FROM workspace_executions WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ${MAX_HISTORY_ROWS}`,
      ).bind(user.id).all();
      return json({ executions: rows?.results || [] });
    }
    if (request.method === "DELETE") {
      await db.prepare("DELETE FROM workspace_executions WHERE user_id = ?1").bind(user.id).run();
      return json({ cleared: true });
    }
  }

  if (url.pathname === "/api/v1/workspace/execute" && request.method === "POST") {
    let payload;
    try {
      payload = await readBoundedJsonBody(request);
    } catch (error) {
      if (error instanceof TaskContractError) {
        return json({ error: { code: error.code, message: error.message } }, error.httpStatus);
      }
      return json({ error: { code: "INVALID_JSON", message: "Invalid JSON body." } }, 400);
    }

    const mode = payload?.mode === "simulate" ? "simulate" : "live";
    const contractPayload = payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...payload }
      : payload;
    if (contractPayload && typeof contractPayload === "object") {
      delete contractPayload.mode;
    }

    let contract;
    try {
      contract = validateTaskRequest(contractPayload);
    } catch (error) {
      if (error instanceof TaskContractError) {
        return json({ error: { code: error.code, message: error.message } }, error.httpStatus);
      }
      return json({ error: { code: "INVALID_TASK", message: "Task request validation failed." } }, 400);
    }

    let task;
    let httpStatus;
    if (mode === "simulate") {
      const decision = chooseExecutionPath();
      const nowIso = new Date().toISOString();
      const id = options.idFactory ? options.idFactory() : crypto.randomUUID();
      const supported = contract.operation === "fetch";
      if (!supported) {
        const errorCode = "OPERATION_NOT_ENABLED";
        task = {
          id,
          goal: contract.goal,
          requestedUrl: contract.url,
          state: "unsupported",
          execution: {
            path: decision.path,
            operation: contract.operation,
            adapterId: null,
            reason: decision.reason,
          },
          timestamps: { createdAt: nowIso, startedAt: nowIso, completedAt: nowIso },
          usage: { durationMs: 0, requestsAttempted: 0, responseBytes: 0, cost: null },
          errors: [{ code: errorCode, message: "Only the Fetch operation is enabled on this workspace execution endpoint." }],
          result: { status: "unsupported", data: null, sources: [], warnings: ["Dry-run policy verification — 0 external requests."] },
        };
        httpStatus = 501;
      } else {
        task = {
          id,
          goal: contract.goal,
          requestedUrl: contract.url,
          state: "succeeded",
          execution: {
            path: decision.path,
            operation: contract.operation,
            adapterId: "http.fetch.v1",
            reason: "Policy and routing checks passed in dry-run simulation mode.",
          },
          timestamps: { createdAt: nowIso, startedAt: nowIso, completedAt: nowIso },
          usage: { durationMs: 1, requestsAttempted: 0, responseBytes: 0, cost: null },
          errors: [],
          result: {
            status: "succeeded",
            data: { simulated: true, finalUrl: contract.url, limits: contract.limits },
            sources: [{ url: contract.url, retrievedAt: nowIso, evidence: [{ type: "policy_simulation", status: 200 }] }],
            warnings: ["Dry-run policy verification — switch to Live Execution to send a bounded outbound fetch."],
          },
        };
        httpStatus = 200;
      }
    } else {
      task = await executeWebTask(contract, {
        fetchImpl: options.fetchImpl,
        now: options.now,
        idFactory: options.idFactory,
        taskTimeoutMs: options.taskTimeoutMs,
        signal: request.signal,
      });
      httpStatus = taskStatusToHttp(task);
    }

    const recordId = task.id || crypto.randomUUID();
    const errorCode = task.errors?.[0]?.code || task.result?.data?.errorCode || null;
    const finalUrl = task.result?.data?.finalUrl || null;
    const upstreamHttp = typeof task.result?.data?.httpStatus === "number" ? task.result.data.httpStatus : httpStatus;

    await db.prepare(
      "INSERT INTO workspace_executions (id, user_id, goal, requested_url, operation, mode, adapter_id, state, http_status, duration_ms, response_bytes, final_url, error_code, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
    ).bind(
      recordId,
      user.id,
      contract.goal.slice(0, 200),
      contract.url,
      contract.operation,
      mode,
      task.execution?.adapterId || null,
      task.state,
      upstreamHttp,
      Number(task.usage?.durationMs || 0),
      Number(task.usage?.responseBytes || 0),
      finalUrl,
      errorCode,
      new Date().toISOString(),
    ).run();

    return json({
      mode,
      httpStatus,
      execution: task,
    }, httpStatus);
  }

  return json({ error: { code: "NOT_FOUND", message: "Workspace endpoint not found." } }, 404);
}
