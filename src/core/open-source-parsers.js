import { CsvParserError, parseCsvText as parseCanonicalCsv } from "./csv-parser.js";
import { OpenSourceParserError } from "./open-source-parser-common.js";

export { OPEN_SOURCE_PARSER_LIMITS, OpenSourceParserError } from "./open-source-parser-common.js";
export { extractReadableArticle } from "./readability-article.js";

// Preserve the compatibility surface for parser-evaluation tests and the
// isolated Workers harness while keeping one canonical PapaParse implementation.
const LEGACY_CSV_ERROR_CODES = Object.freeze({
  INVALID_CSV_OPTIONS: "INVALID_OPTIONS",
  INVALID_CSV_LIMIT: "INVALID_LIMIT",
  CSV_INPUT_TOO_LARGE: "INPUT_TOO_LARGE",
  CSV_UNSAFE_HEADER: "UNSAFE_CSV_HEADER",
});

export function parseCsvText(csv, options) {
  try {
    return parseCanonicalCsv(csv, options);
  } catch (error) {
    if (!(error instanceof CsvParserError)) throw error;
    throw new OpenSourceParserError(
      LEGACY_CSV_ERROR_CODES[error.code] || error.code,
      error.message,
      error.httpStatus,
    );
  }
}
