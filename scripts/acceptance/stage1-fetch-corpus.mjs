import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSuccessfulFetchTask } from "./fetch-assertions.mjs";

const CORPUS_PATH = new URL("../../tests/fixtures/stage1-fetch-corpus.v1.json", import.meta.url);
const CORPUS = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));

const ACCOUNT_ID = "435030befbb9df09ab76f69209c05347";
const DATABASE = "exportflow-tenant-acceptance-20261122";
const DATABASE_ID = "1f94eee0-219e-4a41-86ce-49c29067ef06";
const PLATFORM_WORKER = "exportflow-task-platform-acceptance-20261124";
const MCP_WORKER = "exportflow-task-mcp-acceptance-20261124";
const PLATFORM_URL = "https://exportflow-task-platform-acceptance-20261124.hhameranede.workers.dev";
const MCP_URL = "https://exportflow-task-mcp-acceptance-20261124.hhameranede.workers.dev/mcp";
const CONFIG = "cloudflare/task-acceptance/platform.wrangler.toml";
const MCP_CONFIG = "cloudflare/task-acceptance/mcp.wrangler.toml";
const TERMINAL_STATES = new Set(["succeeded", "partial", "failed", "cancelled", "expired", "unsupported"]);
const RUN_ID = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14) + "_" + randomBytes(5).toString("hex");
const PLAN_CODE = "qa_stage1_fetch_" + RUN_ID;
const TENANT_ID = "qa_stage1_fetch_" + RUN_ID;
const KEY_ID = randomBytes(12).toString("base64url");
const API_TOKEN = "ef_live_" + KEY_ID + "_" + randomBytes(32).toString("base64url");
const KEY_HASH = createHash("sha256").update("exportflow-api-key-v1:" + API_TOKEN).digest("hex");

export const ACCEPTANCE_WORKER_PINS = Object.freeze({
  [PLATFORM_WORKER]: Object.freeze({
    versionId: "af14c8d6-983e-4f4e-86b5-4bcd9e472f24",
    versionNumber: 35,
    scriptEtag: "61f9b00fdd0a886209549a68a0abaffb536e8b7e892b7114ca079d12b7ffdb76",
    bindings: Object.freeze({
      EXPORTFLOW_ACCEPTANCE_RUN: Object.freeze({ type: "plain_text", text: "durable-task-20261124" }),
      EXPORTFLOW_AUTH_DB: Object.freeze({ type: "d1", database_id: DATABASE_ID }),
      TENANT_BURST_LIMITER: Object.freeze({
        type: "durable_object_namespace",
        namespace_id: "270bb3e75d254ddcac7e1dce8ab5201e",
        class_name: "TenantBurstRateLimiter",
      }),
    }),
  }),
  [MCP_WORKER]: Object.freeze({
    versionId: "579787e1-d3e1-4e8c-aee8-01f5e41b3eff",
    versionNumber: 35,
    scriptEtag: "4f5eb6814fd18060c7b9385e70bcb4e8855ea5b90d17214085e282a57272996c",
    bindings: Object.freeze({
      EXPORTFLOW_AUTH_DB: Object.freeze({ type: "d1", database_id: DATABASE_ID }),
      MCP_RATE_LIMITER: Object.freeze({
        type: "ratelimit",
        namespace_id: "91420018",
        simple: Object.freeze({ limit: 30, period: 60 }),
      }),
      TENANT_BURST_LIMITER: Object.freeze({
        type: "durable_object_namespace",
        namespace_id: "270bb3e75d254ddcac7e1dce8ab5201e",
        class_name: "TenantBurstRateLimiter",
        script_name: PLATFORM_WORKER,
      }),
    }),
  }),
});
const REST_MIN_REQUEST_INTERVAL_MS = 2_500;
const MCP_MIN_REQUEST_INTERVAL_MS = 2_500;
const MCP_RATE_LIMIT_RETRY_DELAYS_MS = [20_000, 40_000];
let lastRestRequestAt = 0;
let lastMcpRequestAt = 0;

export function getRequestIntervalWaitMs(lastRequestAt, now, minimumIntervalMs) {
  return Math.max(0, minimumIntervalMs - (now - lastRequestAt));
}

