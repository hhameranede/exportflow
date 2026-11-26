const DEFAULT_LOG_ENDPOINT = "http://1u.ms/log";
const MAX_LOG_CHARACTERS = 64_000;
const MAX_MATCHING_RECORDS = 32;
const MAX_RECORD_CHARACTERS = 1_200;

function unavailableCapture({ capturedAt, hostname, sessionId, url, error }) {
  return {
    async finish() {
      return {
        status: "unavailable",
        capturedAt,
        hostname,
        sessionId,
        url: url.href,
        error: {
          name: String(error?.name || "Error").slice(0, 80),
          message: String(error?.message || "Authoritative DNS stream could not be opened.").slice(0, 500),
        },
      };
    },
  };
}

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
  if (
    url.protocol !== "http:" ||
    url.hostname !== "1u.ms" ||
    url.pathname !== "/log" ||
    url.search ||
    url.hash
  ) {
    throw new TypeError("DNS log capture is restricted to the filtered 1u.ms /log stream endpoint.");
  }
  // Session IDs are restricted to letters, digits and hyphens, so they are
  // safe as a literal RE2/Go regexp filter for the public 1u.ms log viewer.
  url.searchParams.set("grep", sessionId);
  return url;
}

export function hasAuthoritativeAAnswer(matchingRecords, hostname, address) {
  if (!Array.isArray(matchingRecords) ||
      typeof hostname !== "string" ||
      typeof address !== "string") {
    return false;
  }

  return matchingRecords.some((record) => {
    if (typeof record !== "string") return false;
    const separator = record.indexOf("->");
    if (separator < 0) return false;
    const question = record.slice(0, separator);
    const answer = record.slice(separator + 2);
    const query = question.match(/\bA\s+"([^"]+)"\s*$/);
    if (!query || (query[1] !== hostname && query[1] !== hostname + ".")) return false;
    return answer.split(/[^0-9.]+/).includes(address);
  });
}

export async function startAuthoritativeDnsLogCapture({
  hostname,
  sessionId,
  fetchImpl = globalThis.fetch,
  endpoint = DEFAULT_LOG_ENDPOINT,
  timeoutMs = 5_000,
} = {}) {
  const url = createAuthoritativeDnsLogUrl(hostname, sessionId, endpoint);
  const capturedAt = new Date().toISOString();
  if (typeof fetchImpl !== "function") {
    return unavailableCapture({
      capturedAt, hostname, sessionId, url,
      error: new TypeError("A Fetch implementation is required."),
    });
  }

  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetchImpl(url.href, {
      headers: { accept: "text/plain, */*;q=0.1" },
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (error) {
    return unavailableCapture({ capturedAt, hostname, sessionId, url, error });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return unavailableCapture({
      capturedAt, hostname, sessionId, url,
      error: new Error("1u.ms /log returned HTTP " + response.status + "."),
    });
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    return unavailableCapture({
      capturedAt, hostname, sessionId, url,
      error: new TypeError("1u.ms /log did not return a readable response stream."),
    });
  }

  const reader = response.body.getReader();
  let rawBody = "";
  let truncated = false;
  let streamError = null;
  let finished = false;
  let cachedResult;

  // Keep the reader active while the Worker probe is running. Calling
  // finish() cancels this intentionally infinite stream and awaits the pump.
  const pump = (async () => {
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          rawBody += decoder.decode();
          break;
        }
        if (!value) continue;

        const chunk = decoder.decode(value, { stream: true });
        const remaining = MAX_LOG_CHARACTERS - rawBody.length;
        if (remaining > 0) rawBody += chunk.slice(0, remaining);
        if (chunk.length > remaining) {
          truncated = true;
          try { await reader.cancel(); } catch { /* bounded capture cleanup */ }
          break;
        }
      }
    } catch (error) {
      streamError = error;
    }
  })();

  return {
    async finish({ drainMs = 0 } = {}) {
      if (finished) return cachedResult;
      finished = true;

      if (Number.isFinite(drainMs) && drainMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(drainMs, 2_000)));
      }
      try { await reader.cancel(); } catch { /* stream may already be closed */ }
      await pump;

      const streamRecords = rawBody.split(/\r?\n/).filter(Boolean);
      const matchingRecords = streamRecords
        .filter((record) => record.includes(hostname))
        .map((record) => record.slice(0, MAX_RECORD_CHARACTERS));

      cachedResult = {
        status: streamError ? (matchingRecords.length > 0 ? "partial" : "unavailable") : "captured",
        capturedAt,
        hostname,
        sessionId,
        url: url.href,
        httpStatus: response.status,
        contentType: response.headers.get("content-type") || "",
        streamRecordCount: streamRecords.length,
        matchingRecordCount: streamRecords.filter((record) => record.includes(hostname)).length,
        matchingRecords: matchingRecords.slice(0, MAX_MATCHING_RECORDS),
        truncated,
        ...(streamError ? {
          error: {
            name: String(streamError?.name || "Error").slice(0, 80),
            message: String(streamError?.message || "Authoritative DNS stream read failed.").slice(0, 500),
          },
        } : {}),
      };
      return cachedResult;
    },
  };
}
