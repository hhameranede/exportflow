import assert from "node:assert/strict";
import { createDeflatedSyntheticPdf } from "../../tests/fixtures/synthetic-pdf.mjs";

const BASE_URL = "https://exportflow-pdf-parser-compat.hhameranede.workers.dev";
const TOKEN = process.env.PDF_PARSER_SMOKE_TOKEN;
const MAX_INPUT_BYTES = 1_048_576;
const MAX_OUTPUT_CHARACTERS = 65_536;
const EXPANDED_CHARACTERS = 4 * 1024 * 1024;

if (typeof TOKEN !== "string" || TOKEN.length < 32) {
  throw new Error("PDF_PARSER_SMOKE_TOKEN is missing or too short.");
}

const response = await fetch(BASE_URL + "/health", {
  signal: AbortSignal.timeout(20_000),
});
assert.equal(response.status, 200, "isolated Worker health status");
const health = await response.json();
assert.equal(health.status, "ok");
assert.equal(health.parser, "unpdf");
assert.equal(health.parserVersion, "2.2.3");
assert.equal(health.maxInputBytes, MAX_INPUT_BYTES);
assert.equal(health.maxPages, 10);

const pdf = createDeflatedSyntheticPdf("B".repeat(EXPANDED_CHARACTERS));
assert.ok(pdf.byteLength < MAX_INPUT_BYTES, "compressed input must remain under the parser byte ceiling");
assert.ok(
  EXPANDED_CHARACTERS / pdf.byteLength > 20,
  "fixture must exercise meaningful FlateDecode expansion",
);

const startedAt = performance.now();
const parseResponse = await fetch(BASE_URL + "/parse", {
  method: "POST",
  headers: {
    authorization: "Bearer " + TOKEN,
    "content-type": "application/pdf",
  },
  body: pdf,
  signal: AbortSignal.timeout(30_000),
});
const wallTimeMs = performance.now() - startedAt;

assert.equal(parseResponse.status, 200, "compressed PDF parse status");
let result;
try {
  result = await parseResponse.json();
} catch {
  throw new Error("Compressed PDF Acceptance returned non-JSON content (HTTP " + parseResponse.status + ").");
}
assert.equal(result.ok, true);
assert.equal(result.format, "pdf");
assert.equal(result.parserVersion, "2.2.3");
assert.equal(result.totalPages, 1);
assert.equal(result.text.length, MAX_OUTPUT_CHARACTERS);
assert.equal(result.text[0], "B");
assert.equal(result.truncated, true);
assert.equal("bodyBytes" in result, false);

const ratio = EXPANDED_CHARACTERS / pdf.byteLength;
console.log(
  "PASS remote FlateDecode expansion: " +
  pdf.byteLength + " compressed bytes -> " +
  EXPANDED_CHARACTERS + " decoded characters (" +
  ratio.toFixed(1) + "x); output capped at " +
  MAX_OUTPUT_CHARACTERS + "; " +
  wallTimeMs.toFixed(1) + "ms wall time (not CPU time or memory).",
);
