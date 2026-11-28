import assert from "node:assert/strict";
import test from "node:test";
import { createWorker } from "../src/index.js";
import { createDurableTaskD1 } from "./helpers/durable-task-d1.js";
import { createSyntheticPdf } from "./fixtures/synthetic-pdf.mjs";

const identityA = Object.freeze({
  tenantId: "tenant_alpha",
  planCode: "developer",
  policyVersion: "test-v1",
  quotaPeriod: "daily",
  requestLimit: 10,
  scopes: ["tasks:fetch", "tasks:read", "tasks:extract"],
});
const identityB = Object.freeze({ ...identityA, tenantId: "tenant_beta" });

function makeGateway() {
  const authorizeScope = (identity, scope) => identity.scopes.includes(scope)
    ? { ok: true, identity }
    : { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "scope denied" };
  return {
    async authenticate(request, _env, { requiredScope } = {}) {
      const identity = request.headers.get("authorization") === "Bearer beta" ? identityB : identityA;
      if (requiredScope && !identity.scopes.includes(requiredScope)) {
        return { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "scope denied" };
      }
      return { ok: true, identity };
    },
    authorizeScope,
  };
}

function postTask(idempotencyKey, url = "https://example.com/") {
  return new Request("https://exportflow.me/api/v1/tasks", {
    method: "POST",
    headers: {
      authorization: "Bearer alpha",
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({ goal: "Fetch a public test page", operation: "fetch", url }),
  });
}

function postExtractTask(idempotencyKey, url = "https://example.com/report.pdf") {
  return new Request("https://exportflow.me/api/v1/tasks", {
    method: "POST",
    headers: {
      authorization: "Bearer alpha",
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      goal: "Extract text from a public PDF",
      operation: "extract",
      url,
      schema: {
        type: "object",
        properties: { content: { type: "string", "x-source": "pdf:text" } },
        required: ["content"],
      },
    }),
  });
}

test("REST Extract runs a bounded PDF through the shared task path", { skip: typeof globalThis.Iterator !== "function" }, async () => {
  const fixture = createDurableTaskD1({ tenantIds: ["tenant_alpha", "tenant_beta"] });
  const pdfBytes = createSyntheticPdf(["ExportFlow REST PDF acceptance fixture"]);
  let fetchInit;
  const worker = createWorker({
    tenantTaskGateway: makeGateway(),
    fetchImpl: async (_url, init) => {
      fetchInit = init;
      return new Response(pdfBytes, {
        status: 200,
        headers: { "content-type": "application/pdf", "content-length": String(pdfBytes.byteLength) },
      });
    },
  });
  try {
    const response = await worker.fetch(postExtractTask("rest-pdf-task-0001"), {
      EXPORTFLOW_AUTH_DB: fixture.db,
    });
    const task = await response.json();
    assert.equal(response.status, 200);
    assert.equal(task.state, "succeeded");
    assert.equal(task.execution.adapterId, "web.extract.v1");
    assert.equal(task.result.data.format, "pdf");
    assert.equal(task.result.data.inputBytes, pdfBytes.byteLength);
    assert.equal(task.usage.responseBytes, pdfBytes.byteLength);
    assert.match(task.result.data.fields.content, /ExportFlow REST PDF acceptance fixture/);
    assert.ok(fetchInit.headers.accept.includes("application/pdf"));
  } finally {
    fixture.close();
  }
});



test("REST Extract reports downloaded PDF bytes when parsing fails after fetch", async () => {
  const fixture = createDurableTaskD1({ tenantIds: ["tenant_alpha"] });
  const malformedPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  const worker = createWorker({
    tenantTaskGateway: makeGateway(),
    fetchImpl: async () => new Response(malformedPdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-length": String(malformedPdf.byteLength),
      },
    }),
  });

  try {
    const response = await worker.fetch(postExtractTask("rest-pdf-fail-0001"), {
      EXPORTFLOW_AUTH_DB: fixture.db,
    });
    const task = await response.json();
    assert.equal(response.status, 200);
    assert.equal(task.state, "failed");
    assert.equal(task.errors[0].code, "PDF_PARSE_FAILED");
    assert.equal(task.usage.responseBytes, malformedPdf.byteLength);
  } finally {
    fixture.close();
  }
});

