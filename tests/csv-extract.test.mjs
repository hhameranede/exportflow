import assert from "node:assert/strict";
import test from "node:test";
import { extractStructuredData, ExtractionError } from "../src/core/extract.js";
import { parseCsvText, CsvParserError } from "../src/core/csv-parser.js";

const schema = {
  type: "object",
  properties: {
    sku: { type: "array", items: { type: "string" }, "x-source": "csv:SKU" },
    notes: { type: "array", items: { type: "string" }, "x-source": "csv:Product Notes" },
  },
  required: ["sku"],
};

function responseFor(url, body, contentType = "text/csv; charset=utf-8") {
  return {
    status: 200, finalUrl: url, contentType, body,
    bytes: new TextEncoder().encode(body).byteLength,
    retrievedAt: "2026-11-28T09:00:00.000Z",
  };
}

test("CSV parser preserves commas, embedded newlines, leading zeroes and formula-looking values", () => {
  const csv = [
    "SKU,Product Notes",
    '0012,"hello, world"',
    '"0003","first line',
    'second line"',
    '=1+1,"=HYPERLINK(""https://example.com"",""open"")"',
  ].join("\n");
  const parsed = parseCsvText(csv);
  assert.equal(parsed.method, "papaparse");
  assert.equal(parsed.parserVersion, "5.7.1");
  assert.deepEqual(parsed.headers, ["SKU", "Product Notes"]);
  assert.equal(parsed.rowCount, 3);
  assert.equal(parsed.rows[0].SKU, "0012");
  assert.equal(parsed.rows[0]["Product Notes"], "hello, world");
  assert.equal(parsed.rows[1]["Product Notes"], "first line\nsecond line");
  assert.equal(parsed.rows[2].SKU, "=1+1");
  assert.equal(parsed.rows[2]["Product Notes"], '=HYPERLINK("https://example.com","open")');
});

test("Extract returns selected CSV columns as string arrays with source provenance", async () => {
  const url = "https://data.example.test/catalog.csv";
  const body = ["SKU,Product Notes", '0012,"hello, world"', '"0003","first line', 'second line"'].join("\n");
  const result = await extractStructuredData(
    { url, schema },
    { fetchResource: async (requestedUrl) => responseFor(requestedUrl, body) },
  );
  assert.equal(result.status, "succeeded");
  assert.equal(result.data.format, "csv");
  assert.equal(result.data.parser, "papaparse");
  assert.deepEqual(result.data.headers, ["SKU", "Product Notes"]);
  assert.deepEqual(result.data.fields.sku, ["0012", "0003"]);
  assert.deepEqual(result.data.fields.notes, ["hello, world", "first line\nsecond line"]);
  assert.equal(result.data.fieldEvidence[0].sourceType, "csv");
  assert.equal(result.data.fieldEvidence[0].path, "SKU");
  assert.equal(result.data.fieldEvidence[0].columnIndex, 0);
  assert.equal(result.data.fieldEvidence[0].rowCount, 2);
  assert.equal(result.sources[0].evidence[1].type, "csv_table");
});

test("CSV extraction defaults to schema property names when x-source is omitted", async () => {
  const url = "https://data.example.test/items.csv";
  const result = await extractStructuredData(
    { url, schema: { type: "object", properties: { sku: { type: "array", items: { type: "string" } } } } },
    { fetchResource: async (requestedUrl) => responseFor(requestedUrl, "sku\n001\n002") },
  );
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.data.fields.sku, ["001", "002"]);
  assert.equal(result.data.delimiter, ",");
});

test("CSV extraction fails when none of the requested columns are mapped", async () => {
  const url = "https://data.example.test/unmapped-columns.csv";
  const result = await extractStructuredData(
    {
      url,
      schema: {
        type: "object",
        properties: {
          sku: { type: "array", items: { type: "string" }, "x-source": "csv:Missing SKU" },
          notes: { type: "array", items: { type: "string" }, "x-source": "csv:Missing Notes" },
        },
      },
    },
    { fetchResource: async (requestedUrl) => responseFor(requestedUrl, "id\\n001\\n002") },
  );
  assert.equal(result.status, "failed");
  assert.deepEqual(result.data.fields, {});
  assert.deepEqual(result.data.missingFields, ["sku", "notes"]);
});

test("CSV extraction requires explicit string array items before column lookup", async () => {
  const url = "https://data.example.test/schema-contract.csv";
  const csv = "Other Column\\n001";
  const invalidSchemas = [
    { type: "object", properties: { sku: { type: "array", "x-source": "csv:SKU" } } },
    { type: "object", properties: { sku: { type: "array", items: { type: "number" }, "x-source": "csv:SKU" } } },
  ];

  for (const invalidSchema of invalidSchemas) {
    await assert.rejects(
      extractStructuredData(
        { url, schema: invalidSchema },
        { fetchResource: async (requestedUrl) => responseFor(requestedUrl, csv) },
      ),
      (error) => error instanceof ExtractionError && error.code === "CSV_ARRAY_FIELD_REQUIRED",
    );
  }
});

