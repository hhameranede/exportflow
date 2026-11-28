import test from "node:test";
import assert from "node:assert/strict";
import {
  boundPdfText,
  cleanupPdfDocument,
  consumePdfTextStream,
  extractPdfText,
  hasPdfSignature,
  PDF_PARSE_LIMITS,
  PdfParserError,
  withPdfParserTimeout,
} from "../src/core/pdf-parser.js";
import { createSyntheticPdf } from "./fixtures/synthetic-pdf.mjs";

const pdfRuntimeSupported = typeof globalThis.Iterator === "function";
const parserTestOptions = { skip: !pdfRuntimeSupported };

test("extracts bounded text from a valid synthetic PDF", parserTestOptions, async () => {
  const bytes = createSyntheticPdf(["ExportFlow synthetic PDF fixture"]);
  const result = await extractPdfText(bytes, { contentType: "application/pdf" });

  assert.equal(result.format, "pdf");
  assert.equal(result.parser, "unpdf");
  assert.equal(result.parserVersion, "2.2.3");
  assert.equal(result.totalPages, 1);
  assert.match(result.text, /ExportFlow synthetic PDF fixture/);
  assert.equal(result.truncated, false);
  assert.equal(hasPdfSignature(bytes), true);
});

test("accepts octet-stream only after a PDF signature is confirmed", parserTestOptions, async () => {
  const result = await extractPdfText(createSyntheticPdf(["Signature checked"]), {
    contentType: "application/octet-stream",
  });
  assert.match(result.text, /Signature checked/);
});

test("rejects unsupported MIME before parsing", parserTestOptions, async () => {
  await assert.rejects(
    extractPdfText(createSyntheticPdf(), { contentType: "application/zip" }),
    (error) => error instanceof PdfParserError &&
      error.code === "UNSUPPORTED_CONTENT_TYPE" &&
      error.httpStatus === 415,
  );
});

test("rejects a non-PDF payload with an ambiguous octet-stream MIME", parserTestOptions, async () => {
  await assert.rejects(
    extractPdfText(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
      contentType: "application/octet-stream",
    }),
    (error) => error instanceof PdfParserError &&
      error.code === "PDF_INVALID_SIGNATURE" &&
      error.httpStatus === 415,
  );
});

test("rejects oversized PDF bytes before PDF.js is invoked", parserTestOptions, async () => {
  const bytes = new Uint8Array(PDF_PARSE_LIMITS.maxInputBytes + 1);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  await assert.rejects(
    extractPdfText(bytes),
    (error) => error instanceof PdfParserError &&
      error.code === "PDF_TOO_LARGE" &&
      error.httpStatus === 413,
  );
});

test("rejects PDFs that exceed the page fan-out limit", parserTestOptions, async () => {
  const bytes = createSyntheticPdf(
    Array.from({ length: PDF_PARSE_LIMITS.maxPages + 1 }, (_, index) => "Synthetic page " + (index + 1)),
  );
  await assert.rejects(
    extractPdfText(bytes),
    (error) => error instanceof PdfParserError &&
      error.code === "PDF_PAGE_LIMIT" &&
      error.httpStatus === 413,
  );
});

test("bounds normalized PDF text at the configured output ceiling", () => {
  const longText = "A".repeat(PDF_PARSE_LIMITS.maxOutputCharacters + 128);
  const result = boundPdfText(longText);
  assert.equal(result.text.length, PDF_PARSE_LIMITS.maxOutputCharacters);
  assert.equal(result.truncated, true);
});

test("streams large PDF text and stops at the output ceiling", parserTestOptions, async () => {
  const bytes = createSyntheticPdf(["A".repeat(PDF_PARSE_LIMITS.maxOutputCharacters + 1_024)]);
  const result = await extractPdfText(bytes);

  assert.equal(result.text.length, PDF_PARSE_LIMITS.maxOutputCharacters);
  assert.equal(result.truncated, true);
});

test("PDF text stream stops reading immediately when the text-item ceiling is reached", async () => {
  let reads = 0;
  let cancels = 0;
  const reader = {
    async read() {
      reads += 1;
      return reads === 1
        ? { done: false, value: { items: [{ str: "A" }, { str: "B" }, { str: "C" }] } }
        : { done: true };
    },
    cancel() { cancels += 1; return Promise.resolve(); },
  };

  const result = await consumePdfTextStream(reader, {
    maxTextItems: 2,
    maxOutputCharacters: 100,
    getRemainingTimeMs: () => 100,
  });

  assert.equal(result.text, "AB");
  assert.equal(result.itemCount, 2);
  assert.equal(result.truncated, true);
  assert.equal(reads, 1, "must not drain further PDF.js stream chunks after the item ceiling");
  assert.equal(cancels, 0, "leave stream shutdown to bounded document cleanup to avoid PDF.js close races");
});

