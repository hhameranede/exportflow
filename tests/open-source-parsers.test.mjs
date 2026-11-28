import test from "node:test";
import assert from "node:assert/strict";
import {
  extractReadableArticle,
  parseCsvText,
  OpenSourceParserError,
  OPEN_SOURCE_PARSER_LIMITS,
} from "../src/core/open-source-parsers.js";

const longParagraph = [
  "ExportFlow retrieves public web resources through bounded HTTP requests. ",
  "This article explains how a public document can be normalized into useful text. ",
  "The extraction process preserves the source URL and reports the parser method. ",
  "The parser does not execute scripts, follow links, or make additional network requests. ",
  "Every piece of retrieved content remains untrusted input and must be handled safely. ",
].join("").repeat(4);

function parserError(code) {
  return (error) => error instanceof OpenSourceParserError && error.code === code;
}

test("Readability extracts article text and keeps the validated source URL", () => {
  const html =
    "<!doctype html>" +
    '<html lang="en"><head><title>A useful public article</title>' +
    '<meta property="og:site_name" content="Example News"></head><body>' +
    '<nav><a href="/home">Home</a><a href="/about">About</a></nav>' +
    "<main><article><h1>A useful public article</h1>" +
    "<p>" + longParagraph + "</p><p>" + longParagraph + "</p>" +
    "</article></main><footer>Footer boilerplate</footer></body></html>";
  const result = extractReadableArticle(html, { url: "https://example.com/news/story" });

  assert.equal(result.status, "succeeded");
  assert.equal(result.method, "mozilla-readability");
  assert.equal(result.sourceUrl, "https://example.com/news/story");
  assert.match(result.title || "", /useful public article/i);
  assert.match(result.textContent, /bounded HTTP requests/i);
  assert.ok(result.length >= result.textContent.length);
  assert.equal(result.siteName, "Example News");
  assert.equal(result.truncated, false);
});

test("Readability refuses unsafe source URLs, embedded credentials and oversized HTML", () => {
  assert.throws(
    () => extractReadableArticle("<html><body>hello</body></html>", { url: "file:///etc/passwd" }),
    parserError("INVALID_URL")
  );
  assert.throws(
    () => extractReadableArticle("<html><body>hello</body></html>", { url: "https://user:pass@example.com/" }),
    parserError("INVALID_URL")
  );
  assert.throws(
    () => extractReadableArticle("x".repeat(300), { url: "https://example.com/", maxBytes: 100 }),
    parserError("INPUT_TOO_LARGE")
  );
});

test("Readability reports bounded text truncation and rejects invalid options", () => {
  const html = "<html><head><title>Long article</title></head><body><article>" +
    "<p>" + longParagraph.repeat(4) + "</p><p>" + longParagraph.repeat(4) + "</p>" +
    "</article></body></html>";
  const result = extractReadableArticle(html, {
    url: "https://example.com/long",
    maxTextCharacters: 200,
  });
  assert.equal(result.status, "succeeded");
  assert.equal(result.truncated, true);
  assert.equal(result.textContent.length, 200);
  assert.ok(result.length > result.textContent.length);
  assert.throws(() => extractReadableArticle(html, { url: "https://example.com/", maxElements: 0 }), parserError("INVALID_LIMIT"));
  assert.throws(() => extractReadableArticle(html, null), parserError("INVALID_OPTIONS"));
});

