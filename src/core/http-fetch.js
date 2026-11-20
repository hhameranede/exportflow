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
  timeoutMs: 8_000,
  maxRedirects: 3,
});

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
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

async function cancelBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // The stream may already be closed or canceled.
  }
}

function normalizeReceiptContentType(contentType) {
  const mime = String(contentType || "").split(";")[0].trim().toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime) ? mime : null;
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

async function readTextBody(response, maxBytes, signal, onBytesRead) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    await cancelBody(response);
    throw new FetchAdapterError("RESPONSE_TOO_LARGE", "Upstream response exceeds the configured size limit.", 413);
  }

  if (!response.body) {
    return { text: "", bytes: 0 };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (typeof onBytesRead === "function") {
        try {
          onBytesRead(totalBytes);
        } catch {
          // Measurement callbacks are observational only.
        }
      }
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new FetchAdapterError("RESPONSE_TOO_LARGE", "Upstream response exceeds the configured size limit.", 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof FetchAdapterError) throw error;
    if (signal?.aborted) {
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
    text: new TextDecoder("utf-8", { fatal: false }).decode(merged),
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
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      throw new FetchAdapterError("UPSTREAM_FETCH_FAILED", "Request was aborted.", 499);
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    while (true) {
      const current = currentUrl.href;
      if (visited.has(current)) {
        throw new FetchAdapterError("REDIRECT_LOOP", "Upstream redirect loop detected.", 502);
      }
      visited.add(current);

      const attempt = ++attemptsStarted;
      const attemptStartedMs = Date.now();
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
          declaredResponseBytes: response ? getDeclaredResponseBytes(response) : null,
          responseBodyBytesRead,
          bytesSource: "stream_reader_observed",
          elapsedMs: Math.max(0, Date.now() - attemptStartedMs),
          elapsedBasis: "io_inclusive_wall_elapsed_not_cpu",
          errorCode: typeof errorCode === "string" ? errorCode : null,
        });
      };

      try {
        response = await fetchImpl(current, {
          method: "GET",
          redirect: "manual",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            accept: "text/html,application/xhtml+xml,application/json,application/xml,text/plain;q=0.9",
            ...(typeof options.userAgent === "string" && options.userAgent.length <= 200
              ? { "user-agent": options.userAgent }
              : {}),
          },
        });
      } catch {
        if (timedOut) {
          emitReceipt("timeout", "UPSTREAM_TIMEOUT");
          throw new FetchAdapterError("UPSTREAM_TIMEOUT", "Upstream request timed out.", 504);
        }
        emitReceipt("network_error", "UPSTREAM_FETCH_FAILED");
        throw new FetchAdapterError("UPSTREAM_FETCH_FAILED", "Could not retrieve the upstream resource.", 502);
      }

      try {
        if (REDIRECT_STATUSES.has(response.status)) {
          const location = response.headers.get("location");
          await cancelBody(response);
          if (!location) {
            const error = new FetchAdapterError("INVALID_REDIRECT", "Upstream redirect did not include a Location header.", 502);
            emitReceipt("redirect_rejected", error.code);
            throw error;
          }
          if (redirectChain.length >= maxRedirects) {
            const error = new FetchAdapterError("TOO_MANY_REDIRECTS", "Upstream exceeded the redirect limit.", 502);
            emitReceipt("redirect_rejected", error.code);
            throw error;
          }

          let nextUrl;
          try {
            nextUrl = validatePublicHttpUrl(new URL(location, currentUrl).href);
          } catch (error) {
            const redirectError = error instanceof FetchAdapterError
              ? new FetchAdapterError("REDIRECT_NOT_ALLOWED", "Upstream redirected to a disallowed destination.", 502)
              : new FetchAdapterError("INVALID_REDIRECT", "Upstream returned an invalid redirect URL.", 502);
            emitReceipt("redirect_rejected", redirectError.code);
            throw redirectError;
          }
          if (allowedOrigin && nextUrl.origin !== allowedOrigin) {
            const error = new FetchAdapterError("REDIRECT_NOT_ALLOWED", "Redirect left the allowed origin.", 502);
            emitReceipt("redirect_rejected", error.code);
            throw error;
          }
          if (currentUrl.protocol === "https:" && nextUrl.protocol !== "https:") {
            const error = new FetchAdapterError("REDIRECT_DOWNGRADE", "HTTPS redirects cannot downgrade to HTTP.", 502);
            emitReceipt("redirect_rejected", error.code);
            throw error;
          }

          redirectChain.push({
            status: response.status,
            from: currentUrl.href,
            to: nextUrl.href,
          });
          emitReceipt("redirect");
          currentUrl = nextUrl;
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        if (response.body && !isTextContentType(contentType)) {
          await cancelBody(response);
          const error = new FetchAdapterError("UNSUPPORTED_CONTENT_TYPE", "Only text, HTML, JSON, and XML responses are supported.", 415);
          emitReceipt("response_rejected", error.code);
          throw error;
        }

        let body;
        try {
          body = await readTextBody(response, maxBytes, controller.signal, (bytes) => {
            responseBodyBytesRead = bytes;
          });
        } catch (error) {
          emitReceipt(error?.code === "UPSTREAM_TIMEOUT" ? "timeout" : "read_failed", error?.code || null);
          throw error;
        }
        emitReceipt("response");
        const retrievedAt = new Date().toISOString();

        return {
          ok: response.ok,
          status: response.status,
          contentType,
          body: body.text,
          bytes: body.bytes,
          originalUrl: initialUrl.href,
          finalUrl: currentUrl.href,
          redirects: redirectChain,
          retrievedAt,
        };
      } catch (error) {
        if (!receiptEmitted) {
          emitReceipt(
            error?.code === "UPSTREAM_TIMEOUT" ? "timeout" : "failed",
            typeof error?.code === "string" ? error.code : null,
          );
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