async function waitForRestRequestSlot() {
  const waitMs = getRequestIntervalWaitMs(
    lastRestRequestAt,
    Date.now(),
    REST_MIN_REQUEST_INTERVAL_MS,
  );
  if (waitMs > 0) await sleep(waitMs);
  lastRestRequestAt = Date.now();
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function assertAcceptanceEndpointsArePinned({
  platformUrl = PLATFORM_URL,
  mcpUrl = MCP_URL,
} = {}) {
  const platform = new URL(platformUrl);
  const mcp = new URL(mcpUrl);
  if (
    platform.origin !== PLATFORM_URL ||
    platform.pathname !== "/" ||
    mcp.origin !== new URL(MCP_URL).origin ||
    mcp.pathname !== "/mcp" ||
    platform.hostname === "exportflow.me" ||
    mcp.hostname === "mcp.exportflow.me"
  ) {
    throw new Error("Stage 1 runner accepts only the dedicated Task Acceptance Workers.");
  }
  return true;
}

export function assertPinnedAcceptanceConfigs() {
  const platformConfig = readFileSync(new URL("../../" + CONFIG, import.meta.url), "utf8");
  const mcpConfig = readFileSync(new URL("../../" + MCP_CONFIG, import.meta.url), "utf8");
  for (const [name, content] of [[CONFIG, platformConfig], [MCP_CONFIG, mcpConfig]]) {
    assert.ok(content.includes('database_name = "' + DATABASE + '"'), name + " must pin the Acceptance D1 database name.");
    assert.ok(content.includes('database_id = "' + DATABASE_ID + '"'), name + " must pin the Acceptance D1 database ID.");
    assert.ok(content.includes('compatibility_flags = ["global_fetch_strictly_public"]'), name + " must retain public-only global fetch.");
    assert.ok(!content.includes("535fce81-b961-4097-b83f-c87e56c390bb"), name + " must not reference Production tenant D1.");
    assert.ok(!content.includes("0bd9f873-a1d5-4d90-b3fc-1c4b47e1aa67"), name + " must not reference Production Auth D1.");
    assert.ok(!content.includes("exportflow-platform"), name + " must not target the Production Platform Worker.");
  }
  assert.ok(platformConfig.includes('name = "' + PLATFORM_WORKER + '"'));
  assert.ok(mcpConfig.includes('name = "' + MCP_WORKER + '"'));
  assert.ok(platformConfig.includes('binding = "EXPORTFLOW_AUTH_DB"'));
  assert.ok(mcpConfig.includes('binding = "EXPORTFLOW_AUTH_DB"'));
  return true;
}

export function assertExpectedResponseCharset(contentType, expectedCharset, label = "response") {
  if (!expectedCharset) return null;
  const match = /(?:^|;)\s*charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i.exec(String(contentType || ""));
  assert.ok(match, label + " did not declare the expected charset in Content-Type.");
  const actualCharset = (match[1] || match[2] || match[3]).trim();
  const normalize = (value) => value.trim().toLowerCase().replaceAll("_", "-");
  assert.equal(normalize(actualCharset), normalize(expectedCharset),
    label + " declared charset " + actualCharset + ", expected " + expectedCharset + ".");
  return actualCharset;
}

export function isMcpRateLimitedResponse(body) {
  return body?.result?.isError === true &&
    body.result?.structuredContent?.error === "rate_limited";
}

export function assertPinnedAcceptanceWorkerState({ workerName, deployments, version } = {}) {
  const pin = ACCEPTANCE_WORKER_PINS[workerName];
  assert.ok(pin, "Worker is not in the reviewed Acceptance version allowlist.");
  assert.ok(Array.isArray(deployments) && deployments.length > 0, workerName + " has no readable deployment inventory.");
  const latestDeployment = [...deployments].sort((a, b) =>
    Date.parse(b.created_on || 0) - Date.parse(a.created_on || 0),
  )[0];
  assert.equal(latestDeployment.strategy, "percentage", workerName + " must use percentage deployment routing.");
  assert.ok(Array.isArray(latestDeployment.versions), workerName + " deployment has no version allocation.");
  assert.equal(latestDeployment.versions.length, 1, workerName + " must route to exactly one version.");
  assert.equal(latestDeployment.versions[0].version_id, pin.versionId, workerName + " active version drifted from the reviewed pin.");
  assert.equal(latestDeployment.versions[0].percentage, 100, workerName + " must route 100% to the reviewed version.");

  assert.equal(version?.id, pin.versionId, workerName + " version detail ID does not match the reviewed pin.");
  assert.equal(version?.number, pin.versionNumber, workerName + " version number does not match the reviewed pin.");
  assert.equal(version?.resources?.script?.etag, pin.scriptEtag, workerName + " Worker script ETag changed.");
  const flags = version?.resources?.script_runtime?.compatibility_flags || [];
  assert.ok(flags.includes("global_fetch_strictly_public"), workerName + " must retain public-only global Fetch.");
  const bindings = version?.resources?.bindings || [];
  const expectedNames = Object.keys(pin.bindings).sort();
  assert.deepEqual(bindings.map((binding) => binding.name).sort(), expectedNames,
    workerName + " binding inventory differs from the reviewed allowlist.");
  for (const [name, expected] of Object.entries(pin.bindings)) {
    const observed = bindings.find((binding) => binding.name === name);
    for (const [property, value] of Object.entries(expected)) {
      const actual = property === "database_id" ? (observed?.database_id || observed?.id) : observed?.[property];
      assert.deepEqual(actual, value, workerName + " binding " + name + " has unexpected " + property + ".");
    }
  }
  assert.ok(!bindings.some((binding) => ["vpc_network", "vpc_service"].includes(binding.type)),
    workerName + " must not add private-network bindings.");
  return {
    workerName,
    versionId: pin.versionId,
    versionNumber: pin.versionNumber,
    scriptEtag: pin.scriptEtag,
    trafficPercent: 100,
    databaseId: DATABASE_ID,
    bindingNames: expectedNames,
  };
}

function sql(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function execAcceptanceD1(sqlText) {
  const directory = mkdtempSync(join(tmpdir(), "exportflow-stage1-acceptance-"));
  const file = join(directory, "query.sql");
  writeFileSync(file, sqlText, "utf8");
  try {
    const env = {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
    };
    const result = spawnSync("npx", [
      "--yes", "wrangler@4", "d1", "execute", DATABASE,
      "--remote", "--file", file, "--config", CONFIG, "--yes",
    ], {
      encoding: "utf8",
      env,
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
      const detail = (result.stderr || result.stdout || result.error?.message || "unknown Wrangler failure").slice(-1800);
      throw new Error("Dedicated Stage 1 Acceptance D1 operation failed: " + detail);
    }
    return result.stdout || "";
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function seed() {
  const now = new Date().toISOString();
  const scopes = ["tasks:fetch", "tasks:read"];
  const statements = [
    "INSERT INTO plan_policies (plan_code, quota_period, request_limit, policy_version, status, created_at, updated_at) VALUES (" +
      [sql(PLAN_CODE), sql("daily"), "40", sql("stage1-fetch-corpus-v1"), sql("active"), sql(now), sql(now)].join(", ") +
      ") ON CONFLICT(plan_code) DO NOTHING;",
    "INSERT INTO tenants (tenant_id, plan_code, status, created_at, updated_at) VALUES (" +
      [sql(TENANT_ID), sql(PLAN_CODE), sql("active"), sql(now), sql(now)].join(", ") +
      ") ON CONFLICT(tenant_id) DO NOTHING;",
    "INSERT INTO api_keys (key_id, tenant_id, key_hash, status, scopes_json, expires_at, created_at) VALUES (" +
      [sql(KEY_ID), sql(TENANT_ID), sql(KEY_HASH), sql("active"), sql(JSON.stringify(scopes)), "NULL", sql(now)].join(", ") +
      ") ON CONFLICT(key_id) DO NOTHING;",
  ];
  execAcceptanceD1(statements.join("\n"));
  console.log("Created one run-scoped Stage 1 Acceptance tenant and API key; token withheld.");
}

function cleanup() {
  const statements = [
    "DELETE FROM tasks WHERE tenant_id = " + sql(TENANT_ID) + ";",
    "DELETE FROM tenant_request_usage WHERE tenant_id = " + sql(TENANT_ID) + ";",
    "DELETE FROM api_keys WHERE key_id = " + sql(KEY_ID) + ";",
    "DELETE FROM tenants WHERE tenant_id = " + sql(TENANT_ID) + ";",
    "DELETE FROM plan_policies WHERE plan_code = " + sql(PLAN_CODE) + ";",
  ];
  execAcceptanceD1(statements.join("\n"));
  console.log("Cleaned only this Stage 1 run's Tasks, usage, API key, tenant and plan.");
}

async function readJson(response, label) {
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(label + " returned non-JSON HTTP " + response.status + ".");
  }
  return { response, body };
}

async function cloudflareApiGet(path) {
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  assert.ok(token, "Set CLOUDFLARE_API_TOKEN or CF_API_TOKEN with Workers Scripts Read permission for the read-only Acceptance version preflight.");
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method: "GET",
    headers: {
      authorization: "Bearer " + token,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  const { body } = await readJson(response, "Cloudflare read-only Worker version preflight");
  assert.equal(response.status, 200, "Cloudflare version preflight returned HTTP " + response.status + ".");
  assert.equal(body?.success, true, "Cloudflare version preflight API returned success=false.");
  return body.result;
}

function deploymentRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.deployments)) return payload.deployments;
  if (Array.isArray(payload?.result?.deployments)) return payload.result.deployments;
  return [];
}

async function assertPinnedAcceptanceWorkerVersions() {
  const summaries = [];
  for (const workerName of [PLATFORM_WORKER, MCP_WORKER]) {
    const encodedName = encodeURIComponent(workerName);
    const [deploymentPayload, versionPayload] = await Promise.all([
      cloudflareApiGet("/accounts/" + ACCOUNT_ID + "/workers/scripts/" + encodedName + "/deployments?per_page=10"),
      cloudflareApiGet("/accounts/" + ACCOUNT_ID + "/workers/scripts/" + encodedName + "/versions/" + ACCEPTANCE_WORKER_PINS[workerName].versionId),
    ]);
    const version = versionPayload?.result || versionPayload?.version || versionPayload;
    summaries.push(assertPinnedAcceptanceWorkerState({
      workerName,
      deployments: deploymentRows(deploymentPayload),
      version,
    }));
  }
  return summaries;
}

async function restPost(url, idempotencyKey) {
  await waitForRestRequestSlot();
  return readJson(await fetch(PLATFORM_URL + "/api/v1/tasks", {
    method: "POST",
    headers: {
      authorization: "Bearer " + API_TOKEN,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      accept: "application/json",
    },
    body: JSON.stringify({
      goal: "P0 Stage 1 live Fetch corpus probe",
      operation: "fetch",
      url,
    }),
    signal: AbortSignal.timeout(30_000),
  }), "REST task submission");
}

async function restGet(taskId) {
  await waitForRestRequestSlot();
  return readJson(await fetch(PLATFORM_URL + "/api/v1/tasks/" + encodeURIComponent(taskId), {
    headers: { authorization: "Bearer " + API_TOKEN, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  }), "REST task status");
}

async function waitForRestTask(taskId) {
  const deadline = Date.now() + 45_000;
  let latest;
  do {
    latest = await restGet(taskId);
    assert.equal(latest.response.status, 200, "Acceptance Task status must be readable.");
    if (TERMINAL_STATES.has(latest.body?.state)) return latest.body;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  throw new Error("REST Task did not reach a terminal state within 45 seconds.");
}

async function mcpCall(id, name, args) {
  for (let attempt = 0; attempt <= MCP_RATE_LIMIT_RETRY_DELAYS_MS.length; attempt += 1) {
    const waitMs = MCP_MIN_REQUEST_INTERVAL_MS - (Date.now() - lastMcpRequestAt);
    if (waitMs > 0) await sleep(waitMs);
    lastMcpRequestAt = Date.now();
    const result = await readJson(await fetch(MCP_URL, {
      method: "POST",
      headers: {
        authorization: "Bearer " + API_TOKEN,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      }),
      signal: AbortSignal.timeout(30_000),
    }), "MCP " + name);
    if (!isMcpRateLimitedResponse(result.body)) return result;
    if (attempt === MCP_RATE_LIMIT_RETRY_DELAYS_MS.length) {
      throw new Error("MCP rate limit persisted after bounded retries for " + name + ".");
    }
    const delay = MCP_RATE_LIMIT_RETRY_DELAYS_MS[attempt];
    console.warn("MCP rate limit reached for " + name + "; retrying after " + delay + " ms.");
    await sleep(delay);
  }
  throw new Error("MCP request retry loop ended unexpectedly.");
}

async function waitForMcpTask(task) {
  let latest = task;
  const deadline = Date.now() + 120_000;
  let pollDelayMs = 2_000;
  while (!TERMINAL_STATES.has(latest?.state) && Date.now() < deadline) {
    const status = await mcpCall("status-" + Date.now(), "web_task_status", { taskId: latest.id });
    assert.equal(status.response.status, 200, "MCP Task status must be readable.");
    const toolResult = status.body.result;
    assert.equal(toolResult?.isError || false, false,
      "MCP Task status returned a tool error: " + JSON.stringify(toolResult?.structuredContent || {}).slice(0, 500));
    latest = toolResult?.structuredContent;
    if (!TERMINAL_STATES.has(latest?.state)) {
      await sleep(pollDelayMs);
      pollDelayMs = Math.min(8_000, Math.ceil(pollDelayMs * 1.5));
    }
  }
  assert.ok(TERMINAL_STATES.has(latest?.state), "MCP Task did not reach a terminal state within the bounded polling window.");
  return latest;
}

function taskFromRestSubmission(result, label) {
  assert.ok([200, 202].includes(result.response.status), label + " returned HTTP " + result.response.status + ": " + JSON.stringify(result.body.error || result.body).slice(0, 600));
  assert.ok(typeof result.body?.id === "string", label + " did not return a Task record.");
  return result.body;
}

function assertSuccessfulCorpusTask(task, target, transport) {
  const proof = assertSuccessfulFetchTask({
    transport,
    httpStatus: 200,
    task,
    expectedContent: target.expectedBodyContains,
    expectedHost: target.expectedHost,
  });
  const data = task.result.data;
  assert.equal(data.httpStatus, target.expectedHttpStatus, target.id + " upstream HTTP status");
  assert.ok(
    typeof data.contentType === "string" &&
    data.contentType.toLowerCase().startsWith(target.expectedContentTypePrefix),
    target.id + " content type was " + String(data.contentType),
  );
  const actualCharset = assertExpectedResponseCharset(data.contentType, target.expectedCharset, target.id);
  assert.ok(
    typeof data.body === "string" &&
    data.body.includes(target.expectedBodyContains),
    target.id + " expected body content was not decoded.",
  );
  const finalUrl = new URL(data.finalUrl);
  assert.equal(finalUrl.hostname, target.expectedHost, target.id + " final URL host");
  if (target.expectedFinalPath) assert.equal(finalUrl.pathname, target.expectedFinalPath, target.id + " final path");
  if (target.minimumRedirects) assert.ok((data.redirects || []).length >= target.minimumRedirects, target.id + " redirect chain length");
  return {
    id: target.id,
    transport,
    state: task.state,
    httpStatus: data.httpStatus,
    contentType: data.contentType,
    bytes: data.bytes,
    finalUrlHost: finalUrl.hostname,
    redirectCount: (data.redirects || []).length,
    sourceCount: proof.sourceCount,
    decodedSnippetVerified: true,
    ...(actualCharset ? { charset: actualCharset } : {}),
  };
}

function assertExpectedHttpError(task, target, transport) {
  assert.equal(task?.state, "failed", target.id + " should yield a failed Task.");
  assert.equal(task?.result?.status, "failed", target.id + " result should be failed.");
  assert.equal(task?.result?.data?.httpStatus, target.expectedHttpStatus, target.id + " must preserve the upstream HTTP status.");
  return {
    id: target.id,
    transport,
    state: task.state,
    httpStatus: task.result.data.httpStatus,
    errorCode: task.result.data.errorCode || null,
    preservedUpstreamStatus: true,
  };
}

async function runRestTarget(target) {
  const submission = await restPost(target.url, "stage1-" + RUN_ID + "-" + target.id + "-rest");
  const accepted = taskFromRestSubmission(submission, target.id + " REST");
  const task = await waitForRestTask(accepted.id);
  if (target.expectedTaskState === "failed") return assertExpectedHttpError(task, target, "REST");
  return assertSuccessfulCorpusTask(task, target, "REST");
}

async function runMcpTarget(target) {
  const response = await mcpCall("fetch-" + target.id, "web_fetch", {
    url: target.url,
    idempotencyKey: "stage1-" + RUN_ID + "-" + target.id + "-mcp",
  });
  assert.equal(response.response.status, 200, target.id + " MCP transport HTTP status");
  assert.equal(response.body.result?.isError || false, false, target.id + " MCP tool returned an error.");
  const accepted = response.body.result?.structuredContent;
  assert.ok(typeof accepted?.id === "string", target.id + " MCP response did not include a Task.");
  const task = await waitForMcpTask(accepted);
  if (target.expectedTaskState === "failed") return assertExpectedHttpError(task, target, "MCP");
  return assertSuccessfulCorpusTask(task, target, "MCP");
}

async function assertDirectPrivateUrlRejected() {
  const result = await restPost("http://127.0.0.1/", "stage1-" + RUN_ID + "-direct-loopback");
  assert.equal(result.response.status, 400, "Direct loopback URL must be rejected before Task creation.");
  assert.equal(result.body.error?.code, "URL_NOT_ALLOWED", "Direct loopback rejection must expose the safe URL policy code.");
  return { id: "direct-loopback", rejectedBeforeTaskCreation: true, errorCode: result.body.error.code };
}

async function assertPrivateRedirectRejected() {
  const target = CORPUS.negativeCases.find((entry) => entry.id === "redirect-to-loopback");
  const submission = await restPost(target.url, "stage1-" + RUN_ID + "-redirect-loopback");
  const accepted = taskFromRestSubmission(submission, "Redirect-to-loopback REST");
  const task = await waitForRestTask(accepted.id);
  const codes = (task.errors || []).map((error) => error.code).filter((code) => typeof code === "string");
  const diagnostic = {
    state: task.state,
    errorCodes: codes,
    resultErrorCode: task.result?.data?.errorCode || null,
    resultStatus: task.result?.status || null,
    upstreamStatus: task.result?.data?.httpStatus || task.result?.data?.status || null,
    eventTypes: (task.events || []).map((entry) => entry.type).filter((type) => typeof type === "string"),
    eventReasons: (task.events || []).map((entry) => entry.reason).filter((reason) => typeof reason === "string"),
  };
  assert.equal(task.state, "failed", "Redirect to loopback must fail closed: " + JSON.stringify(diagnostic));
  assert.ok(
    codes.includes(target.expectedTaskErrorCode) || task.result?.data?.errorCode === target.expectedTaskErrorCode,
    "Redirect rejection did not report " + target.expectedTaskErrorCode + "; observed " + JSON.stringify(diagnostic),
  );
  return {
    id: target.id,
    rejected: true,
    errorCode: target.expectedTaskErrorCode,
    taskState: task.state,
  };
}

async function runLiveAcceptance() {
  assert.equal((await fetch(PLATFORM_URL + "/api/v1/health", { signal: AbortSignal.timeout(15_000) })).status, 200);
  assert.equal((await fetch(MCP_URL.replace(/\/mcp$/, "") + "/health", { signal: AbortSignal.timeout(15_000) })).status, 200);

  const results = [];
  for (const target of CORPUS.liveFetch) {
    const targetResults = [await runRestTarget(target)];
    if (target.mcp !== false) targetResults.push(await runMcpTarget(target));
    results.push(...targetResults);
    console.log("Stage 1 target: " + JSON.stringify(targetResults));
  }

  const security = [];
  security.push(await assertDirectPrivateUrlRejected());
  security.push(await assertPrivateRedirectRejected());
  console.log("Stage 1 security checks: " + JSON.stringify(security));
  console.log("Stage 1 live Acceptance completed: " + JSON.stringify({
    corpusVersion: CORPUS.version,
    runId: RUN_ID,
    liveTargets: CORPUS.liveFetch.length,
    transportChecks: results.length,
    results,
    security,
    productionTouched: false,
  }));
}

async function main() {
  assertAcceptanceEndpointsArePinned();
  assertPinnedAcceptanceConfigs();
  const deployedVersions = await assertPinnedAcceptanceWorkerVersions();
  console.log("Read-only Acceptance Worker version preflight PASSED: " + JSON.stringify(deployedVersions));
  console.log("Pinned target: " + JSON.stringify({
    platform: PLATFORM_URL,
    mcp: MCP_URL,
    database: DATABASE,
    databaseId: DATABASE_ID,
    accountId: ACCOUNT_ID,
    runId: RUN_ID,
  }));
  let seedAttempted = false;
  try {
    seedAttempted = true;
    seed();
    await runLiveAcceptance();
  } finally {
    // Do not issue any D1 write if a read-only preflight failed before seed began.
    // Once seed is attempted, cleanup also covers a partially completed seed.
    if (seedAttempted) cleanup();
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Stage 1 live Acceptance FAILED: " + String(error?.stack || error));
    process.exitCode = 1;
  });
}
