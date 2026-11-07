const OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "ExportFlow Shipment API",
    version: "1.0.0",
    description: "Server-side parcel tracking, bounded batch tracking, carrier catalog metadata and country coverage. Carrier catalog presence does not establish a live integration or a successful lookup."
  },
  servers: [{ url: "https://exportflow.me" }],
  tags: [
    { name: "Tracking", description: "Single and batch shipment lookups." },
    { name: "Discovery", description: "Carrier catalog and country coverage metadata." },
    { name: "System", description: "Service liveness and machine-readable API description." }
  ],
  paths: {
    "/api/track": {
      post: {
        tags: ["Tracking"],
        operationId: "trackShipment",
        summary: "Track one shipment",
        description: "Tracking numbers are processed by ExportFlow's server-side carrier engine. Input limits and rate limits apply. Results contain only carrier-reported information and conservative truth/insight classifications.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TrackingRequest" },
              example: { number: "LX123456789CN", language: "en" }
            }
          }
        },
        responses: {
          "200": { description: "Carrier result and normalized shipment truth.", content: { "application/json": { schema: { $ref: "#/components/schemas/TrackingResult" } } } },
          "400": { description: "Invalid JSON, tracking number, carrier, postcode or language.", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "403": { description: "Origin is not allowed." },
          "413": { description: "Request body exceeds 4 KiB." },
          "415": { description: "Content-Type must be application/json." },
          "422": { description: "The selected carrier requires additional input." },
          "429": { description: "Per-isolate request limit reached. Retry-After is provided." },
          "502": { description: "Carrier lookup could not be completed." },
          "503": { description: "The per-isolate concurrent lookup limit was reached." }
        }
      }
    },
    "/api/batch-track": {
      post: {
        tags: ["Tracking"],
        operationId: "batchTrackShipments",
        summary: "Track up to five shipments",
        description: "Runs up to five independent single-shipment lookups. Each child lookup reuses /api/track validation, provider budgets, rate limiting, concurrency protection and redaction. Partial failures are returned per item; tracking numbers are never echoed.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BatchTrackingRequest" },
              example: { shipments: [{ id: "order-1", number: "LX123456789CN", language: "en" }, { id: "order-2", number: "RR123456789BD", language: "en" }] }
            }
          }
        },
        responses: {
          "200": { description: "Per-shipment results. Individual failures do not fail the whole batch.", content: { "application/json": { schema: { $ref: "#/components/schemas/BatchTrackingResult" } } } },
          "400": { description: "Invalid batch structure, duplicate IDs or invalid item shape." },
          "403": { description: "Origin is not allowed." },
          "413": { description: "Request body exceeds 12 KiB." },
          "415": { description: "Content-Type must be application/json." }
        }
      }
    },
    "/api/carriers": {
      get: {
        tags: ["Discovery"],
        operationId: "listCarriers",
        summary: "List carrier catalog IDs",
        responses: {
          "200": {
            description: "IDs from the pinned upstream carrier catalog; not a live-availability guarantee.",
            content: { "application/json": { schema: { type: "object", required: ["catalogEntries", "carriers"], properties: { catalogEntries: { type: "integer", minimum: 0 }, carriers: { type: "array", items: { type: "string" } } } } } }
          }
        }
      }
    },
    "/api/coverage": {
      get: {
        tags: ["Discovery"],
        operationId: "getCountryCoverage",
        summary: "Get catalog-derived country coverage",
        description: "The response classifies catalog records as direct adapter, universal fallback, link-only or not listed. It does not claim verified live tracking.",
        responses: { "200": { description: "Catalog-derived 249-code country/territory directory.", content: { "application/json": { schema: { type: "object", required: ["source", "summary", "countries"], properties: { source: { type: "string" }, upstreamRevision: { type: "string" }, generatedAt: { type: "string", format: "date-time" }, summary: { type: "object" }, countries: { type: "array", items: { type: "object" } } } } } } } }
      }
    },
    "/api/health": {
      get: {
        tags: ["System"],
        operationId: "getHealth",
        summary: "Read service liveness",
        responses: { "200": { description: "Process-level liveness only; upstream carrier availability is not tested." } }
      }
    },
    "/api/openapi": {
      get: {
        tags: ["System"],
        operationId: "getOpenApi",
        summary: "Get this OpenAPI document",
        responses: { "200": { description: "OpenAPI 3.1 document." } }
      }
    }
  },
  components: {
    schemas: {
      TrackingRequest: {
        type: "object",
        additionalProperties: false,
        required: ["number"],
        properties: {
          number: { type: "string", minLength: 4, maxLength: 40, pattern: "^[a-zA-Z0-9\\s-]+$" },
          carrier: { type: "string", minLength: 2, maxLength: 80, pattern: "^[a-z0-9-]+$" },
          postcode: { type: "string", maxLength: 24 },
          language: { type: "string", enum: ["en", "ar", "es", "zh", "hi", "pt", "fr", "bn"] }
        }
      },
      TrackingEvent: {
        type: "object",
        properties: {
          time: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          stage: { type: "string" },
          source: { type: "string" },
          sourceRefs: { type: "array", items: { type: "string" } },
          trusted: { type: "boolean" }
        }
      },
      TrackingResult: {
        type: "object",
        required: ["carrier", "source", "status", "confidence", "truth", "events"],
        properties: {
          carrier: { type: "string" },
          source: { type: "string" },
          status: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium"] },
          expectedDelivery: { type: ["string", "null"] },
          service: { type: ["string", "null"] },
          truth: {
            type: "object",
            properties: {
              latestReceived: { oneOf: [{ $ref: "#/components/schemas/TrackingEvent" }, { type: "null" }] },
              latestTrusted: { oneOf: [{ $ref: "#/components/schemas/TrackingEvent" }, { type: "null" }] },
              selected: { oneOf: [{ $ref: "#/components/schemas/TrackingEvent" }, { type: "null" }] },
              conflicts: { type: "array", items: { type: "object" } },
              insights: { type: "object" }
            }
          },
          events: { type: "array", items: { $ref: "#/components/schemas/TrackingEvent" } }
        }
      },
      BatchTrackingItem: {
        type: "object",
        additionalProperties: false,
        required: ["id", "number"],
        properties: {
          id: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,40}$" },
          number: { type: "string", minLength: 4, maxLength: 40, pattern: "^[a-zA-Z0-9\\s-]+$" },
          carrier: { type: "string", minLength: 2, maxLength: 80, pattern: "^[a-z0-9-]+$" },
          postcode: { type: "string", maxLength: 24 },
          language: { type: "string", enum: ["en", "ar", "es", "zh", "hi", "pt", "fr", "bn"] }
        }
      },
      BatchTrackingRequest: {
        type: "object",
        additionalProperties: false,
        required: ["shipments"],
        properties: {
          shipments: { type: "array", minItems: 1, maxItems: 5, uniqueItems: true, items: { $ref: "#/components/schemas/BatchTrackingItem" } }
        }
      },
      BatchTrackingResult: {
        type: "object",
        required: ["results", "summary"],
        properties: {
          results: { type: "array", items: { type: "object", required: ["id", "status", "data"], properties: { id: { type: "string" }, status: { type: "integer" }, data: { type: "object" } } } },
          summary: { type: "object", required: ["requested", "succeeded", "failed"], properties: { requested: { type: "integer" }, succeeded: { type: "integer" }, failed: { type: "integer" } } }
        }
      },
      ApiError: { type: "object", required: ["error"], properties: { error: { type: "string" } } }
    }
  },
  "x-exportflow-privacy": {
    trackingNumbers: "Processed for the requested lookup and not echoed in API responses.",
    storage: "The public tracking API does not provide a user account or server-side shipment history.",
    thirdParty: "A carrier lookup may send the number to the selected upstream carrier adapter. Do not submit another person's tracking number without authorization."
  },
  "x-exportflow-limits": {
    singleLookup: { requestBodyBytes: 4096, requestsPerMinutePerRuntimeInstance: 12, concurrentLookupsPerRuntimeInstance: 6, lookupBudgetMilliseconds: 25000 },
    batchLookup: { requestBodyBytes: 12288, maximumItems: 5, eachItemUsesSingleLookupLimits: true }
  }
};

export async function onRequestGet() {
  return new Response(JSON.stringify(OPENAPI), {
    headers: {
      "Content-Type": "application/vnd.oai.openapi+json;version=3.1",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
