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
  if (!["wikipedia", "openalex", "crossref"].includes(input.source)) {
    throw new ResearchPipelineError("INVALID_SEARCH_SOURCE", "Choose wikipedia, openalex, or crossref as the research source.");
  }
  const cacheMode = input.cacheMode === undefined ? "default" : input.cacheMode;
  if (!["default", "bypass"].includes(cacheMode)) {
    throw new ResearchPipelineError("INVALID_CACHE_MODE", "cacheMode must be 'default' or 'bypass'.");
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
    source: input.source,
    cacheMode,
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


/**
 * Creates a local, bounded Search -> Fetch -> Extract workflow.
 *
 * Search sources are explicit public datasets; only validated result URLs
 * are passed to bounded HTTP Fetch. JavaScript rendering and browser escalation
 * are not part of this pipeline.
 */
export function createResearchPipeline({
  searchAdapter,
  runAdapter = executeAdapter,
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
      "static-http-only",
      "no-browser-runtime",
    ],
    async execute(input = {}) {
      const validated = validateInput(input);
      const signal = input.signal;
      const throwIfCancelled = () => {
        if (signal?.aborted) throw Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" });
      };
      throwIfCancelled();
      if (!searchAdapter || typeof searchAdapter.execute !== "function") {
        throw new ResearchPipelineError("SEARCH_UNAVAILABLE", "Search adapter is not configured.", 503);
      }

      const searchResult = await searchAdapter.execute({
        query: validated.query,
        source: validated.source,
        cacheMode: validated.cacheMode,
        limit: Math.min(validated.limit ?? 5, 10),
        ...(signal ? { signal } : {}),
      });
      throwIfCancelled();
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
        throwIfCancelled();
        let target;
        try {
          target = validatePublicHttpUrl(candidate.url);
        } catch {
          attempts.push({ url: null, stage: "fetch", status: "rejected", reason: "URL_NOT_ALLOWED" });
          continue;
        }

        let fetched;
        try {
          fetched = await runAdapter("http.fetch.v1", { url: target.href, cacheMode: validated.cacheMode }, signal ? { signal } : {});
          throwIfCancelled();
        } catch (error) {
          if (error?.code === "TASK_CANCELLED" || signal?.aborted) throw Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" });
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

        const extracted = extractFetchedContent(fetched, validated, finalUrl);
        const attempt = {
          url: finalUrl,
          stage: "fetch-extract",
          status: extracted.status,
          fieldsFound: Object.keys(extracted.data).length,
          missingRequired: [...extracted.missingRequired],
        };
        attempts.push(attempt);

        const requiredFound = validated.schema.required.length - extracted.missingRequired.length;
        const bestRequiredFound = best
          ? validated.schema.required.length - best.extracted.missingRequired.length
          : -1;
        const fieldsFound = Object.keys(extracted.data).length;
        const bestFieldsFound = best ? Object.keys(best.extracted.data).length : -1;
        if (!best || requiredFound > bestRequiredFound ||
            (requiredFound === bestRequiredFound && fieldsFound > bestFieldsFound)) {
          best = { candidate, finalUrl, fetched, extracted, attempt };
        }

        if (extracted.missingRequired.length === 0 && extracted.status !== "failed") break;
      }

      if (best?.extracted.missingRequired.length) {
        warnings.push("Some requested fields were absent from static HTML/JSON; JavaScript rendering is not supported.");
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
          rendering: "static-http-only",
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
