import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STAGE2_CASES, assertStage2Task } from "./stage2-contract.mjs";

const DATABASE = "exportflow-tenant-acceptance-20261122";
const CONFIG = "cloudflare/task-acceptance/platform.wrangler.toml";
const PLATFORM_URL = "https://exportflow-task-platform-acceptance-20261124.hhameranede.workers.dev";
const MCP_URL = "https://exportflow-task-mcp-acceptance-20261124.hhameranede.workers.dev/mcp";
const RAW_RUN_ID = String(process.env.GITHUB_RUN_ID || "");
const RUN_ATTEMPT = String(process.env.GITHUB_RUN_ATTEMPT || "1");
const RUN_ID = (RAW_RUN_ID + "_" + RUN_ATTEMPT).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
const PLAN_CODE = "qa_s2_plan_" + RUN_ID;
const TENANT_ID = "qa_s2_tenant_" + RUN_ID;
const KEY_ID_LENGTH = 16;
const DAILY_QUOTA = 20;
const EXPECTED_TASKS = STAGE2_CASES.length * 2;

function requireRunId() {
  assert.ok(/^\d+_\d+$/.test(RUN_ID), "GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT are required.");
}

function sql(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function execD1(sqlText) {
  const directory = mkdtempSync(join(tmpdir(), "exportflow-stage2-acceptance-"));
  const file = join(directory, "stage2.sql");
  writeFileSync(file, sqlText, "utf8");
  try {
    const result = spawnSync("npx", [
      "--yes", "wrangler@4", "d1", "execute", DATABASE,
      "--remote", "--file", file, "--config", CONFIG, "--yes",
    ], {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
      const detail = (result.stderr || result.stdout || result.error?.message || "unknown Wrangler failure").slice(-1800);
      throw new Error("Stage 2 isolated Acceptance D1 operation failed: " + detail);
    }
    return result.stdout || "";
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function newApiKey() {
  const keyId = randomBytes(12).toString("base64url");
  assert.equal(keyId.length, KEY_ID_LENGTH);
  const secret = randomBytes(32).toString("base64url");
  const token = "ef_live_" + keyId + "_" + secret;
  const keyHash = createHash("sha256")
    .update("exportflow-api-key-v1:" + token)
    .digest("hex");
  return { keyId, token, keyHash };
}

function writeGithubEnv(name, value) {
  const path = process.env.GITHUB_ENV;
  assert.ok(path, "GITHUB_ENV is required for the Acceptance workflow.");
  assert.ok(!/[\r\n]/.test(value), "Environment values must not contain newlines.");
  if (process.env.GITHUB_ACTIONS === "true" && name.endsWith("_TOKEN")) {
    process.stdout.write("::add-mask::" + value + "\n");
  }
  appendFileSync(path, name + "=" + value + "\n", "utf8");
}

async function seed() {
  requireRunId();
  assert.ok(process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN,
    "Cloudflare D1 write credentials are required only in the isolated Acceptance runner.");

  const token = newApiKey();
  const now = new Date().toISOString();
  const scopes = [
    "tasks:fetch",
    "tasks:map",
    "tasks:crawl",
    "tasks:extract",
    "tasks:search",
    "tasks:research",
    "tasks:read",
  ];
  const statements = [
    "INSERT INTO plan_policies (plan_code, quota_period, request_limit, policy_version, status, created_at, updated_at) VALUES (" +
      [sql(PLAN_CODE), sql("daily"), String(DAILY_QUOTA), sql("p0-stage2-six-operations-v1"), sql("active"), sql(now), sql(now)].join(", ") +
      ");",
    "INSERT INTO tenants (tenant_id, plan_code, status, created_at, updated_at) VALUES (" +
      [sql(TENANT_ID), sql(PLAN_CODE), sql("active"), sql(now), sql(now)].join(", ") +
      ");",
    "INSERT INTO api_keys (key_id, tenant_id, key_hash, status, scopes_json, expires_at, created_at) VALUES (" +
      [sql(token.keyId), sql(TENANT_ID), sql(token.keyHash), sql("active"), sql(JSON.stringify(scopes)), sql(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()), sql(now)].join(", ") +
      ");",
  ];
  execD1(statements.join("\n"));
  writeGithubEnv("EF_STAGE2_API_TOKEN", token.token);
  console.log("Seeded one run-scoped Acceptance plan, tenant and short-lived API key; credential value is masked.");
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

function terminal(state) {
  return ["succeeded", "partial", "failed", "cancelled", "expired", "unsupported"].includes(state);
}

async function restGet(token, taskId) {
  const response = await fetch(PLATFORM_URL + "/api/v1/tasks/" + encodeURIComponent(taskId), {
    headers: { authorization: "Bearer " + token, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  return readJson(response, "REST Task status");
}

async function waitForTask(token, taskId, label) {
  const deadline = Date.now() + 90_000;
  let latest;
  do {
    latest = await restGet(token, taskId);
    assert.equal(latest.response.status, 200,
      label + " status must be readable by its owning tenant (HTTP " + latest.response.status + ").");
    assert.equal(latest.body.id, taskId, label + " status must return the requested Task.");
    if (terminal(latest.body.state)) return latest.body;
    await new Promise((resolve) => setTimeout(resolve, 300));
  } while (Date.now() < deadline);
  throw new Error(label + " did not reach a terminal state within 90 seconds.");
}

async function restSubmit(token, spec) {
  const idempotencyKey = "s2-rest-" + RUN_ID.slice(-32) + "-" + spec.operation;
  const response = await fetch(PLATFORM_URL + "/api/v1/tasks", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      accept: "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      goal: spec.goal,
      operation: spec.operation,
      ...spec.input,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await readJson(response, "REST " + spec.operation + " submission");
  assert.ok([200, 202].includes(response.status),
    "REST " + spec.operation + " submission returned HTTP " + response.status + ": " +
    JSON.stringify(result.body.error || result.body).slice(0, 500));
  assert.ok(typeof result.body?.id === "string", "REST " + spec.operation + " must return a durable Task ID.");
  return result.body;
}

async function mcpCall(token, id, name, args = {}) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
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
    signal: AbortSignal.timeout(45_000),
  });
  return readJson(response, "MCP " + name);
}

async function assertMcpReady() {
  const health = await fetch(MCP_URL.replace(/\/mcp$/, "/health"), {
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(health.status, 200, "Existing Task MCP Acceptance Worker must be healthy.");
  const healthBody = await health.json();
  assert.equal(healthBody.status, "ok");

  const initResponse = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-11-25",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "exportflow-p0-stage2-acceptance", version: "1.0.0" },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const init = await readJson(initResponse, "MCP initialize");
  assert.equal(initResponse.status, 200);
  assert.equal(init.body.result?.serverInfo?.name, "ExportFlow");

  const list = await mcpCallWithoutAuth(2, "tools/list", {});
  const toolNames = list.body.result?.tools?.map((tool) => tool.name) || [];
  for (const name of ["web_fetch", "web_map", "web_crawl", "web_extract", "web_search", "web_research", "web_task_status"]) {
    assert.ok(toolNames.includes(name), "MCP tools/list is missing " + name + ".");
  }
  return toolNames;
}

async function mcpCallWithoutAuth(id, method, params) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  return readJson(response, "MCP " + method);
}

async function smoke() {
  requireRunId();
  const token = process.env.EF_STAGE2_API_TOKEN;
  assert.ok(token, "The run-scoped Stage 2 API key is missing.");

  const platformHealth = await fetch(PLATFORM_URL + "/api/v1/health", {
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(platformHealth.status, 200, "Existing Task Platform Acceptance Worker must be healthy.");
  assert.equal((await platformHealth.json()).status, "ok");
  const listedTools = await assertMcpReady();

  const proofs = [];
  const restTasks = new Map();
  for (const [index, spec] of STAGE2_CASES.entries()) {
    const submitted = await restSubmit(token, spec);
    const task = await waitForTask(token, submitted.id, "REST " + spec.operation);
    proofs.push(assertStage2Task(spec.operation, task, "REST"));
    restTasks.set(spec.operation, task);
    console.log("REST Stage 2 proof: " + JSON.stringify(proofs[proofs.length - 1]));
  }

  let lastMcpTask = null;
  for (const [index, spec] of STAGE2_CASES.entries()) {
    const args = {
      ...spec.input,
      idempotencyKey: "s2-mcp-" + RUN_ID.slice(-32) + "-" + spec.operation,
    };
    const result = await mcpCall(token, index + 10, spec.tool, args);
    assert.equal(result.response.status, 200, "MCP " + spec.operation + " call must return HTTP 200.");
    assert.equal(result.body.error, undefined, "MCP JSON-RPC must not fail before tool execution.");
    assert.equal(result.body.result?.isError || false, false,
      "MCP " + spec.operation + " must not return isError: " + JSON.stringify(result.body.result?.structuredContent).slice(0, 500));
    const task = result.body.result?.structuredContent;
    assert.ok(task && typeof task.id === "string", "MCP " + spec.operation + " must return a durable Task.");
    const finalTask = await waitForTask(token, task.id, "MCP " + spec.operation);
    proofs.push(assertStage2Task(spec.operation, finalTask, "MCP"));
    lastMcpTask = finalTask;
    console.log("MCP Stage 2 proof: " + JSON.stringify(proofs[proofs.length - 1]));
  }

  const extractTask = restTasks.get("extract");
  const mcpStatus = await mcpCall(token, 30, "web_task_status", { taskId: extractTask.id });
  assert.equal(mcpStatus.response.status, 200);
  assert.equal(mcpStatus.body.result?.isError || false, false);
  const statusTask = mcpStatus.body.result?.structuredContent;
  assert.equal(statusTask?.id, extractTask.id, "MCP status must read a REST-created Task for the same tenant.");
  assert.equal(statusTask?.state, "partial", "MCP status must preserve a partial Extract Task.");

  assert.equal(proofs.length, EXPECTED_TASKS, "All six operations must pass through both transports.");
  assert.equal(Number(lastMcpTask?.quota?.used), EXPECTED_TASKS,
    "The shared tenant quota must account for exactly 12 logical Tasks (six REST + six MCP).");

  console.log("Stage 2 Acceptance PASSED on existing isolated Task Workers (no migration/deploy): " +
    JSON.stringify({
      operations: STAGE2_CASES.map((item) => item.operation),
      transports: ["REST", "MCP"],
      durableTasks: proofs.length,
      quotaUsed: Number(lastMcpTask.quota.used),
      mcpTools: listedTools,
      proofs,
    }));
}

async function cleanup() {
  requireRunId();
  const statements = [
    "DELETE FROM tasks WHERE tenant_id = " + sql(TENANT_ID) + ";",
    "DELETE FROM tenant_request_usage WHERE tenant_id = " + sql(TENANT_ID) + ";",
    "DELETE FROM api_keys WHERE tenant_id = " + sql(TENANT_ID) + ";",
    "DELETE FROM tenants WHERE tenant_id = " + sql(TENANT_ID) + ";",
    "DELETE FROM plan_policies WHERE plan_code = " + sql(PLAN_CODE) + ";",
  ];
  execD1(statements.join("\n"));
  console.log("Cleaned only Stage 2 data scoped to run " + RUN_ID + ".");
}

const mode = process.argv[2];
if (mode === "seed") await seed();
else if (mode === "smoke") await smoke();
else if (mode === "cleanup") await cleanup();
else throw new Error("Usage: node scripts/acceptance/stage2-task-runtime.mjs <seed|smoke|cleanup>");
