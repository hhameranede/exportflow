import assert from "node:assert/strict";

const EXAMPLE_URL = "https://example.com/";
const EXAMPLE_TITLE = "Example Domain";
const EXTRACTION_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    title: { type: "string" },
    stage2OptionalMissing: { type: "string", "x-source": "jsonld:stage2OptionalMissing" },
  },
  required: ["title"],
});
const RESEARCH_SCHEMA = Object.freeze({
  type: "object",
  properties: { title: { type: "string" } },
  required: ["title"],
});

export const STAGE2_CASES = Object.freeze([
  Object.freeze({
    operation: "research",
    tool: "web_research",
    input: Object.freeze({
      query: "Ada Lovelace",
      source: "wikipedia",
      limit: 3,
      candidateLimit: 1,
      schema: RESEARCH_SCHEMA,
    }),
    goal: "Stage 2 bounded Search-Fetch-Extract Research acceptance",
  }),
  Object.freeze({
    operation: "fetch",
    tool: "web_fetch",
    input: Object.freeze({ url: EXAMPLE_URL }),
    goal: "Stage 2 bounded public Fetch acceptance",
  }),
  Object.freeze({
    operation: "map",
    tool: "web_map",
    input: Object.freeze({ url: EXAMPLE_URL, maxUrls: 5 }),
    goal: "Stage 2 same-origin Map and robots acceptance",
  }),
  Object.freeze({
    operation: "crawl",
    tool: "web_crawl",
    input: Object.freeze({ url: EXAMPLE_URL, maxPages: 2, maxDepth: 1 }),
    goal: "Stage 2 bounded same-origin Crawl acceptance",
  }),
  Object.freeze({
    operation: "extract",
    tool: "web_extract",
    input: Object.freeze({ url: EXAMPLE_URL, schema: EXTRACTION_SCHEMA }),
    goal: "Stage 2 deterministic Extract and partial-result acceptance",
  }),
  Object.freeze({
    operation: "search",
    tool: "web_search",
    input: Object.freeze({ query: "Ada Lovelace", source: "wikipedia", limit: 3 }),
    goal: "Stage 2 selected Wikipedia Search acceptance",
  }),
]);

function assertHttpUrl(value, label) {
  assert.equal(typeof value, "string", label + " must be a URL string.");
  const url = new URL(value);
  assert.ok(url.protocol === "https:" || url.protocol === "http:", label + " must use HTTP(S).");
  assert.equal(url.username, "", label + " must not contain a username.");
  assert.equal(url.password, "", label + " must not contain a password.");
  return url;
}

function assertSameOriginSources(sources, expectedOrigin, label) {
  assert.ok(Array.isArray(sources) && sources.length > 0, label + " must retain source provenance.");
  for (const source of sources) {
    const url = assertHttpUrl(source?.url, label + " source");
    assert.equal(url.origin, expectedOrigin, label + " must not return off-origin source evidence.");
    assert.ok(typeof source.retrievedAt === "string" && source.retrievedAt.length > 0,
      label + " source must include retrievedAt.");
    assert.ok(Array.isArray(source.evidence), label + " source must include an evidence array.");
  }
}

