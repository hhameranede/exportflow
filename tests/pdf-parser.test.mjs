import test from "node:test";
import assert from "node:assert/strict";
import {
  extractPdfText,
  hasPdfSignature,
  PDF_PARSE_LIMITS,
  PdfParserError,
} from "../src/core/pdf-parser.js";
import { createSyntheticPdf } from "./fixtures/synthetic-pdf.mjs";

test("extracts bounded text from a valid synthetic PDF", async () => {
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

test("accepts octet-stream only after a PDF signature is confirmed", async () => {
  const result = await extractPdfText(createSyntheticPdf(["Signature checked"]), {
    contentType: "application/octet-stream",
  });
  assert.match(result.text, /Signature checked/);
});

test("rejects unsupported MIME before parsing", async () => {
  await assert.rejects(
    extractPdfText(createSyntheticPdf(), { contentType: "application/zip" }),
    (error) => error instanceof PdfParserError &&
      error.code === "UNSUPPORTED_CONTENT_TYPE" &&
      error.httpStatus === 415,
  );
});

test("rejects a non-PDF payload with an ambiguous octet-stream MIME", async () => {
  await assert.rejects(
    extractPdfText(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
      contentType: "application/octet-stream",
    }),
    (error) => error instanceof PdfParserError &&
      error.code === "PDF_INVALID_SIGNATURE" &&
      error.httpStatus === 415,
  );
});

test("rejects oversized PDF bytes before PDF.js is invoked", async () => {
  const bytes = new Uint8Array(PDF_PARSE_LIMITS.maxInputBytes + 1);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  await assert.rejects(
    extractPdfText(bytes),
    (error) => error instanceof PdfParserError &&
      error.code === "PDF_TOO_LARGE" &&
      error.httpStatus === 413,
  );
});

test("rejects PDFs that exceed the page fan-out limit", async () => {
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

test("truncates extracted text at the configured output ceiling", async () => {
  const longText = "A".repeat(PDF_PARSE_LIMITS.maxOutputCharacters + 128);
  const result = await extractPdfText(createSyntheticPdf([longText]));
  assert.equal(result.text.length, PDF_PARSE_LIMITS.maxOutputCharacters);
  assert.equal(result.truncated, true);
});

test("reports a PDF without extractable text instead of claiming OCR support", async () => {
  await assert.rejects(
    extractPdfText(createSyntheticPdf([""])),
    (error) => error instanceof PdfParserError &&
      error.code === "PDF_NO_TEXT_LAYER" &&
      error.httpStatus === 422,
  );
});
