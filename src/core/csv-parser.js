import Papa from "papaparse";
import {
  OPEN_SOURCE_PARSER_LIMITS,
  OpenSourceParserError,
  boundedInteger,
  validateOptionsObject,
  validateTextInput,
} from "./open-source-parser-common.js";

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
