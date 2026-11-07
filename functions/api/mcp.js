import { onRequestPost as trackOne } from "./track.js";
import { onRequestPost as trackBatch } from "./batch-track.js";
import { onRequestGet as getCarriers } from "./carriers.js";
import { onRequestGet as getCoverage } from "./coverage.js";
import { onRequestGet as getHealth } from "./health.js";

const PROTOCOL_VERSION = "2026-07-28";
const SERVER_INFO = Object.freeze({ name: "ExportFlow MCP Server", version: "1.0.0" });
const MAX_BODY_BYTES = 16_384;
const SERVER_META_KEY = "io.modelcontextprotocol/serverInfo";
const PROTOCOL_META_KEY = "io.modelcontextprotocol/protocolVersion";
const CAPABILITIES_META_KEY = "io.modelcontextprotocol/clientCapabilities";

const TOOLS = Object.freeze([
  {
    name: "batch_track_shipments",
    title: "Track multiple shipments",
    description: "Track between one and five shipments. Each result is isolated and uses ExportFlow's normal validation, rate limits, carrier lookup budget and privacy projection. Tracking numbers are sent to the selected upstream carrier when needed.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["shipments"],
      properties: {
        shipments: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "number"],
            properties: {
              id: { type: "string", minLength: 1, maxLength: 40, pattern: "^[a-zA-Z0-9_-]+$" },
              number: { type: "string", minLength: 4, maxLength: 40, pattern: "^[a-zA-Z0-9\\s-]+$" },
              carrier: { type: "string", minLength: 2, maxLength: 80, pattern: "^[a-zA-Z0-9-]+$" },
              postcode: { type: "string", minLength: 1, maxLength: 24, pattern: "^[a-zA-Z0-9 -]+$" },
              language: { type: "string", enum: ["en", "ar", "es", "zh", "hi", "pt", "fr", "bn"] }
            }
          }
        }
      }
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
  },
  {
    name: "check_service_health",
    title: "Check ExportFlow API health",
    description: "Check service liveness only. This does not prove that upstream carrier systems are reachable.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "get_coverage",
    title: "Get country and territory coverage metadata",
    description: "Get catalog-derived country classifications. A result is not a guarantee of live tracking support. Supply a two-letter ISO country code for a single country record; omit it for summary counts only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        countryCode: { type: "string", pattern: "^[A-Za-z]{2}$" }
      }
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "list_carriers",
    title: "Search carrier catalog metadata",
    description: "Find carrier IDs and sanitized catalog metadata. Catalog entries do not guarantee successful live lookups or official partnerships.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", maxLength: 100 },
        countryCode: { type: "string", pattern: "^[A-Za-z]{2}$" },
        limit: { type: "integer", minimum: 1, maximum: 50 }
      }
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "track_shipment",
    title: "Track one shipment",
    description: "Track one parcel and return carrier-reported events, conservative shipment truth, explicit delay/customs signals and an ETA only when the carrier reports one. The tracking number may be sent to an upstream carrier.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["number"],
      properties: {
        number: { type: "string", minLength: 4, maxLength: 40, pattern: "^[a-zA-Z0-9\\s-]+$" },
        carrier: { type: "string", minLength: 2, maxLength: 80, pattern: "^[a-zA-Z0-9-]+$" },
        postcode: { type: "string", minLength: 1, maxLength: 24, pattern: "^[a-zA-Z0-9 -]+$" },
        language: { type: "string", enum: ["en", "ar", "es", "zh", "hi", "pt", "fr", "bn"] }
      }
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
  }
]);

const TOOL_BY_NAME = new Map(TOOLS.map(tool => [tool.name, tool]));

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function rpcError(id, code, message, data, status = 400) {
  return response({
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {})
    }
  }, status);
}

