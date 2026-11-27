import test from "node:test";
import assert from "node:assert/strict";
import { STAGE2_CASES, assertStage2Task } from "../scripts/acceptance/stage2-contract.mjs";

const timestamp = "2026-11-27T14:00:00.000Z";

function source(url, evidence = []) {
  return { url, retrievedAt: timestamp, title: null, evidence };
}

function makeTask(operation) {
  const task = {
    id: "stage2_task_0001",
    execution: { operation },
    state: "succeeded",
    result: { status: "succeeded", data: {}, sources: [], warnings: [], generatedAt: timestamp },
  };
  const base = source("https://example.com/", [{ type: "http_response" }]);
  switch (operation) {
    case "fetch":
      task.result.data = { httpStatus: 200, body: "Example Domain" };
      task.result.sources = [base];
      break;
    case "map":
      task.result.data = {
        origin: "https://example.com",
        homepage: { status: 200 },
        robots: { status: 404, unavailable: true, allowedRules: 0 },
        urls: [{ url: "https://example.com/about", discoveredBy: "link" }],
      };
      task.result.sources = [base];
      break;
    case "crawl":
      task.result.data = {
        origin: "https://example.com",
        robots: { status: 404, unavailable: true, allowedRules: 0 },
        pages: [{ url: "https://example.com/", bytes: 64 }],
        pageCount: 1,
        totalBytes: 64,
      };
      task.result.sources = [base];
      break;
    case "extract":
      task.state = "partial";
      task.result.status = "partial";
      task.result.data = {
        httpStatus: 200,
        fields: { title: "Example Domain" },
        fieldEvidence: [{ field: "title", sourceType: "page", path: "title" }],
        missingFields: ["stage2OptionalMissing"],
        missingRequired: [],
      };
      task.result.sources = [source("https://example.com/", [{ type: "extracted_field", field: "title" }])];
      break;
    case "search":
      task.result.data = {
        source: "wikipedia",
        results: [{ url: "https://en.wikipedia.org/?curid=42", source: "wikipedia" }],
      };
      task.result.sources = [source("https://en.wikipedia.org/?curid=42", [
        { type: "public_search_result", provider: "wikipedia" },
      ])];
      break;
    case "research":
      task.result.data = {
        selectedUrl: "https://en.wikipedia.org/wiki/Ada_Lovelace",
        rendering: "static-http-only",
        attempts: [{ url: "https://en.wikipedia.org/wiki/Ada_Lovelace" }],
        fields: { title: "Ada Lovelace" },
      };
      task.result.sources = [source("https://en.wikipedia.org/wiki/Ada_Lovelace", [
        { type: "public_search_result", provider: "wikipedia" },
        { type: "http_response" },
        { type: "extracted_field", field: "title" },
      ])];
      break;
    default:
      throw new Error("Unknown operation: " + operation);
  }
  return task;
}

for (const spec of STAGE2_CASES) {
  test("Stage 2 assertion accepts valid " + spec.operation + " evidence", () => {
    const proof = assertStage2Task(spec.operation, makeTask(spec.operation), "REST");
    assert.equal(proof.operation, spec.operation);
    assert.equal(proof.transport, "REST");
  });
}

test("Stage 2 assertion rejects off-origin crawl results", () => {
  const task = makeTask("crawl");
  task.result.data.pages[0].url = "https://outside.example.net/";
  assert.throws(() => assertStage2Task("crawl", task, "REST"), /off-origin/);
});

test("Stage 2 assertion rejects a failed durable Task", () => {
  const task = makeTask("fetch");
  task.state = "failed";
  task.result.status = "failed";
  assert.throws(() => assertStage2Task("fetch", task, "MCP"), /succeeded or partial/);
});

test("Stage 2 assertion rejects Search results from an unselected provider", () => {
  const task = makeTask("search");
  task.result.data.results[0].source = "openalex";
  assert.throws(() => assertStage2Task("search", task, "MCP"), /selected Wikipedia provider/);
});

test("Stage 2 assertion requires a real partial Extract result", () => {
  const task = makeTask("extract");
  task.state = "succeeded";
  task.result.status = "succeeded";
  assert.throws(() => assertStage2Task("extract", task, "REST"), /genuine partial extraction/);
});
