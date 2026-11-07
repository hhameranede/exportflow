import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/mcp.js";

const endpoint = "https://exportflow.me/api/mcp";
const protocolVersion = "2026-07-28";
const baseMeta = {
  "io.modelcontextprotocol/protocolVersion": protocolVersion,
  "io.modelcontextprotocol/clientInfo": { name: "exportflow-mcp-test", version: "1.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {}
};

function makeRequest(method, params = {}, id = 1, overrides = {}) {
  const body = {
    jsonrpc: "2.0",
    id,
    method,
    params: { ...params, _meta: baseMeta }
  };
  const headers = new Headers({
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "MCP-Protocol-Version": protocolVersion,
    "Mcp-Method": method,
    ...(method === "tools/call" && typeof params.name === "string" ? { "Mcp-Name": params.name } : {}),
    ...(overrides.headers || {})
  });
  const request = new Request(endpoint, {
    method: overrides.method || "POST",
    headers,
    body: overrides.rawBody ?? JSON.stringify(body)
  });
  return { request, body };
}

async function call(method, params = {}, id = 1, overrides = {}) {
  const { request } = makeRequest(method, params, id, overrides);
  return onRequestPost({ request, env: {} });
}

const getOnly = await onRequestGet({ request: new Request(endpoint, { method: "GET" }), env: {} });
assert.equal(getOnly.status, 405);
assert.equal(getOnly.headers.get("Allow"), "POST");

const getPassedToPostHandler = await onRequestPost({
  request: new Request(endpoint, { method: "GET" }),
  env: {}
});
assert.equal(getPassedToPostHandler.status, 405);

const emptyBody = await onRequestPost({
  request: new Request(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "MCP-Protocol-Version": protocolVersion,
      "Mcp-Method": "tools/list"
    },
    body: ""
  }),
  env: {}
});
assert.equal(emptyBody.status, 400);
assert.equal((await emptyBody.json()).error.code, -32700);

const discover = await call("server/discover", {}, "discover-1");
assert.equal(discover.status, 200);
assert.equal(discover.headers.get("Content-Type"), "application/json; charset=utf-8");
const discovery = await discover.json();
assert.equal(discovery.id, "discover-1");
assert.equal(discovery.result.resultType, "complete");
assert.deepEqual(discovery.result.supportedVersions, [protocolVersion]);
assert.ok(discovery.result.capabilities.tools);
assert.equal(discovery.result.capabilities.resources, undefined, "The server must not advertise resources that are not implemented");
assert.equal(discovery.result._meta["io.modelcontextprotocol/serverInfo"].name, "ExportFlow MCP Server");
assert.equal(discovery.result.cacheScope, "public");

const listed = await call("tools/list", {}, "list-1");
assert.equal(listed.status, 200);
const listPayload = await listed.json();
assert.equal(listPayload.result.resultType, "complete");
assert.equal(listPayload.result.cacheScope, "public");
assert.ok(listPayload.result.ttlMs > 0);
assert.equal(listPayload.result._meta["io.modelcontextprotocol/serverInfo"].name, "ExportFlow MCP Server");
const names = listPayload.result.tools.map(tool => tool.name);
assert.deepEqual(names, [...names].sort());
assert.deepEqual(names, [
  "batch_track_shipments",
  "check_service_health",
  "get_coverage",
  "list_carriers",
  "track_shipment"
]);
assert.ok(listPayload.result.tools.every(tool => tool.inputSchema.type === "object"));
assert.ok(listPayload.result.tools.find(tool => tool.name === "track_shipment").annotations.readOnlyHint);

const health = await call("tools/call", { name: "check_service_health", arguments: {} }, 2);
assert.equal(health.status, 200);
const healthPayload = await health.json();
assert.equal(healthPayload.result.isError, false);
assert.equal(healthPayload.result.structuredContent.ok, true);
assert.equal(healthPayload.result._meta["io.modelcontextprotocol/serverInfo"].name, "ExportFlow MCP Server");

const coverage = await call("tools/call", {
  name: "get_coverage",
  arguments: { countryCode: "DZ" }
}, 3);
assert.equal(coverage.status, 200);
const coveragePayload = await coverage.json();
assert.equal(coveragePayload.result.isError, false);
assert.equal(coveragePayload.result.structuredContent.country.code, "DZ");
assert.ok(coveragePayload.result.structuredContent.summary.allCountries >= 240);

const coverageSummary = await call("tools/call", {
  name: "get_coverage",
  arguments: {}
}, 4);
const coverageSummaryPayload = await coverageSummary.json();
assert.equal(coverageSummaryPayload.result.structuredContent.summary.allCountries, 249);
assert.equal(coverageSummaryPayload.result.structuredContent.countries, undefined);

const carriers = await call("tools/call", {
  name: "list_carriers",
  arguments: { query: "ups", limit: 5 }
}, 5);
const carriersPayload = await carriers.json();
assert.equal(carriersPayload.result.isError, false);
assert.ok(carriersPayload.result.structuredContent.totalSelectableCatalogRecords > 0);
assert.ok(carriersPayload.result.structuredContent.records.length <= 5);
assert.ok(carriersPayload.result.structuredContent.records.every(record =>
  record.id.toLowerCase().includes("ups") || record.name.toLowerCase().includes("ups")
));

