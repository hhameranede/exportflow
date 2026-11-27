import assert from "node:assert/strict";
import { createSyntheticPdf } from "../../tests/fixtures/synthetic-pdf.mjs";

const BASE_URL = "https://exportflow-pdf-parser-compat.hhameranede.workers.dev";
const TOKEN = process.env.PDF_PARSER_SMOKE_TOKEN;
const MAX_INPUT_BYTES = 1_048_576;
const MAX_OUTPUT_CHARACTERS = 65_536;

if (typeof TOKEN !== "string" || TOKEN.length < 32) {
  throw new Error("PDF_PARSER_SMOKE_TOKEN is missing or too short.");
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.contentType) headers.set("content-type", options.contentType);
  if (options.token !== null && options.token !== undefined) {
    headers.set("authorization", "Bearer " + options.token);
  }

  return fetch(BASE_URL + path, {
    method: options.method || "GET",
    headers,
    body: options.body,
    signal: AbortSignal.timeout(20_000),
  });
}

async function readJson(response, label) {
  try {
    return await response.json();
  } catch {
    throw new Error(label + " returned a non-JSON response (HTTP " + response.status + ").");
  }
}

async function expectError(response, expectedStatus, expectedCode, label) {
  assert.equal(response.status, expectedStatus, label + " HTTP status");
  const body = await readJson(response, label);
  assert.equal(body?.error?.code, expectedCode, label + " error code");
  console.log("PASS " + label + " → HTTP " + expectedStatus + " / " + expectedCode);
  return body;
}

const healthResponse = await request("/health");
assert.equal(healthResponse.status, 200, "health HTTP status");
const health = await readJson(healthResponse, "health");
assert.equal(health.status, "ok");
assert.equal(health.parser, "unpdf");
assert.equal(health.parserVersion, "2.2.3");
assert.equal(health.maxInputBytes, MAX_INPUT_BYTES);
assert.equal(health.maxPages, 10);
console.log("PASS isolated Worker health and parser limits");

const validPdf = createSyntheticPdf(["ExportFlow isolated remote PDF Acceptance"]);
await expectError(
  await request("/parse", {
    method: "POST",
    contentType: "application/pdf",
    token: null,
    body: validPdf,
  }),
  401,
  "UNAUTHORIZED",
  "missing bearer token",
);
await expectError(
  await request("/parse", {
    method: "POST",
    contentType: "application/pdf",
    token: "invalid-pdf-parser-smoke-token",
    body: validPdf,
  }),
  401,
  "UNAUTHORIZED",
  "invalid bearer token",
);

const validStarted = performance.now();
const validResponse = await request("/parse", {
  method: "POST",
  contentType: "application/pdf",
  token: TOKEN,
  body: validPdf,
});
assert.equal(validResponse.status, 200, "valid PDF HTTP status");
const validResult = await readJson(validResponse, "valid PDF parse");
assert.equal(validResult.ok, true);
assert.equal(validResult.format, "pdf");
assert.equal(validResult.parserVersion, "2.2.3");
assert.equal(validResult.totalPages, 1);
assert.match(validResult.text, /ExportFlow isolated remote PDF Acceptance/);
assert.equal(validResult.truncated, false);
assert.equal("bodyBytes" in validResult, false);
console.log("PASS authenticated synthetic PDF extraction (" + Math.round(performance.now() - validStarted) + " ms)");

const largePdf = createSyntheticPdf(["A".repeat(MAX_OUTPUT_CHARACTERS + 1_024)]);
for (let attempt = 1; attempt <= 3; attempt += 1) {
  const started = performance.now();
  const response = await request("/parse", {
    method: "POST",
    contentType: "application/pdf",
    token: TOKEN,
    body: largePdf,
  });
  assert.equal(response.status, 200, "large PDF HTTP status, attempt " + attempt);
  const result = await readJson(response, "large PDF parse " + attempt);
  assert.equal(result.ok, true);
  assert.equal(result.text.length, MAX_OUTPUT_CHARACTERS);
  assert.equal(result.truncated, true);
  assert.equal("bodyBytes" in result, false);
  console.log("PASS output-cap cancellation " + attempt + "/3 (" + Math.round(performance.now() - started) + " ms)");
  await new Promise((resolve) => setTimeout(resolve, 75));
}

await expectError(
  await request("/parse", {
    method: "POST",
    contentType: "text/html",
    token: TOKEN,
    body: validPdf,
  }),
  415,
  "UNSUPPORTED_CONTENT_TYPE",
  "unsupported MIME",
);
await expectError(
  await request("/parse", {
    method: "POST",
    contentType: "application/octet-stream",
    token: TOKEN,
    body: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
  }),
  415,
  "PDF_INVALID_SIGNATURE",
  "invalid PDF signature",
);

const oversized = new Uint8Array(MAX_INPUT_BYTES + 1);
oversized.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
await expectError(
  await request("/parse", {
    method: "POST",
    contentType: "application/pdf",
    token: TOKEN,
    body: oversized,
  }),
  413,
  "PDF_TOO_LARGE",
  "input byte ceiling",
);
await expectError(
  await request("/parse", {
    method: "POST",
    contentType: "application/pdf",
    token: TOKEN,
    body: createSyntheticPdf(Array.from({ length: 11 }, (_, index) => "Page " + (index + 1))),
  }),
  413,
  "PDF_PAGE_LIMIT",
  "page fan-out ceiling",
);
await expectError(
  await request("/parse", {
    method: "POST",
    contentType: "application/pdf",
    token: TOKEN,
    body: createSyntheticPdf([""]),
  }),
  422,
  "PDF_NO_TEXT_LAYER",
  "textless PDF",
);

console.log("PASS isolated authenticated PDF Acceptance: all synthetic cases completed.");
