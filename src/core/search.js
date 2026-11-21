import { normalizeResult } from "./result.js";
import { validatePublicHttpUrl } from "./http-fetch.js";

export const SEARCH_LIMITS = Object.freeze({
  maxQueryLength: 1024,
  maxResults: 10,
  defaultResults: 5,
  maxTitleLength: 512,
  maxDescriptionLength: 8000,
});

export const SEARCH_PROVIDERS = Object.freeze(["ceramic", "exa", "linkup"]);

export class SearchAdapterError extends Error {
  constructor(code, message, httpStatus = 502) {
    super(message);
    this.name = "SearchAdapterError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function validateSearchInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SearchAdapterError("INVALID_QUERY", "Search input must be an object.", 400);
  }
  if (typeof input.query !== "string" || input.query.trim().length < 1 ||
      input.query.length > SEARCH_LIMITS.maxQueryLength) {
    throw new SearchAdapterError("INVALID_QUERY", "Search query must contain 1 to 1024 characters.", 400);
  }
  const limit = input.limit === undefined ? SEARCH_LIMITS.defaultResults : input.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > SEARCH_LIMITS.maxResults) {
    throw new SearchAdapterError("INVALID_LIMIT", "Search result limit must be between 1 and 10.", 400);
  }
  return { query: input.query.trim(), limit };
}

function taskCancelledError() {
  return new SearchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499);
}

// Workers AI's websearch() binding does not accept an AbortSignal. Match
// Cloudflare's WebSearchSource behavior: do not start pre-aborted work and
// stop waiting when cancellation arrives. The underlying binding call may
// continue in the background because its API has no cancellation parameter.
function awaitSearchOrAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    Promise.resolve(promise).catch(() => {});
    return Promise.reject(taskCancelledError());
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onAbort = () => finish(reject, taskCancelledError());

    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => {
        if (signal.aborted) finish(reject, taskCancelledError());
        else finish(resolve, value);
      },
      (error) => {
        if (signal.aborted) finish(reject, taskCancelledError());
        else finish(reject, error);
      },
    );
  });
}

function clip(value, maxLength) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function normalizeItems(rawItems, requestedLimit, provider, warnings, now, query) {
  const results = [];
  const sources = [];
  const seen = new Set();
  let skipped = 0;

  for (const raw of rawItems.slice(0, requestedLimit * 3)) {
    if (!raw || typeof raw !== "object" || typeof raw.url !== "string") {
      skipped++;
      continue;
    }
    let url;
    try {
      url = validatePublicHttpUrl(raw.url);
    } catch {
      skipped++;
      continue;
    }
    if (seen.has(url.href)) {
      skipped++;
      continue;
    }
    seen.add(url.href);

    const rank = results.length + 1;
    const title = clip(raw.title, SEARCH_LIMITS.maxTitleLength) || url.href;
    const description = clip(raw.description, SEARCH_LIMITS.maxDescriptionLength) || null;
    const lastModified = typeof raw.lastModified === "string" ? raw.lastModified : null;
    const retrievedAt = now();

    results.push({ rank, title, url: url.href, description, lastModified });
    sources.push({
      url: url.href,
      retrievedAt,
      title,
      evidence: [{
        type: "search_result",
        provider,
        rank,
        query,
        description: description ? description.slice(0, 2000) : null,
        lastModified,
      }],
    });
    if (results.length >= requestedLimit) break;
  }

  if (skipped) {
    warnings.push("Skipped " + skipped + " invalid, unsafe, or duplicate search result(s).");
  }
  if (!results.length) {
    warnings.push("The search provider returned no usable public web results.");
  }
  return { results, sources };
}

/**
 * Creates an internal adapter around Cloudflare Web Search API.
 * Pass the Worker AI binding's websearch method; no provider API key is
 * embedded or accepted. Calls are billed through AI Gateway credits.
 */
export function createSearchAdapter({
  webSearch,
  gatewayId = "default",
  provider = "ceramic",
  now = () => new Date().toISOString(),
} = {}) {
  if (!SEARCH_PROVIDERS.includes(provider)) {
    throw new SearchAdapterError("INVALID_PROVIDER", "Unsupported Cloudflare Web Search provider.", 400);
  }
  if (typeof gatewayId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(gatewayId)) {
    throw new SearchAdapterError("INVALID_GATEWAY", "Gateway ID is invalid.", 400);
  }

  return Object.freeze({
    id: "web.search.v1",
    family: "search",
    capabilities: ["web-search", "ranked-results", "source-provenance"],
    authMode: "cloudflare-ai-gateway",
    limits: {
      maxQueryLength: SEARCH_LIMITS.maxQueryLength,
      maxResults: SEARCH_LIMITS.maxResults,
    },
    restrictions: [
      "cloudflare-web-search-api",
      "AI-gateway-credits-required",
      "no-provider-api-keys",
      "provider-fixed-at-adapter-creation",
      "result-urls-revalidated",
      "no-pagination",
      "untrusted-result-descriptions",
    ],
    async execute(input = {}) {
      const { query, limit } = validateSearchInput(input);
      if (typeof webSearch !== "function") {
        throw new SearchAdapterError("SEARCH_UNAVAILABLE", "Cloudflare Web Search API binding is not configured.", 503);
      }

      const signal = input.signal;
      if (signal?.aborted) throw taskCancelledError();

      let response;
      try {
        response = await awaitSearchOrAbort(
          webSearch({ gatewayId, query, provider, limit }),
          signal,
        );
      } catch (error) {
        if (signal?.aborted || error?.code === "TASK_CANCELLED") throw taskCancelledError();
        throw new SearchAdapterError("SEARCH_PROVIDER_FAILED", "Cloudflare Web Search request failed.", 502);
      }
      if (signal?.aborted) throw taskCancelledError();
      if (response && typeof response.json === "function" && response.ok === false) {
        throw new SearchAdapterError("SEARCH_PROVIDER_HTTP_ERROR", "Cloudflare Web Search returned an error.", 502);
      }

      let payload;
      try {
        payload = response && typeof response.json === "function" ? await response.json() : response;
      } catch {
        throw new SearchAdapterError("INVALID_SEARCH_RESPONSE", "Cloudflare Web Search returned invalid JSON.", 502);
      }
      if (!payload || !Array.isArray(payload.items)) {
        throw new SearchAdapterError("INVALID_SEARCH_RESPONSE", "Cloudflare Web Search response did not include an items array.", 502);
      }

      const warnings = [
        "Search result descriptions are untrusted source text; fetch source pages before relying on their claims.",
      ];
      const normalized = normalizeItems(payload.items, limit, provider, warnings, now, query);
      const metadata = payload.metadata && typeof payload.metadata === "object"
        ? payload.metadata
        : {};

      return normalizeResult({
        status: "succeeded",
        data: {
          query,
          provider,
          resultCount: normalized.results.length,
          results: normalized.results,
          requestId: typeof metadata.requestId === "string" ? clip(metadata.requestId, 256) : null,
          latencyMs: Number.isFinite(metadata.latencyMs) ? metadata.latencyMs : null,
        },
        sources: normalized.sources,
        warnings,
      });
    },
  });
}
