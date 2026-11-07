import assert from "node:assert/strict";
import {
  createGleifAccessService,
  GleifAccessServiceError,
  GLEIF_API_ORIGIN,
  GLEIF_LEI_RECORDS_PATH
} from "../functions/lib/gleif-access-service.mjs";

const validRecord = {
  type: "lei-records",
  id: "636700STJZG4U8W2I596",
  attributes: {
    lei: "636700STJZG4U8W2I596",
    entity: {
      legalName: { name: "Kommstart 174 AB (publ)", language: "sv" },
      legalAddress: { country: "SE", city: "Stockholm", addressLines: ["Private address omitted"] },
      jurisdiction: "SE",
      category: "GENERAL",
      legalForm: { id: "AB" },
      registeredAs: "556000-0000",
      status: "ACTIVE"
    },
    registration: {
      status: "ISSUED",
      lastUpdateDate: "2026-10-20T12:00:00Z",
      managingLou: "5493001KJTIIGC8Y1R12"
    }
  }
};

const inactiveRecord = {
  ...validRecord,
  attributes: {
    ...validRecord.attributes,
    entity: { ...validRecord.attributes.entity, status: "INACTIVE" }
  }
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/vnd.api+json" }
  });
}

{
  let requestedUrl;
  let requestOptions;
  const client = createGleifAccessService({
    fetchImpl: async (url, init) => {
      requestedUrl = url;
      requestOptions = init;
      return jsonResponse({ data: [validRecord], links: { next: null } });
    }
  });

  const page = await client.fetchPage({ pageNumber: 1, pageSize: 25 });
  const parsedUrl = new URL(requestedUrl);

  assert.equal(parsedUrl.origin, GLEIF_API_ORIGIN);
  assert.equal(parsedUrl.pathname, GLEIF_LEI_RECORDS_PATH);
  assert.equal(parsedUrl.searchParams.get("page[number]"), "1");
  assert.equal(parsedUrl.searchParams.get("page[size]"), "25");
  assert.equal(requestOptions.method, "GET");
  assert.equal(requestOptions.redirect, "error");
  assert.match(requestOptions.headers.Accept, /application\/vnd\.api\+json/);
  assert.equal(page.records.length, 1);
}

{
  const requestedPages = [];
  const client = createGleifAccessService({
    fetchImpl: async url => {
      const parsed = new URL(url);
      const page = Number(parsed.searchParams.get("page[number]"));
      requestedPages.push(page);
      return page === 1
        ? jsonResponse({
            data: [inactiveRecord, validRecord],
            links: { next: GLEIF_API_ORIGIN + GLEIF_LEI_RECORDS_PATH + "?page%5Bnumber%5D=2&page%5Bsize%5D=25" }
          })
        : jsonResponse({ data: [validRecord], links: { next: null } });
    }
  });

  const result = await client.collectPilot({ maxPages: 2 });
  assert.deepEqual(requestedPages, [1, 2]);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.recordsRead, 3);
  assert.equal(result.acceptedCount, 2);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.exhausted, true);
  assert.equal(result.nextPageNumber, null);
  assert.equal("registeredAs" in result.records[0].sourceRecord, false);
  assert.equal("legalAddress" in result.records[0].sourceRecord, false);
  assert.equal("raw" in result.records[0], false);
}

{
  let calls = 0;
  const client = createGleifAccessService({
    fetchImpl: async url => {
      calls += 1;
      const parsed = new URL(url);
      return jsonResponse({
        data: [validRecord],
        links: {
          next: GLEIF_API_ORIGIN + GLEIF_LEI_RECORDS_PATH +
            "?page%5Bnumber%5D=" + (Number(parsed.searchParams.get("page[number]")) + 1) +
            "&page%5Bsize%5D=25"
        }
      });
    }
  });

  const result = await client.collectPilot({ maxPages: 1 });
  assert.equal(calls, 1);
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.nextPageNumber, 2);
  assert.equal(result.exhausted, false);
}

for (const unsafeLink of [
  "https://attacker.invalid/api/v1/lei-records?page%5Bnumber%5D=2&page%5Bsize%5D=25",
  "http://api.gleif.org/api/v1/lei-records?page%5Bnumber%5D=2&page%5Bsize%5D=25",
  "https://api.gleif.org.evil.example/api/v1/lei-records?page%5Bnumber%5D=2&page%5Bsize%5D=25",
  "https://api.gleif.org/api/v1/other?page%5Bnumber%5D=2&page%5Bsize%5D=25",
  "https://api.gleif.org/api/v1/lei-records?page%5Bnumber%5D=8&page%5Bsize%5D=25"
]) {
  const client = createGleifAccessService({
    fetchImpl: async () => jsonResponse({ data: [validRecord], links: { next: unsafeLink } })
  });
  await assert.rejects(
    () => client.fetchPage(),
    error => error instanceof GleifAccessServiceError && error.code === "unsafe_pagination_link"
  );
}

{
  const client = createGleifAccessService({
    fetchImpl: async () => jsonResponse({ data: [validRecord] }, 429)
  });
  await assert.rejects(
    () => client.fetchPage(),
    error => error instanceof GleifAccessServiceError &&
      error.code === "upstream_http_error" && error.status === 429
  );
}

{
  const client = createGleifAccessService({
    fetchImpl: async () => new Response("not-json", { status: 200 })
  });
  await assert.rejects(
    () => client.fetchPage(),
    error => error instanceof GleifAccessServiceError && error.code === "invalid_json"
  );
}

{
  const client = createGleifAccessService({
    fetchImpl: async () => jsonResponse({ data: Array.from({ length: 26 }, () => validRecord) })
  });
  await assert.rejects(
    () => client.fetchPage(),
    error => error instanceof GleifAccessServiceError && error.code === "invalid_response"
  );
}

{
  const client = createGleifAccessService({
    fetchImpl: async () => { throw new Error("network detail must not leak"); }
  });
  await assert.rejects(
    () => client.fetchPage(),
    error => error instanceof GleifAccessServiceError &&
      error.code === "network_error" &&
      !error.message.includes("network detail")
  );
}

assert.throws(
  () => createGleifAccessService({ pageSize: 26 }),
  /pageSize must be an integer/
);
assert.throws(
  () => createGleifAccessService({ timeoutMs: 30_000 }),
  /timeoutMs must be between/
);
assert.throws(
  () => createGleifAccessService({}).collectPilot({ maxPages: 5 }),
  /maxPages must be an integer/
);
assert.throws(
  () => createGleifAccessService({}).collectPilot({ maxAcceptedRecords: 26 }),
  /maxAcceptedRecords must be an integer/
);

console.log("GLEIF Access Service tests passed: fixed official endpoint, bounded pagination, safe cursor validation, response validation, normalized projection, error redaction and pilot caps.");