test("Readability truncation never leaves an unmatched high surrogate", () => {
  const articleText = "A".repeat(199) + "😀" + "B".repeat(120);
  const html = "<html><head><title>Unicode article</title></head><body><article><p>" +
    articleText +
    "</p></article></body></html>";
  const result = extractReadableArticle(html, {
    url: "https://example.com/unicode",
    maxTextCharacters: 200,
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.truncated, true);
  assert.ok(result.textContent.length <= 200);
  const lastCodeUnit = result.textContent.charCodeAt(result.textContent.length - 1);
  assert.equal(lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff, false);
});

test("Readability returns a no-article result with bounded title and language metadata", () => {
  const title = "T".repeat(600);
  const language = "l".repeat(40);
  const result = extractReadableArticle(
    "<html lang='" + language + "'><head><title>" + title + "</title></head>" +
    "<body><nav><a href='/'>Home</a></nav></body></html>",
    { url: "https://example.com/navigation" }
  );
  assert.equal(result.status, "no_article");
  assert.equal(result.textContent, "");
  assert.equal(result.sourceUrl, "https://example.com/navigation");
  assert.equal(result.title.length, 500);
  assert.equal(result.language.length, 32);
});

test("Readability bounds title and language on successful article extraction", () => {
  const title = "T".repeat(600);
  const language = "l".repeat(40);
  const html = "<html lang='" + language + "'><head><title>" + title + "</title></head>" +
    "<body><article><h1>Long article</h1><p>" + longParagraph.repeat(2) +
    "</p><p>" + longParagraph.repeat(2) + "</p></article></body></html>";
  const result = extractReadableArticle(html, { url: "https://example.com/long-metadata" });

  assert.equal(result.status, "succeeded");
  assert.equal(result.title.length, 500);
  assert.equal(result.language.length, 32);
});

test("PapaParse rejects reserved headers rather than dropping their values", () => {
  for (const reserved of ["__proto__", "constructor", "prototype"]) {
    assert.throws(
      () => parseCsvText("name," + reserved + "\nAda,record"),
      parserError("UNSAFE_CSV_HEADER")
    );
  }
});

test("PapaParse rejects duplicate headers after whitespace normalization", () => {
  assert.throws(
    () => parseCsvText("name, name \nAda,record"),
    parserError("CSV_DUPLICATE_HEADER")
  );
  assert.throws(
    () => parseCsvText("name,name\nAda,Grace"),
    parserError("CSV_DUPLICATE_HEADER")
  );
});

test("PapaParse rejects headers that would otherwise be silently truncated", () => {
  const longHeader = "x".repeat(OPEN_SOURCE_PARSER_LIMITS.maxCsvHeaderCharacters + 1);
  assert.throws(
    () => parseCsvText(longHeader + "\nvalue"),
    parserError("CSV_HEADER_TOO_LONG")
  );
});

test("PapaParse rejects data rows with more fields than the header", () => {
  assert.throws(
    () => parseCsvText("name,age\nAda,37,extra"),
    parserError("CSV_TOO_MANY_COLUMNS")
  );
});

test("PapaParse preserves original response byte counts for decoded legacy charsets", () => {
  const decodedCsv = "name\ncafé";
  const originalBytes = new Uint8Array([0x6e, 0x61, 0x6d, 0x65, 0x0a, 0x63, 0x61, 0x66, 0xe9]);

  assert.equal(new TextEncoder().encode(decodedCsv).byteLength, 10);
  assert.equal(originalBytes.byteLength, 9);

  const result = parseCsvText(decodedCsv, {
    maxBytes: originalBytes.byteLength,
    inputBytes: originalBytes.byteLength,
  });
  assert.equal(result.inputBytes, originalBytes.byteLength);
  assert.equal(result.rows[0].name, "café");

  assert.throws(
    () => parseCsvText(decodedCsv, { maxBytes: 9, inputBytes: 10 }),
    parserError("INPUT_TOO_LARGE")
  );
});

test("PapaParse handles quoted commas, embedded newlines and leading zeroes", () => {
  const csv = "name,notes,quantity\n" +
    '"Ada","hello, world",0012\n' +
    '"Grace","line one\nline two",7\n';
  const result = parseCsvText(csv);

  assert.equal(result.status, "succeeded");
  assert.equal(result.method, "papaparse");
  assert.deepEqual(result.headers, ["name", "notes", "quantity"]);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].notes, "hello, world");
  assert.equal(result.rows[0].quantity, "0012");
  assert.equal(result.rows[1].notes, "line one\nline two");
  assert.equal(result.truncated, false);
});

test("PapaParse preserves malformed short-row diagnostics as a partial result", () => {
  const result = parseCsvText("name,age\nAda\nGrace,85\n");
  assert.equal(result.status, "partial");
  assert.equal(result.rowCount, 2);
  assert.ok(result.errors.some((error) => error.code === "TooFewFields"));
});

test("PapaParse rejects unclosed quoted fields", () => {
  assert.throws(
    () => parseCsvText('name,notes\nAda,"unterminated'),
    parserError("CSV_MALFORMED_QUOTES")
  );
});

test("PapaParse requires a header row and validates parser options", () => {
  assert.throws(() => parseCsvText("\n \n"), parserError("CSV_HEADER_REQUIRED"));
  assert.throws(() => parseCsvText("name\nAda", null), parserError("INVALID_OPTIONS"));
  assert.throws(() => parseCsvText("name\nAda", { maxRows: 0 }), parserError("INVALID_LIMIT"));
});

test("PapaParse enforces byte, row and column limits", () => {
  assert.throws(
    () => parseCsvText("name\n" + "x".repeat(100), { maxBytes: 20 }),
    parserError("INPUT_TOO_LARGE")
  );

  const rowLimited = parseCsvText("name\na\nb\nc\n", { maxRows: 2 });
  assert.equal(rowLimited.rows.length, 2);
  assert.equal(rowLimited.truncated, true);

  assert.throws(
    () => parseCsvText("a,b,c\n1,2,3\n", { maxColumns: 2 }),
    parserError("CSV_TOO_MANY_COLUMNS")
  );
});
