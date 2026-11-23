import { HTTP_FETCH_LIMITS, validatePublicHttpUrl } from "./http-fetch.js";
import { validateExtractionSchema } from "./extract.js";

export const TASK_REQUEST_LIMITS = Object.freeze({
  maxBodyBytes: 32_768,
  maxBodyChunks: 8_192,
  maxGoalLength: 2_000,
});

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "goal", "url", "operation", "query", "source", "limit", "candidateLimit",
  "schema", "maxUrls", "maxPages", "maxDepth", "cacheMode", "limits",
]);

const ALLOWED_LIMIT_KEYS = new Set([
  "timeoutMs",
  "maxBytes",
  "maxRedirects",
]);

const KNOWN_OPERATIONS = new Set([
  "fetch",
  "map",
  "crawl",
  "extract",
  "search",
  "research",
]);

export class TaskContractError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.name = "TaskContractError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Cancellation is best-effort: a stream source's cancel() callback must never
// hold the HTTP request open after a resource limit or read error.
function cancelReaderBestEffort(reader) {
  try {
    const cancellation = reader.cancel();
    if (cancellation && typeof cancellation.catch === "function") {
      void cancellation.catch(() => {});
    }
  } catch {
    // The stream may already be closed, errored, or locked by the runtime.
  }
}

export async function readBoundedJsonBody(request, maxBytes = TASK_REQUEST_LIMITS.maxBodyBytes) {
  const contentType = String(request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new TaskContractError(
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json.",
      415,
    );
  }

  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer.");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) {
      throw new TaskContractError(
        "INVALID_CONTENT_LENGTH",
        "Content-Length must contain decimal digits only.",
        400,
      );
    }
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength > maxBytes) {
      throw new TaskContractError(
        "PAYLOAD_TOO_LARGE",
        "Request body exceeds the maximum allowed size.",
        413,
      );
    }
  }

  if (!request.body) {
    throw new TaskContractError("INVALID_JSON", "Request body must be a JSON object.", 400);
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  let chunksRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunksRead += 1;
      if (chunksRead > TASK_REQUEST_LIMITS.maxBodyChunks) {
        throw new TaskContractError(
          "PAYLOAD_TOO_LARGE",
          "Request body contains too many chunks.",
          413,
        );
      }

      const chunkBytes = value?.byteLength ?? 0;
      if (chunkBytes > maxBytes - totalBytes) {
        throw new TaskContractError(
          "PAYLOAD_TOO_LARGE",
          "Request body exceeds the maximum allowed size.",
          413,
        );
      }
      if (chunkBytes === 0) continue;

      totalBytes += chunkBytes;
      chunks.push(value);
    }
  } catch (error) {
    cancelReaderBestEffort(reader);
    if (error instanceof TaskContractError) throw error;
    throw new TaskContractError("INVALID_BODY", "Could not read request body.", 400);
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let rawText;
  try {
    rawText = new TextDecoder("utf-8", { fatal: true }).decode(merged);
  } catch {
    throw new TaskContractError("INVALID_JSON", "Request body must be valid UTF-8 JSON.", 400);
  }
  if (!rawText.trim()) {
    throw new TaskContractError("INVALID_JSON", "Request body must not be empty.", 400);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new TaskContractError("INVALID_JSON", "Request body contains invalid JSON.", 400);
  }

  if (!isPlainObject(parsed)) {
    throw new TaskContractError("INVALID_TASK", "Task payload must be a JSON object.", 400);
  }
  return parsed;
}

