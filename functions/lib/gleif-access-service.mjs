import { normalizeGleifRecord } from "./gleif-normalizer.mjs";

export const GLEIF_API_ORIGIN = "https://api.gleif.org";
export const GLEIF_LEI_RECORDS_PATH = "/api/v1/lei-records";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 25;
const DEFAULT_MAX_PAGES = 4;
const MAX_PAGES = 4;
const MAX_ACCEPTED_RECORDS = 25;
const DEFAULT_TIMEOUT_MS = 8_000;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 15_000;
const GLEIF_ACCEPT = "application/vnd.api+json, application/json";

export class GleifAccessServiceError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = "GleifAccessServiceError";
    this.code = code;
    this.status = status;
  }
}

function positiveInteger(value, fallback, maximum, label) {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    throw new RangeError(label + " must be an integer between 1 and " + maximum);
  }
  return result;
}

function buildPageUrl(pageNumber, pageSize) {
  const url = new URL(GLEIF_LEI_RECORDS_PATH, GLEIF_API_ORIGIN);
  url.searchParams.set("page[number]", String(pageNumber));
  url.searchParams.set("page[size]", String(pageSize));
  return url;
}

function getNextLink(payload) {
  const links = payload?.links ?? payload?.meta?.links;
  return typeof links?.next === "string" && links.next.trim()
    ? links.next.trim()
    : null;
}

function validateNextPageUrl(value, currentPage, pageSize) {
  let url;
  try {
    url = new URL(value, GLEIF_API_ORIGIN);
  } catch {
    throw new GleifAccessServiceError("unsafe_pagination_link", "GLEIF returned an invalid pagination link.");
  }

  const pageNumber = Number(url.searchParams.get("page[number]"));
  const returnedPageSize = Number(url.searchParams.get("page[size]"));

  if (
    url.protocol !== "https:" ||
    url.origin !== GLEIF_API_ORIGIN ||
    url.pathname !== GLEIF_LEI_RECORDS_PATH ||
    url.username ||
    url.password ||
    url.hash ||
    !Number.isSafeInteger(pageNumber) ||
    pageNumber !== currentPage + 1 ||
    !Number.isSafeInteger(returnedPageSize) ||
    returnedPageSize !== pageSize
  ) {
    throw new GleifAccessServiceError("unsafe_pagination_link", "GLEIF returned a pagination link outside the approved API boundary.");
  }

  return { url, pageNumber };
}

function parsePagePayload(payload, pageSize) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !Array.isArray(payload.data)) {
    throw new GleifAccessServiceError("invalid_response", "GLEIF returned an unexpected API response.");
  }

  if (payload.data.length > pageSize) {
    throw new GleifAccessServiceError("invalid_response", "GLEIF returned more records than the requested page size.");
  }

  return payload.data;
}

function getTimeoutSignal(timeoutMs) {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") {
    throw new GleifAccessServiceError("timeout_unavailable", "This runtime does not support bounded GLEIF requests.");
  }
  return AbortSignal.timeout(timeoutMs);
}

/**
 * Create a bounded client for GLEIF's official Access Service.
 *
 * The client is deliberately read-only. It never downloads Golden Copy files,
 * follows links outside api.gleif.org, retries automatically, writes to D1,
 * or returns unfiltered raw records from the pilot collector.
 */
export function createGleifAccessService(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A Fetch-compatible implementation is required.");
  }

  const defaultPageSize = positiveInteger(
    options.pageSize,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    "pageSize"
  );
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new RangeError("timeoutMs must be between " + MIN_TIMEOUT_MS + " and " + MAX_TIMEOUT_MS);
  }

  async function fetchPage({ pageNumber = 1, pageSize = defaultPageSize } = {}) {
    positiveInteger(pageNumber, 1, Number.MAX_SAFE_INTEGER, "pageNumber");
    positiveInteger(pageSize, defaultPageSize, MAX_PAGE_SIZE, "pageSize");

    const url = buildPageUrl(pageNumber, pageSize);
    const timeoutSignal = getTimeoutSignal(timeoutMs);
    let response;

    try {
      response = await fetchImpl(url.toString(), {
        method: "GET",
        headers: { Accept: GLEIF_ACCEPT },
        redirect: "error",
        signal: timeoutSignal
      });
    } catch (error) {
      const timedOut = error?.name === "AbortError" || error?.name === "TimeoutError";
      throw new GleifAccessServiceError(
        timedOut ? "request_timeout" : "network_error",
        timedOut
          ? "The GLEIF request exceeded its time limit."
          : "The GLEIF Access Service could not be reached."
      );
    }

    if (!response || response.status !== 200) {
      throw new GleifAccessServiceError(
        "upstream_http_error",
        "The GLEIF Access Service returned an unsuccessful response.",
        Number.isInteger(response?.status) ? response.status : null
      );
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new GleifAccessServiceError("invalid_json", "GLEIF returned a response that was not valid JSON.");
    }

    const data = parsePagePayload(payload, pageSize);
    const nextLink = getNextLink(payload);
    const next = nextLink
      ? validateNextPageUrl(nextLink, pageNumber, pageSize)
      : null;

    return {
      pageNumber,
      pageSize,
      records: data,
      nextPageNumber: next?.pageNumber ?? null
    };
  }

  /**
   * Read a small, bounded pilot window and return only normalized allowlisted
   * records. A caller must separately check the D1 rights gate before any write.
   */
  async function collectPilot(options = {}) {
    const pageSize = positiveInteger(
      options.pageSize,
      defaultPageSize,
      MAX_PAGE_SIZE,
      "pageSize"
    );
    const maxPages = positiveInteger(
      options.maxPages,
      DEFAULT_MAX_PAGES,
      MAX_PAGES,
      "maxPages"
    );
    const maxAcceptedRecords = positiveInteger(
      options.maxAcceptedRecords,
      MAX_ACCEPTED_RECORDS,
      MAX_ACCEPTED_RECORDS,
      "maxAcceptedRecords"
    );
    const normalizer = options.normalizer ?? normalizeGleifRecord;
    if (typeof normalizer !== "function") throw new TypeError("normalizer must be a function.");

    const records = [];
    let recordsRead = 0;
    let skippedCount = 0;
    let pagesFetched = 0;
    let pageNumber = 1;
    let nextPageNumber = null;

    while (pagesFetched < maxPages && records.length < maxAcceptedRecords) {
      const page = await fetchPage({ pageNumber, pageSize });
      pagesFetched += 1;

      for (const sourceRecord of page.records) {
        if (records.length >= maxAcceptedRecords) break;
        recordsRead += 1;
        const normalized = normalizer(sourceRecord);
        if (normalized?.eligible === true && normalized.entity && normalized.sourceRecord) {
          records.push({
            entity: normalized.entity,
            sourceRecord: normalized.sourceRecord,
            sourceUpdatedAt: normalized.sourceUpdatedAt ?? null
          });
        } else {
          skippedCount += 1;
        }
      }

      nextPageNumber = page.nextPageNumber;
      if (nextPageNumber === null || records.length >= maxAcceptedRecords) break;
      pageNumber = nextPageNumber;
    }

    return {
      records,
      recordsRead,
      acceptedCount: records.length,
      skippedCount,
      pagesFetched,
      nextPageNumber,
      exhausted: nextPageNumber === null
    };
  }

  return Object.freeze({ fetchPage, collectPilot });
}

