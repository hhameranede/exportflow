import {
  GLOBAL_RATE_OBJECT_PROTOCOL,
  GLOBAL_RATE_REQUESTS_PER_WINDOW,
  GLOBAL_RATE_WINDOW_MS
} from "./global-rate-limit-policy.mjs";

const encoder = new TextEncoder();

export class GlobalRateLimiterUnavailableError extends Error {
  constructor(code = "global_rate_limiter_unavailable") {
    super(code);
    this.name = "GlobalRateLimiterUnavailableError";
    this.code = code;
  }
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacClientAddress(address, secret, cryptoApi) {
  const key = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await cryptoApi.subtle.sign("HMAC", key, encoder.encode(address));
  return base64Url(new Uint8Array(signature));
}

function environmentScope(request, env) {
  const configured = typeof env?.EXPORTFLOW_ENV === "string" ? env.EXPORTFLOW_ENV.trim().toLowerCase() : "";
  if (configured === "production" || configured === "preview" || configured === "local") return configured;
  const host = new URL(request.url).hostname.toLowerCase();
  return host === "exportflow.me" || host === "www.exportflow.me" ? "production" : "preview";
}

function validLimiterResult(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.allowed === "boolean" &&
    value.limit === GLOBAL_RATE_REQUESTS_PER_WINDOW &&
    Number.isInteger(value.remaining) &&
    value.remaining >= 0 &&
    Number.isInteger(value.retryAfterSeconds) &&
    value.retryAfterSeconds >= 0 &&
    Number.isInteger(value.resetAt) &&
    Number.isInteger(value.resetAfterSeconds) &&
    value.resetAfterSeconds >= 0
  );
}

/**
 * Returns null when the Pages environment has not been bound to the Durable Object.
 * Once bound, configuration or DO errors fail closed: a request must not bypass the
 * global control because the coordinator is unavailable.
 */
export async function consumeGlobalRateLimit(request, env, {
  cryptoApi = globalThis.crypto,
  now = () => Date.now()
} = {}) {
  const namespace = env?.GLOBAL_RATE_LIMITER;
  if (!namespace || typeof namespace.idFromName !== "function" || typeof namespace.get !== "function") {
    const explicitScope = typeof env?.EXPORTFLOW_ENV === "string"
      ? env.EXPORTFLOW_ENV.trim().toLowerCase()
      : "";
    const host = new URL(request.url).hostname.toLowerCase();
    const production = explicitScope === "production" ||
      (!explicitScope && (host === "exportflow.me" || host === "www.exportflow.me"));
    if (production) {
      throw new GlobalRateLimiterUnavailableError("global_rate_limiter_not_configured");
    }
    return null;
  }

  const secret = env.GLOBAL_RATE_LIMITER_HMAC_SECRET;
  if (typeof secret !== "string" || secret.length < 32 || secret.length > 256) {
    throw new GlobalRateLimiterUnavailableError("global_rate_limiter_not_configured");
  }

  const address = (request.headers.get("CF-Connecting-IP") || "").trim() || "unknown";
  let digest;
  try {
    digest = await hmacClientAddress(address, secret, cryptoApi);
  } catch {
    throw new GlobalRateLimiterUnavailableError("global_rate_limiter_unavailable");
  }

  const scope = environmentScope(request, env);
  const objectName = [GLOBAL_RATE_OBJECT_PROTOCOL, scope, digest].join(":");

  let response;
  try {
    const id = namespace.idFromName(objectName);
    const stub = namespace.get(id);
    response = await stub.fetch("https://global-rate-limiter.internal/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ now: Math.floor(now()) })
    });
  } catch {
    throw new GlobalRateLimiterUnavailableError("global_rate_limiter_unavailable");
  }

  if (!response || !response.ok) {
    throw new GlobalRateLimiterUnavailableError("global_rate_limiter_unavailable");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new GlobalRateLimiterUnavailableError("global_rate_limiter_invalid_response");
  }
  if (!validLimiterResult(result)) {
    throw new GlobalRateLimiterUnavailableError("global_rate_limiter_invalid_response");
  }

  return result;
}

export function globalRateLimitHeaders(result) {
  if (!result) return {};
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.resetAfterSeconds),
    "X-RateLimit-Reset": String(result.resetAt),
    "X-RateLimit-Scope": "global-client",
    ...(result.retryAfterSeconds > 0 ? { "Retry-After": String(result.retryAfterSeconds) } : {})
  };
}
