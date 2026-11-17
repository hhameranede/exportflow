import { fetchPublicResource, HTTP_FETCH_LIMITS, validatePublicHttpUrl } from "./http-fetch.js";
import { DOMParser, parseHTML } from "linkedom";
import { normalizeResult } from "./result.js";

export const DEFUDDLE_VERSION = "0.19.6";
export const DEFUDDLE_LIMITS = Object.freeze({
  maxInputBytes: HTTP_FETCH_LIMITS.maxResponseBytes,
});

export class DefuddleAdapterError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.name = "DefuddleAdapterError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function parseContentType(value) {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

/**
 * Load Defuddle only after installing the minimal DOM compatibility globals
 * expected by its full (Markdown-capable) browser bundle. This parser accepts
 * HTML supplied by ExportFlow; it does not fetch URLs or execute page scripts.
 */
export async function parseDefuddleHtml(html, sourceUrl) {
  if (typeof html !== "string") {
    throw new DefuddleAdapterError("INVALID_HTML", "HTML input must be a string.");
  }
  const size = byteLength(html);
  if (size > DEFUDDLE_LIMITS.maxInputBytes) {
    throw new DefuddleAdapterError("INPUT_TOO_LARGE", "HTML input exceeds the configured parser limit.", 413);
  }

  // One-time, immutable Worker DOM compatibility globals. The empty global
  // document is never populated with page HTML; every request gets its own DOM
  // below, avoiding cross-request document state.
  const workerGlobal = globalThis;
  if (!workerGlobal.DOMParser) workerGlobal.DOMParser = DOMParser;
  if (!workerGlobal.window) workerGlobal.window = workerGlobal;
  if (!workerGlobal.document) workerGlobal.document = parseHTML("").document;
  if (!workerGlobal.Node) {
    workerGlobal.Node = workerGlobal.document.defaultView?.Node ??
      Object.freeze({ ELEMENT_NODE: 1, TEXT_NODE: 3 });
  }
  if (!workerGlobal.getComputedStyle) {
    workerGlobal.getComputedStyle = () => ({ display: "" });
  }

  const { document } = parseHTML(html);
  if (!document.styleSheets) document.styleSheets = [];
  if (document.defaultView && !document.defaultView.getComputedStyle) {
    document.defaultView.getComputedStyle = () => ({ display: "" });
  }
  document.URL = sourceUrl;

  const { default: Defuddle } = await import("defuddle/full");
  const parsed = new Defuddle(document, {
    url: sourceUrl,
    markdown: true,
    useAsync: false,
    debug: false,
    // Fail closed if any extractor attempts network access, even if a future
    // Defuddle version regresses its useAsync:false behavior.
    fetch: async () => {
      throw new Error("Network access is disabled in ExportFlow parser mode.");
    },
  }).parse();

  return {
    markdown: typeof parsed.content === "string" ? parsed.content : "",
    title: parsed.title || null,
    description: parsed.description || null,
    author: parsed.author || null,
    site: parsed.site || null,
    domain: parsed.domain || null,
    language: parsed.language || null,
    published: parsed.published || null,
    wordCount: Number.isFinite(parsed.wordCount) ? parsed.wordCount : 0,
    parseTimeMs: Number.isFinite(parsed.parseTime) ? parsed.parseTime : null,
    extractorType: parsed.extractorType || null,
  };
}

/**
 * Parser-only content adapter.
 *
 * The default fetch path is ExportFlow's bounded public HTTP adapter. An
 * injected fetchResource is intended for deterministic tests only; production
 * callers should retain the default fetchPublicResource boundary.
 */
