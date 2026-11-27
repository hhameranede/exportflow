import test from "node:test";
import assert from "node:assert/strict";
import {
  boundPdfText,
  extractPdfText,
  hasPdfSignature,
  PDF_PARSE_LIMITS,
  PdfParserError,
  withPdfParserTimeout,
} from "../src/core/pdf-parser.js";
import { createDeflatedSyntheticPdf, createSyntheticPdf } from "./fixtures/synthetic-pdf.mjs";

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

test("bounds extracted text from a compressed content stream with large expansion", parserTestOptions, async () => {
  const expandedCharacters = 4 * 1024 * 1024;
  const bytes = createDeflatedSyntheticPdf("B".repeat(expandedCharacters));
  assert.ok(bytes.byteLength < PDF_PARSE_LIMITS.maxInputBytes);
  assert.ok(expandedCharacters / bytes.byteLength > 20, "fixture should exercise meaningful stream expansion");

  const startedAt = performance.now();
  const result = await extractPdfText(bytes);
  const wallTimeMs = performance.now() - startedAt;

  assert.equal(result.totalPages, 1);
  assert.equal(result.text.length, PDF_PARSE_LIMITS.maxOutputCharacters);
  assert.equal(result.truncated, true);
  assert.ok(result.text.startsWith("B"));
  assert.ok(Number.isFinite(wallTimeMs) && wallTimeMs > 0);
});

test("repeatedly cancels large PDF text streams without late async failures", parserTestOptions, async () => {
  const bytes = createSyntheticPdf(["A".repeat(PDF_PARSE_LIMITS.maxOutputCharacters + 1_024)]);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await extractPdfText(bytes);
    assert.equal(result.text.length, PDF_PARSE_LIMITS.maxOutputCharacters);
    assert.equal(result.truncated, true);
  }

  // Allow PDF.js worker messages and stream cancellation cleanup to settle
  // before this test completes, so late asynchronous failures remain visible.
  await new Promise((resolve) => setTimeout(resolve, 50));
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

test("reports a PDF without extractable text instead of claiming OCR support", parserTestOptions, async () => {
  await assert.rejects(
    extractPdfText(createSyntheticPdf([""])),
    (error) => error instanceof PdfParserError &&
      error.code === "PDF_NO_TEXT_LAYER" &&
      error.httpStatus === 422,
  );
});
