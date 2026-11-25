import { EGRESS_POLICY, EgressPolicyError, validateEgressTarget } from "./egress-guard.js";

export class FetchAdapterError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.name = "FetchAdapterError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export const HTTP_FETCH_LIMITS = Object.freeze({
  maxUrlLength: EGRESS_POLICY.maxUrlLength,
  maxResponseBytes: 1_048_576,
  maxResponseChunks: 8_192,
  timeoutMs: 8_000,
  maxRedirects: 3,
});

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function monotonicNow() {
  const read = globalThis.performance?.now;
  if (typeof read === "function") {
    const value = read.call(globalThis.performance);
    if (Number.isFinite(value)) return value;
  }
  return Date.now();
}

function normalizeReceiptContentType(contentType) {
  const mime = String(contentType || "").split(";")[0].trim().toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime) ? mime : null;
}

function normalizeCacheStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return /^[A-Z_]{2,24}$/.test(status) ? status : null;
}

function getDeclaredResponseBytes(response) {
  const value = response?.headers?.get("content-length") || "";
  if (!/^\d+$/.test(value)) return null;
  const bytes = Number(value);
  return Number.isSafeInteger(bytes) ? bytes : null;
}

function reportUsageReceipt(callback, receipt) {
  if (typeof callback !== "function") return;
  try {
    callback(Object.freeze(receipt));
  } catch {
    // Usage observation must never change Fetch success or failure behavior.
  }
}
function invalidUrl(message) {
  return new FetchAdapterError("URL_NOT_ALLOWED", message, 400);
}

/**
 * Applies ExportFlow's application-level egress policy.
 * The network connection itself must use Cloudflare Workers' native fetch()
 * runtime so its outbound proxy can enforce the platform network boundary.
 */
export function validatePublicHttpUrl(input) {
  try {
    return validateEgressTarget(input);
  } catch (error) {
    if (error instanceof EgressPolicyError) {
      throw invalidUrl(error.message);
    }
    throw error;
  }
}

function isTextContentType(contentType) {
  const mime = String(contentType || "").split(";")[0].trim().toLowerCase();
  return mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/xhtml+xml" ||
    mime.endsWith("+json") ||
    mime.endsWith("+xml");
}

function createResponseTextDecoder(contentType) {
  const value = String(contentType || "");
  const match = /(?:^|;)\s*charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i.exec(value);
  const charset = (match?.[1] || match?.[2] || match?.[3] || "utf-8").trim();
  try {
    return new TextDecoder(charset, { fatal: false });
  } catch {
    throw new FetchAdapterError(
      "UNSUPPORTED_CHARSET",
      "Upstream declared a character encoding that this runtime does not support.",
      415,
    );
  }
}

// Upstream-controlled stream cancellation is best-effort. Never let a slow
// or stalled cancel() callback hold the task open after its result is unusable.
function cancelBestEffort(cancel) {
  try {
    const cancellation = cancel();
    if (cancellation && typeof cancellation.catch === "function") {
      void cancellation.catch(() => {});
    }
  } catch {
    // The stream may already be closed, errored, or locked by the runtime.
  }
}

function cancelBody(response) {
  cancelBestEffort(() => response.body?.cancel());
}

function cancelReader(reader) {
  cancelBestEffort(() => reader.cancel());
}

async function readTextBody(response, maxBytes, signal, getAbortCode, onBytesRead, decoder) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    cancelBody(response);
    throw new FetchAdapterError("RESPONSE_TOO_LARGE", "Upstream response exceeds the configured size limit.", 413);
  }

  if (!response.body) {
    return { text: "", bytes: 0 };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  let chunksRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunksRead += 1;
      if (chunksRead > HTTP_FETCH_LIMITS.maxResponseChunks) {
        cancelReader(reader);
        throw new FetchAdapterError("RESPONSE_TOO_LARGE", "Upstream response contains too many chunks.", 413);
      }
      totalBytes += value.byteLength;
      try {
        onBytesRead?.(totalBytes);
      } catch {
        // Usage measurement is observational only.
      }
      if (totalBytes > maxBytes) {
        cancelReader(reader);
        throw new FetchAdapterError("RESPONSE_TOO_LARGE", "Upstream response exceeds the configured size limit.", 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    cancelReader(reader);
    if (error instanceof FetchAdapterError) throw error;
    if (signal?.aborted) {
      const abortCode = getAbortCode?.();
      if (abortCode === "TASK_CANCELLED") {
        throw new FetchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499);
      }
      throw new FetchAdapterError("UPSTREAM_TIMEOUT", "Upstream request timed out.", 504);
    }
    throw new FetchAdapterError("UPSTREAM_FETCH_FAILED", "Could not read the upstream response stream.", 502);
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    text: decoder.decode(merged),
    bytes: totalBytes,
  };
}

