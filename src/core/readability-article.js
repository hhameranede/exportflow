import readabilityPackage from "@mozilla/readability";
import { DOMParser } from "linkedom/worker";
import {
  OPEN_SOURCE_PARSER_LIMITS,
  OpenSourceParserError,
  boundedInteger,
  validateOptionsObject,
  validatePageUrl,
  validateTextInput,
} from "./open-source-parser-common.js";

const Readability = readabilityPackage.Readability;

function boundedTitle(value) {
  return typeof value === "string" ? value.slice(0, 500) || null : null;
}

function boundedDocumentLanguage(document) {
  const language = document.documentElement.getAttribute("lang");
  return typeof language === "string" ? language.slice(0, 32) || null : null;
}

function sliceTextWithoutSplittingSurrogatePair(value, maxLength) {
  let end = Math.min(value.length, maxLength);
  if (end > 0 && end < value.length) {
    const lastCodeUnit = value.charCodeAt(end - 1);
    const nextCodeUnit = value.charCodeAt(end);
    const splitsSurrogatePair =
      lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff &&
      nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff;
    if (splitsSurrogatePair) end -= 1;
  }
  return value.slice(0, end);
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

  const rawText = String(parsed?.textContent || "").trim();
  // The configured article threshold is 200 characters. Readability may still
  // return a navigation fragment shorter than that threshold, so enforce it
  // explicitly rather than treating a menu label as an article.
  if (!parsed || rawText.length < 200) {
    return {
      status: "no_article",
      method: "mozilla-readability",
      sourceUrl: pageUrl.href,
      inputBytes,
      title: boundedTitle(document.title),
      textContent: "",
      length: 0,
      excerpt: null,
      byline: null,
      siteName: null,
      language: boundedDocumentLanguage(document),
      truncated: false,
    };
  }
  return {
    status: "succeeded",
    method: "mozilla-readability",
    sourceUrl: pageUrl.href,
    inputBytes,
    title: boundedTitle(parsed.title),
    textContent: sliceTextWithoutSplittingSurrogatePair(rawText, maxTextCharacters),
    length: rawText.length,
    excerpt: typeof parsed.excerpt === "string" ? parsed.excerpt.slice(0, 1_200) : null,
    byline: typeof parsed.byline === "string" ? parsed.byline.slice(0, 300) : null,
    siteName: typeof parsed.siteName === "string" ? parsed.siteName.slice(0, 300) : null,
    language: typeof parsed.lang === "string"
      ? parsed.lang.slice(0, 32)
      : boundedDocumentLanguage(document),
    truncated: rawText.length > maxTextCharacters,
  };
}
