import { createTracker, TrackingError } from "../../node_modules/universal-parcel-scraper/dist/facade/index.js";

const MAX_BODY_CHARS = 4_096;
const MAX_NUMBER_LENGTH = 40;
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
    stage: safeStage(event?.stage)
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

function trackingFailure(error) {
  if (error instanceof TrackingError) {
    const kind = error.hint?.kind || "unavailable";
    const status = kind === "not_found" ? 404
      : kind === "rate_limited" ? 429
      : kind === "invalid_input" ? 400
      : kind === "input_required" ? 422
      : 502;
    return json({
      error: kind,
      attempts: Array.isArray(error.attempts) ? error.attempts.map(attempt => ({
        source: safeText(attempt.source, 80),
        kind: safeText(attempt.kind, 40),
        durationMs: Number.isFinite(attempt.durationMs) ? attempt.durationMs : null
      })) : []
    }, status);
  }

  if (error instanceof TypeError || error instanceof RangeError) {
    return json({ error: "invalid_input" }, 400);
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

  const number = typeof input.number === "string" ? input.number.trim() : "";
  if (number.length < 4 || number.length > MAX_NUMBER_LENGTH || !/^[a-zA-Z0-9\s-]+$/.test(number)) {
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
  if (language !== undefined && (typeof language !== "string" || !/^(en|ar|fr|de(?:-[A-Z]{2})?)$/i.test(language))) {
    return json({ error: "invalid_language" }, 400);
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
    return trackingFailure(error);
  } finally {
    activeLookups = Math.max(0, activeLookups - 1);
  }
}