const invalidTrack = await call("tools/call", {
  name: "track_shipment",
  arguments: { number: "abc" }
}, 6);
const invalidTrackPayload = await invalidTrack.json();
assert.equal(invalidTrackPayload.result.isError, true);
assert.equal(invalidTrackPayload.result.structuredContent.error, "invalid_tracking_number");
assert.ok(!JSON.stringify(invalidTrackPayload).includes('"abc"'), "MCP must not echo tracking numbers");

const invalidBatch = await call("tools/call", {
  name: "batch_track_shipments",
  arguments: { shipments: [{ id: "one", number: "abc" }] }
}, 7);
const invalidBatchPayload = await invalidBatch.json();
assert.equal(invalidBatchPayload.result.isError, true);
assert.equal(invalidBatchPayload.result.structuredContent.results[0].data.error, "invalid_tracking_number");
assert.ok(!JSON.stringify(invalidBatchPayload).includes('"abc"'));

const wrongVersion = await call("tools/list", {}, 8, {
  headers: { "MCP-Protocol-Version": "2025-11-25" }
});
assert.equal(wrongVersion.status, 400);
const wrongVersionPayload = await wrongVersion.json();
assert.equal(wrongVersionPayload.error.code, -32020);

const unsupportedVersionBody = {
  jsonrpc: "2.0",
  id: 9,
  method: "tools/list",
  params: {
    _meta: {
      ...baseMeta,
      "io.modelcontextprotocol/protocolVersion": "1900-01-01"
    }
  }
};
const unsupportedVersion = await onRequestPost({
  request: new Request(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "MCP-Protocol-Version": "1900-01-01",
      "Mcp-Method": "tools/list"
    },
    body: JSON.stringify(unsupportedVersionBody)
  }),
  env: {}
});
assert.equal(unsupportedVersion.status, 400);
assert.equal((await unsupportedVersion.json()).error.code, -32022);

const missingMethodHeader = await call("tools/list", {}, 10, {
  headers: { "Mcp-Method": "tools/call" }
});
assert.equal(missingMethodHeader.status, 400);
assert.equal((await missingMethodHeader.json()).error.code, -32020);

const missingNameHeader = await call("tools/call", {
  name: "check_service_health",
  arguments: {}
}, 11, { headers: { "Mcp-Name": "" } });
assert.equal(missingNameHeader.status, 400);
assert.equal((await missingNameHeader.json()).error.code, -32020);

const unicodeToolName = "list_cärrìers";
const encodedToolName = btoa(String.fromCharCode(...new TextEncoder().encode(unicodeToolName)));
const encodedNameCall = await call("tools/call", {
  name: unicodeToolName,
  arguments: {}
}, 17, { headers: { "Mcp-Name": "=?base64?" + encodedToolName + "?=" } });
assert.equal(encodedNameCall.status, 400);
assert.equal((await encodedNameCall.json()).error.code, -32602, "Valid Base64 Mcp-Name must decode before unsupported-tool validation");

const malformedEncodedName = await call("tools/call", {
  name: unicodeToolName,
  arguments: {}
}, 18, { headers: { "Mcp-Name": "=?base64?%%%?=" } });
assert.equal(malformedEncodedName.status, 400);
assert.equal((await malformedEncodedName.json()).error.code, -32020);

const badAcceptToken = await call("tools/list", {}, 19, {
  headers: { Accept: "notapplication/json, text/event-stream" }
});
assert.equal(badAcceptToken.status, 406, "Accept parsing must match exact media types");

const invalidOrigin = await call("tools/list", {}, 12, {
  headers: { Origin: "https://attacker.example" }
});
assert.equal(invalidOrigin.status, 403);

const badAccept = await call("tools/list", {}, 13, {
  headers: { Accept: "application/json" }
});
assert.equal(badAccept.status, 406);

const unknownMethod = await call("resources/list", {}, 14);
assert.equal(unknownMethod.status, 404);
assert.equal((await unknownMethod.json()).error.code, -32601);

const unknownTool = await call("tools/call", {
  name: "delete_everything",
  arguments: {}
}, 15);
assert.equal(unknownTool.status, 400);
assert.equal((await unknownTool.json()).error.code, -32602);

const wrongContentType = await call("tools/list", {}, 16, { headers: { "Content-Type": "text/plain" } });
assert.equal(wrongContentType.status, 415);

const malformed = await onRequestPost({
  request: new Request(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "MCP-Protocol-Version": protocolVersion,
      "Mcp-Method": "tools/list"
    },
    body: "{not-json"
  }),
  env: {}
});
assert.equal(malformed.status, 400);
assert.equal((await malformed.json()).error.code, -32700);

console.log("ExportFlow MCP 2026-07-28 discovery, tools, routing headers, privacy and error handling verified.");