export function validateTaskRequest(payload) {
  if (!isPlainObject(payload)) throw new TaskContractError("INVALID_TASK", "Task payload must be a JSON object.", 400);
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) throw new TaskContractError("INVALID_TASK", `Unsupported task property: ${key}.`, 400);
  }
  if (typeof payload.goal !== "string" || !payload.goal.trim() || payload.goal.length > TASK_REQUEST_LIMITS.maxGoalLength) {
    throw new TaskContractError("INVALID_GOAL", "Task goal must be a non-empty string up to 2000 characters.", 400);
  }
  const operation = payload.operation === undefined ? "fetch" : payload.operation;
  if (typeof operation !== "string" || !KNOWN_OPERATIONS.has(operation)) throw new TaskContractError("UNSUPPORTED_OPERATION", "Unsupported task operation.", 400);
  const queryOperation = operation === "search" || operation === "research";
  let url;
  if (!queryOperation) {
    try { url = validatePublicHttpUrl(payload.url).href; }
    catch (error) { throw new TaskContractError(error?.code || "URL_NOT_ALLOWED", error?.message || "Destination URL is not allowed.", 400); }
    if (payload.query !== undefined || payload.source !== undefined || payload.limit !== undefined || payload.candidateLimit !== undefined) {
      throw new TaskContractError("INVALID_TASK", "Search-only properties are not allowed for URL operations.", 400);
    }
  } else {
    if (payload.url !== undefined) throw new TaskContractError("INVALID_TASK", "Search and research tasks do not accept a URL.", 400);
    if (typeof payload.query !== "string" || !payload.query.trim() || payload.query.length > 1024) throw new TaskContractError("INVALID_QUERY", "Search query must contain 1 to 1024 characters.", 400);
    if (!["wikipedia", "openalex", "crossref"].includes(payload.source)) throw new TaskContractError("INVALID_SEARCH_SOURCE", "Choose wikipedia, openalex, or crossref as the source.", 400);
  }
  const cacheMode = payload.cacheMode === undefined ? "default" : payload.cacheMode;
  if (!["default", "bypass"].includes(cacheMode)) throw new TaskContractError("INVALID_CACHE_MODE", "cacheMode must be 'default' or 'bypass'.", 400);
  const bounded = (name, value, min, max) => {
    if (value !== undefined && (!Number.isInteger(value) || value < min || value > max)) throw new TaskContractError("INVALID_LIMIT", name + " must be an integer between " + min + " and " + max + ".", 400);
    return value;
  };
  const maxUrls = bounded("maxUrls", payload.maxUrls, 1, 15);
  const maxPages = bounded("maxPages", payload.maxPages, 1, 3);
  const maxDepth = bounded("maxDepth", payload.maxDepth, 0, 1);
  const limit = bounded("limit", payload.limit, 1, 10) ?? 5;
  const candidateLimit = bounded("candidateLimit", payload.candidateLimit, 1, 3) ?? 2;
  if (payload.maxUrls !== undefined && operation !== "map") throw new TaskContractError("INVALID_LIMIT", "maxUrls is only supported for map.", 400);
  if ((payload.maxPages !== undefined || payload.maxDepth !== undefined) && operation !== "crawl") throw new TaskContractError("INVALID_LIMIT", "maxPages and maxDepth are only supported for crawl.", 400);
  if (payload.candidateLimit !== undefined && operation !== "research") throw new TaskContractError("INVALID_LIMIT", "candidateLimit is only supported for research.", 400);
  if (payload.limit !== undefined && !queryOperation) throw new TaskContractError("INVALID_LIMIT", "limit is only supported for search and research.", 400);
  let schema;
  if (operation === "extract" || operation === "research") {
    try { validateExtractionSchema(payload.schema); schema = payload.schema; }
    catch (error) { throw new TaskContractError("INVALID_SCHEMA", error?.message || "A supported extraction schema is required.", 400); }
  } else if (payload.schema !== undefined) throw new TaskContractError("INVALID_TASK", "schema is only supported for extract and research.", 400);
  const limits = {};
  if (payload.limits !== undefined) {
    if (operation !== "fetch") throw new TaskContractError("INVALID_LIMIT", "limits are only supported for fetch.", 400);
    if (!isPlainObject(payload.limits)) throw new TaskContractError("INVALID_LIMIT", "limits must be a plain object.", 400);
    for (const key of Object.keys(payload.limits)) if (!ALLOWED_LIMIT_KEYS.has(key)) throw new TaskContractError("INVALID_LIMIT", `Unsupported limit property: ${key}.`, 400);
    if (payload.limits.timeoutMs !== undefined) {
      if (!Number.isInteger(payload.limits.timeoutMs) || payload.limits.timeoutMs < 1 || payload.limits.timeoutMs > HTTP_FETCH_LIMITS.timeoutMs) throw new TaskContractError("INVALID_LIMIT", `limits.timeoutMs must be an integer between 1 and ${HTTP_FETCH_LIMITS.timeoutMs}.`, 400);
      limits.timeoutMs = payload.limits.timeoutMs;
    }
    if (payload.limits.maxBytes !== undefined) {
      if (!Number.isInteger(payload.limits.maxBytes) || payload.limits.maxBytes < 1 || payload.limits.maxBytes > HTTP_FETCH_LIMITS.maxResponseBytes) throw new TaskContractError("INVALID_LIMIT", `limits.maxBytes must be an integer between 1 and ${HTTP_FETCH_LIMITS.maxResponseBytes}.`, 400);
      limits.maxBytes = payload.limits.maxBytes;
    }
    if (payload.limits.maxRedirects !== undefined) {
      if (!Number.isInteger(payload.limits.maxRedirects) || payload.limits.maxRedirects < 0 || payload.limits.maxRedirects > HTTP_FETCH_LIMITS.maxRedirects) throw new TaskContractError("INVALID_LIMIT", `limits.maxRedirects must be an integer between 0 and ${HTTP_FETCH_LIMITS.maxRedirects}.`, 400);
      limits.maxRedirects = payload.limits.maxRedirects;
    }
  }
  return {
    goal: payload.goal.trim(), operation, ...(url ? { url } : {}),
    ...(queryOperation ? { query: payload.query.trim(), source: payload.source, limit } : {}),
    ...(operation === "research" ? { candidateLimit, schema } : {}),
    ...(operation === "extract" ? { schema } : {}),
    ...(maxUrls !== undefined ? { maxUrls } : {}),
    ...(maxPages !== undefined ? { maxPages } : {}),
    ...(maxDepth !== undefined ? { maxDepth } : {}),
    cacheMode, limits,
  };
}
