import { createTracker, TrackingError } from "../../node_modules/universal-parcel-scraper/dist/facade/index.js";
import { parseTrackingInput } from "universal-parcel-scraper";
import { isPublicCarrierQuarantined } from "../lib/public-carrier-policy.mjs";
import { createCloudflareFetch } from "../lib/cloudflare-fetch.mjs";
import { safeEventPoint } from "../lib/coordinates.mjs";

const MAX_BODY_CHARS = 4_096;
const MAX_NUMBER_LENGTH = 256;
const REQUESTS_PER_MINUTE = 12;
const MAX_CONCURRENT_LOOKUPS = 6;
const LOOKUP_BUDGET_MS = 25_000;

const rateBuckets = new Map();
let activeLookups = 0;
let tracker;
let trackerTrawlUrl;

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders
    }
  });
}

async function readBoundedBody(request, limit) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel().catch(() => {});
        const error = new Error("Request body is too large");
        error.code = "BODY_TOO_LARGE";
        throw error;
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
  return new TextDecoder().decode(bytes);
}

function getTracker(env) {
  const trawlUrl = typeof env?.EXPORTFLOW_TRAWL_URL === "string"
    ? env.EXPORTFLOW_TRAWL_URL.trim()
    : "";
  if (!tracker || trackerTrawlUrl !== trawlUrl) {
    trackerTrawlUrl = trawlUrl;
    tracker = createTracker({
      userAgent: "ExportFlow/0.1",
      // Cloudflare Workers rejects redirect: "error" before sending a request.
      // Preserve carrier-specific "follow"/"manual" modes and emulate error mode
      // with a visible 3xx response instead of a transport failure.
      fetcher: createCloudflareFetch(),
      // Carrier adapters run first. UPU is the only universal fallback enabled
      // by default; third-party aggregators are deliberately not sent parcel IDs.
      providers: ["UPU"],
      ...(trawlUrl ? { trawlUrl } : {})
    });
  }
  return tracker;
}

async function clientKey(request) {
  const address = request.headers.get("CF-Connecting-IP") || "unknown";
  const bytes = new TextEncoder().encode(address);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(request) {
  const now = Date.now();
  const key = await clientKey(request);
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + 60_000 };
    rateBuckets.set(key, bucket);
  }
  if (bucket.count >= REQUESTS_PER_MINUTE) {
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
  }
  bucket.count += 1;

  // Bound per-isolate bookkeeping; never retain raw IP addresses or parcel IDs.
  if (rateBuckets.size > 1_000) {
    for (const [entryKey, entry] of rateBuckets) {
      if (entry.resetAt <= now) rateBuckets.delete(entryKey);
    }
    while (rateBuckets.size > 1_000) {
      rateBuckets.delete(rateBuckets.keys().next().value);
    }
  }
  return 0;
}

function safeText(value, maxLength = 240) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength) : null;
}

function safeStage(value) {
  return typeof value === "string" && /^[a-z_]{2,40}$/.test(value) ? value : "unknown";
}

