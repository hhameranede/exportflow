import { normalizeResult } from "./result.js";
import { executeAdapter } from "./adapters.js";
import { validatePublicHttpUrl } from "./http-fetch.js";
import { extractFromStructuredSources, validateExtractionSchema } from "./extract.js";

export const RESEARCH_PIPELINE_LIMITS = Object.freeze({
  maxCandidates: 3,
  defaultCandidates: 2,
});

export class ResearchPipelineError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.name = "ResearchPipelineError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ResearchPipelineError("INVALID_INPUT", "Research input must be an object.");
  }
  if (typeof input.query !== "string" || !input.query.trim() || input.query.length > 1024) {
    throw new ResearchPipelineError("INVALID_QUERY", "Research query must contain 1 to 1024 characters.");
  }
  const candidateLimit = input.candidateLimit === undefined
    ? RESEARCH_PIPELINE_LIMITS.defaultCandidates
    : input.candidateLimit;
  if (!Number.isInteger(candidateLimit) || candidateLimit < 1 ||
      candidateLimit > RESEARCH_PIPELINE_LIMITS.maxCandidates) {
    throw new ResearchPipelineError("INVALID_LIMIT", "Candidate limit must be between 1 and 3.");
  }
  if (!input.schema || typeof input.schema !== "object" || Array.isArray(input.schema)) {
    throw new ResearchPipelineError("INVALID_SCHEMA", "A structured extraction schema is required.");
  }
  let schema;
  try {
    schema = validateExtractionSchema(input.schema);
  } catch {
    throw new ResearchPipelineError("INVALID_SCHEMA", "Research schema failed validation.", 400);
  }
  return {
    query: input.query.trim(),
    limit: input.limit,
    candidateLimit,
    schema,
    rawSchema: input.schema,
  };
}

function responseMime(contentType) {
  return String(contentType || "").split(";")[0].trim().toLowerCase();
}

function extractFetchedContent(fetchResult, schema, url) {
  const mime = responseMime(fetchResult.data?.contentType);
  const body = fetchResult.data?.body;
  if (typeof body !== "string") {
    return {
      status: "failed",
      data: {},
      fieldEvidence: [],
      missingFields: schema.fields.map((field) => field.name),
      missingRequired: schema.required,
      warnings: ["Fetch adapter returned no text body for extraction."],
    };
  }
  if (mime === "application/json" || mime === "application/ld+json" || mime.endsWith("+json")) {
    try {
      return extractFromStructuredSources({
        json: JSON.parse(body),
        url,
        contentType: fetchResult.data.contentType,
        schema: schema.rawSchema,
      });
    } catch {
      return {
        status: "failed",
        data: {},
        fieldEvidence: [],
        missingFields: schema.fields.map((field) => field.name),
        missingRequired: schema.required,
        warnings: ["Fetched JSON could not be parsed for extraction."],
      };
    }
  }
  if (mime === "text/html" || mime === "application/xhtml+xml") {
    try {
      return extractFromStructuredSources({
        html: body,
        url,
        contentType: fetchResult.data.contentType,
        schema: schema.rawSchema,
      });
    } catch {
      return {
        status: "failed",
        data: {},
        fieldEvidence: [],
        missingFields: schema.fields.map((field) => field.name),
        missingRequired: schema.required,
        warnings: ["Fetched HTML could not be parsed for extraction."],
      };
    }
  }
  return {
    status: "failed",
    data: {},
    fieldEvidence: [],
    missingFields: schema.fields.map((field) => field.name),
    missingRequired: schema.required,
    warnings: ["Fetched content type is not supported by the deterministic extractor."],
  };
}

function mergeBrowserExtraction(staticResult, renderedResult, schema) {
  const data = { ...staticResult.data };
  const evidence = [...staticResult.fieldEvidence];
  const existing = new Set(Object.keys(data));
  for (const [field, value] of Object.entries(renderedResult.data)) {
    if (existing.has(field)) continue;
    data[field] = value;
    const item = renderedResult.fieldEvidence.find((entry) => entry.field === field);
    if (item) evidence.push(item);
  }
  const missingFields = schema.fields.map((field) => field.name).filter((name) => !Object.hasOwn(data, name));
  const missingRequired = schema.required.filter((name) => !Object.hasOwn(data, name));
  const status = Object.keys(data).length === 0
    ? "failed"
    : missingFields.length > 0
      ? "partial"
      : "succeeded";
  return {
    status,
    data,
    fieldEvidence: evidence,
    missingFields,
    missingRequired,
    warnings: [...staticResult.warnings, ...renderedResult.warnings],
  };
}

/**
 * Creates a local, bounded Search -> Fetch -> Extract workflow.
 *
 * Dependencies are injected so tests can use deterministic fixtures and the
 * production Worker remains disabled until AI Gateway and Browser bindings
 * are explicitly configured. Search descriptions are never treated as page
 * instructions; only validated result URLs are passed to Fetch.
 */