test("PDF text stream stops reading immediately when the output-character ceiling is reached", async () => {
  let reads = 0;
  const reader = {
    async read() {
      reads += 1;
      return reads === 1
        ? { done: false, value: { items: [{ str: "ABCDE" }, { str: "ignored" }] } }
        : { done: true };
    },
  };

  const result = await consumePdfTextStream(reader, {
    maxTextItems: 100,
    maxOutputCharacters: 3,
    getRemainingTimeMs: () => 100,
  });

  assert.equal(result.text, "ABC");
  assert.equal(result.truncated, true);
  assert.equal(reads, 1, "must not drain further PDF.js stream chunks after the output ceiling");
});

test("PDF text stream stops after a chunk ends exactly at the item ceiling", async () => {
  let reads = 0;
  const reader = {
    async read() {
      reads += 1;
      return reads === 1
        ? { done: false, value: { items: [{ str: "A" }, { str: "B" }] } }
        : { done: true };
    },
  };
  const result = await consumePdfTextStream(reader, {
    maxTextItems: 2,
    maxOutputCharacters: 100,
    getRemainingTimeMs: () => 100,
  });
  assert.equal(result.text, "AB");
  assert.equal(result.itemCount, 2);
  assert.equal(result.truncated, true, "exact equality is conservatively treated as truncated");
  assert.equal(reads, 1, "must not issue another read to discover whether the stream ended");
});

test("PDF text stream stops after a chunk ends exactly at the output ceiling", async () => {
  let reads = 0;
  const reader = {
    async read() {
      reads += 1;
      return reads === 1
        ? { done: false, value: { items: [{ str: "ABC" }] } }
        : { done: true };
    },
  };
  const result = await consumePdfTextStream(reader, {
    maxTextItems: 100,
    maxOutputCharacters: 3,
    getRemainingTimeMs: () => 100,
  });
  assert.equal(result.text, "ABC");
  assert.equal(result.truncated, true, "exact equality is conservatively treated as truncated");
  assert.equal(reads, 1);
});

test("PDF text stream does not read when either budget is zero", async () => {
  let reads = 0;
  const reader = { async read() { reads += 1; return { done: true }; } };
  const byItems = await consumePdfTextStream(reader, {
    maxTextItems: 0,
    maxOutputCharacters: 10,
    getRemainingTimeMs: () => 100,
  });
  const byCharacters = await consumePdfTextStream(reader, {
    maxTextItems: 10,
    maxOutputCharacters: 0,
    getRemainingTimeMs: () => 100,
  });
  assert.equal(byItems.truncated, true);
  assert.equal(byCharacters.truncated, true);
  assert.equal(reads, 0);
});

test("PDF stream truncation never leaves a split Unicode surrogate pair", async () => {
  let reads = 0;
  const reader = {
    async read() {
      reads += 1;
      return { done: false, value: { items: [{ str: "A😀B" }] } };
    },
  };
  const result = await consumePdfTextStream(reader, {
    maxTextItems: 10,
    maxOutputCharacters: 2,
    getRemainingTimeMs: () => 100,
  });
  assert.equal(result.text, "A");
  assert.equal(result.text.length, 1);
  assert.equal(result.truncated, true);
  assert.equal(reads, 1);
});

test("normalized PDF text truncation preserves complete Unicode code points", () => {
  const longText = "A".repeat(PDF_PARSE_LIMITS.maxOutputCharacters - 1) + "😀B";
  const result = boundPdfText(longText);
  assert.equal(result.text.length, PDF_PARSE_LIMITS.maxOutputCharacters - 1);
  assert.equal(result.text.endsWith("A"), true);
  assert.equal(result.truncated, true);
  const finalCodeUnit = result.text.charCodeAt(result.text.length - 1);
  assert.equal(finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff, false);
});

test("PDF parser deadline returns a typed timeout for unresolved work", async () => {
  await assert.rejects(
    withPdfParserTimeout(() => new Promise(() => {}), 1),
    (error) => error instanceof PdfParserError &&
      error.code === "PDF_PARSE_TIMEOUT" &&
      error.httpStatus === 504,
  );
});

test("PDF parser deadline preserves successful work", async () => {
  assert.equal(
    await withPdfParserTimeout(() => Promise.resolve("parsed"), 100),
    "parsed",
  );
});

test("PDF document cleanup cannot outlive the shared parser deadline", async () => {
  let destroyCalled = false;
  const startedAt = Date.now();

  await cleanupPdfDocument({
    loadingTask: {
      destroy() {
        destroyCalled = true;
        return new Promise(() => {});
      },
    },
  }, () => 10);

  assert.equal(destroyCalled, true);
  assert.ok(Date.now() - startedAt < 250, "stalled PDF.js cleanup must remain bounded");
});

test("reports a PDF without extractable text instead of claiming OCR support", parserTestOptions, async () => {
  await assert.rejects(
    extractPdfText(createSyntheticPdf([""])),
    (error) => error instanceof PdfParserError &&
      error.code === "PDF_NO_TEXT_LAYER" &&
      error.httpStatus === 422,
  );
});