function projectResult(response) {
  const result = response?.result ?? {};
  const events = Array.isArray(result.events) ? result.events.slice(0, 60).map(event => ({
    time: safeText(event?.time, 80),
    location: safeText(event?.location, 180),
    description: safeText(event?.description, 320),
    stage: safeStage(event?.stage),
    ...(safeEventPoint(event?.point) ? { point: safeEventPoint(event.point) } : {})
  })) : [];

  return {
    carrier: safeText(response?.carrier, 80) || "unknown",
    source: safeText(response?.source, 80) || "carrier",
    status: safeStage(result.current_stage),
    expectedDelivery: safeText(result.expected_delivery, 80),
    service: safeText(result.service_name, 120),
    events
  };
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasConfiguredFedExRoute(env) {
  const apiConfigured = hasText(env?.FEDEX_API_KEY) && hasText(env?.FEDEX_SECRET_KEY);
  const browserRouteConfigured = hasText(env?.EXPORTFLOW_TRAWL_URL);
  return apiConfigured || browserRouteConfigured;
}

function publicTrackingErrorKind(kind) {
  const mapping = {
    not_found: "not_found",
    rate_limited: "rate_limited",
    invalid_input: "invalid_input",
    input_required: "input_required",
    challenge: "verification_required",
    transport: "carrier_unavailable",
    maintenance: "carrier_maintenance",
    schema: "carrier_response_invalid",
    indeterminate: "carrier_unavailable",
    budget: "tracking_timeout"
  };
  return mapping[kind] || "tracking_unavailable";
}

export function trackingFailure(error, env = {}) {
  if (error instanceof TrackingError) {
    const attempts = Array.isArray(error.attempts) ? error.attempts.map(attempt => ({
      source: safeText(attempt.source, 80),
      kind: safeText(attempt.kind, 40),
      durationMs: Number.isFinite(attempt.durationMs) ? attempt.durationMs : null
    })) : [];

    // A challenge is not evidence that a parcel does not exist. A FedEx adapter
    // without either its official API credentials or an approved browser route
    // is a configuration gap, not proof that a parcel failed verification.
    const fedexAttempted = attempts.some(attempt => String(attempt.source || "").toLowerCase() === "fedex");
    const fedexRouteMissing = fedexAttempted && !hasConfiguredFedExRoute(env) &&
      attempts.some(attempt => ["challenge", "transport", "budget"].includes(attempt.kind));
    const verificationBlocked = error.hint?.kind === "challenge" ||
      attempts.some(attempt => attempt.kind === "challenge");
    const kind = fedexRouteMissing
      ? "carrier_connection_not_configured"
      : verificationBlocked
        ? "verification_required"
        : publicTrackingErrorKind(error.hint?.kind);

    const status = kind === "not_found" ? 404
      : kind === "rate_limited" ? 429
      : kind === "invalid_input" ? 400
      : kind === "input_required" ? 422
      : kind === "tracking_timeout" ? 504
      : kind === "carrier_connection_not_configured" || kind === "verification_required" || kind === "carrier_maintenance" ? 503
      : 502;
    return json({ error: kind, attempts }, status);
  }

  if (error instanceof TypeError || error instanceof RangeError) {
    return json({ error: "invalid_input" }, 400);
  }
  if (error instanceof SyntaxError) {
    return json({ error: "carrier_response_invalid" }, 502);
  }
  return json({ error: "tracking_unavailable" }, 502);
}

export async function onRequestPost({ request, env }) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  }

  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: "origin_not_allowed" }, 403);
  }

  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "content_type_must_be_json" }, 415);
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_CHARS) {
    return json({ error: "request_too_large" }, 413);
  }

  let raw;
  try {
    raw = await readBoundedBody(request, MAX_BODY_CHARS);
  } catch (error) {
    return error?.code === "BODY_TOO_LARGE"
      ? json({ error: "request_too_large" }, 413)
      : json({ error: "invalid_request_body" }, 400);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return json({ error: "invalid_request_body" }, 400);
  }
  if (Object.keys(input).some(key => !["number", "carrier", "postcode", "language"].includes(key))) {
    return json({ error: "unknown_request_field" }, 400);
  }

  const number = typeof input.number === "string"
    ? input.number.replace(/[\u200B-\u200D\uFEFF]/g, "").trim()
    : "";
  // Let the pinned upstream parser and carrier adapters judge identifier syntax.
  // Keep only bounded, non-empty, printable input at this public boundary.
  if (!number || number.length > MAX_NUMBER_LENGTH || /[\u0000-\u001F\u007F-\u009F]/.test(number)) {
    return json({ error: "invalid_tracking_number" }, 400);
  }

  const carrier = input.carrier === undefined ? undefined : input.carrier;
  if (carrier !== undefined && (typeof carrier !== "string" || !/^[a-z0-9-]{2,80}$/i.test(carrier))) {
    return json({ error: "invalid_carrier" }, 400);
  }

  const postcode = input.postcode === undefined ? undefined : input.postcode;
  if (postcode !== undefined && (typeof postcode !== "string" || postcode.length > 24 || !/^[a-z0-9 -]+$/i.test(postcode))) {
    return json({ error: "invalid_postcode" }, 400);
  }

  const language = input.language === undefined ? undefined : input.language;
  if (language !== undefined && (typeof language !== "string" || !/^(en|ar|es|zh|hi|pt|fr|ru)$/i.test(language))) {
    return json({ error: "invalid_language" }, 400);
  }

  // Apply the route-specific rights gate before rate limiting or any carrier
  // request. The policy includes explicit terms conflicts and unresolved
  // public third-party display routes held pending evidence.
  const detection = carrier ? null : parseTrackingInput(number);
  const selectedCarrier = carrier || detection?.carrier;
  // Block only the carrier selected with confidence (or explicitly supplied).
  // An unrelated quarantined carrier appearing among ambiguous candidates must
  // not prevent another carrier's adapter from being tried.
  if (isPublicCarrierQuarantined(selectedCarrier)) {
    return json({ error: "carrier_authorization_required" }, 403);
  }

  const retryAfter = await consumeRateLimit(request);
  if (retryAfter > 0) {
    return json({ error: "rate_limited" }, 429, { "Retry-After": String(retryAfter) });
  }
  if (activeLookups >= MAX_CONCURRENT_LOOKUPS) {
    return json({ error: "temporarily_busy" }, 503, { "Retry-After": "10" });
  }

  activeLookups += 1;
  try {
    const result = await getTracker(env).track({
      number,
      ...(carrier ? { carrier } : {}),
      ...(postcode ? { postcode } : {}),
      ...(language ? { language } : {})
    }, {
      budgetMs: LOOKUP_BUDGET_MS,
      signal: request.signal
    });
    return json(projectResult(result), 200);
  } catch (error) {
    return trackingFailure(error, env);
  } finally {
    activeLookups = Math.max(0, activeLookups - 1);
  }
}