test("REST task execution is persisted and an idempotent retry returns the original task", async () => {
  const fixture = createDurableTaskD1({ tenantIds: ["tenant_alpha", "tenant_beta"] });
  let fetchCalls = 0;
  const worker = createWorker({
    tenantTaskGateway: makeGateway(),
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response("ExportFlow durable task test", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    },
  });
  try {
    const firstResponse = await worker.fetch(postTask("rest-task-key-0001"), {
      EXPORTFLOW_AUTH_DB: fixture.db,
    });
    const first = await firstResponse.json();
    assert.equal(firstResponse.status, 200);
    assert.equal(first.state, "succeeded");
    assert.ok(first.id);
    assert.equal(fetchCalls, 1);

    const retryResponse = await worker.fetch(postTask("rest-task-key-0001"), {
      EXPORTFLOW_AUTH_DB: fixture.db,
    });
    const retry = await retryResponse.json();
    assert.equal(retryResponse.status, 200);
    assert.equal(retryResponse.headers.get("idempotency-replayed"), "true");
    assert.equal(retry.id, first.id);
    assert.equal(fetchCalls, 1);

    const noReadWorker = createWorker({
      tenantTaskGateway: {
        async authenticate(_request, _env, { requiredScope } = {}) {
          return requiredScope === "tasks:read"
            ? { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "scope denied" }
            : { ok: true, identity: { ...identityA, scopes: ["tasks:fetch"] } };
        },
        authorizeScope: makeGateway().authorizeScope,
      },
    });
    const deniedRead = await noReadWorker.fetch(new Request(
      "https://exportflow.me/api/v1/tasks/" + first.id,
      { headers: { authorization: "Bearer no-read" } },
    ), { EXPORTFLOW_AUTH_DB: fixture.db });
    assert.equal(deniedRead.status, 403);
    assert.equal((await deniedRead.json()).error.code, "INSUFFICIENT_SCOPE");

    const statusResponse = await worker.fetch(new Request(
      "https://exportflow.me/api/v1/tasks/" + first.id,
      { headers: { authorization: "Bearer alpha" } },
    ), { EXPORTFLOW_AUTH_DB: fixture.db });
    const status = await statusResponse.json();
    assert.equal(statusResponse.status, 200);
    assert.equal(status.id, first.id);
    assert.equal(status.state, "succeeded");
    assert.match(status.result.data.body, /durable task test/);

    const otherTenantResponse = await worker.fetch(new Request(
      "https://exportflow.me/api/v1/tasks/" + first.id,
      { headers: { authorization: "Bearer beta" } },
    ), { EXPORTFLOW_AUTH_DB: fixture.db });
    assert.equal(otherTenantResponse.status, 404);

    const quota = fixture.sqlite.prepare(
      "SELECT requests_used FROM tenant_request_usage WHERE tenant_id = 'tenant_alpha'",
    ).get();
    assert.equal(quota.requests_used, 1);
  } finally {
    fixture.close();
  }
});

test("REST rejects an idempotency key reused for another request", async () => {
  const fixture = createDurableTaskD1();
  let fetchCalls = 0;
  const worker = createWorker({
    tenantTaskGateway: makeGateway(),
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    },
  });
  try {
    const first = await worker.fetch(postTask("rest-task-key-0002"), { EXPORTFLOW_AUTH_DB: fixture.db });
    assert.equal(first.status, 200);
    const conflict = await worker.fetch(postTask("rest-task-key-0002", "https://www.iana.org/"), { EXPORTFLOW_AUTH_DB: fixture.db });
    const body = await conflict.json();
    assert.equal(conflict.status, 409);
    assert.equal(body.error.code, "IDEMPOTENCY_KEY_REUSED");
    assert.equal(fetchCalls, 1);
  } finally {
    fixture.close();
  }
});

test("REST Extract parses bounded CSV through the shared task execution path", async () => {
  const fixture = createDurableTaskD1({ tenantIds: ["tenant_alpha"] });
  const identity = Object.freeze({
    ...identityA,
    scopes: Object.freeze([...identityA.scopes, "tasks:extract"]),
  });
  const baseGateway = makeGateway();
  const gateway = {
    async authenticate(_request, _env, { requiredScope } = {}) {
      if (requiredScope && !identity.scopes.includes(requiredScope)) {
        return { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "scope denied" };
      }
      return { ok: true, identity };
    },
    authorizeScope: baseGateway.authorizeScope,
  };
  const csv = 'SKU,Product Notes\n001,"Contains, commas"\n002,"=SUM(1,1)"\n';
  let fetchCalls = 0;
  const worker = createWorker({
    tenantTaskGateway: gateway,
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(csv, {
        status: 200,
        headers: { "content-type": "text/csv; charset=utf-8" },
      });
    },
  });

  try {
    const response = await worker.fetch(new Request("https://exportflow.me/api/v1/tasks", {
      method: "POST",
      headers: {
        authorization: "Bearer alpha",
        "content-type": "application/json",
        "idempotency-key": "rest-csv-extract-0001",
      },
      body: JSON.stringify({
        goal: "Extract bounded CSV columns",
        operation: "extract",
        url: "https://example.com/catalog.csv",
        schema: {
          type: "object",
          properties: {
            sku: { type: "array", items: { type: "string" }, "x-source": "csv:SKU" },
            notes: { type: "array", items: { type: "string" }, "x-source": "csv:Product Notes" },
          },
          required: ["sku"],
        },
      }),
    }), { EXPORTFLOW_AUTH_DB: fixture.db });
    const task = await response.json();

    assert.equal(response.status, 200);
    assert.equal(task.state, "succeeded");
    assert.equal(task.result.data.format, "csv");
    assert.deepEqual(task.result.data.fields.sku, ["001", "002"]);
    assert.deepEqual(task.result.data.fields.notes, ["Contains, commas", "=SUM(1,1)"]);
    assert.equal(task.result.data.parser, "papaparse");
    assert.equal(task.result.data.rowCount, 2);
    assert.equal(task.result.data.fieldEvidence[0].sourceType, "csv");
    assert.equal(task.result.data.fieldEvidence[0].path, "SKU");
    assert.equal(fetchCalls, 1);
  } finally {
    fixture.close();
  }
});