test("CSV short rows are retained as empty strings and reported as partial", async () => {
  const url = "https://data.example.test/short.csv";
  const result = await extractStructuredData(
    { url, schema },
    { fetchResource: async (requestedUrl) => responseFor(requestedUrl, "SKU,Product Notes\n001,available\n002") },
  );
  assert.equal(result.status, "partial");
  assert.deepEqual(result.data.fields.sku, ["001", "002"]);
  assert.deepEqual(result.data.fields.notes, ["available", ""]);
  assert.ok(result.warnings.some((warning) => warning.includes("TooFewFields")));
});

test("CSV extraction reports absent columns separately from required-column gaps", async () => {
  const url = "https://data.example.test/missing-column.csv";
  const result = await extractStructuredData(
    {
      url,
      schema: {
        type: "object",
        properties: {
          sku: { type: "array", items: { type: "string" }, "x-source": "csv:SKU" },
          notes: { type: "array", items: { type: "string" }, "x-source": "csv:Product Notes" },
        },
        required: ["sku", "notes"],
      },
    },
    { fetchResource: async (requestedUrl) => responseFor(requestedUrl, "SKU\n001\n") },
  );
  assert.equal(result.status, "partial");
  assert.deepEqual(result.data.missingFields, ["notes"]);
  assert.deepEqual(result.data.missingRequired, ["notes"]);
});

test("CSV parser rejects duplicate and unsafe headers, malformed quotes and oversized input", () => {
  assert.throws(() => parseCsvText("sku, sku \n001,002"),
    (error) => error instanceof CsvParserError && error.code === "CSV_DUPLICATE_HEADER");
  assert.throws(() => parseCsvText("sku,__proto__\n001,value"),
    (error) => error instanceof CsvParserError && error.code === "CSV_UNSAFE_HEADER");
  assert.throws(() => parseCsvText('sku,notes\n001,"unfinished'),
    (error) => error instanceof CsvParserError && error.code === "CSV_MALFORMED_QUOTES");
  assert.throws(() => parseCsvText("sku\n" + "x".repeat(262_145)),
    (error) => error instanceof CsvParserError && error.code === "CSV_INPUT_TOO_LARGE");
});

test("CSV extraction refuses non-array/non-string contracts and generic binary content", async () => {
  const url = "https://data.example.test/numeric.csv";
  await assert.rejects(
    extractStructuredData(
      { url, schema: { type: "object", properties: { amount: { type: "number", "x-source": "csv:Amount" } } } },
      { fetchResource: async (requestedUrl) => responseFor(requestedUrl, "Amount\n0012") },
    ),
    (error) => error instanceof ExtractionError && error.code === "CSV_ARRAY_FIELD_REQUIRED",
  );
  await assert.rejects(
    extractStructuredData(
      { url, schema },
      { fetchResource: async (requestedUrl) => responseFor(requestedUrl, "SKU\n001", "application/octet-stream") },
    ),
    (error) => error instanceof ExtractionError && error.code === "UNSUPPORTED_CONTENT_TYPE",
  );
});


test("single-column CSV ignores PapaParse's undetectable-delimiter diagnostic", () => {
  const parsed = parseCsvText(["id", "001", "002"].join(String.fromCharCode(10)));
  assert.equal(parsed.status, "succeeded");
  assert.deepEqual(parsed.headers, ["id"]);
  assert.deepEqual(parsed.rows.map((row) => row.id), ["001", "002"]);
  assert.deepEqual(parsed.errors, []);
});

test("CSV parser enforces row, column and header-length ceilings", () => {
  const rows = ["id", ...Array.from({ length: 1_001 }, (_, index) => String(index))].join(String.fromCharCode(10));
  const rowLimited = parseCsvText(rows);
  assert.equal(rowLimited.rowCount, 1_000);
  assert.equal(rowLimited.truncated, true);

  const wideHeader = Array.from({ length: 101 }, (_, index) => "c" + index).join(",");
  const wideRow = Array.from({ length: 101 }, (_, index) => String(index)).join(",");
  assert.throws(
    () => parseCsvText(wideHeader + String.fromCharCode(10) + wideRow),
    (error) => error.code === "CSV_TOO_MANY_COLUMNS",
  );

  assert.throws(
    () => parseCsvText("x".repeat(257) + String.fromCharCode(10) + "value"),
    (error) => error.code === "CSV_HEADER_TOO_LONG",
  );
});


test("CSV parser detects semicolon-delimited locale exports without coercing values", () => {
  const csv = ["SKU;Description", "0012;Widget"].join(String.fromCharCode(10));
  const parsed = parseCsvText(csv);
  assert.equal(parsed.delimiter, ";");
  assert.deepEqual(parsed.headers, ["SKU", "Description"]);
  assert.equal(parsed.rows[0].SKU, "0012");
  assert.equal(parsed.rows[0].Description, "Widget");
});

