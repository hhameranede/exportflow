export class FetchAdapterError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.name = "FetchAdapterError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export const HTTP_FETCH_LIMITS = Object.freeze({
  maxUrlLength: 2048,
  maxResponseBytes: 1_048_576,
  timeoutMs: 8_000,
  maxRedirects: 3,
});

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".home",
  ".lan",
  ".test",
  ".invalid",
  ".onion",
  ".arpa",
];
const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "exportflow.me",
  "www.exportflow.me",
  "exportflow-platform.hhameranede.workers.dev",
]);

function invalidUrl(message) {
  return new FetchAdapterError("URL_NOT_ALLOWED", message, 400);
}

function isIpv4Literal(hostname) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || /^[0-9.]+$/.test(hostname);
}

function isBlockedHostname(hostname) {
  return BLOCKED_HOSTS.has(hostname) ||
    BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Accepts only canonical public DNS hostnames over HTTP(S).
 * IP literals, local names, credentials, and non-standard ports are denied.
 */
export function validatePublicHttpUrl(input) {
  if (typeof input !== "string" || input.length === 0 || input.length > HTTP_FETCH_LIMITS.maxUrlLength) {
    throw invalidUrl("URL is missing or exceeds the allowed length.");
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    throw invalidUrl("URL could not be parsed.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw invalidUrl("Only HTTP and HTTPS URLs are supported.");
  }
  if (url.username || url.password) {
    throw invalidUrl("URLs containing embedded credentials are not allowed.");
  }
  if (url.port) {
    throw invalidUrl("Only the default HTTP and HTTPS ports are allowed.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname.startsWith("[") || hostname.includes(":") || isIpv4Literal(hostname)) {
    throw invalidUrl("IP-literal and non-domain destinations are not allowed.");
  }
  if (!hostname.includes(".") || isBlockedHostname(hostname)) {
    throw invalidUrl("Local, reserved, and single-label hostnames are not allowed.");
  }

  const labels = hostname.split(".");
  const validHostname = labels.every((label) =>
    label.length > 0 &&
    label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
  if (!validHostname || hostname.length > 253) {
    throw invalidUrl("Destination must be a valid public DNS hostname.");
  }

  // Do not allow this service to recursively fetch itself.
  url.hostname = hostname;
  url.hash = "";
  return url;
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
