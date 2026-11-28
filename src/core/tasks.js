import { chooseExecutionPath } from "./router.js";
import { executeAdapter } from "./adapters.js";
import { normalizeResult } from "./result.js";
import { validatePublicHttpUrl } from "./http-fetch.js";
import { createResearchPipeline } from "./research.js";

const TASK_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;
const MAX_GOAL_LENGTH = 2_000;
const ALLOWED_TASK_INPUT_KEYS = new Set([
  "goal", "url", "operation", "query", "source", "limit", "candidateLimit",
  "schema", "maxUrls", "maxPages", "maxDepth", "cacheMode", "limits", "includeArticle",
]);

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
  UNSUPPORTED_CHARSET: "Upstream declared an unsupported character encoding.",
  CSV_INPUT_TOO_LARGE: "CSV source exceeds the configured parser byte limit.",
  CSV_HEADER_REQUIRED: "CSV source must contain a non-empty header row.",
  CSV_HEADER_TOO_LONG: "A CSV column name exceeds the configured character limit.",
  CSV_DUPLICATE_HEADER: "CSV column names must be unique after trimming whitespace.",
  CSV_UNSAFE_HEADER: "CSV contains an unsafe column name.",
  CSV_TOO_MANY_COLUMNS: "CSV source exceeds the configured column limit.",
  CSV_MALFORMED_QUOTES: "CSV source contains an unterminated quoted field.",
  CSV_PARSE_FAILED: "CSV source could not be parsed.",
  CSV_ARRAY_FIELD_REQUIRED: "CSV extraction fields must be declared as arrays of strings.",
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
  SEARCH_UNAVAILABLE: "The selected public search source is not configured.",
  SEARCH_RATE_LIMITED: "The selected public search source rate-limited this request. Retry later.",
  SEARCH_UPSTREAM_FAILED: "The selected public search source could not complete the query.",
  SEARCH_UPSTREAM_INVALID_RESPONSE: "The selected public search source returned invalid data.",
  RESEARCH_UNAVAILABLE: "The static research pipeline is not configured.",
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
 * All operations use bounded HTTP requests; page scripts are never executed.
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

    for (const key of Object.keys(input)) {
      if (!ALLOWED_TASK_INPUT_KEYS.has(key)) {
        throw Object.assign(new TypeError("Unsupported task property: " + key), { code: "INVALID_TASK" });
      }
    }

    if (typeof input.goal !== "string" || !input.goal.trim() || input.goal.length > MAX_GOAL_LENGTH) {
      throw Object.assign(new TypeError("Task goal is missing or too long."), { code: "INVALID_GOAL" });
    }
    goal = input.goal.trim();

    if (options.signal?.aborted) throw Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" });

    const operation = input.operation === undefined ? "fetch" : input.operation;
    if (!["fetch", "map", "crawl", "extract", "search", "research"].includes(operation)) {
      throw Object.assign(new TypeError("Unsupported task operation."), { code: "UNSUPPORTED_OPERATION" });
    }
    const queryOperation = operation === "search" || operation === "research";
    if (input.includeArticle !== undefined && typeof input.includeArticle !== "boolean") {
      throw Object.assign(new TypeError("includeArticle must be a boolean."), { code: "INVALID_INCLUDE_ARTICLE" });
    }
    if (input.includeArticle !== undefined && operation !== "extract") {
      throw Object.assign(new TypeError("includeArticle is only supported for extract."), { code: "INVALID_TASK" });
    }
    const url = queryOperation ? null : validatePublicHttpUrl(input.url);
    requestedUrl = url ? url.href : null;
    if (queryOperation && (typeof input.query !== "string" || !input.query.trim() || input.query.length > 1024)) {
      throw Object.assign(new TypeError("Search query must contain 1 to 1024 characters."), { code: "INVALID_QUERY" });
    }
    const route = chooseExecutionPath();
    execution = { path: route.path, operation, adapterId: null, reason: route.reason };

    startedAt = now();
    events.push(event("task.started", startedAt, { executionPath: route.path }));

    const searchAdapter = options.searchAdapter || {
      id: "web.search.v1",
      execute: (searchInput) => runAdapter("web.search.v1", searchInput, {
        ...(searchInput.signal ? { signal: searchInput.signal } : {}),
        ...(typeof options.fetchImpl === "function" ? { fetchImpl: options.fetchImpl } : {}),
      }),
    };
    const researchAdapterDefault = createResearchPipeline({
      searchAdapter,
      runAdapter: (adapterId, adapterInput, adapterOptions = {}) => runAdapter(adapterId, adapterInput, {
        ...adapterOptions,
        ...(typeof options.fetchImpl === "function" ? { fetchImpl: options.fetchImpl } : {}),
      }),
    });

    if (operation === "research") {
      const researchAdapter = options.researchAdapter || researchAdapterDefault;
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
          source: input.source,
          cacheMode: input.cacheMode,
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
      if (!searchAdapter || typeof searchAdapter.execute !== "function") {
        const completedAt = now();
        const result = normalizeResult({
          status: "failed",
          data: null,
          warnings: ["The selected public search source is not configured; no request was made."],
        });
        events.push(event("task.unsupported", completedAt, { reason: "search_adapter_unavailable" }));
        return buildTask({
          id, goal, state: "unsupported", execution, createdAt, startedAt,
          completedAt, events, result,
        });
      }
      execution.adapterId = searchAdapter.id || "web.search.v1";
      const result = await runWithTaskControls((signal) => searchAdapter.execute({ query: input.query, source: input.source, limit: input.limit, cacheMode: input.cacheMode, signal }), controls);
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
    if (operation === "extract") {
      adapterInput.schema = input.schema;
      if (input.includeArticle === true) adapterInput.includeArticle = true;
    }
    if (input.cacheMode !== undefined) adapterInput.cacheMode = input.cacheMode;
    const adapterOptions = {};
    if (typeof options.fetchImpl === "function") adapterOptions.fetchImpl = options.fetchImpl;
    if (typeof options.onUsageReceipt === "function") adapterOptions.onUsageReceipt = options.onUsageReceipt;
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
    const cancelled = code === "TASK_CANCELLED";
    events.push(event(cancelled ? "task.cancelled" : "task.failed", completedAt, { reason: code }));
    return buildTask({
      id,
      goal,
      requestedUrl,
      state: cancelled ? "cancelled" : "failed",
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
