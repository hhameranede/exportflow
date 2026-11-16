import { createTracker } from "../../../../../node_modules/universal-parcel-scraper/dist/facade/index.js";
import {
  resolveMerchantSession,
  merchantIdentityErrorResponse
} from "../../../../lib/merchant-identity.mjs";
import { createCloudflareFetch } from "../../../../lib/cloudflare-fetch.mjs";
import {
  consumeGlobalRateLimit,
  globalRateLimitHeaders
} from "../../../../lib/global-rate-limiter.mjs";

const PROVIDERS = new Set(["ups", "fedex"]);
const MAX_BODY_BYTES = 4 * 1024;
const TRACKING_BUDGET_MS = 25_000;

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Pragma": "no-cache",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      ...extraHeaders
    }
  });
}

function trustedSameOrigin(request, env) {
  if (typeof env?.MERCHANT_APP_ORIGIN !== "string") return false;
  try {
    const parsed = new URL(env.MERCHANT_APP_ORIGIN);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if ((parsed.protocol !== "https:" && !local) || parsed.origin !== env.MERCHANT_APP_ORIGIN) return false;
    return request.headers.get("Origin") === parsed.origin &&
      new URL(request.url).origin === parsed.origin;
  } catch {
    return false;
  }
}

async function readPayload(request) {
  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw Object.assign(new Error("content_type_must_be_json"), { status: 415 });
  }
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) {
    throw Object.assign(new Error("request_too_large"), { status: 413 });
  }
  if (!request.body) throw Object.assign(new Error("invalid_request_body"), { status: 400 });

  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        throw Object.assign(new Error("request_too_large"), { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw Object.assign(new Error("invalid_request_body"), { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      Object.keys(payload).some(key => key !== "number") ||
      typeof payload.number !== "string") {
    throw Object.assign(new Error("invalid_request_body"), { status: 400 });
  }

  const number = payload.number.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!number || number.length > 256 || /[\u0000-\u001F\u007F-\u009F]/.test(number)) {
    throw Object.assign(new Error("invalid_tracking_number"), { status: 400 });
  }
  return { number };
}

function safeText(value, maxLength = 240) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength)
    : null;
}

function safeStage(value) {
  return typeof value === "string" && /^[a-z_]{2,40}$/.test(value) ? value : "unknown";
}

function projectTrackingResult(provider, response) {
  const result = response?.result ?? {};
  const events = Array.isArray(result.events) ? result.events.slice(0, 60).map(event => ({
    time: safeText(event?.time ?? event?.local_time, 80),
    location: safeText(event?.location, 180),
    description: safeText(event?.description, 320),
    stage: safeStage(event?.stage)
  })) : [];

  return {
    provider,
    carrier: safeText(response?.carrier, 80) || provider,
    source: safeText(response?.source, 80) || provider,
    status: safeStage(result.current_stage),
    expectedDelivery: safeText(result.expected_delivery, 80),
    service: safeText(result.service_name, 120),
    events
  };
}

function safeAttempts(error) {
  return Array.isArray(error?.attempts) ? error.attempts.slice(0, 8).map(attempt => ({
    source: safeText(attempt?.source, 80),
    kind: safeStage(attempt?.kind),
    durationMs: Number.isFinite(attempt?.durationMs)
      ? Math.max(0, Math.round(attempt.durationMs))
      : null
  })) : [];
}

function trackingFailureResponse(error) {
  const attempts = safeAttempts(error);
  const kinds = attempts.map(attempt => attempt.kind);
  const challenge = kinds.includes("challenge") || error?.name === "ChallengeError";
  const status = error?.name === "RateLimitedError" || kinds.includes("rate_limited") ? 429
    : error?.name === "TimeoutError" || error?.name === "AbortError" || kinds.includes("budget") ? 504
    : error?.name === "InvalidInputError" || kinds.includes("invalid_input") ? 400
    : challenge ? 503
    : 502;
  const code = status === 429 ? "carrier_rate_limited"
    : status === 504 ? "carrier_lookup_timeout"
    : status === 400 ? "invalid_tracking_number"
    : status === 503 ? "carrier_verification_required"
    : "carrier_lookup_failed";
  return jsonResponse({ error: code, attempts }, status);
}

export function createMerchantAdapterTrackHandler({
  resolveSession = resolveMerchantSession,
  consumeRateLimit = consumeGlobalRateLimit,
  trackerFactory = createTracker,
  fetchFactory = createCloudflareFetch
} = {}) {
  return async function onRequestPost({ request, env, params } = {}) {
    if (!request || request.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "POST" });
    }
    if (!trustedSameOrigin(request, env)) {
      return jsonResponse({ error: "origin_forbidden" }, 403);
    }

    const provider = String(params?.provider || "").trim().toLowerCase();
    if (!PROVIDERS.has(provider)) {
      return jsonResponse({ error: "unsupported_provider" }, 400);
    }

    let payload;
    try {
      payload = await readPayload(request);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 400;
      return jsonResponse({ error: error?.message || "invalid_request_body" }, status);
    }

    let session;
    try {
      session = await resolveSession(request, env?.MERCHANT_DB);
    } catch (error) {
      return merchantIdentityErrorResponse(error);
    }
    if (typeof session?.user?.id !== "string" || !session.user.id) {
      return jsonResponse({ error: "unauthenticated" }, 401);
    }

    let quota;
    try {
      quota = await consumeRateLimit(request, env);
    } catch {
      return jsonResponse({ error: "global_rate_limiter_unavailable" }, 503, { "Retry-After": "10" });
    }
    if (!quota || typeof quota.allowed !== "boolean") {
      return jsonResponse({ error: "global_rate_limiter_not_configured" }, 503, { "Retry-After": "10" });
    }
    if (!quota.allowed) {
      return jsonResponse({ error: "rate_limited" }, 429, globalRateLimitHeaders(quota));
    }

    try {
      const trawlUrl = typeof env?.EXPORTFLOW_TRAWL_URL === "string"
        ? env.EXPORTFLOW_TRAWL_URL.trim()
        : "";
      const tracker = trackerFactory({
        // Use the same server-side adapter configuration as public ExportFlow tracking.
        // No merchant-supplied credentials and no browser-visible secrets are involved.
        env,
        fetcher: fetchFactory(),
        ...(trawlUrl ? { trawlUrl } : {}),
        // Keep merchant parcel IDs on the selected carrier adapter only.
        providers: [],
        userAgent: "ExportFlow-Merchant/1.0"
      });
      const response = await tracker.track(
        { number: payload.number, carrier: provider },
        {
          budgetMs: TRACKING_BUDGET_MS,
          signal: AbortSignal.any([
            request.signal,
            AbortSignal.timeout(TRACKING_BUDGET_MS)
          ])
        }
      );
      return jsonResponse(projectTrackingResult(provider, response), 200, globalRateLimitHeaders(quota));
    } catch (error) {
      return trackingFailureResponse(error);
    }
  };
}

export const onRequestPost = createMerchantAdapterTrackHandler();
