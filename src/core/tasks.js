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
 * durable state and accepts no caller-supplied credentials or headers.
 * Browser rendering can run only through an explicitly injected internal adapter;
 * user-directed browser interactions remain unsupported.
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
    const operation = input.operation === undefined ? "fetch" : input.operation;
    if (!["fetch", "map", "crawl", "extract"].includes(operation)) {
      throw Object.assign(new TypeError("Unsupported task operation."), { code: "UNSUPPORTED_OPERATION" });
    }
    const route = chooseExecutionPath({
      requiresJavascript: input.requiresJavascript === true,
      requiresInteraction: input.requiresInteraction === true,
    });
    execution = { path: route.path, operation, adapterId: null, reason: route.reason };

    startedAt = now();
    events.push(event("task.started", startedAt, { executionPath: route.path }));

    if (route.path === "browser") {
      const browserAdapter = options.browserAdapter;
      if (input.requiresInteraction === true || !browserAdapter || typeof browserAdapter.execute !== "function") {
        const completedAt = now();
        const reason = input.requiresInteraction === true
          ? "browser_interaction_not_implemented"
          : "browser_adapter_unavailable";
        const message = input.requiresInteraction === true
          ? "User-directed browser interactions are not connected; no interaction was performed."
          : "Browser Run binding is not configured; no browser navigation was performed.";
        const result = normalizeResult({ status: "failed", data: null, warnings: [message] });
        events.push(event("task.unsupported", completedAt, { reason }));
        return buildTask({
          id, goal, state: "unsupported", execution, createdAt, startedAt,
          completedAt, events, result,
        });
      }

      execution.adapterId = browserAdapter.id || "web.browser.v1";
      let browserResult;
      try {
        browserResult = await browserAdapter.execute({ url: url.href, goal, requiresInteraction: false });
      } catch (error) {
        if (error?.code === "BROWSER_UNAVAILABLE") {
          const completedAt = now();
          const unsupportedResult = normalizeResult({
            status: "failed",
            data: null,
            warnings: ["Browser Run binding is not configured; no browser navigation was performed."],
          });
          events.push(event("task.unsupported", completedAt, { reason: "browser_binding_unavailable" }));
          return buildTask({
            id, goal, state: "unsupported", execution, createdAt, startedAt,
            completedAt, events, result: unsupportedResult,
          });
        }
        throw error;
      }
      const completedAt = now();
      const state = browserResult.status === "succeeded"
        ? "succeeded"
        : browserResult.status === "partial"
          ? "partial"
          : "failed";
      if (state === "succeeded") events.push(event("task.succeeded", completedAt));
      else if (state === "partial") events.push(event("task.partial", completedAt, { reason: "partial_browser_result" }));
      else events.push(event("task.failed", completedAt, { reason: "browser_render_failed" }));
      return buildTask({
        id, goal, state, execution, createdAt, startedAt, completedAt, events, result: browserResult,
      });
    }

    const adapterId = operation === "fetch"
      ? "http.fetch.v1"
      : operation === "map"
        ? "web.map.v1"
        : operation === "crawl"
          ? "web.crawl.v1"
          : "web.extract.v1";
    execution.adapterId = adapterId;
    const adapterInput = { url: url.href };
    if (operation === "map" && input.maxUrls !== undefined) adapterInput.maxUrls = input.maxUrls;
    if (operation === "crawl") {
      if (input.maxPages !== undefined) adapterInput.maxPages = input.maxPages;
      if (input.maxDepth !== undefined) adapterInput.maxDepth = input.maxDepth;
    }
    if (operation === "extract") adapterInput.schema = input.schema;
    const result = await runAdapter(adapterId, adapterInput);
    const completedAt = now();
    const state = result.status === "succeeded"
      ? "succeeded"
      : result.status === "partial"
        ? "partial"
        : "failed";
    if (state === "succeeded") {
      events.push(event("task.succeeded", completedAt));
    } else if (state === "partial") {
      events.push(event("task.partial", completedAt, { reason: "some_fields_missing" }));
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
