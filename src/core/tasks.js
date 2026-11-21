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

const SAFE_ERROR_MESSAGES = Object.freeze({
  INVALID_TASK: "Task input failed contract validation.",
  INVALID_GOAL: "Task goal is missing or exceeds the allowed length.",
  INVALID_QUERY: "Search query must contain 1 to 1024 characters.",
  INVALID_LIMIT: "One or more execution limits are outside the supported range.",
  UNSUPPORTED_OPERATION: "Unsupported task operation.",
  URL_NOT_ALLOWED: "Destination URL is not allowed by the egress policy.",
  RESPONSE_TOO_LARGE: "Upstream response exceeded the maximum allowed byte limit.",
  UNSUPPORTED_CONTENT_TYPE: "Upstream returned an unsupported content type.",
  UPSTREAM_TIMEOUT: "Upstream request timed out.",
  UPSTREAM_FETCH_FAILED: "Could not retrieve the upstream resource.",
  TOO_MANY_REDIRECTS: "Upstream exceeded the redirect limit.",
  REDIRECT_LOOP: "Upstream redirect loop detected.",
  REDIRECT_NOT_ALLOWED: "Upstream redirected to a disallowed destination.",
  REDIRECT_DOWNGRADE: "HTTPS redirects cannot downgrade to HTTP.",
  INVALID_REDIRECT: "Upstream returned an invalid redirect response.",
  UPSTREAM_HTTP_ERROR: "Upstream returned a non-2xx HTTP status.",
  TASK_CANCELLED: "Task was cancelled before completion.",
  TASK_TIMEOUT: "Task exceeded its maximum execution time.",
  BROWSER_INTERACTION_UNAVAILABLE: "User-directed browser interactions are not connected.",
  BROWSER_UNAVAILABLE: "Browser Run binding is not configured.",
  SEARCH_UNAVAILABLE: "Cloudflare Web Search binding is not configured.",
  RESEARCH_UNAVAILABLE: "Research pipeline is not configured.",
  TASK_EXECUTION_FAILED: "Task execution failed.",
});

function safeErrorMessage(code) {
  return SAFE_ERROR_MESSAGES[code] || SAFE_ERROR_MESSAGES.TASK_EXECUTION_FAILED;
}

const DEFAULT_TASK_TIMEOUT_MS = 30_000;
const MAX_TASK_TIMEOUT_MS = 120_000;

function createTaskExecutionControls(externalSignal, timeoutMs) {
  const controller = new AbortController();
  let timeoutHandle = null;
  let externalAbortHandler = null;
  let rejectTimeout;
  let rejectAbort;
  let timeoutStarted = false;

  const timeoutPromise = new Promise((_, reject) => {
    rejectTimeout = reject;
  });
  const abortPromise = new Promise((_, reject) => {
    rejectAbort = reject;
  });

  const abortFromCaller = () => {
    const error = Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" });
    controller.abort(externalSignal?.reason || error);
    rejectAbort(error);
  };

  // Mark the rejection handled even when validation exits before adapter execution.
  abortPromise.catch(() => {});

  return {
    signal: controller.signal,
    timeoutPromise,
    abortPromise,
    startTimeout() {
      if (timeoutStarted) return;
      timeoutStarted = true;
      if (externalSignal?.aborted) {
        abortFromCaller();
      } else if (externalSignal) {
        externalAbortHandler = abortFromCaller;
        externalSignal.addEventListener("abort", externalAbortHandler, { once: true });
      }
      timeoutHandle = setTimeout(() => {
        const error = Object.assign(new Error("Task execution timed out."), { code: "TASK_TIMEOUT" });
        controller.abort(error);
        rejectTimeout(error);
      }, timeoutMs);
    },
    cleanup() {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      if (externalAbortHandler) externalSignal.removeEventListener("abort", externalAbortHandler);
    },
  };
}
async function runWithTaskControls(run, controls) {
  controls.startTimeout();
  const work = Promise.resolve().then(() => run(controls.signal));
  try {
    return await Promise.race([work, controls.timeoutPromise, controls.abortPromise]);
  } finally {
    controls.cleanup();
  }
}

function computeDurationMs(startedAt, completedAt, fallbackMs) {
  if (startedAt && completedAt) {
    const start = Date.parse(startedAt);
    const end = Date.parse(completedAt);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return end - start;
    }
  }
  return Math.max(0, fallbackMs);
}

function failureResult(code, requestedUrl = null) {
  return normalizeResult({
    status: "failed",
    data: { errorCode: code, requestedUrl },
    warnings: [`Task failed (${code}).`],
  });
}

