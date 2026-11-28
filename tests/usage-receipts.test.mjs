import test from "node:test";
import assert from "node:assert/strict";
import { fetchPublicResource } from "../src/core/http-fetch.js";
import { executeWebTask } from "../src/core/tasks.js";
import { createSyntheticPdf } from "./fixtures/synthetic-pdf.mjs";

test("Fetch usage receipts are immutable, sanitized and observational", async () => {
  let receiptCalls = 0;
  let observedReceipt = null;
  const result = await fetchPublicResource("https://example.com/public-data", {
    fetchImpl: async () => new Response("safe-body", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-length": "9",
        "set-cookie": "session=must-not-leak",
      },
    }),
    onUsageReceipt(receipt) {
      receiptCalls += 1;
      observedReceipt = receipt;
      throw new Error("observer failure must not escape");
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body, "safe-body");
  assert.equal(receiptCalls, 1);
  assert.ok(Object.isFrozen(observedReceipt));
  assert.equal(observedReceipt.schemaVersion, 1);
  assert.equal(observedReceipt.attempt, 1);
  assert.equal(observedReceipt.outcome, "response");
  assert.equal(observedReceipt.httpStatus, 200);
  assert.equal(observedReceipt.contentType, "text/plain");
  assert.equal(observedReceipt.declaredResponseBytes, 9);
  assert.equal(observedReceipt.responseBodyBytesRead, 9);
  assert.equal(observedReceipt.bytesSource, "stream_reader_observed");
  assert.equal(observedReceipt.elapsedBasis, "io_inclusive_wall_elapsed_not_cpu");
  assert.equal(observedReceipt.elapsedMs >= 0, true);

  const serialized = JSON.stringify(observedReceipt);
  assert.equal(serialized.includes("https://"), false);
  assert.equal(serialized.includes("session=must-not-leak"), false);
  assert.equal(serialized.includes("safe-body"), false);
});

test("Extract task usage reports original downloaded bytes for HTML and JSON", async () => {
  const fixtures = [
    {
      url: "https://example.com/article",
      contentType: "text/html; charset=utf-8",
      body: "<html><head><title>Measured HTML</title></head><body><p>Public page</p></body></html>",
      schema: {
        type: "object",
        properties: { title: { type: "string", "x-source": "page:title" } },
        required: ["title"],
      },
    },
    {
      url: "https://example.com/data.json",
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ name: "ExportFlow" }),
      schema: {
        type: "object",
        properties: { name: { type: "string", "x-source": "jsonld:name" } },
        required: ["name"],
      },
    },
  ];

  for (let index = 0; index < fixtures.length; index += 1) {
    const fixture = fixtures[index];
    const expectedBytes = new TextEncoder().encode(fixture.body).byteLength;
    const task = await executeWebTask(
      {
        goal: "Measure downloaded bytes for " + fixture.contentType,
        operation: "extract",
        url: fixture.url,
        schema: fixture.schema,
      },
      {
        idFactory: () => "extract-byte-usage-" + index,
        fetchImpl: async () => new Response(fixture.body, {
          status: 200,
          headers: { "content-type": fixture.contentType },
        }),
      },
    );

    assert.equal(task.state, "succeeded");
    assert.equal(task.result.data.bytes, expectedBytes);
    assert.equal(task.usage.responseBytes, expectedBytes);
  }
});

test("CSV Extract usage reports original bytes for a Windows-1252 response", async () => {
  const csvBytes = new Uint8Array([0x6e, 0x61, 0x6d, 0x65, 0x0a, 0x63, 0x61, 0x66, 0xe9]);
  const task = await executeWebTask(
    {
      goal: "Measure original CSV download bytes",
      operation: "extract",
      url: "https://example.com/legacy.csv",
      schema: {
        type: "object",
        properties: {
          names: { type: "array", items: { type: "string" }, "x-source": "csv:name" },
        },
        required: ["names"],
      },
    },
    {
      idFactory: () => "csv-original-byte-usage",
      fetchImpl: async () => new Response(csvBytes, {
        status: 200,
        headers: { "content-type": "text/csv; charset=windows-1252" },
      }),
    },
  );

  assert.equal(task.state, "succeeded");
  assert.equal(task.result.data.inputBytes, csvBytes.byteLength);
  assert.equal(task.usage.responseBytes, csvBytes.byteLength);
  assert.deepEqual(task.result.data.fields.names, ["café"]);
});

