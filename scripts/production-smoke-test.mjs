import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const REQUEST_TIMEOUT_MS = 10_000;

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Set EXPORTFLOW_SMOKE_BASE_URL to a valid HTTPS origin.");
  }

  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error("The smoke-test base URL must use HTTPS (HTTP is allowed only for localhost).");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Use an origin only, without credentials, path, query or fragment.");
  }
  return url.origin;
}

export async function runProductionSmoke({
  baseUrl,
  fetchImpl = globalThis.fetch,
  log = () => {},
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A Fetch-compatible function is required.");
  const origin = normalizeBaseUrl(baseUrl);
  const results = [];

  async function check(label, callback) {
    try {
      await callback();
      results.push({ label, passed: true });
      log(`PASS ${label}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unexpected_error";
      results.push({ label, passed: false, reason });
      log(`FAIL ${label}: ${reason}`);
    }
  }

  async function request(path, init = {}) {
    try {
      return await fetchImpl(new URL(path, origin), {
        ...init,
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { "User-Agent": "ExportFlowSmokeBot/1.0", ...(init.headers || {}) },
      });
    } catch {
      throw new Error("network_error_or_timeout");
    }
  }

  async function readJson(response) {
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      throw new Error("expected_json_content_type");
    }
    try {
      return await response.json();
    } catch {
      throw new Error("invalid_json_response");
    }
  }

  async function getJson(path) {
    const response = await request(path);
    if (!response.ok) throw new Error(`http_${response.status}`);
    return readJson(response);
  }

  async function getHtml(path) {
    const response = await request(path);
    if (!response.ok) throw new Error(`http_${response.status}`);
    if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
      throw new Error("expected_html_content_type");
    }
    return response.text();
  }

  await check("homepage catalog disclosures", async () => {
    const html = await getHtml("/");
    if (!html.includes('data-i18n="supportedCarriersHeading">CARRIER CATALOG')) {
      throw new Error("carrier_catalog_label_missing");
    }
    if (!html.includes('data-i18n="illustrativeRouteLabel">ILLUSTRATIVE ROUTE · NOT LIVE SHIPMENT DATA')) {
      throw new Error("illustrative_route_disclosure_missing");
    }
    if (/ACTIVE NETWORK SCANS|OVER 1,300\+ COURIERS|SUPPORTED GLOBAL &amp; REGIONAL CARRIERS|98\.4%/i.test(html)) {
      throw new Error("unverified_homepage_claim_found");
    }
    if (/ticker-live-dot|chip-status-dot/.test(html)) {
      throw new Error("unverified_live_status_indicator_found");
    }
    if (!html.includes('<link rel="canonical" href="https://exportflow.me/">')) {
      throw new Error("homepage_canonical_missing");
    }
  });

  await check("Arabic RTL route", async () => {
    const html = await getHtml("/ar/");
    if (!/<html[^>]*lang="ar"[^>]*dir="rtl"/i.test(html)) throw new Error("arabic_rtl_document_missing");
  });

  await check("Bengali locale route", async () => {
    const html = await getHtml("/bn/");
    if (!/<html[^>]*lang="bn"[^>]*dir="ltr"/i.test(html)) throw new Error("bengali_document_missing");
  });

  await check("API liveness", async () => {
    const data = await getJson("/api/health");
    if (data.ok !== true || data.service !== "exportflow-tracking-api") {
      throw new Error("unexpected_liveness_payload");
    }
  });

  await check("carrier catalog disclosure", async () => {
    const data = await getJson("/api/carriers");
    if (!Array.isArray(data.carriers) || !Array.isArray(data.carrierRecords) ||
        !Number.isInteger(data.catalogEntries) ||
        !String(data.metadataNotice || "").includes("not a live availability check")) {
      throw new Error("unexpected_carrier_catalog_payload");
    }
  });

  await check("country coverage directory", async () => {
    const data = await getJson("/api/coverage");
    if (data.source !== "installed-universal-parcel-scraper-catalog" ||
        data.summary?.allCountries !== 249 ||
        !Array.isArray(data.countries) || data.countries.length !== 249) {
      throw new Error("unexpected_coverage_payload");
    }
  });

  await check("OpenAPI 3.1 contract", async () => {
    const data = await getJson("/api/openapi");
    if (data.openapi !== "3.1.0" || !data.paths?.["/api/track"] ||
        !data.paths?.["/api/batch-track"] || !data.paths?.["/api/mcp"]) {
      throw new Error("unexpected_openapi_contract");
    }
  });

  await check("invalid tracking input rejected before carrier lookup", async () => {
    const response = await request("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ number: "x" }),
    });
    if (response.status !== 400) throw new Error(`expected_400_received_${response.status}`);
    const data = await readJson(response);
    if (data.error !== "invalid_tracking_number") throw new Error("unexpected_tracking_validation_error");
  });

  await check("invalid batch rejected before carrier lookup", async () => {
    const response = await request("/api/batch-track", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ shipments: [] }),
    });
    if (response.status !== 400) throw new Error(`expected_400_received_${response.status}`);
    const data = await readJson(response);
    if (data.error !== "invalid_batch_size") throw new Error("unexpected_batch_validation_error");
  });

  return {
    passed: results.filter(result => result.passed).length,
    failed: results.filter(result => !result.passed).length,
    results,
  };
}

const isDirectExecution = process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  const baseUrl = process.env.EXPORTFLOW_SMOKE_BASE_URL || process.argv[2];
  if (!baseUrl) {
    console.error("Set EXPORTFLOW_SMOKE_BASE_URL or pass an HTTPS origin, for example https://exportflow.me.");
    process.exitCode = 2;
  } else {
    const result = await runProductionSmoke({ baseUrl, log: console.log });
    console.log(`Production smoke checks: ${result.passed} passed, ${result.failed} failed.`);
    if (result.failed > 0) process.exitCode = 1;
  }
}
