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
            description: "Carrier catalog metadata plus a D1-backed evidence register. Research status, account-access conditions and third-party display rights are disclosed separately. Verified requires repeatable live test evidence and an authorization reference.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CarrierCatalog" } } }
          }
        }
      }
    },
    "/api/carrier-directory": {
      get: {
        tags: ["Discovery"],
        operationId: "getPaginatedCarrierDirectory",
        summary: "Search the global carrier catalog",
        description: "Returns a paginated view of the pinned upstream carrier catalog. Each record is catalog metadata, not proof of a live lookup, a distinct legal company, carrier authorization or third-party tracking rights. Evidence details are joined only for the curated D1 research records.",
        parameters: [
          { name: "q", in: "query", required: false, schema: { type: "string", maxLength: 120 }, description: "Search carrier names, IDs, aliases or ISO country codes." },
          { name: "country", in: "query", required: false, schema: { type: "string", pattern: "^[A-Z]{2}$" }, description: "Filter by ISO 3166-1 alpha-2 country code." },
          { name: "evidence", in: "query", required: false, schema: { type: "string", enum: ["all", "catalogued", "research", "testing", "integrated", "verified", "blocked", "deprecated"] } },
          { name: "adapter", in: "query", required: false, schema: { type: "string", enum: ["all", "dedicated", "universal-fallback", "link-only", "none"] } },
          { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "pageSize", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } }
        ],
        responses: {
          "200": {
            description: "A bounded page of the upstream catalog with separate catalog, adapter and evidence counts.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CarrierDirectoryResponse" } } }
          },
          "400": { description: "Invalid country, evidence or adapter filter.", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
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
    "/api/mcp": {
      post: {
        tags: ["Developer Ecosystem"],
        operationId: "handleMcpRequest",
        summary: "Call ExportFlow through the stateless MCP endpoint",
        description: "Model Context Protocol Streamable HTTP endpoint implementing protocol revision 2026-07-28. POST one JSON-RPC request with MCP-Protocol-Version, Mcp-Method and the required Accept header. Mcp-Name is required for tools/call and must equal params.name. No protocol session or server-side watchlist is created. Tracking numbers may be forwarded to upstream carrier adapters when a tool performs a live lookup.",
        parameters: [
          { name: "MCP-Protocol-Version", in: "header", required: true, schema: { type: "string", const: "2026-07-28" } },
          { name: "Mcp-Method", in: "header", required: true, schema: { type: "string" } },
          { name: "Mcp-Name", in: "header", required: false, description: "Required for tools/call; must equal params.name.", schema: { type: "string" } },
          { name: "Accept", in: "header", required: true, description: "Must include application/json and text/event-stream.", schema: { type: "string", example: "application/json, text/event-stream" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/McpJsonRpcRequest" },
              example: {
                jsonrpc: "2.0",
                id: 1,
                method: "tools/list",
                params: { _meta: {
                  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                  "io.modelcontextprotocol/clientInfo": { name: "example-client", version: "1.0.0" },
                  "io.modelcontextprotocol/clientCapabilities": {}
                } }
              }
            }
          }
        },
        responses: {
          "200": { description: "JSON-RPC response, discovery document, tool catalog or tool result." },
          "400": { description: "Invalid JSON-RPC message, protocol metadata or required routing header." },
          "403": { description: "Origin is not allowed." },
          "405": { description: "Only POST is supported." },
          "406": { description: "Accept must include application/json and text/event-stream." },
          "413": { description: "Request body exceeds 16 KiB." },
          "415": { description: "Content-Type must be application/json." },
          "404": { description: "Unknown JSON-RPC method." }
        }
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
          carrier: { type: "string", minLength: 2, maxLength: 80, pattern: "^[a-zA-Z0-9-]+$" },
          postcode: { type: "string", minLength: 1, maxLength: 24, pattern: "^[a-zA-Z0-9 -]+$" },
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
      CarrierDirectoryEvidence: {
        type: "object",
        required: ["level", "adapterState", "integrationMethod", "commercialAccess", "trackingRights", "sourceUrl", "disclosure", "verification"],
        properties: {
          level: { type: "string", enum: ["catalogued", "research", "testing", "integrated", "verified", "blocked", "deprecated"] },
          adapterState: { type: "string" },
          integrationMethod: { type: "string" },
          commercialAccess: { type: "string" },
          trackingRights: { type: "string" },
          sourceUrl: { type: ["string", "null"], format: "uri" },
          disclosure: { type: "string" },
          verification: {
            type: "object",
            required: ["method", "liveVerified", "verifiedAt"],
            properties: {
              method: { type: "string", enum: ["none", "mock", "sandbox", "live"] },
              liveVerified: { type: "boolean" },
              verifiedAt: { type: ["string", "null"], format: "date-time" }
            }
          }
        }
      },
      CarrierDirectoryRecord: {
        type: "object",
        required: ["id", "name", "aliases", "countries", "selectable", "trackingMode", "adapter", "adapterType", "isCatalogEntry", "evidence"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
          countries: { type: "array", items: { type: "string", pattern: "^[A-Z]{2}$" } },
          selectable: { type: "boolean" },
          trackingMode: { type: "string", enum: ["automatic", "link-only", "not-declared"] },
          adapter: { type: ["string", "null"] },
          adapterType: { type: "string", enum: ["dedicated", "universal-fallback", "link-only", "none"] },
          isCatalogEntry: { type: "boolean" },
          countryScope: { type: "string" },
          evidence: { $ref: "#/components/schemas/CarrierDirectoryEvidence" }
        }
      },
      CarrierDirectoryResponse: {
        type: "object",
        required: ["source", "upstreamRevision", "upstreamSnapshot", "summary", "pagination", "filters", "records"],
        properties: {
          source: { type: "string" },
          upstreamRevision: { type: "string" },
          generatedAt: { type: "string", format: "date-time" },
          upstreamSnapshot: { type: "object" },
          summary: { type: "object" },
          pagination: {
            type: "object",
            required: ["page", "pageSize", "totalMatches", "totalPages", "hasPrevious", "hasNext"],
            properties: {
              page: { type: "integer" },
              pageSize: { type: "integer", maximum: 100 },
              totalMatches: { type: "integer" },
              totalPages: { type: "integer" },
              hasPrevious: { type: "boolean" },
              hasNext: { type: "boolean" }
            }
          },
          filters: { type: "object" },
          records: { type: "array", items: { $ref: "#/components/schemas/CarrierDirectoryRecord" } }
        }
      },
      CarrierCatalog: {
        type: "object",
        required: ["catalogEntries", "selectableCarrierRecords", "carriers", "carrierRecords", "evidenceRegistryAvailable", "evidenceRegistryCounts", "evidenceRegistry", "metadataNotice"],
        properties: {
          catalogEntries: { type: "integer", minimum: 0 },
          selectableCarrierRecords: { type: "integer", minimum: 0 },
          directAdapterCatalogRecords: { type: "integer", minimum: 0 },
          universalFallbackCatalogRecords: { type: "integer", minimum: 0 },
          linkOnlyCatalogRecords: { type: "integer", minimum: 0 },
          carriers: { type: "array", items: { type: "string" } },
          carrierRecords: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "name", "countries", "tracking"],
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                countries: { type: "array", items: { type: "string", pattern: "^[A-Z]{2}$" } },
                tracking: {
                  type: "object",
                  required: ["mode", "adapter"],
                  properties: {
                    mode: { type: "string", enum: ["automatic", "link-only", "not-declared"] },
                    adapter: { type: ["string", "null"] }
                  }
                },
                evidence: { $ref: "#/components/schemas/CarrierEvidenceSummary" }
              }
            }
          },
          evidenceRegistryAvailable: { type: "boolean" },
          evidenceRegistryCounts: {
            type: "object",
            properties: {
              researched: { type: "integer" },
              testing: { type: "integer" },
              integrated: { type: "integer" },
              verified: { type: "integer" },
              blocked: { type: "integer" },
              withoutAdapter: { type: "integer" }
            }
          },
          evidenceRegistry: { type: "array", items: { $ref: "#/components/schemas/CarrierEvidence" } },
          metadataNotice: { type: "string" }
        }
      },
      CarrierEvidenceVerification: {
        type: "object",
        required: ["method", "liveVerified", "verifiedAt", "evidenceUrl", "authorizationConfirmed"],
        properties: {
          method: { type: "string", enum: ["none", "mock", "sandbox", "live"] },
          liveVerified: { type: "boolean" },
          verifiedAt: { type: ["string", "null"], format: "date-time" },
          evidenceUrl: { type: ["string", "null"], format: "uri" },
          authorizationConfirmed: { type: "boolean" }
        }
      },
      CarrierEvidenceSummary: {
        type: "object",
        required: ["level", "commercialAccess", "trackingRights", "sourceUrl", "disclosure", "verification"],
        properties: {
          level: { type: "string", enum: ["catalogued", "research", "testing", "integrated", "verified", "blocked", "deprecated"] },
          commercialAccess: { type: "string" },
          trackingRights: { type: "string" },
          sourceUrl: { type: ["string", "null"], format: "uri" },
          disclosure: { type: "string" },
          verification: { $ref: "#/components/schemas/CarrierEvidenceVerification" }
        }
      },
      CarrierEvidence: {
        type: "object",
        required: ["id", "name", "countryScope", "integrationMethod", "adapterState", "adapterIds", "evidenceLevel", "verification", "commercialAccess", "trackingRights", "sourceUrl", "disclosure"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          countryScope: { type: "string" },
          integrationMethod: { type: "string" },
          adapterState: { type: "string", enum: ["present", "country_specific", "missing"] },
          adapterIds: { type: "array", items: { type: "string" } },
          evidenceLevel: { type: "string", enum: ["research", "testing", "integrated", "verified", "blocked", "deprecated"] },
          verification: { $ref: "#/components/schemas/CarrierEvidenceVerification" },
          commercialAccess: { type: "string" },
          trackingRights: { type: "string" },
          sourceUrl: { type: ["string", "null"], format: "uri" },
          disclosure: { type: "string" }
        }
      },
      BatchTrackingItem: {
        type: "object",
        additionalProperties: false,
        required: ["id", "number"],
        properties: {
          id: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,40}$" },
          number: { type: "string", minLength: 4, maxLength: 40, pattern: "^[a-zA-Z0-9\\s-]+$" },
          carrier: { type: "string", minLength: 2, maxLength: 80, pattern: "^[a-zA-Z0-9-]+$" },
          postcode: { type: "string", minLength: 1, maxLength: 24, pattern: "^[a-zA-Z0-9 -]+$" },
          language: { type: "string", enum: ["en", "ar", "es", "zh", "hi", "pt", "fr", "bn"] }
        }
      },
      BatchTrackingRequest: {
        type: "object",
        additionalProperties: false,
        required: ["shipments"],
        properties: {
          shipments: { type: "array", minItems: 1, maxItems: 5, items: { $ref: "#/components/schemas/BatchTrackingItem" } }
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
      McpJsonRpcRequest: {
        type: "object",
        additionalProperties: true,
        required: ["jsonrpc", "id", "method"],
        properties: {
          jsonrpc: { type: "string", const: "2.0" },
          id: { oneOf: [{ type: "string" }, { type: "number" }] },
          method: { type: "string", enum: ["server/discover", "tools/list", "tools/call"] },
          params: {
            type: "object",
            properties: {
              name: { type: "string" },
              arguments: { type: "object" },
              _meta: {
                type: "object",
                required: ["io.modelcontextprotocol/protocolVersion", "io.modelcontextprotocol/clientCapabilities"],
                properties: {
                  "io.modelcontextprotocol/protocolVersion": { type: "string", const: "2026-07-28" },
                  "io.modelcontextprotocol/clientInfo": { type: "object" },
                  "io.modelcontextprotocol/clientCapabilities": { type: "object" }
                }
              }
            }
          }
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
