import readabilityPackage from "@mozilla/readability";
import { DOMParser } from "linkedom/worker";
import Papa from "papaparse";

const Readability = readabilityPackage.Readability;
const UTF8 = new TextEncoder();

export const OPEN_SOURCE_PARSER_LIMITS = Object.freeze({
  maxHtmlBytes: 262_144,
  maxCsvBytes: 262_144,
  maxArticleElements: 4_000,
  maxArticleTextCharacters: 100_000,
  maxCsvRows: 1_000,
  maxCsvColumns: 100,
  maxCsvHeaderCharacters: 256,
});

export class OpenSourceParserError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.name = "OpenSourceParserError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function boundedInteger(value, fallback, maximum, name) {
  const actual = value === undefined ? fallback : value;
  if (!Number.isInteger(actual) || actual < 1 || actual > maximum) {
    throw new OpenSourceParserError("INVALID_LIMIT", name + " is outside the supported range.");
  }
  return actual;
}

function validatePageUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new OpenSourceParserError("INVALID_URL", "A valid source URL is required.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new OpenSourceParserError("INVALID_URL", "The source URL must be unauthenticated HTTP or HTTPS.");
  }
  url.hash = "";
  return url;
}

function validateOptionsObject(options, label) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new OpenSourceParserError("INVALID_OPTIONS", label + " options must be an object.");
  }
}

function validateTextInput(value, maximumBytes, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new OpenSourceParserError("INVALID_INPUT", label + " must be a non-empty string.");
  }
  const bytes = UTF8.encode(value).byteLength;
  if (bytes > maximumBytes) {
    throw new OpenSourceParserError("INPUT_TOO_LARGE", label + " exceeds the configured byte limit.", 413);
  }
  return bytes;
}

/**
 * Parses an already-fetched HTML document into article text and metadata.
 * This function performs no network requests and never executes page scripts.
 */
export function extractReadableArticle(html, options = {}) {
  validateOptionsObject(options, "HTML parser");
  const maxBytes = boundedInteger(
    options.maxBytes,
    OPEN_SOURCE_PARSER_LIMITS.maxHtmlBytes,
    OPEN_SOURCE_PARSER_LIMITS.maxHtmlBytes,
    "maxBytes"
  );
  const maxElements = boundedInteger(
    options.maxElements,
    OPEN_SOURCE_PARSER_LIMITS.maxArticleElements,
    OPEN_SOURCE_PARSER_LIMITS.maxArticleElements,
    "maxElements"
  );
  const maxTextCharacters = boundedInteger(
    options.maxTextCharacters,
    OPEN_SOURCE_PARSER_LIMITS.maxArticleTextCharacters,
    OPEN_SOURCE_PARSER_LIMITS.maxArticleTextCharacters,
    "maxTextCharacters"
  );
  const inputBytes = validateTextInput(html, maxBytes, "HTML");
  const pageUrl = validatePageUrl(options.url);

  let document;
  try {
    document = new DOMParser().parseFromString(html, "text/html");
  } catch {
    throw new OpenSourceParserError("HTML_PARSE_FAILED", "HTML could not be parsed by the DOM implementation.", 422);
  }
  if (!document?.documentElement) {
    throw new OpenSourceParserError("HTML_PARSE_FAILED", "HTML did not produce a document element.", 422);
  }

  // LinkeDOM resolves Document.baseURI through the first <base> element.
  // Supplying the already-validated final URL avoids resolving article links
  // against an unrelated Worker/global location.
  const head = document.querySelector("head");
  if (head) {
    const base = document.createElement("base");
    base.setAttribute("href", pageUrl.href);
    head.insertBefore(base, head.firstChild);
  }
  if (!("documentURI" in document)) {
    Object.defineProperty(document, "documentURI", {
      configurable: true,
      value: pageUrl.href,
    });
  }

  let parsed;
  try {
    parsed = new Readability(document, {
      maxElemsToParse: maxElements,
      charThreshold: 200,
      disableJSONLD: false,
      debug: false,
    }).parse();
  } catch {
    throw new OpenSourceParserError("READABILITY_FAILED", "Article extraction failed for this document.", 422);
  }

  if (!parsed) {
    return {
      status: "no_article",
      method: "mozilla-readability",
      sourceUrl: pageUrl.href,
      inputBytes,
      title: document.title || null,
      textContent: "",
      length: 0,
      excerpt: null,
      byline: null,
      siteName: null,
      language: document.documentElement.getAttribute("lang") || null,
      truncated: false,
    };
  }

  const rawText = String(parsed.textContent || "").trim();
  return {
    status: "succeeded",
    method: "mozilla-readability",
    sourceUrl: pageUrl.href,
    inputBytes,
    title: typeof parsed.title === "string" ? parsed.title.slice(0, 500) : null,
    textContent: rawText.slice(0, maxTextCharacters),
    length: rawText.length,
    excerpt: typeof parsed.excerpt === "string" ? parsed.excerpt.slice(0, 1_200) : null,
    byline: typeof parsed.byline === "string" ? parsed.byline.slice(0, 300) : null,
    siteName: typeof parsed.siteName === "string" ? parsed.siteName.slice(0, 300) : null,
    language: typeof parsed.lang === "string"
      ? parsed.lang.slice(0, 32)
      : (document.documentElement.getAttribute("lang") || null),
    truncated: rawText.length > maxTextCharacters,
  };
}