/**
 * Bounded, unauthenticated GET of public text resources.
 * The caller must enforce its own API authentication and tenant quotas.
 */
export async function fetchPublicResource(input, options = {}) {
  const maxBytes = options.maxBytes ?? HTTP_FETCH_LIMITS.maxResponseBytes;
  const timeoutMs = options.timeoutMs ?? HTTP_FETCH_LIMITS.timeoutMs;
  const maxRedirects = options.maxRedirects ?? HTTP_FETCH_LIMITS.maxRedirects;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const onUsageReceipt = options.onUsageReceipt;
  const cacheMode = options.cacheMode ?? "default";
  if (!["default", "bypass"].includes(cacheMode)) {
    throw new FetchAdapterError("INVALID_LIMIT", "Cache mode must be 'default' or 'bypass'.", 400);
  }
  let attemptsStarted = 0;
  let allowedOrigin = null;
  if (options.allowedOrigin !== undefined) {
    try {
      const parsedOrigin = new URL(options.allowedOrigin);
      if (!["http:", "https:"].includes(parsedOrigin.protocol) || parsedOrigin.origin !== options.allowedOrigin) {
        throw new Error("Expected an exact HTTP(S) origin.");
      }
      allowedOrigin = parsedOrigin.origin;
    } catch {
      throw new FetchAdapterError("INVALID_LIMIT", "Allowed origin must be a valid HTTP(S) origin.", 500);
    }
    if (!["http:", "https:"].includes(new URL(allowedOrigin).protocol)) {
      throw new FetchAdapterError("INVALID_LIMIT", "Allowed origin must use HTTP or HTTPS.", 500);
    }
  }

  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > HTTP_FETCH_LIMITS.maxResponseBytes) {
    throw new FetchAdapterError("INVALID_LIMIT", "Response size limit is outside the supported range.", 500);
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > HTTP_FETCH_LIMITS.timeoutMs) {
    throw new FetchAdapterError("INVALID_LIMIT", "Timeout is outside the supported range.", 500);
  }
  if (!Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > HTTP_FETCH_LIMITS.maxRedirects) {
    throw new FetchAdapterError("INVALID_LIMIT", "Redirect limit is outside the supported range.", 500);
  }
  if (typeof fetchImpl !== "function") {
    throw new FetchAdapterError("FETCH_UNAVAILABLE", "The runtime does not provide fetch().", 500);
  }

  const initialUrl = validatePublicHttpUrl(input);
  let currentUrl = initialUrl;
  if (allowedOrigin && currentUrl.origin !== allowedOrigin) {
    throw new FetchAdapterError("URL_NOT_ALLOWED", "URL is outside the allowed origin.", 400);
  }
  const visited = new Set();
  const redirectChain = [];
  const controller = new AbortController();
  let timedOut = false;
  let callerCancelled = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const externalSignal = options.signal;
  const onExternalAbort = () => {
    callerCancelled = true;
    controller.abort();
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      throw new FetchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499);
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    while (true) {
      if (callerCancelled) {
        throw new FetchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499);
      }
      if (timedOut) {
        throw new FetchAdapterError("UPSTREAM_TIMEOUT", "Upstream request timed out.", 504);
      }
      const current = currentUrl.href;
      if (visited.has(current)) {
        throw new FetchAdapterError("REDIRECT_LOOP", "Upstream redirect loop detected.", 502);
      }
      visited.add(current);

      const attempt = ++attemptsStarted;
      const attemptStartedMs = monotonicNow();
      let response;
      let responseBodyBytesRead = 0;
      let receiptEmitted = false;
      const emitReceipt = (outcome, errorCode = null) => {
        if (receiptEmitted) return;
        receiptEmitted = true;
        reportUsageReceipt(onUsageReceipt, {
          schemaVersion: 1,
          attempt,
          outcome,
          httpStatus: response && Number.isInteger(response.status) ? response.status : null,
          contentType: normalizeReceiptContentType(response?.headers?.get("content-type")),
          cacheStatus: response ? normalizeCacheStatus(response.headers.get("cf-cache-status")) : null,
          declaredResponseBytes: response ? getDeclaredResponseBytes(response) : null,
          responseBodyBytesRead,
          bytesSource: "stream_reader_observed",
          elapsedMs: Math.max(0, monotonicNow() - attemptStartedMs),
          elapsedBasis: "io_inclusive_wall_elapsed_not_cpu",
          errorCode: typeof errorCode === "string" ? errorCode : null,
        });
      };
      try {
        response = await fetchImpl(current, {
          method: "GET",
          redirect: "manual",
          ...(cacheMode === "bypass" ? { cache: "no-store" } : {}),
          // Do not force cache eligibility for arbitrary HTML/API responses.
          // Cloudflare may cache standard static extensions or responses that
          // explicitly opt in via origin Cache-Control / Expires headers.
          // Deliberately do not set cacheEverything or force a cache TTL.
          signal: controller.signal,
          headers: {
            accept: "text/html,application/xhtml+xml,application/json,application/xml,text/plain;q=0.9",
            ...(typeof options.userAgent === "string" && options.userAgent.length <= 200
              ? { "user-agent": options.userAgent }
              : {}),
          },
        });
      } catch {
        if (callerCancelled) {
          emitReceipt("cancelled", "TASK_CANCELLED");
          throw new FetchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499);
        }
        if (timedOut) {
          emitReceipt("timeout", "UPSTREAM_TIMEOUT");
          throw new FetchAdapterError("UPSTREAM_TIMEOUT", "Upstream request timed out.", 504);
        }
        emitReceipt("network_error", "UPSTREAM_FETCH_FAILED");
        throw new FetchAdapterError("UPSTREAM_FETCH_FAILED", "Could not retrieve the upstream resource.", 502);
      }

      try {
      if (callerCancelled) {
        cancelBody(response);
        throw new FetchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499);
      }
      if (timedOut) {
        cancelBody(response);
        throw new FetchAdapterError("UPSTREAM_TIMEOUT", "Upstream request timed out.", 504);
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        cancelBody(response);
        if (!location) {
          throw new FetchAdapterError("INVALID_REDIRECT", "Upstream redirect did not include a Location header.", 502);
        }
        if (redirectChain.length >= maxRedirects) {
          throw new FetchAdapterError("TOO_MANY_REDIRECTS", "Upstream exceeded the redirect limit.", 502);
        }

        let nextUrl;
        try {
          nextUrl = validatePublicHttpUrl(new URL(location, currentUrl).href);
        } catch (error) {
          if (error instanceof FetchAdapterError) {
            throw new FetchAdapterError("REDIRECT_NOT_ALLOWED", "Upstream redirected to a disallowed destination.", 502);
          }
          throw new FetchAdapterError("INVALID_REDIRECT", "Upstream returned an invalid redirect URL.", 502);
        }
        if (allowedOrigin && nextUrl.origin !== allowedOrigin) {
          throw new FetchAdapterError("REDIRECT_NOT_ALLOWED", "Redirect left the allowed origin.", 502);
        }
        if (currentUrl.protocol === "https:" && nextUrl.protocol !== "https:") {
          throw new FetchAdapterError("REDIRECT_DOWNGRADE", "HTTPS redirects cannot downgrade to HTTP.", 502);
        }

        emitReceipt("redirect");
        redirectChain.push({
          status: response.status,
          from: currentUrl.href,
          to: nextUrl.href,
        });
        currentUrl = nextUrl;
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      if (response.body && !isTextContentType(contentType)) {
        cancelBody(response);
        throw new FetchAdapterError("UNSUPPORTED_CONTENT_TYPE", "Only text, HTML, JSON, and XML responses are supported.", 415);
      }

      let decoder;
      try {
        decoder = createResponseTextDecoder(contentType);
      } catch (error) {
        cancelBody(response);
        throw error;
      }
      const { text, bytes } = await readTextBody(
        response,
        maxBytes,
        controller.signal,
        () => callerCancelled ? "TASK_CANCELLED" : timedOut ? "UPSTREAM_TIMEOUT" : null,
        (bytes) => { responseBodyBytesRead = bytes; },
        decoder,
      );
      if (callerCancelled) {
        throw new FetchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499);
      }
      if (timedOut) {
        throw new FetchAdapterError("UPSTREAM_TIMEOUT", "Upstream request timed out.", 504);
      }
      const retrievedAt = new Date().toISOString();
      emitReceipt("response");

      return {
        ok: response.ok,
        status: response.status,
        contentType,
        cacheStatus: normalizeCacheStatus(response.headers.get("cf-cache-status")),
        body: text,
        bytes,
        originalUrl: initialUrl.href,
        finalUrl: currentUrl.href,
        redirects: redirectChain,
        retrievedAt,
      };
      } catch (error) {
        if (!receiptEmitted) {
          const code = typeof error?.code === "string" ? error.code : null;
          const outcome = code === "TASK_CANCELLED"
            ? "cancelled"
            : code === "UPSTREAM_TIMEOUT"
              ? "timeout"
              : code?.startsWith("REDIRECT_") || code === "TOO_MANY_REDIRECTS" || code === "INVALID_REDIRECT"
                ? "redirect_rejected"
                : code === "UNSUPPORTED_CONTENT_TYPE" || code === "RESPONSE_TOO_LARGE"
                  ? "response_rejected"
                  : "failed";
          emitReceipt(outcome, code);
        }
        throw error;
      }
    }
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}