test("executeWebTask forwards usage receipts through Extract, Map and Crawl", async () => {
  const pageHtml = "<html><head><title>Usage receipt page</title></head><body><p>Public page</p></body></html>";
  const pageBytes = new TextEncoder().encode(pageHtml).byteLength;
  const schemas = {
    type: "object",
    properties: { title: { type: "string", "x-source": "page:title" } },
    required: ["title"],
  };

  for (const operation of ["extract", "map", "crawl"]) {
    const receipts = [];
    const task = await executeWebTask(
      {
        goal: "Verify usage receipt propagation for " + operation,
        operation,
        url: "https://example.com/",
        ...(operation === "extract" ? { schema: schemas } : {}),
        ...(operation === "map" ? { maxUrls: 1 } : {}),
        ...(operation === "crawl" ? { maxPages: 1, maxDepth: 0 } : {}),
      },
      {
        idFactory: () => "usage-receipt-" + operation,
        fetchImpl: async (input) => {
          const pathname = new URL(String(input)).pathname;
          if (pathname === "/robots.txt") {
            return new Response("User-agent: *\nAllow: /", {
              status: 200,
              headers: { "content-type": "text/plain; charset=utf-8" },
            });
          }
          if (pathname === "/sitemap.xml") {
            return new Response("", {
              status: 404,
              headers: { "content-type": "text/plain; charset=utf-8" },
            });
          }
          return new Response(pageHtml, {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        },
        onUsageReceipt(receipt) { receipts.push(receipt); },
      },
    );

    assert.equal(task.state, "succeeded", operation);
    assert.equal(receipts.length, operation === "extract" ? 1 : 3, operation);
    assert.ok(receipts.every((receipt) => Object.isFrozen(receipt)), operation);
    assert.ok(receipts.every((receipt) => receipt.outcome === "response"), operation);
    assert.ok(receipts.every((receipt) => Number.isInteger(receipt.responseBodyBytesRead)), operation);
    if (operation === "extract") {
      assert.equal(receipts[0].responseBodyBytesRead, pageBytes);
    } else {
      assert.ok(receipts.some((receipt) => receipt.responseBodyBytesRead === pageBytes), operation);
    }
    const observedBytes = receipts.reduce((total, receipt) => total + receipt.responseBodyBytesRead, 0);
    assert.equal(task.usage.responseBytes, observedBytes, operation);
  }
});

test("executeWebTask forwards Fetch receipts through the internal observer only", async () => {
  const receipts = [];
  const task = await executeWebTask(
    { goal: "Read a public text resource", url: "https://example.com/data" },
    {
      idFactory: () => "usage-receipt-task-01",
      fetchImpl: async () => new Response("ok", {
        status: 200,
        headers: { "content-type": "text/plain", "content-length": "2" },
      }),
      onUsageReceipt(receipt) { receipts.push(receipt); },
    },
  );

  assert.equal(task.state, "succeeded");
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].outcome, "response");
  assert.equal(receipts[0].responseBodyBytesRead, 2);
  assert.equal(task.usage.responseBytes, 2);
  assert.equal(Object.isFrozen(receipts[0]), true);
});


test("failed PDF Extract usage retains the original downloaded byte count", { skip: typeof globalThis.Iterator !== "function" }, async () => {
  const pdfBytes = createSyntheticPdf([""]);
  const task = await executeWebTask(
    {
      goal: "Measure downloaded bytes for a PDF without a text layer",
      operation: "extract",
      url: "https://example.com/scanned-report.pdf",
      schema: {
        type: "object",
        properties: { content: { type: "string", "x-source": "pdf:text" } },
        required: ["content"],
      },
    },
    {
      idFactory: () => "failed-pdf-byte-usage",
      fetchImpl: async () => new Response(pdfBytes, {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    },
  );

  assert.equal(task.state, "failed");
  assert.equal(task.errors[0].code, "PDF_NO_TEXT_LAYER");
  assert.equal(task.usage.responseBytes, pdfBytes.byteLength);
});