/**
 * Parses bounded CSV text. Values remain strings to avoid lossy coercion.
 * The parser does not fetch URLs, create files, or execute spreadsheet formulas.
 */
export function parseCsvText(csv, options = {}) {
  validateOptionsObject(options, "CSV parser");
  const maxBytes = boundedInteger(
    options.maxBytes,
    OPEN_SOURCE_PARSER_LIMITS.maxCsvBytes,
    OPEN_SOURCE_PARSER_LIMITS.maxCsvBytes,
    "maxBytes"
  );
  const maxRows = boundedInteger(
    options.maxRows,
    500,
    OPEN_SOURCE_PARSER_LIMITS.maxCsvRows,
    "maxRows"
  );
  const maxColumns = boundedInteger(
    options.maxColumns,
    50,
    OPEN_SOURCE_PARSER_LIMITS.maxCsvColumns,
    "maxColumns"
  );
  const inputBytes = validateTextInput(csv, maxBytes, "CSV");

  let parsed;
  try {
    parsed = Papa.parse(csv, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      preview: maxRows + 1,
      transformHeader: (header) => String(header).trim(),
    });
  } catch {
    throw new OpenSourceParserError("CSV_PARSE_FAILED", "CSV parsing failed.", 422);
  }

  const headers = Array.isArray(parsed.meta?.fields) ? parsed.meta.fields : [];
  if (headers.length === 0 || headers.some((header) => typeof header !== "string" || !header.trim())) {
    throw new OpenSourceParserError("CSV_HEADER_REQUIRED", "CSV must contain non-empty header names.", 422);
  }
  if (headers.some((header) => header.length > OPEN_SOURCE_PARSER_LIMITS.maxCsvHeaderCharacters)) {
    throw new OpenSourceParserError(
      "CSV_HEADER_TOO_LONG",
      "A CSV header exceeds the configured character limit.",
      413
    );
  }
  if (parsed.meta?.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length > 0) {
    throw new OpenSourceParserError(
      "CSV_DUPLICATE_HEADER",
      "CSV header names must be unique after trimming whitespace.",
      422
    );
  }
  if (headers.some((header) => ["__proto__", "constructor", "prototype"].includes(header))) {
    throw new OpenSourceParserError(
      "UNSAFE_CSV_HEADER",
      "CSV headers must not use reserved JavaScript object property names.",
      422
    );
  }
  if (headers.length > maxColumns) {
    throw new OpenSourceParserError("CSV_TOO_MANY_COLUMNS", "CSV exceeds the configured column limit.", 413);
  }

  const parseErrors = Array.isArray(parsed.errors) ? parsed.errors : [];
  if (parseErrors.some((error) => error.code === "TooManyFields")) {
    throw new OpenSourceParserError(
      "CSV_TOO_MANY_COLUMNS",
      "A CSV row exceeds the configured header column count.",
      413
    );
  }
  if (parseErrors.some((error) => error.code === "MissingQuotes")) {
    throw new OpenSourceParserError(
      "CSV_MALFORMED_QUOTES",
      "CSV contains an unterminated quoted field.",
      422
    );
  }

  const allRows = Array.isArray(parsed.data) ? parsed.data : [];
  const rows = allRows.slice(0, maxRows);
  const errors = parseErrors.slice(0, 20).map((error) => ({
    type: String(error.type || "ParseError").slice(0, 80),
    code: String(error.code || "CSV_PARSE_WARNING").slice(0, 80),
    row: Number.isInteger(error.row) ? error.row : null,
  }));

  return {
    status: errors.length > 0 ? "partial" : "succeeded",
    method: "papaparse",
    inputBytes,
    headers,
    rows,
    rowCount: rows.length,
    truncated: allRows.length > maxRows,
    errors,
    errorsTruncated: parseErrors.length > errors.length,
  };
}
