import { getQuotaWindow } from "./plan-quota.js";

export const TASK_RESULT_MAX_BYTES = 1_500_000;
export const TASK_RESULT_RETENTION_MS = 24 * 60 * 60 * 1000;
const TASK_LEASE_MS = 3 * 60 * 1000;
const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7E]{8,128}$/;
const TERMINAL_STATES = new Set(["partial", "succeeded", "failed", "cancelled", "expired", "unsupported"]);
const TASK_STATES = new Set(["accepted", "running", ...TERMINAL_STATES]);

export class DurableTaskStoreError extends Error {
  constructor(code, message, httpStatus = 503, extra = {}) {
    super(message);
    this.name = "DurableTaskStoreError";
    this.code = code;
    this.httpStatus = httpStatus;
    Object.assign(this, extra);
  }
}

function requireDatabase(db) {
  if (!db || typeof db.prepare !== "function") {
    throw new DurableTaskStoreError("TASK_STORE_UNAVAILABLE", "Task storage is not configured.");
  }
  return db;
}

function timestampValue(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError("Task clock must return a valid date.");
  }
  return date.toISOString();
}

function makeId() {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new DurableTaskStoreError("TASK_ID_UNAVAILABLE", "Secure task ID generation is unavailable.");
  return value;
}

function stableValue(value, root = false) {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .filter((key) => !(root && key === "goal"))
      .sort()
      .map((key) => [key, stableValue(value[key])]);
    return Object.fromEntries(entries);
  }
  return value;
}

function toHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  if (!globalThis.crypto?.subtle?.digest) {
    throw new DurableTaskStoreError("TASK_CRYPTO_UNAVAILABLE", "Secure task hashing is unavailable.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

async function canonicalTaskInput(input) {
  const value = { ...input };
  delete value.goal;
  value.operation = value.operation || "fetch";
  value.cacheMode = value.cacheMode || "default";
  if (typeof value.url === "string") {
    try { value.url = new URL(value.url).href; } catch { /* Contract validation reports invalid URLs upstream. */ }
  }
  if (typeof value.query === "string") value.query = value.query.trim();
  if (value.operation === "search" || value.operation === "research") {
    value.limit = value.limit ?? 5;
  } else {
    delete value.limit;
  }
  if (value.operation === "research") value.candidateLimit = value.candidateLimit ?? 2;
  else delete value.candidateLimit;
  if (value.operation === "fetch") value.limits = value.limits || {};
  else delete value.limits;
  return stableValue(value);
}

function requestFingerprint(input) {
  return sha256("exportflow-task-request-v1:" + JSON.stringify(canonicalTaskInput(input)));
}

async function idempotencyFingerprint(tenantId, key) {
  return sha256("exportflow-task-idempotency-v1:" + tenantId + ":" + key);
}

function quotaSnapshot(row) {
  return {
    period: row.quota_period,
    limit: Number(row.quota_limit),
    used: Number(row.quota_used),
    remaining: Number(row.quota_remaining),
    resetAt: row.quota_reset_at,
    windowId: row.quota_window_id,
  };
}

function safeJson(value, fallback = null) {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function taskFromRow(row, events = []) {
  const stored = safeJson(row.response_json);
  const task = stored && typeof stored === "object"
    ? stored
    : {
        id: row.task_id,
        state: row.state,
        execution: safeJson(row.execution_json, { operation: row.operation }),
        timestamps: {
          createdAt: row.created_at,
          startedAt: row.started_at,
          completedAt: row.completed_at,
        },
        usage: safeJson(row.usage_json),
        errors: row.error_code ? [{ code: row.error_code, message: "Task did not retain a completed response." }] : [],
        result: null,
      };

  task.id = row.task_id;
  task.state = row.state;
  task.timestamps = {
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
  task.events = events;
  task.quota = quotaSnapshot(row);
  task.persistence = {
    resultAvailable: Number(row.result_available) === 1,
    expiresAt: row.expires_at,
    retentionHours: TASK_RESULT_RETENTION_MS / (60 * 60 * 1000),
  };
  if (Number(row.result_available) !== 1 && task.result === undefined) task.result = null;
  return task;
}

async function readRow(db, tenantId, taskId) {
  return db.prepare(
    "SELECT * FROM tasks WHERE tenant_id = ?1 AND task_id = ?2 LIMIT 1",
  ).bind(tenantId, taskId).first();
}

async function readEvents(db, tenantId, taskId) {
  const result = await db.prepare(
    "SELECT event_type, occurred_at, details_json FROM task_events " +
    "WHERE tenant_id = ?1 AND task_id = ?2 ORDER BY revision ASC",
  ).bind(tenantId, taskId).all();
  return (result?.results || []).map((row) => ({
    type: row.event_type,
    at: row.occurred_at,
    ...(safeJson(row.details_json, {}) || {}),
  }));
}

async function markExpired(db, row, timestamp, reason = "TASK_EXECUTION_LEASE_EXPIRED") {
  if (row.state === "accepted" || row.state === "running") {
    await db.prepare(
      "UPDATE tasks SET state = 'expired', completed_at = ?1, updated_at = ?1, " +
      "lease_expires_at = NULL, response_json = NULL, result_available = 0, " +
      "error_code = ?2, revision = revision + 1 " +
      "WHERE tenant_id = ?3 AND task_id = ?4 AND state = ?5",
    ).bind(timestamp, reason, row.tenant_id, row.task_id, row.state).run();
  } else {
    await db.prepare(
      "UPDATE tasks SET response_json = NULL, result_available = 0, updated_at = ?1 " +
      "WHERE tenant_id = ?2 AND task_id = ?3",
    ).bind(timestamp, row.tenant_id, row.task_id).run();
  }
}

export async function getDurableTask({ db, tenantId, taskId, now = () => new Date().toISOString() } = {}) {
  try { db = requireDatabase(db); }
  catch { return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Task storage is not configured." }; }
  if (typeof tenantId !== "string" || !tenantId || typeof taskId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(taskId)) {
    return { ok: false, httpStatus: 404, code: "TASK_NOT_FOUND", message: "Task was not found." };
  }

  let timestamp;
  try {
    timestamp = timestampValue(now);
  } catch {
    return { ok: false, httpStatus: 500, code: "TASK_CLOCK_INVALID", message: "Task storage clock is invalid." };
  }

  let row;
  try {
    row = await readRow(db, tenantId, taskId);
  } catch {
    return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Task storage is temporarily unavailable." };
  }
  if (!row) return { ok: false, httpStatus: 404, code: "TASK_NOT_FOUND", message: "Task was not found." };

  if (Date.parse(row.expires_at) <= Date.parse(timestamp)) {
    try {
      await markExpired(db, row, timestamp, "TASK_RESULT_EXPIRED");
    } catch {
      return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Task expiration could not be recorded." };
    }
    return { ok: false, httpStatus: 410, code: "TASK_EXPIRED", message: "The task record or retained result has expired." };
  }

  try {
    const events = await readEvents(db, tenantId, taskId);
    return { ok: true, task: taskFromRow(row, events) };
  } catch {
    return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Task events are temporarily unavailable." };
  }
}

function taskStatusForResult(result) {
  return TERMINAL_STATES.has(result?.state) ? result.state : "failed";
}

function taskQuotaError(db, identity, windowId, resetAt, timestamp) {
  return db.prepare(
    "SELECT request_limit, requests_used FROM tenant_request_usage " +
    "WHERE tenant_id = ?1 AND window_id = ?2 LIMIT 1",
  ).bind(identity.tenantId, windowId).first().then((row) => {
    const retryAfterSec = Math.max(1, Math.ceil((Date.parse(resetAt) - Date.parse(timestamp)) / 1000));
    return {
      ok: false,
      httpStatus: 429,
      code: "PLAN_QUOTA_EXCEEDED",
      message: "The plan request allowance for this window has been exhausted.",
      retryAfterSec,
      quota: row ? {
        limit: Number(row.request_limit),
        used: Number(row.requests_used),
        remaining: 0,
        resetAt,
        windowId,
      } : undefined,
    };
  });
}

export async function executeDurableTask({
  db,
  identity,
  input,
  idempotencyKey,
  signal,
  executeTask,
  now = () => new Date().toISOString(),
  idFactory = makeId,
  taskTimeoutMs,
  resultMaxBytes = TASK_RESULT_MAX_BYTES,
} = {}) {
  try { db = requireDatabase(db); }
  catch { return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Task storage is not configured." }; }
  if (!identity || typeof identity.tenantId !== "string" || !identity.tenantId ||
      typeof identity.planCode !== "string" || typeof identity.policyVersion !== "string" ||
      !Number.isSafeInteger(identity.requestLimit) || identity.requestLimit < 1 ||
      !["daily", "monthly"].includes(identity.quotaPeriod)) {
    return { ok: false, httpStatus: 503, code: "AUTH_BACKEND_INVALID_RECORD", message: "Authenticated tenant identity is invalid." };
  }
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      typeof executeTask !== "function") {
    return { ok: false, httpStatus: 400, code: "INVALID_TASK", message: "A valid task input and executor are required." };
  }

  let timestamp;
  let taskId;
  let quotaWindow;
  try {
    timestamp = timestampValue(now);
    taskId = idFactory();
    if (typeof taskId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(taskId)) throw new TypeError("Task ID is invalid.");
    quotaWindow = getQuotaWindow(timestamp, identity.quotaPeriod);
  } catch {
    return { ok: false, httpStatus: 500, code: "TASK_ACCEPTANCE_FAILED", message: "Task acceptance could not be initialized." };
  }

  const key = idempotencyKey === undefined || idempotencyKey === null || idempotencyKey === ""
    ? taskId
    : idempotencyKey;
  if (typeof key !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return { ok: false, httpStatus: 400, code: "INVALID_IDEMPOTENCY_KEY", message: "Idempotency-Key must contain 8 to 128 visible ASCII characters without spaces." };
  }

  let keyHash;
  let requestHash;
  try {
    [keyHash, requestHash] = await Promise.all([
      idempotencyFingerprint(identity.tenantId, key),
      requestFingerprint(input),
    ]);
  } catch {
    return { ok: false, httpStatus: 503, code: "TASK_CRYPTO_UNAVAILABLE", message: "Task idempotency could not be verified." };
  }

  const expiresAt = new Date(Date.parse(timestamp) + TASK_RESULT_RETENTION_MS).toISOString();
  const leaseExpiresAt = new Date(Date.parse(timestamp) + TASK_LEASE_MS).toISOString();

  try {
    // Expired records are removed only for the authenticated tenant; their event rows cascade.
    await db.prepare(
      "DELETE FROM tasks WHERE tenant_id = ?1 AND expires_at <= ?2",
    ).bind(identity.tenantId, timestamp).run();
  } catch {
    return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Task retention cleanup is temporarily unavailable." };
  }

  let inserted;
  try {
    inserted = await db.prepare(
      "INSERT INTO tasks (" +
      "task_id, tenant_id, idempotency_key_hash, request_hash, operation, state, " +
      "quota_period, quota_window_id, plan_code, policy_version, quota_limit, quota_reset_at, " +
      "created_at, updated_at, expires_at" +
      ") VALUES (?1, ?2, ?3, ?4, ?5, 'accepted', ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12, ?13) " +
      "ON CONFLICT (tenant_id, idempotency_key_hash) DO NOTHING RETURNING task_id",
    ).bind(
      taskId,
      identity.tenantId,
      keyHash,
      requestHash,
      input.operation || "fetch",
      identity.quotaPeriod,
      quotaWindow.windowId,
      identity.planCode,
      identity.policyVersion,
      identity.requestLimit,
      quotaWindow.resetAt,
      timestamp,
      expiresAt,
    ).first();
  } catch (error) {
    if (String(error?.message || error).includes("PLAN_REQUEST_QUOTA_EXCEEDED")) {
      try {
        return await taskQuotaError(db, identity, quotaWindow.windowId, quotaWindow.resetAt, timestamp);
      } catch {
        return { ok: false, httpStatus: 503, code: "QUOTA_BACKEND_UNAVAILABLE", message: "Plan quota storage is temporarily unavailable." };
      }
    }
    return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Task acceptance could not be persisted." };
  }

  let row;
  try {
    row = inserted
      ? await readRow(db, identity.tenantId, taskId)
      : await db.prepare(
          "SELECT * FROM tasks WHERE tenant_id = ?1 AND idempotency_key_hash = ?2 LIMIT 1",
        ).bind(identity.tenantId, keyHash).first();
  } catch {
    return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Task acceptance could not be read back." };
  }
  if (!row) return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Task acceptance record is missing." };
  if (row.request_hash !== requestHash) {
    return { ok: false, httpStatus: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different task request." };
  }

  if (Date.parse(row.expires_at) <= Date.parse(timestamp)) {
    return { ok: false, httpStatus: 410, code: "TASK_EXPIRED", message: "The task record or retained result has expired." };
  }

  if (TERMINAL_STATES.has(row.state)) {
    const saved = await getDurableTask({ db, tenantId: identity.tenantId, taskId: row.task_id, now });
    return saved.ok
      ? { ok: true, task: saved.task, quota: saved.task.quota, replayed: true, httpStatus: 200 }
      : saved;
  }

  if (row.state === "running") {
    if (row.lease_expires_at && Date.parse(row.lease_expires_at) <= Date.parse(timestamp)) {
      try {
        await markExpired(db, row, timestamp);
        return { ok: false, httpStatus: 410, code: "TASK_EXPIRED", message: "The task execution lease expired before a terminal result was persisted." };
      } catch {
        return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Expired task execution could not be recorded." };
      }
    }
    const running = await getDurableTask({ db, tenantId: identity.tenantId, taskId: row.task_id, now });
    return running.ok
      ? { ok: true, task: running.task, quota: running.task.quota, replayed: true, httpStatus: 202 }
      : running;
  }

  let claimed;
  try {
    claimed = await db.prepare(
      "UPDATE tasks SET state = 'running', started_at = ?1, lease_expires_at = ?2, " +
      "attempt_count = attempt_count + 1, revision = revision + 1, updated_at = ?1 " +
      "WHERE tenant_id = ?3 AND task_id = ?4 AND state = 'accepted' RETURNING task_id",
    ).bind(timestamp, leaseExpiresAt, identity.tenantId, row.task_id).first();
  } catch {
    return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Task execution could not be claimed." };
  }

  if (!claimed) {
    const current = await getDurableTask({ db, tenantId: identity.tenantId, taskId: row.task_id, now });
    return current.ok
      ? { ok: true, task: current.task, quota: current.task.quota, replayed: true, httpStatus: current.task.state === "running" ? 202 : 200 }
      : current;
  }

  try {
    row = await readRow(db, identity.tenantId, row.task_id);
  } catch {
    return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Claimed task could not be read." };
  }
  if (!row) return { ok: false, httpStatus: 503, code: "TASK_STORE_UNAVAILABLE", message: "Claimed task record is missing." };
  const quota = quotaSnapshot(row);
  let executed;
  try {
    executed = await executeTask(input, {
      signal,
      idFactory: () => row.task_id,
      ...(Number.isInteger(taskTimeoutMs) ? { taskTimeoutMs } : {}),
    });
  } catch {
    executed = {
      id: row.task_id,
      state: "failed",
      execution: { operation: input.operation || "fetch" },
      timestamps: { createdAt: row.created_at, startedAt: row.started_at, completedAt: timestampValue(now) },
      usage: null,
      events: [],
      errors: [{ code: "TASK_EXECUTION_FAILED", message: "Task execution failed." }],
      result: { status: "failed", data: { errorCode: "TASK_EXECUTION_FAILED" }, warnings: [] },
    };
  }

  const finalState = taskStatusForResult(executed);
  const persistenceExpiry = row.expires_at;
  let responseTask = {
    ...executed,
    id: row.task_id,
    state: finalState,
    quota,
    persistence: {
      resultAvailable: true,
      expiresAt: persistenceExpiry,
      retentionHours: TASK_RESULT_RETENTION_MS / (60 * 60 * 1000),
    },
  };
  const { goal: _displayGoal, ...retainedTask } = responseTask;
  let responseJson = JSON.stringify(retainedTask);
  const resultAvailable = new TextEncoder().encode(responseJson).byteLength <= resultMaxBytes;
  if (!resultAvailable) {
    responseJson = null;
    responseTask = {
      ...responseTask,
      persistence: {
        resultAvailable: false,
        reason: "RESULT_STORAGE_LIMIT",
        expiresAt: persistenceExpiry,
        retentionHours: TASK_RESULT_RETENTION_MS / (60 * 60 * 1000),
      },
    };
  }

  const completedAt = timestampValue(now);
  const errorCode = executed?.errors?.[0]?.code || executed?.result?.data?.errorCode || null;
  try {
    const completed = await db.prepare(
      "UPDATE tasks SET state = ?1, completed_at = ?2, updated_at = ?2, lease_expires_at = NULL, " +
      "response_json = ?3, result_available = ?4, error_code = ?5, usage_json = ?6, execution_json = ?7, " +
      "revision = revision + 1 " +
      "WHERE tenant_id = ?8 AND task_id = ?9 AND state = 'running' RETURNING task_id",
    ).bind(
      finalState,
      completedAt,
      responseJson,
      resultAvailable ? 1 : 0,
      errorCode,
      executed?.usage ? JSON.stringify(executed.usage) : null,
      executed?.execution ? JSON.stringify(executed.execution) : null,
      identity.tenantId,
      row.task_id,
    ).first();
    if (!completed) throw new Error("Task completion state was not updated.");
  } catch {
    return { ok: false, httpStatus: 503, code: "TASK_COMPLETION_PERSIST_FAILED", message: "Task ran but its terminal result could not be persisted. Check the task status before retrying." };
  }

  return {
    ok: true,
    task: responseTask,
    quota,
    replayed: false,
    httpStatus: 200,
  };
}