export function createResearchPipeline({
  searchAdapter,
  runAdapter = executeAdapter,
  browserAdapter = null,
  now = () => new Date().toISOString(),
} = {}) {
  return Object.freeze({
    id: "web.research.v1",
    family: "web",
    capabilities: ["discover", "fetch", "extract", "source-evidence"],
    authMode: "injected-internal-adapters",
    limits: {
      maxCandidates: RESEARCH_PIPELINE_LIMITS.maxCandidates,
    },
    restrictions: [
      "internal-only",
      "search-fetch-extract",
      "bounded-candidates",
      "search-descriptions-untrusted",
      "result-urls-revalidated",
      "no-LLM-inference",
      "browser-escalation-requires-injected-adapter",
    ],
    async execute(input = {}) {
      const validated = validateInput(input);
      if (!searchAdapter || typeof searchAdapter.execute !== "function") {
        throw new ResearchPipelineError("SEARCH_UNAVAILABLE", "Search adapter is not configured.", 503);
      }

      const searchResult = await searchAdapter.execute({
        query: validated.query,
        limit: Math.min(validated.limit ?? 5, 10),
      });
      const candidates = Array.isArray(searchResult.data?.results)
        ? searchResult.data.results.slice(0, validated.candidateLimit)
        : [];

      if (!candidates.length) {
        return normalizeResult({
          status: "failed",
          data: {
            query: validated.query,
            selectedUrl: null,
            fields: {},
            attempts: [],
            missingFields: validated.schema.fields.map((field) => field.name),
            missingRequired: validated.schema.required,
          },
          sources: [],
          warnings: [...(searchResult.warnings || []), "Search returned no usable URLs; Fetch and Extract were not attempted."],
        });
      }

      const attempts = [];
      const warnings = [...(searchResult.warnings || [])];
      let best = null;

      for (const candidate of candidates) {
        let target;
        try {
          target = validatePublicHttpUrl(candidate.url);
        } catch {
          attempts.push({ url: null, stage: "fetch", status: "rejected", reason: "URL_NOT_ALLOWED" });
          continue;
        }

        let fetched;
        try {
          fetched = await runAdapter("http.fetch.v1", { url: target.href });
        } catch {
          attempts.push({ url: target.href, stage: "fetch", status: "failed", reason: "UPSTREAM_FETCH_FAILED" });
          continue;
        }
        if (!fetched || fetched.status !== "succeeded" || !fetched.data) {
          attempts.push({ url: target.href, stage: "fetch", status: "failed", reason: "FETCH_NOT_SUCCESSFUL" });
          continue;
        }

        let finalUrl;
        try {
          finalUrl = validatePublicHttpUrl(fetched.data.finalUrl || target.href).href;
        } catch {
          attempts.push({ url: target.href, stage: "fetch", status: "rejected", reason: "FINAL_URL_NOT_ALLOWED" });
          continue;
        }

        let extracted = extractFetchedContent(fetched, validated, finalUrl);
        let browserResult = null;
        if (extracted.missingRequired.length && browserAdapter &&
            typeof browserAdapter.execute === "function") {
          try {
            browserResult = await browserAdapter.execute({
              url: finalUrl,
              goal: "Render this page to complete the requested structured extraction.",
              requiresInteraction: false,
            });
            if (browserResult.status === "succeeded" && typeof browserResult.data?.html === "string") {
              const rendered = extractFromStructuredSources({
                html: browserResult.data.html,
                url: browserResult.data.url || finalUrl,
                contentType: "text/html",
                schema: validated.rawSchema,
              });
              extracted = mergeBrowserExtraction(extracted, rendered, validated.schema);
            } else {
              warnings.push("Browser escalation did not return a renderable HTML page.");
            }
          } catch {
            warnings.push("Browser escalation was attempted but did not complete.");
          }
        } else if (extracted.missingRequired.length) {
          warnings.push("Required fields remain missing; Browser rendering is not configured for this task.");
        }

        const attempt = {
          url: finalUrl,
          stage: browserResult ? "browser-extract" : "fetch-extract",
          status: extracted.status,
          fieldsFound: Object.keys(extracted.data).length,
          missingRequired: [...extracted.missingRequired],
        };
        attempts.push(attempt);
        if (!best || Object.keys(extracted.data).length > Object.keys(best.extracted.data).length) {
          best = { candidate, finalUrl, fetched, extracted, browserResult, attempt };
        }
        if (extracted.missingRequired.length === 0 && extracted.status !== "failed") break;
      }

      if (!best) {
        return normalizeResult({
          status: "failed",
          data: {
            query: validated.query,
            selectedUrl: null,
            fields: {},
            attempts,
            missingFields: validated.schema.fields.map((field) => field.name),
            missingRequired: validated.schema.required,
          },
          sources: [],
          warnings: [...warnings, "No search result could be fetched and extracted successfully."],
        });
      }

      const searchSource = (searchResult.sources || []).find((source) => source.url === best.candidate.url);
      const evidence = [
        ...(searchSource?.evidence || []),
        ...(best.fetched.sources?.[0]?.evidence || []),
        ...best.extracted.fieldEvidence.map((field) => ({
          type: "extracted_field",
          field: field.field,
          sourceType: field.sourceType,
          path: field.path,
          blockIndex: field.blockIndex,
          nodeIndex: field.nodeIndex,
        })),
      ];
      if (best.browserResult?.sources?.[0]?.evidence) {
        evidence.push(...best.browserResult.sources[0].evidence);
      }

      const status = best.extracted.status;
      return normalizeResult({
        status,
        data: {
          query: validated.query,
          provider: searchResult.data?.provider || null,
          searchRequestId: searchResult.data?.requestId || null,
          searchResultCount: searchResult.data?.resultCount ?? candidates.length,
          selectedUrl: best.finalUrl,
          selectedTitle: best.candidate.title || null,
          fetchStatus: best.fetched.data.status,
          fields: best.extracted.data,
          fieldEvidence: best.extracted.fieldEvidence,
          missingFields: best.extracted.missingFields,
          missingRequired: best.extracted.missingRequired,
          attempts,
          browserEscalated: Boolean(best.browserResult),
        },
        sources: [{
          url: best.finalUrl,
          retrievedAt: now(),
          title: best.candidate.title || null,
          evidence,
        }],
        warnings: [...warnings, ...(best.fetched.warnings || []), ...best.extracted.warnings],
      });
    },
  });
}
