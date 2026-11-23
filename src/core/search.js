import { fetchPublicResource, validatePublicHttpUrl } from "./http-fetch.js";
import { normalizeResult } from "./result.js";

export const SEARCH_SOURCES = Object.freeze(["wikipedia", "openalex", "crossref"]);
export const SEARCH_LIMITS = Object.freeze({ maxQueryLength: 1024, maxResults: 10, maxResponseBytes: 1_048_576 });

export class SearchAdapterError extends Error {
  constructor(code, message, httpStatus = 502) {
    super(message); this.name = "SearchAdapterError"; this.code = code; this.httpStatus = httpStatus;
  }
}

function clean(value, max = 500) {
  return typeof value === "string"
    ? value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function endpointFor(source, query, limit) {
  const endpoint = new URL(source === "wikipedia" ? "https://en.wikipedia.org/w/api.php"
    : source === "openalex" ? "https://api.openalex.org/works" : "https://api.crossref.org/works");
  if (source === "wikipedia") {
    for (const [key, value] of Object.entries({ action: "query", list: "search", srsearch: query, format: "json", formatversion: "2", srlimit: String(limit), maxlag: "5" })) endpoint.searchParams.set(key, value);
  } else if (source === "openalex") {
    endpoint.searchParams.set("search", query); endpoint.searchParams.set("per_page", String(limit));
    endpoint.searchParams.set("select", "id,doi,title,publication_year,primary_location,best_oa_location,cited_by_count");
  } else {
    endpoint.searchParams.set("query", query); endpoint.searchParams.set("rows", String(limit));
    endpoint.searchParams.set("select", "DOI,title,URL,published-print,published-online,type,container-title");
  }
  return endpoint;
}

function normalizeResults(source, payload) {
  if (source === "wikipedia") {
    if (!Array.isArray(payload?.query?.search)) throw new SearchAdapterError("SEARCH_UPSTREAM_INVALID_RESPONSE", "Wikipedia returned an unexpected response.");
    return payload.query.search.map((row, i) => ({
      rank: i + 1, title: clean(row.title, 300), url: "https://en.wikipedia.org/?curid=" + encodeURIComponent(String(row.pageid)),
      description: clean(row.snippet, 700), source, sourceId: String(row.pageid),
    })).filter((r) => r.title && Number.isSafeInteger(Number(r.sourceId)));
  }
  if (source === "openalex") {
    if (!Array.isArray(payload?.results)) throw new SearchAdapterError("SEARCH_UPSTREAM_INVALID_RESPONSE", "OpenAlex returned an unexpected response.");
    return payload.results.map((row, i) => ({
      rank: i + 1, title: clean(row?.title, 300),
      url: row?.primary_location?.landing_page_url || row?.best_oa_location?.landing_page_url || row?.doi || row?.id,
      description: "", source, sourceId: clean(row?.id, 160),
      year: Number.isInteger(row?.publication_year) ? row.publication_year : null,
      citedByCount: Number.isInteger(row?.cited_by_count) ? row.cited_by_count : null,
    })).filter((r) => r.title && typeof r.url === "string");
  }
  if (!Array.isArray(payload?.message?.items)) throw new SearchAdapterError("SEARCH_UPSTREAM_INVALID_RESPONSE", "Crossref returned an unexpected response.");
  return payload.message.items.map((row, i) => {
    const published = row?.["published-print"]?.["date-parts"]?.[0] || row?.["published-online"]?.["date-parts"]?.[0];
    return {
      rank: i + 1, title: clean(Array.isArray(row?.title) ? row.title[0] : "", 300),
      url: typeof row?.URL === "string" ? row.URL : (typeof row?.DOI === "string" ? "https://doi.org/" + row.DOI : null),
      description: "", source, sourceId: clean(row?.DOI, 160),
      year: Array.isArray(published) && Number.isInteger(published[0]) ? published[0] : null,
      type: clean(row?.type, 80), journal: clean(Array.isArray(row?.["container-title"]) ? row["container-title"][0] : "", 180),
    };
  }).filter((r) => r.title && typeof r.url === "string");
}

let crossrefQueue = Promise.resolve();
let crossrefLastStartedAt = 0;

async function waitForCrossrefSlot(run, signal) {
  let release;
  const previous = crossrefQueue;
  crossrefQueue = new Promise((resolve) => { release = resolve; });
  await previous;
  try {
    if (signal?.aborted) throw new SearchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499);
    const remainingMs = 1_000 - (Date.now() - crossrefLastStartedAt);
    if (remainingMs > 0) {
      await new Promise((resolve, reject) => {
        const onAbort = () => {
          clearTimeout(timer);
          reject(new SearchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499));
        };
        const timer = setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        }, remainingMs);
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
    if (signal?.aborted) throw new SearchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499);
    crossrefLastStartedAt = Date.now();
    return await run();
  } finally {
    release();
  }
}

