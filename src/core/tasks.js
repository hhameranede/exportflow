import { chooseExecutionPath } from "./router.js";
import { executeAdapter } from "./adapters.js";
import { normalizeResult } from "./result.js";
import { validatePublicHttpUrl } from "./http-fetch.js";

const TASK_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;
const MAX_GOAL_LENGTH = 2_000;

function createId() {
  const id = globalThis.crypto?.randomUUID?.();
  if (!id) throw new Error("Secure task ID generation is unavailable.");
  return id;
}

function event(type, at, details = {}) {
  return { type, at, ...details };
}

function failureResult(code) {
  return normalizeResult({
    status: "failed",
    data: { errorCode: code },
    warnings: [`Task failed (${code}).`],
  });
}

function buildTask({
  id,
  goal,
  state,
  execution,
  createdAt,
  startedAt,
  completedAt,
  events,
  result,
}) {
  return {
    id,
    goal,
    state,
    execution,
    timestamps: { createdAt, startedAt, completedAt },
    events,
    result,
  };
}

/**
 * Executes one bounded web task inside the Worker.
 *
 * This is an internal Core primitive, not an HTTP/MCP endpoint. It keeps no
 * durable state, accepts no upstream credentials or caller-supplied headers,
 * and only invokes the installed direct HTTP adapter. Browser work is
 * explicitly reported as unsupported until a reviewed browser adapter exists.
 */
export async function executeWebTask(input, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const idFactory = options.idFactory || createId;
  const runAdapter = options.executeAdapter || executeAdapter;
  const id = idFactory();
  const createdAt = now();
  const events = [event("task.accepted", createdAt)];
  let startedAt = null;
  let goal = "";
  let execution = null;

  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw Object.assign(new TypeError("Task input must be an object."), { code: "INVALID_TASK" });
    }

    if (typeof input.goal !== "string" || !input.goal.trim() || input.goal.length > MAX_GOAL_LENGTH) {
      throw Object.assign(new TypeError("Task goal is missing or too long."), { code: "INVALID_GOAL" });
    }
    goal = input.goal.trim();

    if (input.requiresJavascript !== undefined && typeof input.requiresJavascript !== "boolean") {
      throw Object.assign(new TypeError("requiresJavascript must be a boolean."), { code: "INVALID_TASK" });
    }
    if (input.requiresInteraction !== undefined && typeof input.requiresInteraction !== "boolean") {
      throw Object.assign(new TypeError("requiresInteraction must be a boolean."), { code: "INVALID_TASK" });
    }

    const url = validatePublicHttpUrl(input.url);
    const route = chooseExecutionPath({
      requiresJavascript: input.requiresJavascript === true,
      requiresInteraction: input.requiresInteraction === true,
    });
    execution = { path: route.path, adapterId: null, reason: route.reason };

    startedAt = now();
    events.push(event("task.started", startedAt, { executionPath: route.path }));

    if (route.path === "browser") {
      const completedAt = now();
      const result = normalizeResult({
        status: "failed",
        data: null,
        warnings: ["Browser execution is not connected; no browser action was performed."],
      });
      events.push(event("task.unsupported", completedAt, { reason: "browser_adapter_unavailable" }));
      return buildTask({
        id, goal, state: "unsupported", execution, createdAt, startedAt,
        completedAt, events, result,
      });
    }

    execution.adapterId = "http.fetch.v1";
    const result = await runAdapter("http.fetch.v1", { url: url.href });
    const completedAt = now();
    const state = result.status === "succeeded" ? "succeeded" : "failed";
    if (state === "succeeded") {
      events.push(event("task.succeeded", completedAt));
    } else {
      events.push(event("task.failed", completedAt, { reason: "upstream_request_failed" }));
    }
    return buildTask({
      id, goal, state, execution, createdAt, startedAt, completedAt, events, result,
    });
  } catch (error) {
    const completedAt = now();
    const code = typeof error?.code === "string" && /^[A-Z0-9_]{2,64}$/.test(error.code)
      ? error.code
      : "TASK_EXECUTION_FAILED";
    events.push(event("task.failed", completedAt, { reason: code }));
    return buildTask({
      id,
      goal,
      state: "failed",
      execution,
      createdAt,
      startedAt,
      completedAt,
      events,
      result: failureResult(code),
    });
  }
}