export function createDefuddleAdapter({
  fetchResource = fetchPublicResource,
  parseHtml = parseDefuddleHtml,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof fetchResource !== "function") {
    throw new TypeError("fetchResource must be a function");
  }
  if (typeof parseHtml !== "function") {
    throw new TypeError("parseHtml must be a function");
  }

  return Object.freeze({
    id: "web.content.defuddle.spike.v1",
    family: "web",
    capabilities: Object.freeze(["fetch", "main-content", "markdown", "metadata"]),
    authMode: "none",
    limits: Object.freeze({ maxInputBytes: DEFUDDLE_LIMITS.maxInputBytes }),
    restrictions: Object.freeze([
      "ExportFlow-fetch-only",
      "application-egress-policy-enforced",
      "redirects-revalidated-by-ExportFlow",
      "bounded-html-input",
      "local-parser-only",
      "async-extractors-disabled",
      "no-page-script-execution",
      "untrusted-markdown-output",
    ]),
    async execute(input = {}) {
      // Validate before invoking even an injected fetcher. The production
      // default also validates and rechecks each redirect in fetchPublicResource.
      const requestedUrl = validatePublicHttpUrl(input.url);
      const page = await fetchResource(requestedUrl.href);
      if (!page || typeof page !== "object") {
        throw new DefuddleAdapterError("FETCH_INVALID_RESULT", "Fetch adapter returned an invalid result.", 502);
      }

      const finalUrl = validatePublicHttpUrl(page.finalUrl || requestedUrl.href);
      const contentType = String(page.contentType || "");
      const mime = parseContentType(contentType);
      const body = typeof page.body === "string" ? page.body : "";
      const measuredBytes = byteLength(body);
      const reportedBytes = Number.isFinite(page.bytes) ? page.bytes : measuredBytes;
      if (reportedBytes > DEFUDDLE_LIMITS.maxInputBytes || measuredBytes > DEFUDDLE_LIMITS.maxInputBytes) {
        throw new DefuddleAdapterError("INPUT_TOO_LARGE", "HTML input exceeds the configured parser limit.", 413);
      }

      const baseEvidence = [{
        type: "http_response",
        status: page.status,
        contentType,
        bytes: reportedBytes,
        redirects: Array.isArray(page.redirects) ? page.redirects.length : 0,
      }];
      const retrievedAt = page.retrievedAt || now();

      if (!page.ok) {
        return normalizeResult({
          status: "failed",
          data: {
            requestedUrl: page.originalUrl || requestedUrl.href,
            finalUrl: finalUrl.href,
            status: page.status,
            contentType,
            bytes: reportedBytes,
            markdown: "",
            metadata: null,
          },
          sources: [{ url: finalUrl.href, retrievedAt, evidence: baseEvidence }],
          warnings: ["Upstream returned HTTP " + page.status + "."],
        });
      }

      if (mime !== "text/html" && mime !== "application/xhtml+xml") {
        throw new DefuddleAdapterError("UNSUPPORTED_CONTENT_TYPE", "Defuddle accepts HTML and XHTML responses only.", 415);
      }

      let parsed;
      try {
        // This operation is synchronous inside Defuddle. Do not call
        // parseAsync(); useAsync:false is also forced in parseDefuddleHtml.
        parsed = await parseHtml(body, finalUrl.href);
      } catch {
        throw new DefuddleAdapterError("PARSER_FAILED", "Could not extract readable content from the fetched page.", 502);
      }

      const markdown = typeof parsed?.markdown === "string" ? parsed.markdown : "";
      const title = typeof parsed?.title === "string" && parsed.title.trim() ? parsed.title.trim() : null;
      const wordCount = Number.isFinite(parsed?.wordCount) ? parsed.wordCount : 0;
      const data = {
        requestedUrl: page.originalUrl || requestedUrl.href,
        finalUrl: finalUrl.href,
        status: page.status,
        contentType,
        bytes: reportedBytes,
        markdown,
        metadata: {
          title,
          description: parsed?.description || null,
          author: parsed?.author || null,
          site: parsed?.site || null,
          domain: parsed?.domain || null,
          language: parsed?.language || null,
          published: parsed?.published || null,
          wordCount,
          parseTimeMs: parsed?.parseTimeMs ?? null,
          extractorType: parsed?.extractorType || null,
        },
        parser: { name: "Defuddle", version: DEFUDDLE_VERSION },
      };
      const warnings = markdown.trim() ? [] : ["Defuddle did not find readable main content in this page."];

      return normalizeResult({
        status: markdown.trim() ? "succeeded" : "partial",
        data,
        sources: [{
          url: finalUrl.href,
          retrievedAt,
          title,
          evidence: [
            ...baseEvidence,
            { type: "content_extraction", engine: "defuddle", version: DEFUDDLE_VERSION, wordCount },
          ],
        }],
        warnings,
      });
    },
  });
}