export function createSearchAdapter({ fetchResource = fetchPublicResource, now = () => new Date().toISOString() } = {}) {
  return Object.freeze({
    id: "web.search.v1", family: "web",
    capabilities: ["source-search", "wikipedia-search", "openalex-works-search", "crossref-works-search"],
    authMode: "none", limits: { maxQueryLength: 1024, maxResults: 10 },
    restrictions: ["public-no-key-endpoints-only", "source-must-be-selected", "not-general-web-search", "result-urls-revalidated", "untrusted-search-results", "no-paid-search-provider"],
    async execute(input = {}, options = {}) {
      const signal = options.signal || input.signal;
      if (signal?.aborted) throw new SearchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499);
      const query = typeof input.query === "string" ? input.query.trim() : "";
      const source = input.source;
      const limit = input.limit === undefined ? 5 : input.limit;
      if (!query || query.length > 1024) throw new SearchAdapterError("INVALID_QUERY", "Search query must contain 1 to 1024 characters.", 400);
      if (!SEARCH_SOURCES.includes(source)) throw new SearchAdapterError("INVALID_SEARCH_SOURCE", "Choose wikipedia, openalex, or crossref.", 400);
      if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new SearchAdapterError("INVALID_LIMIT", "Search result limit must be between 1 and 10.", 400);
      const endpoint = endpointFor(source, query, limit);
      validatePublicHttpUrl(endpoint.href);
      const performFetch = () => fetchResource(endpoint.href, {
        maxBytes: SEARCH_LIMITS.maxResponseBytes, timeoutMs: 8_000, maxRedirects: 1,
        cacheMode: input.cacheMode === "bypass" ? "bypass" : "default",
        userAgent: "ExportFlow/0.6 (https://exportflow.me; mailto:hhameranede@gmail.com)", signal,
        ...(typeof options.fetchImpl === "function" ? { fetchImpl: options.fetchImpl } : {}),
      });
      const response = source === "crossref"
        ? await waitForCrossrefSlot(performFetch, signal)
        : await performFetch();
      if (response.status === 429) throw new SearchAdapterError("SEARCH_RATE_LIMITED", "The selected public search source rate-limited this request. Retry later.", 429);
      if (!response.ok) throw new SearchAdapterError("SEARCH_UPSTREAM_FAILED", "The selected public search source returned HTTP " + response.status + ".", 502);
      let payload;
      try { payload = JSON.parse(response.body); } catch { throw new SearchAdapterError("SEARCH_UPSTREAM_INVALID_RESPONSE", "The selected public search source returned invalid JSON."); }
      if (signal?.aborted) throw new SearchAdapterError("TASK_CANCELLED", "Task was cancelled.", 499);
      const results = normalizeResults(source, payload).slice(0, limit);
      const coverage = source === "wikipedia" ? "Wikipedia encyclopedic pages only; not a general web index."
        : source === "openalex" ? "OpenAlex scholarly works metadata only; full-text availability depends on the publisher or open-access location."
        : "Crossref DOI and scholarly publication metadata only; not general web search.";
      return normalizeResult({
        status: "succeeded",
        data: { query, source, coverage, resultCount: results.length, results, cacheStatus: response.cacheStatus ?? null, searchEndpoint: endpoint.origin + endpoint.pathname },
        sources: results.map((r) => ({ url: r.url, retrievedAt: response.retrievedAt || now(), title: r.title, evidence: [{ type: "public_search_result", provider: source, query, rank: r.rank }] })),
        warnings: results.length ? [] : ["The selected public source returned no results; its coverage is domain-limited."],
      });
    },
  });
}
