import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/openapi.js";

const response = await onRequestGet();
assert.equal(response.status, 200);
assert.match(response.headers.get("Content-Type") || "", /openapi\+json/);
assert.equal(response.headers.get("Cache-Control"), "public, max-age=300, s-maxage=300");

const document = await response.json();
assert.equal(document.openapi, "3.1.0");
for (const route of [
  "/api/track",
  "/api/batch-track",
  "/api/carriers",
  "/api/carrier-directory",
  "/api/coverage",
  "/api/health",
  "/api/openapi",
  "/api/mcp"
]) {
  assert.ok(document.paths[route], "OpenAPI document must describe " + route);
}
const mcpOperation = document.paths["/api/mcp"].post;
assert.equal(mcpOperation.operationId, "handleMcpRequest");
assert.equal(mcpOperation.parameters.find(parameter => parameter.name === "MCP-Protocol-Version").schema.const, "2026-07-28");
assert.ok(document.components.schemas.McpJsonRpcRequest);
const trackSchema = document.components.schemas.TrackingRequest;
assert.deepEqual(trackSchema.properties.language.enum, ["en", "ar", "es", "zh", "hi", "pt", "fr", "bn"]);
assert.equal(trackSchema.additionalProperties, false);
assert.equal(trackSchema.properties.carrier.pattern, "^[a-zA-Z0-9-]+$");
assert.equal(trackSchema.properties.postcode.pattern, "^[a-zA-Z0-9 -]+$");
const directoryOperation = document.paths["/api/carrier-directory"].get;
assert.equal(directoryOperation.operationId, "getPaginatedCarrierDirectory");
assert.ok(directoryOperation.parameters.some(parameter => parameter.name === "pageSize" && parameter.schema.maximum === 100));
assert.ok(document.components.schemas.CarrierDirectoryResponse);
assert.ok(document.components.schemas.CarrierDirectoryRecord);
assert.ok(document.components.schemas.CarrierDirectoryRecord.properties.isCatalogEntry);
assert.ok(document.components.schemas.CarrierDirectoryEvidence);
assert.ok(document.components.schemas.CarrierDirectoryResponse.properties.records);
const carrierCatalogSchema = document.components.schemas.CarrierCatalog;
assert.ok(carrierCatalogSchema.properties.carrierRecords);
assert.ok(carrierCatalogSchema.properties.metadataNotice);
assert.ok(carrierCatalogSchema.properties.carrierRecords.items.properties.tracking);
assert.ok(carrierCatalogSchema.properties.carrierRecords.items.properties.evidence);
assert.ok(carrierCatalogSchema.properties.evidenceRegistryAvailable);
assert.ok(carrierCatalogSchema.properties.evidenceRegistry);
assert.ok(carrierCatalogSchema.properties.evidenceRegistryCounts);
assert.ok(document.components.schemas.CarrierEvidence);
assert.ok(document.components.schemas.CarrierEvidenceVerification);
assert.ok(document.components.schemas.CarrierEvidenceVerification.properties.authorizationConfirmed);
const batchSchema = document.components.schemas.BatchTrackingRequest;
assert.equal(batchSchema.properties.shipments.maxItems, 5);
assert.equal(batchSchema.properties.shipments.minItems, 1);
const batchItemSchema = document.components.schemas.BatchTrackingItem;
assert.equal(batchItemSchema.additionalProperties, false);
assert.ok(batchItemSchema.properties.id);
assert.ok(batchItemSchema.properties.number);
assert.equal(batchItemSchema.properties.carrier.pattern, "^[a-zA-Z0-9-]+$");
assert.equal(batchItemSchema.properties.postcode.pattern, "^[a-zA-Z0-9 -]+$");
assert.equal(batchSchema.properties.shipments.uniqueItems, undefined, "Runtime enforces unique item IDs, not entire object equality");
assert.equal(document["x-exportflow-limits"].singleLookup.lookupBudgetMilliseconds, 25000);
assert.match(document["x-exportflow-privacy"].storage, /does not provide a user account/);

console.log("OpenAPI 3.1 document routes, schemas, locales, privacy and limits verified.");