test("REST Extract can opt into bounded Readability article text without changing structured fields", async () => {
  const fixture = createDurableTaskD1({ tenantIds: ["tenant_alpha"] });
  const identity = Object.freeze({
    ...identityA,
    scopes: Object.freeze([...identityA.scopes, "tasks:extract"]),
  });
  const baseGateway = makeGateway();
  const gateway = {
    async authenticate(request, env, { requiredScope } = {}) {
      if (requiredScope && !identity.scopes.includes(requiredScope)) {
        return { ok: false, httpStatus: 403, code: "INSUFFICIENT_SCOPE", message: "scope denied" };
      }
      return { ok: true, identity };
    },
    authorizeScope: baseGateway.authorizeScope,
  };
  const articleText = "ExportFlow parses article content through the optional Readability mode. ".repeat(35);
  let fetchCalls = 0;
  const worker = createWorker({
    tenantTaskGateway: gateway,
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(
        "<html lang='en'><head><title>REST article</title></head><body><article><h1>REST article</h1><p>" +
        articleText + "</p><p>" + articleText + "</p></article></body></html>",
        { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    },
  });
  try {
    const response = await worker.fetch(new Request("https://exportflow.me/api/v1/tasks", {
      method: "POST",
      headers: {
        authorization: "Bearer alpha",
        "content-type": "application/json",
        "idempotency-key": "rest-extract-article-01",
      },
      body: JSON.stringify({
        goal: "Extract the article and structured title",
        operation: "extract",
        url: "https://example.com/article",
        schema: { type: "object", properties: { title: { type: "string", "x-source": "page:title" } } },
        includeArticle: true,
      }),
    }), { EXPORTFLOW_AUTH_DB: fixture.db });
    const task = await response.json();
    assert.equal(response.status, 200);
    assert.equal(task.state, "succeeded");
    assert.equal(task.result.data.fields.title, "REST article");
    assert.equal(task.result.data.article.status, "succeeded");
    assert.equal(task.result.data.article.method, "mozilla-readability");
    assert.match(task.result.data.article.textContent, /optional Readability mode/);
    assert.ok(task.result.sources[0].evidence.some((item) => item.type === "article_text"));
    assert.equal(fetchCalls, 1);
  } finally {
    fixture.close();
  }
});


test("REST Extract maps malformed, scanned, and oversized PDF failures to precise HTTP statuses", { skip: typeof globalThis.Iterator !== "function" }, async () => {
  const fixture = createDurableTaskD1({ tenantIds: ["tenant_alpha", "tenant_beta"] });
  const scannedPdf = createSyntheticPdf([""]);
  const invalidPdf = new TextEncoder().encode("not a PDF document");
  const oversizedPdf = new Uint8Array(1_048_577);
  oversizedPdf.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const worker = createWorker({
    tenantTaskGateway: makeGateway(),
    fetchImpl: async (source) => {
      const pathname = new URL(source).pathname;
      const bytes = pathname === "/scanned.pdf"
        ? scannedPdf
        : pathname === "/invalid.pdf"
          ? invalidPdf
          : pathname === "/oversized.pdf"
            ? oversizedPdf
            : null;
      if (!bytes) throw new Error("Unexpected PDF acceptance-test URL.");
      return new Response(bytes, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-length": String(bytes.byteLength),
        },
      });
    },
  });

  const cases = [
    { key: "rest-pdf-scanned-0001", url: "https://example.com/scanned.pdf", status: 422 },
    { key: "rest-pdf-invalid-0001", url: "https://example.com/invalid.pdf", status: 415 },
    { key: "rest-pdf-oversized-0001", url: "https://example.com/oversized.pdf", status: 413 },
  ];

  try {
    for (const item of cases) {
      const response = await worker.fetch(postExtractTask(item.key, item.url), {
        EXPORTFLOW_AUTH_DB: fixture.db,
      });
      assert.equal(response.status, item.status, item.url);
    }
  } finally {
    fixture.close();
  }
});
