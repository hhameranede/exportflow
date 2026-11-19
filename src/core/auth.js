const MAX_TOKEN_LENGTH = 512;
const MAX_AUTH_HEADER_LENGTH = MAX_TOKEN_LENGTH + 32;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 60;
const MAX_TRACKED_CLIENTS = 1_000;

async function sha256ConstantTimeEqual(a, b) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto subtle digest is unavailable.");
  }
  const encoder = new TextEncoder();
  const [aDigest, bDigest] = await Promise.all([
    subtle.digest("SHA-256", encoder.encode(a)),
    subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const aBytes = new Uint8Array(aDigest);
  const bBytes = new Uint8Array(bDigest);
  let diff = 0;
  for (let i = 0; i < 32; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

export async function authenticateRequest(request, env = {}) {
  const configuredToken = typeof env?.EXPORTFLOW_API_TOKEN === "string"
    ? env.EXPORTFLOW_API_TOKEN.trim()
    : "";

  if (!configuredToken) {
    return {
      ok: false,
      httpStatus: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: "Task execution is disabled until EXPORTFLOW_API_TOKEN is configured.",
    };
  }

  const header = request.headers.get("authorization");
  if (!header) {
    return {
      ok: false,
      httpStatus: 401,
      code: "UNAUTHORIZED",
      message: "Authorization Bearer token is required.",
      headers: { "www-authenticate": 'Bearer realm="exportflow"' },
    };
  }

  if (header.length > MAX_AUTH_HEADER_LENGTH) {
    return {
      ok: false,
      httpStatus: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header exceeds the maximum supported length.",
      headers: { "www-authenticate": 'Bearer realm="exportflow"' },
    };
  }

  const match = /^Bearer[ ]+([^\s]+)$/i.exec(header.trim());
  if (!match || match[1].length > MAX_TOKEN_LENGTH) {
    return {
      ok: false,
      httpStatus: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header must use a valid Bearer token.",
      headers: { "www-authenticate": 'Bearer realm="exportflow"' },
    };
  }

  const matched = await sha256ConstantTimeEqual(match[1], configuredToken);
  if (!matched) {
    return {
      ok: false,
      httpStatus: 401,
      code: "INVALID_TOKEN",
      message: "The provided Bearer token is invalid.",
      headers: { "www-authenticate": 'Bearer realm="exportflow", error="invalid_token"' },
    };
  }

  return {
    ok: true,
    clientId: "default-authorized-client",
  };
}

export function createRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
  now = () => Date.now(),
} = {}) {
  if (!Number.isInteger(windowMs) || windowMs < 1) {
    throw new TypeError("Rate limiter windowMs must be a positive integer.");
  }
  if (!Number.isInteger(maxRequests) || maxRequests < 1) {
    throw new TypeError("Rate limiter maxRequests must be a positive integer.");
  }

  const buckets = new Map();

  return {
    check(key) {
      const currentMs = now();
      if (buckets.size >= MAX_TRACKED_CLIENTS) {
        for (const [entryKey, entry] of buckets.entries()) {
          if (entry.resetAt <= currentMs) buckets.delete(entryKey);
        }
        if (buckets.size >= MAX_TRACKED_CLIENTS) {
          const oldestKey = buckets.keys().next().value;
          if (oldestKey !== undefined) buckets.delete(oldestKey);
        }
      }

      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= currentMs) {
        const next = { count: 1, resetAt: currentMs + windowMs };
        buckets.set(key, next);
        return {
          allowed: true,
          remaining: Math.max(0, maxRequests - 1),
          resetAtMs: next.resetAt,
        };
      }

      if (existing.count >= maxRequests) {
        const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - currentMs) / 1000));
        return {
          allowed: false,
          remaining: 0,
          resetAtMs: existing.resetAt,
          retryAfterSec,
        };
      }

      existing.count += 1;
      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - existing.count),
        resetAtMs: existing.resetAt,
      };
    },
  };
}