async function readBoundedBody(request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        const error = new Error("Request body exceeds the MCP request limit");
        error.code = "BODY_TOO_LARGE";
        throw error;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function headerMismatch(id, message) {
  return rpcError(id, -32020, "Header mismatch", { reason: message }, 400);
}

function decodeMcpHeaderValue(value) {
  if (typeof value !== "string") return null;
  const prefix = "=?base64?";
  const suffix = "?=";
  const hasPrefix = value.startsWith(prefix);
  const hasSuffix = value.endsWith(suffix);
  if (!hasPrefix && !hasSuffix) return value;
  if (!hasPrefix || !hasSuffix) return null;

  const encoded = value.slice(prefix.length, -suffix.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded) || encoded.length === 0) {
    return null;
  }
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function acceptsMediaType(header, expected) {
  return typeof header === "string" && header.split(",").some(item =>
    item.trim().split(";")[0].trim().toLowerCase() === expected
  );
}

function jsonResult(id, result) {
  return response({ jsonrpc: "2.0", id, result });
}

function makeInternalRequest(original, path, method, payload) {
  const url = new URL(path, original.url);
  const headers = new Headers();
  for (const name of ["CF-Connecting-IP", "CF-IPCountry", "Accept-Language", "User-Agent"]) {
    const value = original.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (method === "POST") {
    headers.set("Content-Type", "application/json");
    headers.set("Origin", url.origin);
  }
  return new Request(url, {
    method,
    headers,
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    signal: original.signal
  });
}

async function invokeApi(handler, original, env, path, method = "GET", payload) {
  try {
    const internalRequest = makeInternalRequest(original, path, method, payload);
    const result = await handler({ request: internalRequest, env });
    let data;
    try {
      data = await result.json();
    } catch {
      return { status: 502, data: { error: "invalid_api_response" } };
    }
    return { status: result.status, data };
  } catch {
    return { status: 502, data: { error: "service_unavailable" } };
  }
}

function toolResult(id, data, isError = false, extra = {}) {
  const text = JSON.stringify(data);
  return jsonResult(id, {
    resultType: "complete",
    content: [{ type: "text", text }],
    structuredContent: data,
    isError,
    ...extra
  });
}

function invalidToolArguments() {
  return { error: "invalid_tool_arguments" };
}

async function callTool(name, args, request, env) {
  if (!isObject(args)) return { status: 400, data: invalidToolArguments() };

  switch (name) {
    case "track_shipment": {
      const result = await invokeApi(
        trackOne, request, env, "/api/track", "POST", args
      );
      return result;
    }
    case "batch_track_shipments": {
      const result = await invokeApi(
        trackBatch, request, env, "/api/batch-track", "POST", args
      );
      return result;
    }
    case "check_service_health": {
      if (Object.keys(args).length !== 0) return { status: 400, data: invalidToolArguments() };
      return invokeApi(getHealth, request, env, "/api/health");
    }
    case "get_coverage": {
      if (Object.keys(args).some(key => key !== "countryCode")) return { status: 400, data: invalidToolArguments() };
      const countryCode = args.countryCode;
      if (countryCode !== undefined && (typeof countryCode !== "string" || !/^[A-Za-z]{2}$/.test(countryCode))) {
        return { status: 400, data: invalidToolArguments() };
      }
      const result = await invokeApi(getCoverage, request, env, "/api/coverage");
      if (result.status < 200 || result.status >= 300) return result;
      const countries = Array.isArray(result.data.countries) ? result.data.countries : [];
      if (countryCode) {
        const country = countries.find(item => item.code === countryCode.toUpperCase());
        return country
          ? { status: 200, data: { source: result.data.source, summary: result.data.summary, country } }
          : { status: 404, data: { error: "country_not_listed", countryCode: countryCode.toUpperCase() } };
      }
      return { status: 200, data: { source: result.data.source, upstreamRevision: result.data.upstreamRevision, generatedAt: result.data.generatedAt, summary: result.data.summary } };
    }
    case "list_carriers": {
      const allowed = new Set(["query", "countryCode", "limit"]);
      if (Object.keys(args).some(key => !allowed.has(key))) return { status: 400, data: invalidToolArguments() };
      if (args.query !== undefined && (typeof args.query !== "string" || args.query.length > 100)) return { status: 400, data: invalidToolArguments() };
      if (args.countryCode !== undefined && (typeof args.countryCode !== "string" || !/^[A-Za-z]{2}$/.test(args.countryCode))) return { status: 400, data: invalidToolArguments() };
      if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 50)) return { status: 400, data: invalidToolArguments() };

      const result = await invokeApi(getCarriers, request, env, "/api/carriers");
      if (result.status < 200 || result.status >= 300) return result;
      const needle = (args.query || "").trim().toLowerCase();
      const country = args.countryCode ? args.countryCode.toUpperCase() : null;
      const records = Array.isArray(result.data.carrierRecords) ? result.data.carrierRecords : [];
      const matched = records.filter(record =>
        (!needle || record.id.toLowerCase().includes(needle) || record.name.toLowerCase().includes(needle)) &&
        (!country || record.countries.includes(country))
      );
      const limit = args.limit ?? 20;
      return {
        status: 200,
        data: {
          totalSelectableCatalogRecords: result.data.selectableCarrierRecords,
          totalMatches: matched.length,
          returned: Math.min(limit, matched.length),
          records: matched.slice(0, limit),
          notice: result.data.metadataNotice
        }
      };
    }
    default:
      return null;
  }
}

