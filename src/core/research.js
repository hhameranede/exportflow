import { normalizeResult } from "./result.js";
import { executeAdapter } from "./adapters.js";
import { validatePublicHttpUrl } from "./http-fetch.js";
import { extractFromStructuredSources, validateExtractionSchema } from "./extract.js";
import { throwIfAborted, createTaskCancelledError } from "./cancellation.js";

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
    async execute(input = {}, options = {}) {
      const signal = options.signal;
      throwIfAborted(signal);
      const validated = validateInput(input);
      if (!searchAdapter || typeof searchAdapter.execute !== "function") {
        throw new ResearchPipelineError("SEARCH_UNAVAILABLE", "Search adapter is not configured.", 503);
      }

      const searchResult = await searchAdapter.execute({
        query: validated.query,
        limit: Math.min(validated.limit ?? 5, 10),
      }, { signal });
      throwIfAborted(signal);
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
        throwIfAborted(signal);
        let target;
        try {
          target = validatePublicHttpUrl(candidate.url);
        } catch {
          attempts.push({ url: null, stage: "fetch", status: "rejected", reason: "URL_NOT_ALLOWED" });
          continue;
        }

        let fetched;
        try {
          fetched = await runAdapter("http.fetch.v1", { url: target.href }, {
            ...(typeof options.fetchImpl === "function" ? { fetchImpl: options.fetchImpl } : {}),
            ...(signal ? { signal } : {}),
          });
          throwIfAborted(signal);
        } catch (error) {
          if (error?.code === "TASK_CANCELLED" || signal?.aborted) throw createTaskCancelledError();
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
          best = { candidate, finalUrl, fetched, extracted, browserResult: null, attempt };
        }

        if (extracted.missingRequired.length === 0 && extracted.status !== "failed") break;
      }

      // Browser escalation is a single bounded attempt against the best static candidate.
      let browserEscalated = false;
      if (best && best.extracted.missingRequired.length && browserAdapter &&
          typeof browserAdapter.execute === "function") {
        browserEscalated = true;
        try {
          const browserResult = await browserAdapter.execute({
            url: best.finalUrl,
            goal: "Render this page to complete the requested structured extraction.",
            requiresInteraction: false,
          }, {
            ...(signal ? { signal } : {}),
            ...(typeof options.fetchImpl === "function" ? { fetchImpl: options.fetchImpl } : {}),
          });
          throwIfAborted(signal);
          best.browserResult = browserResult;
          const html = browserResult.data?.html;
          if (browserResult.status === "succeeded" && typeof html === "string") {
            const htmlBytes = new TextEncoder().encode(html).byteLength;
            const renderedUrl = validatePublicHttpUrl(browserResult.data.url || best.finalUrl);
            if (renderedUrl.origin !== new URL(best.finalUrl).origin) {
              warnings.push("Browser rendering returned a page outside the selected origin; rendered content was ignored.");
            } else if (htmlBytes > 524_288) {
              warnings.push("Browser rendered HTML exceeded the extraction size limit and was ignored.");
            } else {
              const rendered = extractFromStructuredSources({
                html,
                url: renderedUrl.href,
                contentType: "text/html",
                schema: validated.rawSchema,
              });
              best.extracted = mergeBrowserExtraction(best.extracted, rendered, validated.schema);
              best.browserEvidenceAccepted = true;
            }
          } else {
            warnings.push("Browser escalation did not return a renderable HTML page.");
          }
        } catch (error) {
          if (error?.code === "TASK_CANCELLED" || signal?.aborted) throw createTaskCancelledError();
          warnings.push("Browser escalation was attempted but did not complete.");
        }
        best.attempt.stage = "browser-extract";
        best.attempt.status = best.extracted.status;
        best.attempt.fieldsFound = Object.keys(best.extracted.data).length;
        best.attempt.missingRequired = [...best.extracted.missingRequired];
      } else if (best?.extracted.missingRequired.length) {
        warnings.push("Required fields remain missing; Browser rendering is not configured for this task.");
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

      throwIfAborted(signal);
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
      if (best.browserEvidenceAccepted && best.browserResult?.sources?.[0]?.evidence) {
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
          browserEscalated,
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