export function assertStage2Task(operation, task, transport) {
  const label = (transport || "Task") + " " + operation;
  const spec = STAGE2_CASES.find((item) => item.operation === operation);
  assert.ok(spec, "Unknown Stage 2 operation: " + operation);
  assert.ok(task && typeof task === "object", label + " must return a Task object.");
  assert.ok(typeof task.id === "string" && task.id.length >= 8, label + " must return a durable Task ID.");
  assert.equal(task.execution?.operation, operation, label + " must persist the requested operation.");
  assert.ok(["succeeded", "partial"].includes(task.state), label + " must reach succeeded or partial state.");
  assert.ok(["succeeded", "partial"].includes(task.result?.status), label + " must preserve the result status.");
  assert.ok(task.result?.generatedAt, label + " must include a generatedAt timestamp.");

  const data = task.result.data || {};
  const sources = task.result.sources;
  assert.ok(Array.isArray(sources) && sources.length > 0, label + " must return provenance.");
  for (const source of sources) {
    const url = assertHttpUrl(source?.url, label + " source");
    assert.ok(typeof source.retrievedAt === "string" && source.retrievedAt.length > 0,
      label + " source must include retrievedAt.");
    assert.ok(Array.isArray(source.evidence), label + " source must include evidence.");
    assert.ok(url.hostname.length > 0);
  }

  if (operation === "fetch") {
    assert.equal(data.httpStatus, 200, label + " must retrieve the HTTP 200 control page.");
    assert.ok(typeof data.body === "string" && data.body.includes(EXAMPLE_TITLE),
      label + " must return the expected public response content.");
    assert.ok(sources.some((source) => source.evidence.some((item) => item.type === "http_response")),
      label + " must preserve HTTP response evidence.");
  } else if (operation === "map") {
    assert.equal(data.origin, "https://example.com", label + " must identify the expected origin.");
    assert.equal(data.homepage?.status, 200, label + " must verify the mapped homepage.");
    assert.ok(Array.isArray(data.urls) && data.urls.length <= spec.input.maxUrls,
      label + " must respect maxUrls.");
    assert.ok(data.robots && Number.isInteger(data.robots.status) &&
      typeof data.robots.unavailable === "boolean" &&
      Number.isInteger(data.robots.allowedRules),
      label + " must report the robots policy decision inputs.");
    assertSameOriginSources(sources, data.origin, label);
    for (const item of data.urls) {
      assert.equal(assertHttpUrl(item.url, label + " discovered URL").origin, data.origin,
        label + " must stay within the requested origin.");
    }
  } else if (operation === "crawl") {
    assert.equal(data.origin, "https://example.com", label + " must identify the expected origin.");
    assert.ok(Array.isArray(data.pages) && data.pages.length >= 1 &&
      data.pages.length <= spec.input.maxPages, label + " must respect maxPages and return the homepage.");
    assert.equal(data.pageCount, data.pages.length, label + " pageCount must match the pages array.");
    assert.ok(Number.isInteger(data.totalBytes) && data.totalBytes >= 0 &&
      data.totalBytes <= 1_048_576, label + " must respect the total byte budget.");
    assert.ok(data.robots && Number.isInteger(data.robots.status) &&
      typeof data.robots.unavailable === "boolean" &&
      Number.isInteger(data.robots.allowedRules),
      label + " must expose robots policy state.");
    assertSameOriginSources(sources, data.origin, label);
    for (const page of data.pages) {
      assert.equal(assertHttpUrl(page.url, label + " crawled page").origin, data.origin,
        label + " must not crawl off-origin pages.");
    }
  } else if (operation === "extract") {
    assert.equal(data.httpStatus, 200, label + " must fetch the control page.");
    assert.equal(data.fields?.title, EXAMPLE_TITLE, label + " must extract the explicit title field.");
    assert.ok(Array.isArray(data.fieldEvidence) &&
      data.fieldEvidence.some((item) => item.field === "title"),
      label + " must preserve field-level extraction evidence.");
    assert.ok(Array.isArray(data.missingFields) &&
      data.missingFields.includes("stage2OptionalMissing"),
      label + " must report an absent optional field.");
    assert.deepEqual(data.missingRequired, [], label + " must distinguish missing optional fields from required ones.");
    assert.equal(task.state, "partial", label + " must preserve a genuine partial extraction result.");
  } else if (operation === "search") {
    assert.equal(data.source, "wikipedia", label + " must use the selected provider.");
    assert.ok(Array.isArray(data.results) && data.results.length >= 1 &&
      data.results.length <= spec.input.limit, label + " must return bounded provider results.");
    for (const item of data.results) {
      assert.equal(assertHttpUrl(item.url, label + " search result").hostname, "en.wikipedia.org",
        label + " must retain URLs from the selected Wikipedia provider.");
      assert.equal(item.source, "wikipedia");
    }
    assert.ok(sources.some((source) => source.evidence.some((item) =>
      item.type === "public_search_result" && item.provider === "wikipedia")),
      label + " must preserve selected-provider provenance.");
  } else if (operation === "research") {
    const selectedUrl = assertHttpUrl(data.selectedUrl, label + " selected URL");
    assert.equal(selectedUrl.hostname, "en.wikipedia.org",
      label + " must use the selected Search provider's public result.");
    assert.equal(data.rendering, "static-http-only", label + " must not escalate to browser rendering.");
    assert.ok(data.attempts?.length >= 1 && data.attempts.length <= spec.input.candidateLimit,
      label + " must respect the candidate limit.");
    assert.equal(data.fields?.title?.length > 0, true,
      label + " must extract the selected source title.");
    const evidenceTypes = new Set(sources.flatMap((source) =>
      source.evidence.map((item) => item.type)));
    for (const type of ["public_search_result", "http_response", "extracted_field"]) {
      assert.ok(evidenceTypes.has(type), label + " must preserve " + type + " provenance.");
    }
  }

  return {
    operation,
    transport: transport || "unknown",
    taskId: task.id,
    taskState: task.state,
    resultStatus: task.result.status,
    sourceCount: sources.length,
  };
}

function safeString(value, maxLength = 180) {
  return typeof value === "string" ? value.slice(0, maxLength) : null;
}

function safeHost(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function safeStringList(value, maxItems = 8) {
  return Array.isArray(value)
    ? value.slice(0, maxItems).filter((item) => typeof item === "string").map((item) => item.slice(0, 80))
    : [];
}

/**
 * Returns bounded failure metadata for CI diagnostics.
 * Page bodies, queries, complete URLs, request headers and credentials are excluded.
 */
export function summarizeStage2Failure(operation, task, transport) {
  const data = task?.result?.data && typeof task.result.data === "object" && !Array.isArray(task.result.data)
    ? task.result.data
    : {};
  const attempts = Array.isArray(data.attempts) ? data.attempts.slice(0, 5) : [];
  const errors = Array.isArray(task?.errors) ? task.errors.slice(0, 4) : [];
  const warnings = Array.isArray(task?.result?.warnings) ? task.result.warnings.slice(0, 5) : [];

  return {
    operation: safeString(operation, 32) || "unknown",
    transport: safeString(transport, 16) || "unknown",
    taskState: safeString(task?.state, 24),
    resultStatus: safeString(task?.result?.status, 24),
    errorCode: safeString(data.errorCode, 64),
    errors: errors.map((item) => ({ code: safeString(item?.code, 64) })),
    warnings: warnings.map((item) => safeString(item, 180)).filter(Boolean),
    selectedHost: safeHost(data.selectedUrl),
    attempts: attempts.map((item) => ({
      host: safeHost(item?.url),
      stage: safeString(item?.stage, 32),
      status: safeString(item?.status, 24),
      reason: safeString(item?.reason, 64),
      fieldsFound: Number.isInteger(item?.fieldsFound) ? item.fieldsFound : null,
      missingRequired: safeStringList(item?.missingRequired, 8),
    })),
    missingFields: safeStringList(data.missingFields, 12),
    missingRequired: safeStringList(data.missingRequired, 12),
    sourceCount: Array.isArray(task?.result?.sources) ? task.result.sources.length : 0,
  };
}
