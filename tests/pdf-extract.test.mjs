import assert from "node:assert/strict";
import test from "node:test";
import { extractStructuredData, ExtractionError } from "../src/core/extract.js";
import { PDF_PARSE_LIMITS } from "../src/core/pdf-parser.js";
import { createSyntheticPdf } from "./fixtures/synthetic-pdf.mjs";

const runtimeSupported = typeof globalThis.Iterator === "function";
const runtimeTest = { skip: !runtimeSupported };
const url = "https://files.example.test/report.pdf";
const schema = {
  type: "object",
  properties: {
    content: { type: "string", "x-source": "pdf:text" },
  },
  required: ["content"],
};

function responseFor(requestedUrl, bodyBytes, contentType = "application/pdf") {
  return {
    status: 200,
    finalUrl: requestedUrl,
    contentType,
    bodyBytes,
    bytes: bodyBytes.byteLength,
    cacheStatus: "MISS",
    retrievedAt: "2026-11-28T12:00:00.000Z",
  };
}

test("Extract maps bounded PDF text into a declared string field with provenance", runtimeTest, async () => {
  const bytes = createSyntheticPdf(["ExportFlow PDF Extract integration"]);
  let fetchOptions;
  const result = await extractStructuredData(
    { url, schema },
    {
      fetchResource: async (_requestedUrl, options) => {
        fetchOptions = options;
        return responseFor(url, bytes);
      },
    },
  );

  assert.equal(fetchOptions.responseMode, "extract");
  assert.equal(fetchOptions.maxBytes, PDF_PARSE_LIMITS.maxInputBytes);
  assert.equal(result.status, "succeeded");
  assert.equal(result.data.format, "pdf");
  assert.equal(result.data.parser, "unpdf");
  assert.equal(result.data.parserVersion, "2.2.3");
  assert.equal(result.data.totalPages, 1);
  assert.match(result.data.fields.content, /ExportFlow PDF Extract integration/);
  assert.equal(result.data.fieldEvidence[0].sourceType, "pdf");
  assert.equal(result.data.fieldEvidence[0].path, "text");
  assert.equal(result.data.fieldEvidence[0].pageCount, 1);
  assert.equal(result.sources[0].evidence[1].type, "pdf_document");
});

test("Extract accepts octet-stream only when its bytes carry a PDF signature", runtimeTest, async () => {
  const bytes = createSyntheticPdf(["Signature-gated PDF"]);
  const result = await extractStructuredData(
    { url, schema },
    { fetchResource: async () => responseFor(url, bytes, "application/octet-stream") },
  );
  assert.equal(result.status, "succeeded");
  assert.match(result.data.fields.content, /Signature-gated PDF/);
});

test("Extract reports scanned PDFs without claiming OCR support", runtimeTest, async () => {
  const bytes = createSyntheticPdf([""]);
  await assert.rejects(
    extractStructuredData(
      { url, schema },
      { fetchResource: async () => responseFor(url, bytes) },
    ),
    (error) => error instanceof ExtractionError &&
      error.code === "PDF_NO_TEXT_LAYER" &&
      error.httpStatus === 422,
  );
});

test("Extract requires PDF text fields to be declared as strings", runtimeTest, async () => {
  const bytes = createSyntheticPdf(["Type contract"]);
  await assert.rejects(
    extractStructuredData(
      {
        url,
        schema: {
          type: "object",
          properties: { content: { type: "number", "x-source": "pdf:text" } },
        },
      },
      { fetchResource: async () => responseFor(url, bytes) },
    ),
    (error) => error instanceof ExtractionError &&
      error.code === "PDF_STRING_FIELD_REQUIRED" &&
      error.httpStatus === 422,
  );
});