function buildTask({
  id,
  goal,
  requestedUrl = null,
  state,
  execution,
  createdAt,
  startedAt,
  completedAt,
  events,
  errors = [],
  usage = null,
  result,
}) {
  return {
    id,
    goal,
    requestedUrl,
    state,
    execution,
    timestamps: { createdAt, startedAt, completedAt },
    usage,
    events,
    errors,
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
  const startMs = Date.now();
  const requestedTimeout = Number.isInteger(options.taskTimeoutMs) ? options.taskTimeoutMs : DEFAULT_TASK_TIMEOUT_MS;
  const taskTimeoutMs = Math.min(MAX_TASK_TIMEOUT_MS, Math.max(1, requestedTimeout));
  const controls = createTaskExecutionControls(options.signal, taskTimeoutMs);
  const id = idFactory();
  const createdAt = now();
  const events = [event("task.accepted", createdAt)];
  let startedAt = null;
  let goal = "";
  let requestedUrl = null;
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

    if (options.signal?.aborted) throw Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" });

    const operation = input.operation === undefined ? "fetch" : input.operation;
    if (!["fetch", "map", "crawl", "extract", "search", "research"].includes(operation)) {
      throw Object.assign(new TypeError("Unsupported task operation."), { code: "UNSUPPORTED_OPERATION" });
    }
    const url = ["search", "research"].includes(operation) ? null : validatePublicHttpUrl(input.url);
    requestedUrl = url ? url.href : null;
    if (["search", "research"].includes(operation) && (typeof input.query !== "string" || !input.query.trim() || input.query.length > 1024)) {
      throw Object.assign(new TypeError("Search query must contain 1 to 1024 characters."), { code: "INVALID_QUERY" });
    }
    if (["search", "research"].includes(operation) && (input.requiresJavascript === true || input.requiresInteraction === true)) {
      throw Object.assign(new TypeError("Search operations cannot require browser execution."), { code: "INVALID_TASK" });
    }
    const route = ["search", "research"].includes(operation)
      ? { path: "http", reason: "Discovery tasks return public URLs for bounded retrieval.", escalationAllowed: false }
      : chooseExecutionPath({
          requiresJavascript: input.requiresJavascript === true,
          requiresInteraction: input.requiresInteraction === true,
        });
    execution = { path: route.path, operation, adapterId: null, reason: route.reason };

    startedAt = now();
    events.push(event("task.started", startedAt, { executionPath: route.path }));

    if (operation === "research") {
      const researchAdapter = options.researchAdapter;
      if (!researchAdapter || typeof researchAdapter.execute !== "function") {
        const completedAt = now();
        const result = normalizeResult({
          status: "failed",
          data: null,
          warnings: ["Research pipeline is not configured; no search or fetch request was made."],
        });
        events.push(event("task.unsupported", completedAt, { reason: "research_pipeline_unavailable" }));
        return buildTask({
          id,
          goal,
          requestedUrl,
          state: "unsupported",
          execution,
          createdAt,
          startedAt,
          completedAt,
          events,
          errors: [{ code: "RESEARCH_UNAVAILABLE", message: safeErrorMessage("RESEARCH_UNAVAILABLE") }],
          usage: {
            durationMs: computeDurationMs(startedAt, completedAt, Date.now() - startMs),
            requestsAttempted: 0,
            responseBytes: 0,
            cost: null,
          },
          result,
        });
      }
      execution.adapterId = researchAdapter.id || "web.research.v1";
      const result = await runWithTaskControls(
        (signal) => researchAdapter.execute({
          query: input.query,
          schema: input.schema,
          limit: input.limit,
          candidateLimit: input.candidateLimit,
          signal,
        }),
        controls,
      );
      const completedAt = now();
      const state = result.status === "succeeded"
        ? "succeeded"
        : result.status === "partial"
          ? "partial"
          : "failed";
      if (state === "succeeded") events.push(event("task.succeeded", completedAt));
      else if (state === "partial") events.push(event("task.partial", completedAt, { reason: "required_or_optional_fields_missing" }));
      else events.push(event("task.failed", completedAt, { reason: "research_failed" }));
      return buildTask({
        id, goal, state, execution, createdAt, startedAt, completedAt, events, result,
      });
    }

    if (operation === "search") {
      const searchAdapter = options.searchAdapter;
      if (!searchAdapter || typeof searchAdapter.execute !== "function") {
        const completedAt = now();
        const result = normalizeResult({
          status: "failed",
          data: null,
          warnings: ["Cloudflare Web Search binding is not configured; no search request was made."],
        });
        events.push(event("task.unsupported", completedAt, { reason: "search_adapter_unavailable" }));
        return buildTask({
          id, goal, state: "unsupported", execution, createdAt, startedAt,
          completedAt, events, result,
        });
      }
      execution.adapterId = searchAdapter.id || "web.search.v1";
      const result = await runWithTaskControls((signal) => searchAdapter.execute({ query: input.query, limit: input.limit, signal }), controls);
      const completedAt = now();
      const state = result.status === "succeeded"
        ? "succeeded"
        : result.status === "partial"
          ? "partial"
          : "failed";
      if (state === "succeeded") events.push(event("task.succeeded", completedAt));
      else if (state === "partial") events.push(event("task.partial", completedAt, { reason: "partial_search_result" }));
      else events.push(event("task.failed", completedAt, { reason: "search_failed" }));
      return buildTask({
        id, goal, state, execution, createdAt, startedAt, completedAt, events, result,
      });
    }

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
        const errorCode = input.requiresInteraction === true
          ? "BROWSER_INTERACTION_UNAVAILABLE"
          : "BROWSER_UNAVAILABLE";
        return buildTask({
          id,
          goal,
          requestedUrl,
          state: "unsupported",
          execution,
          createdAt,
          startedAt,
          completedAt,
          events,
          errors: [{ code: errorCode, message: safeErrorMessage(errorCode) }],
          usage: {
            durationMs: computeDurationMs(startedAt, completedAt, Date.now() - startMs),
            requestsAttempted: 0,
            responseBytes: 0,
            cost: null,
          },
          result,
        });
      }

      execution.adapterId = browserAdapter.id || "web.browser.v1";
      let browserResult;
      try {
        browserResult = await runWithTaskControls((signal) => browserAdapter.execute({ url: url.href, goal, requiresInteraction: false, signal }), controls);
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
    if (operation === "fetch" && input.limits && typeof input.limits === "object" && !Array.isArray(input.limits)) {
      if (input.limits.timeoutMs !== undefined) adapterInput.timeoutMs = input.limits.timeoutMs;
      if (input.limits.maxBytes !== undefined) adapterInput.maxBytes = input.limits.maxBytes;
      if (input.limits.maxRedirects !== undefined) adapterInput.maxRedirects = input.limits.maxRedirects;
    }
    if (operation === "map" && input.maxUrls !== undefined) adapterInput.maxUrls = input.maxUrls;
    if (operation === "crawl") {
      if (input.maxPages !== undefined) adapterInput.maxPages = input.maxPages;
      if (input.maxDepth !== undefined) adapterInput.maxDepth = input.maxDepth;
    }
    if (operation === "extract") adapterInput.schema = input.schema;
    const adapterOptions = {};
    if (typeof options.fetchImpl === "function") adapterOptions.fetchImpl = options.fetchImpl;
    adapterOptions.signal = controls.signal;
    const result = Object.keys(adapterOptions).length
      ? await runWithTaskControls((signal) => runAdapter(adapterId, adapterInput, { ...adapterOptions, signal }), controls)
      : await runWithTaskControls((signal) => runAdapter(adapterId, adapterInput, { signal }), controls);
    const completedAt = now();
    const state = result.status === "succeeded"
      ? "succeeded"
      : result.status === "partial"
        ? "partial"
        : "failed";
    const errors = [];
    if (state === "succeeded") {
      events.push(event("task.succeeded", completedAt));
    } else if (state === "partial") {
      events.push(event("task.partial", completedAt, { reason: "some_fields_missing" }));
    } else {
      events.push(event("task.failed", completedAt, { reason: "upstream_request_failed" }));
      if (operation === "fetch" && Number.isInteger(result.data?.status)) {
        errors.push({
          code: "UPSTREAM_HTTP_ERROR",
          message: `Upstream returned HTTP ${result.data.status}.`,
        });
      }
    }
    const redirectsCount = Array.isArray(result.data?.redirects) ? result.data.redirects.length : null;
    const requestsAttempted = operation === "fetch" && redirectsCount !== null
      ? 1 + redirectsCount
      : null;
    return buildTask({
      id,
      goal,
      requestedUrl,
      state,
      execution,
      createdAt,
      startedAt,
      completedAt,
      events,
      errors,
      usage: {
        durationMs: computeDurationMs(startedAt, completedAt, Date.now() - startMs),
        requestsAttempted,
        responseBytes: Number.isInteger(result.data?.bytes) ? result.data.bytes : null,
        cost: null,
      },
      result,
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
      requestedUrl,
      state: "failed",
      execution,
      createdAt,
      startedAt,
      completedAt,
      events,
      errors: [{ code, message: safeErrorMessage(code) }],
      usage: {
        durationMs: computeDurationMs(startedAt, completedAt, Date.now() - startMs),
        requestsAttempted: startedAt ? null : 0,
        responseBytes: 0,
        cost: null,
      },
      result: failureResult(code, requestedUrl),
    });
  }
}
