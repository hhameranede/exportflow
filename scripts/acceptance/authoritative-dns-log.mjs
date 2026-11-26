const DEFAULT_LOG_ENDPOINT = "http://1u.ms/log";
const MAX_LOG_CHARACTERS = 64_000;

export function createAuthoritativeDnsLogUrl(hostname, sessionId, endpoint = DEFAULT_LOG_ENDPOINT) {
  if (typeof hostname !== "string" || !hostname.endsWith(".1u.ms")) {
    throw new TypeError("A 1u.ms hostname is required for authoritative DNS log capture.");
  }
  if (typeof sessionId !== "string" || !/^worker-[a-z0-9-]{8,80}$/.test(sessionId)) {
    throw new TypeError("A run-scoped Worker session ID is required for authoritative DNS log capture.");
  }
  if (!hostname.includes("-rr-" + sessionId + ".1u.ms")) {
    throw new TypeError("The DNS log hostname must belong to the requested Worker session.");
  }
  const url = new URL(endpoint);
  if (url.protocol !== "http:" || url.hostname !== "1u.ms" || url.pathname !== "/log") {
    throw new TypeError("DNS log capture is restricted to the 1u.ms HTTP log endpoint.");
  }
  url.searchParams.set("grep", sessionId);
  return url;
}

export async function captureAuthoritativeDnsLog({
  hostname,
  sessionId,
  fetchImpl = globalThis.fetch,
  endpoint = DEFAULT_LOG_ENDPOINT,
  timeoutMs = 8_000,
} = {}) {
  const url = createAuthoritativeDnsLogUrl(hostname, sessionId, endpoint);
  const capturedAt = new Date().toISOString();
  if (typeof fetchImpl !== "function") {
    return {
      status: "unavailable",
      capturedAt,
      hostname,
      sessionId,
      url: url.href,
      error: { name: "TypeError", message: "A Fetch implementation is required." },
    };
  }

  try {
    const response = await fetchImpl(url.href, {
      headers: { accept: "text/plain, text/html;q=0.9, */*;q=0.1" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const rawBody = await response.text();
    return {
      status: response.ok ? "captured" : "http_error",
      capturedAt,
      hostname,
      sessionId,
      url: url.href,
      httpStatus: response.status,
      contentType: response.headers.get("content-type") || "",
      body: rawBody.slice(0, MAX_LOG_CHARACTERS),
      truncated: rawBody.length > MAX_LOG_CHARACTERS,
    };
  } catch (error) {
    return {
      status: "unavailable",
      capturedAt,
      hostname,
      sessionId,
      url: url.href,
      error: {
        name: String(error?.name || "Error").slice(0, 80),
        message: String(error?.message || "Authoritative DNS log fetch failed.").slice(0, 500),
      },
    };
  }
}
