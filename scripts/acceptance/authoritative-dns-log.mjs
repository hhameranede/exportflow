const DEFAULT_LOG_ENDPOINT = "http://1u.ms/last";
const MAX_LOG_CHARACTERS = 64_000;
const MAX_MATCHING_RECORDS = 32;
const MAX_RECORD_CHARACTERS = 1_200;

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
  if (url.protocol !== "http:" || url.hostname !== "1u.ms" || url.pathname !== "/last") {
    throw new TypeError("DNS log capture is restricted to the finite 1u.ms /last snapshot endpoint.");
  }
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
      headers: { accept: "text/plain, */*;q=0.1" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const rawBody = await response.text();
    if (!response.ok) {
      return {
        status: "http_error",
        capturedAt,
        hostname,
        sessionId,
        url: url.href,
        httpStatus: response.status,
        contentType: response.headers.get("content-type") || "",
        error: {
          name: "HttpError",
          message: ("1u.ms /last returned HTTP " + response.status + ": " + rawBody.slice(0, 500)).slice(0, 600),
        },
      };
    }

    // /last is a finite snapshot of the latest 100 DNS requests. Keep only
    // records containing this unique Worker hostname; never upload other
    // users' DNS activity into the CI artifact.
    const truncated = rawBody.length > MAX_LOG_CHARACTERS;
    const boundedBody = truncated ? rawBody.slice(-MAX_LOG_CHARACTERS) : rawBody;
    const snapshotRecords = boundedBody.split(/\r?\n/).filter(Boolean);
    const matchingRecords = snapshotRecords
      .filter((record) => record.includes(hostname))
      .map((record) => record.slice(0, MAX_RECORD_CHARACTERS));

    return {
      status: "captured",
      capturedAt,
      hostname,
      sessionId,
      url: url.href,
      httpStatus: response.status,
      contentType: response.headers.get("content-type") || "",
      snapshotRecordCount: snapshotRecords.length,
      matchingRecordCount: snapshotRecords.filter((record) => record.includes(hostname)).length,
      matchingRecords: matchingRecords.slice(0, MAX_MATCHING_RECORDS),
      truncated,
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
        message: String(error?.message || "Authoritative DNS snapshot fetch failed.").slice(0, 500),
      },
    };
  }
}
