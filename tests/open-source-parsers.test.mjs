import test from "node:test";
import assert from "node:assert/strict";
import {
  extractReadableArticle,
  parseCsvText,
  OpenSourceParserError,
} from "../src/core/open-source-parsers.js";

const longParagraph = [
  "ExportFlow retrieves public web resources through bounded HTTP requests. ",
  "This article explains how a public document can be normalized into useful text. ",
  "The extraction process preserves the source URL and reports the parser method. ",
  "The parser does not execute scripts, follow links, or make additional network requests. ",
  "Every piece of retrieved content remains untrusted input and must be handled safely. ",
].join("").repeat(4);

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

test("Readability refuses non-HTTP source URLs and oversized HTML", () => {
  assert.throws(
    () => extractReadableArticle("<html><body>hello</body></html>", { url: "file:///etc/passwd" }),
    (error) => error instanceof OpenSourceParserError && error.code === "INVALID_URL"
  );
  assert.throws(
    () => extractReadableArticle("x".repeat(300), {
      url: "https://example.com/",
      maxBytes: 100,
    }),
    (error) => error instanceof OpenSourceParserError && error.code === "INPUT_TOO_LARGE"
  );
});

test("PapaParse rejects reserved __proto__ headers rather than dropping their values", () => {
  assert.throws(
    () => parseCsvText("name,__proto__\nAda,record\\n"),
    (error) => error instanceof OpenSourceParserError && error.code === "UNSAFE_CSV_HEADER"
  );
});

test("PapaParse handles quoted commas and embedded newlines without type coercion", () => {
  const csv = "name,notes,quantity\n" +
    '"Ada","hello, world",0012\n' +
    '"Grace","line one\nline two",7\n';
  const result = parseCsvText(csv);

  assert.equal(result.method, "papaparse");
  assert.deepEqual(result.headers, ["name", "notes", "quantity"]);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].notes, "hello, world");
  assert.equal(result.rows[0].quantity, "0012");
  assert.equal(result.rows[1].notes, "line one\nline two");
  assert.equal(result.truncated, false);
});

test("PapaParse enforces byte, row and column limits", () => {
  assert.throws(
    () => parseCsvText("name\n" + "x".repeat(100), { maxBytes: 20 }),
    (error) => error instanceof OpenSourceParserError && error.code === "INPUT_TOO_LARGE"
  );

  const rowLimited = parseCsvText("name\na\nb\nc\n", { maxRows: 2 });
  assert.equal(rowLimited.rows.length, 2);
  assert.equal(rowLimited.truncated, true);

  assert.throws(
    () => parseCsvText("a,b,c\n1,2,3\n", { maxColumns: 2 }),
    (error) => error instanceof OpenSourceParserError && error.code === "CSV_TOO_MANY_COLUMNS"
  );
});
