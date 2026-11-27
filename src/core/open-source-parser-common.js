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

export function boundedInteger(value, fallback, maximum, name) {
  const actual = value === undefined ? fallback : value;
  if (!Number.isInteger(actual) || actual < 1 || actual > maximum) {
    throw new OpenSourceParserError("INVALID_LIMIT", name + " is outside the supported range.");
  }
  return actual;
}

export function validateOptionsObject(options, label) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new OpenSourceParserError("INVALID_OPTIONS", label + " options must be an object.");
  }
}

export function validatePageUrl(value) {
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

export function validateTextInput(value, maximumBytes, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new OpenSourceParserError("INVALID_INPUT", label + " must be a non-empty string.");
  }
  const bytes = new TextEncoder().encode(value).byteLength;
  if (bytes > maximumBytes) {
    throw new OpenSourceParserError("INPUT_TOO_LARGE", label + " exceeds the configured byte limit.", 413);
  }
  return bytes;
}
