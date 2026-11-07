import { onRequestPost as trackOne } from "./track.js";

const MAX_BATCH_BYTES = 12_288;
const MAX_BATCH_SIZE = 5;
const ALLOWED_ITEM_FIELDS = new Set(["id", "number", "carrier", "postcode", "language"]);

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

function validItem(item) {
  return Boolean(
    item &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    Object.keys(item).every(key => ALLOWED_ITEM_FIELDS.has(key)) &&
    typeof item.id === "string" &&
    /^[a-zA-Z0-9_-]{1,40}$/.test(item.id)
  );
}

async function runOne({ item, request, env }) {
  const payload = {
    number: item.number,
    ...(item.carrier !== undefined ? { carrier: item.carrier } : {}),
    ...(item.postcode !== undefined ? { postcode: item.postcode } : {}),
    ...(item.language !== undefined ? { language: item.language } : {})
  };
  const headers = new Headers({
    "Content-Type": "application/json",
    "Origin": new URL(request.url).origin
  });
  for (const header of ["CF-Connecting-IP", "Accept-Language", "User-Agent"]) {
    const value = request.headers.get(header);
    if (value) headers.set(header, value);
  }

  try {
    const childRequest = new Request(new URL("/api/track", request.url), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: request.signal
    });
    const response = await trackOne({ request: childRequest, env });
    let data;
    try {
      data = await response.json();
    } catch {
      data = { error: "invalid_tracking_response" };
    }
    return { id: item.id, status: response.status, data };
  } catch {
    return { id: item.id, status: 502, data: { error: "tracking_unavailable" } };
  }
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
  if (declaredLength > MAX_BATCH_BYTES) return json({ error: "request_too_large" }, 413);

  let raw;
  try {
    raw = await readBoundedBody(request, MAX_BATCH_BYTES);
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
  if (Object.keys(input).some(key => key !== "shipments")) {
    return json({ error: "unknown_request_field" }, 400);
  }
  if (!Array.isArray(input.shipments) || input.shipments.length < 1 || input.shipments.length > MAX_BATCH_SIZE) {
    return json({ error: "invalid_batch_size", maximum: MAX_BATCH_SIZE }, 400);
  }

  const ids = new Set();
  for (const item of input.shipments) {
    if (!validItem(item)) return json({ error: "invalid_shipment_item" }, 400);
    if (ids.has(item.id)) return json({ error: "duplicate_shipment_id" }, 400);
    ids.add(item.id);
  }

  // Each child request reuses the exact single-shipment validation, rate limit,
  // lookup budget, provider facade, truth engine and redaction rules.
  const results = await Promise.all(input.shipments.map(item => runOne({ item, request, env })));
  const succeeded = results.filter(result => result.status >= 200 && result.status < 300).length;
  return json({
    results,
    summary: {
      requested: results.length,
      succeeded,
      failed: results.length - succeeded
    }
  });
}