function serverInfoMeta() {
  return { _meta: { [SERVER_META_KEY]: SERVER_INFO } };
}

export async function onRequestPost({ request, env }) {
  if (request.method !== "POST") {
    return rpcError(null, -32600, "Only POST is supported by this MCP endpoint", undefined, 405);
  }

  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return rpcError(null, -32000, "Origin not allowed", undefined, 403);
  }

  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return rpcError(null, -32600, "Content-Type must be application/json", undefined, 415);
  }
  const accept = request.headers.get("Accept") || "";
  if (!acceptsMediaType(accept, "application/json") || !acceptsMediaType(accept, "text/event-stream")) {
    return rpcError(null, -32600, "Accept must include application/json and text/event-stream", undefined, 406);
  }

  let raw;
  try {
    raw = await readBoundedBody(request);
  } catch (error) {
    return error?.code === "BODY_TOO_LARGE"
      ? rpcError(null, -32600, "Request body too large", undefined, 413)
      : rpcError(null, -32700, "Invalid request body", undefined, 400);
  }

  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return rpcError(null, -32700, "Parse error", undefined, 400);
  }
  if (!isObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string" ||
      !(typeof message.id === "string" || (typeof message.id === "number" && Number.isFinite(message.id)))) {
    return rpcError(null, -32600, "Invalid JSON-RPC request", undefined, 400);
  }

  if (message.params !== undefined && !isObject(message.params)) {
    return rpcError(message.id, -32602, "MCP params must be an object", undefined, 400);
  }
  const params = isObject(message.params) ? message.params : {};
  const meta = isObject(params._meta) ? params._meta : {};
  const requestedVersion = meta[PROTOCOL_META_KEY];
  const headerVersion = request.headers.get("MCP-Protocol-Version");
  if (!headerVersion || !requestedVersion || headerVersion !== requestedVersion) {
    return headerMismatch(message.id, "MCP-Protocol-Version must match _meta protocolVersion");
  }
  if (requestedVersion !== PROTOCOL_VERSION) {
    return rpcError(message.id, -32022, "Unsupported protocol version", {
      supported: [PROTOCOL_VERSION],
      requested: requestedVersion
    }, 400);
  }
  if (!isObject(meta[CAPABILITIES_META_KEY])) {
    return rpcError(message.id, -32600, "Request _meta must include clientCapabilities", undefined, 400);
  }

  const headerMethod = request.headers.get("Mcp-Method");
  if (!headerMethod || headerMethod !== message.method) {
    return headerMismatch(message.id, "Mcp-Method must match JSON-RPC method");
  }
  if (message.method === "tools/call") {
    const toolName = params.name;
    const headerName = decodeMcpHeaderValue(request.headers.get("Mcp-Name"));
    if (typeof toolName !== "string" || !headerName || headerName !== toolName) {
      return headerMismatch(message.id, "Mcp-Name must match params.name for tools/call");
    }
  }

  if (message.method === "server/discover") {
    return jsonResult(message.id, {
      resultType: "complete",
      supportedVersions: [PROTOCOL_VERSION],
      capabilities: { tools: { listChanged: false } },
      ...serverInfoMeta(),
      instructions: "Use ExportFlow tools for live shipment lookups and catalog discovery. Tracking numbers are sent to the upstream carrier selected by the tracking engine when needed. Carrier catalog metadata is not a live availability guarantee. No account, cloud watchlist or server-side shipment history is provided.",
      ttlMs: 3_600_000,
      cacheScope: "public"
    });
  }

  if (message.method === "tools/list") {
    return jsonResult(message.id, {
      resultType: "complete",
      tools: TOOLS,
      ttlMs: 300_000,
      cacheScope: "public",
      ...serverInfoMeta()
    });
  }

  if (message.method === "tools/call") {
    if (typeof params.name !== "string" || !TOOL_BY_NAME.has(params.name)) {
      return rpcError(message.id, -32602, "Unknown tool name", undefined, 400);
    }
    const args = params.arguments === undefined ? {} : params.arguments;
    if (!isObject(args)) {
      return toolResult(message.id, { error: "invalid_tool_arguments" }, true, serverInfoMeta());
    }

    const result = await callTool(params.name, args, request, env);
    if (!result) return rpcError(message.id, -32602, "Unknown tool name", undefined, 400);
    return toolResult(
      message.id,
      result.data,
      result.status < 200 || result.status >= 300,
      serverInfoMeta()
    );
  }

  return rpcError(message.id, -32601, "Method not found", undefined, 404);
}

export async function onRequestGet() {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: "POST",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
