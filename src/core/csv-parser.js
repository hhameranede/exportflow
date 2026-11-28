import Papa from "papaparse";

export const CSV_PARSER_VERSION = "5.7.1";
export const CSV_PARSE_LIMITS = Object.freeze({
  maxBytes: 262_144,
  maxRows: 1_000,
  maxColumns: 100,
  maxHeaderCharacters: 256,
});

export class CsvParserError extends Error {
  constructor(code, message, httpStatus = 422) {
    super(message);
    this.name = "CsvParserError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function positiveInteger(value, fallback, maximum, name) {
  const actual = value === undefined ? fallback : value;
  if (!Number.isInteger(actual) || actual < 1 || actual > maximum) {
    throw new CsvParserError("INVALID_CSV_LIMIT", name + " is outside the supported range.", 400);
  }
  return actual;
}

/**
 * Parses bounded CSV text without coercing values or evaluating spreadsheet formulas.
 * The parser returns source values as strings and never fetches external resources.
 */
export function parseCsvText(csv, options = {}) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new CsvParserError("INVALID_CSV_OPTIONS", "CSV parser options must be an object.", 400);
  }
  const maxBytes = positiveInteger(options.maxBytes, CSV_PARSE_LIMITS.maxBytes, CSV_PARSE_LIMITS.maxBytes, "maxBytes");
  const maxRows = positiveInteger(options.maxRows, CSV_PARSE_LIMITS.maxRows, CSV_PARSE_LIMITS.maxRows, "maxRows");
  const maxColumns = positiveInteger(options.maxColumns, CSV_PARSE_LIMITS.maxColumns, CSV_PARSE_LIMITS.maxColumns, "maxColumns");

  if (typeof csv !== "string" || csv.length === 0) {
    throw new CsvParserError("CSV_HEADER_REQUIRED", "CSV must contain a non-empty header row.");
  }
  const inputBytes = new TextEncoder().encode(csv).byteLength;
  if (inputBytes > maxBytes) {
    throw new CsvParserError("CSV_INPUT_TOO_LARGE", "CSV input exceeds the 256 KiB parser limit.", 413);
  }

  const source = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
  let parsed;
  try {
    parsed = Papa.parse(source, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      preview: maxRows + 1,
      transformHeader: (header) => String(header).trim(),
    });
  } catch {
    throw new CsvParserError("CSV_PARSE_FAILED", "CSV parsing failed.");
  }

  const headers = Array.isArray(parsed.meta?.fields) ? parsed.meta.fields : [];
  if (headers.length === 0 || headers.some((header) => typeof header !== "string" || !header.trim())) {
    throw new CsvParserError("CSV_HEADER_REQUIRED", "CSV must contain non-empty header names.");
  }
  if (headers.some((header) => header.length > CSV_PARSE_LIMITS.maxHeaderCharacters)) {
    throw new CsvParserError("CSV_HEADER_TOO_LONG", "A CSV header exceeds the 256-character limit.", 413);
  }
  if (headers.some((header) => /[\u0000-\u001f\u007f]/.test(header))) {
    throw new CsvParserError("CSV_UNSAFE_HEADER", "CSV headers must not contain control characters.");
  }
  if (parsed.meta?.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length > 0) {
    throw new CsvParserError("CSV_DUPLICATE_HEADER", "CSV header names must be unique after trimming whitespace.");
  }
  if (headers.some((header) => ["__proto__", "constructor", "prototype"].includes(header))) {
    throw new CsvParserError("CSV_UNSAFE_HEADER", "CSV headers must not use reserved JavaScript object property names.");
  }
  if (headers.length > maxColumns) {
    throw new CsvParserError("CSV_TOO_MANY_COLUMNS", "CSV exceeds the configured column limit.", 413);
  }

  const rawParseErrors = Array.isArray(parsed.errors) ? parsed.errors : [];
  // PapaParse emits this diagnostic for valid one-column CSV when no delimiter is needed.
  const parseErrors = headers.length === 1
    ? rawParseErrors.filter((error) => error.code !== "UndetectableDelimiter")
    : rawParseErrors;
  if (parseErrors.some((error) => error.code === "TooManyFields")) {
    throw new CsvParserError("CSV_TOO_MANY_COLUMNS", "A CSV row exceeds its header column count.", 413);
  }
  if (parseErrors.some((error) => error.code === "MissingQuotes")) {
    throw new CsvParserError("CSV_MALFORMED_QUOTES", "CSV contains an unterminated quoted field.");
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
    parserVersion: CSV_PARSER_VERSION,
    inputBytes,
    delimiter: parsed.meta?.delimiter ?? ",",
    headers,
    rows,
    rowCount: rows.length,
    truncated: allRows.length > maxRows,
    errors,
    errorsTruncated: parseErrors.length > errors.length,
  };
}
