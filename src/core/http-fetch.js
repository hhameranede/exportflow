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

async function readTextBody(response, maxBytes) {
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
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new FetchAdapterError("RESPONSE_TOO_LARGE", "Upstream response exceeds the configured size limit.", 413);
      }
      chunks.push(value);
    }
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

  let currentUrl = validatePublicHttpUrl(input);
  const visited = new Set();
  const redirectChain = [];
  const signal = AbortSignal.timeout(timeoutMs);

  while (true) {
    const current = currentUrl.href;
    if (visited.has(current)) {
      throw new FetchAdapterError("REDIRECT_LOOP", "Upstream redirect loop detected.", 502);
    }
    visited.add(current);

    let response;
    try {
      response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal,
        headers: {
          accept: "text/html,application/xhtml+xml,application/json,application/xml,text/plain;q=0.9",
        },
      });
    } catch {
      if (signal.aborted) {
        throw new FetchAdapterError("UPSTREAM_TIMEOUT", "Upstream request timed out.", 504);
      }
      throw new FetchAdapterError("UPSTREAM_FETCH_FAILED", "Could not retrieve the upstream resource.", 502);
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      await cancelBody(response);
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
      if (currentUrl.protocol === "https:" && nextUrl.protocol !== "https:") {
        throw new FetchAdapterError("REDIRECT_DOWNGRADE", "HTTPS redirects cannot downgrade to HTTP.", 502);
      }

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
      await cancelBody(response);
      throw new FetchAdapterError("UNSUPPORTED_CONTENT_TYPE", "Only text, HTML, JSON, and XML responses are supported.", 415);
    }

    const { text, bytes } = await readTextBody(response, maxBytes);
    const retrievedAt = new Date().toISOString();

    return {
      ok: response.ok,
      status: response.status,
      contentType,
      body: text,
      bytes,
      originalUrl: validatePublicHttpUrl(input).href,
      finalUrl: currentUrl.href,
      redirects: redirectChain,
      retrievedAt,
    };
  }
}
