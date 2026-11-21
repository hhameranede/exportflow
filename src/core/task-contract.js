import { HTTP_FETCH_LIMITS, validatePublicHttpUrl } from "./http-fetch.js";

export const TASK_REQUEST_LIMITS = Object.freeze({
  maxBodyBytes: 32_768,
  maxBodyChunks: 8_192,
  maxGoalLength: 2_000,
});

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "goal",
  "url",
  "operation",
  "requiresJavascript",
  "requiresInteraction",
  "limits",
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
  if (!isPlainObject(payload)) {
    throw new TaskContractError("INVALID_TASK", "Task payload must be a JSON object.", 400);
  }

  for (const key of Object.keys(payload)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      throw new TaskContractError("INVALID_TASK", `Unsupported task property: ${key}.`, 400);
    }
  }

  if (typeof payload.goal !== "string" || !payload.goal.trim() || payload.goal.length > TASK_REQUEST_LIMITS.maxGoalLength) {
    throw new TaskContractError("INVALID_GOAL", "Task goal must be a non-empty string up to 2000 characters.", 400);
  }

  const operation = payload.operation === undefined ? "fetch" : payload.operation;
  if (typeof operation !== "string" || !KNOWN_OPERATIONS.has(operation)) {
    throw new TaskContractError("UNSUPPORTED_OPERATION", "Unsupported task operation.", 400);
  }
  if (operation !== "fetch") {
    throw new TaskContractError(
      "OPERATION_NOT_ENABLED",
      `Operation '${operation}' is not enabled on the public execution endpoint yet; only 'fetch' is available.`,
      501,
    );
  }

  if (payload.requiresJavascript !== undefined && typeof payload.requiresJavascript !== "boolean") {
    throw new TaskContractError("INVALID_TASK", "requiresJavascript must be a boolean.", 400);
  }
  if (payload.requiresInteraction !== undefined && typeof payload.requiresInteraction !== "boolean") {
    throw new TaskContractError("INVALID_TASK", "requiresInteraction must be a boolean.", 400);
  }

  let validatedUrl;
  try {
    validatedUrl = validatePublicHttpUrl(payload.url);
  } catch (error) {
    throw new TaskContractError(
      error?.code || "URL_NOT_ALLOWED",
      error?.message || "Destination URL is not allowed.",
      400,
    );
  }

  const limits = {};
  if (payload.limits !== undefined) {
    if (!isPlainObject(payload.limits)) {
      throw new TaskContractError("INVALID_LIMIT", "limits must be a plain object.", 400);
    }
    for (const key of Object.keys(payload.limits)) {
      if (!ALLOWED_LIMIT_KEYS.has(key)) {
        throw new TaskContractError("INVALID_LIMIT", `Unsupported limit property: ${key}.`, 400);
      }
    }
    if (payload.limits.timeoutMs !== undefined) {
      if (!Number.isInteger(payload.limits.timeoutMs) ||
          payload.limits.timeoutMs < 1 ||
          payload.limits.timeoutMs > HTTP_FETCH_LIMITS.timeoutMs) {
        throw new TaskContractError(
          "INVALID_LIMIT",
          `limits.timeoutMs must be an integer between 1 and ${HTTP_FETCH_LIMITS.timeoutMs}.`,
          400,
        );
      }
      limits.timeoutMs = payload.limits.timeoutMs;
    }
    if (payload.limits.maxBytes !== undefined) {
      if (!Number.isInteger(payload.limits.maxBytes) ||
          payload.limits.maxBytes < 1 ||
          payload.limits.maxBytes > HTTP_FETCH_LIMITS.maxResponseBytes) {
        throw new TaskContractError(
          "INVALID_LIMIT",
          `limits.maxBytes must be an integer between 1 and ${HTTP_FETCH_LIMITS.maxResponseBytes}.`,
          400,
        );
      }
      limits.maxBytes = payload.limits.maxBytes;
    }
    if (payload.limits.maxRedirects !== undefined) {
      if (!Number.isInteger(payload.limits.maxRedirects) ||
          payload.limits.maxRedirects < 0 ||
          payload.limits.maxRedirects > HTTP_FETCH_LIMITS.maxRedirects) {
        throw new TaskContractError(
          "INVALID_LIMIT",
          `limits.maxRedirects must be an integer between 0 and ${HTTP_FETCH_LIMITS.maxRedirects}.`,
          400,
        );
      }
      limits.maxRedirects = payload.limits.maxRedirects;
    }
  }

  return {
    goal: payload.goal.trim(),
    url: validatedUrl.href,
    operation: "fetch",
    requiresJavascript: payload.requiresJavascript === true,
    requiresInteraction: payload.requiresInteraction === true,
    limits,
  };
}
