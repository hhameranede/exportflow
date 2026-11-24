import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DATABASE = "exportflow-tenant-acceptance-20261122";
const CONFIG = "cloudflare/task-acceptance/platform.wrangler.toml";
const PLATFORM_URL = "https://exportflow-task-platform-acceptance-20261124.hhameranede.workers.dev";
const MCP_URL = "https://exportflow-task-mcp-acceptance-20261124.hhameranede.workers.dev/mcp";
const RUN_ID = String(process.env.GITHUB_RUN_ID || process.env.CI_RUN_ID || "local-acceptance").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
const PLAN_CODE = "qa_task_acceptance_" + RUN_ID;
const TENANTS = {
  alpha: "qa_task_alpha_" + RUN_ID,
  beta: "qa_task_beta_" + RUN_ID,
  noRead: "qa_task_noread_" + RUN_ID,
};

function sql(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function execD1(sqlText) {
  const directory = mkdtempSync(join(tmpdir(), "exportflow-task-acceptance-"));
  const file = join(directory, "query.sql");
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
      throw new Error("Isolated Acceptance D1 operation failed: " + detail);
    }
    return result.stdout || "";
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function newApiKey() {
  const keyId = randomBytes(12).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const token = "ef_live_" + keyId + "_" + secret;
  const keyHash = createHash("sha256").update("exportflow-api-key-v1:" + token).digest("hex");
  return { keyId, token, keyHash };
}

function writeGithubEnv(values) {
  const path = process.env.GITHUB_ENV;
  if (!path) throw new Error("GITHUB_ENV is required when seeding CI fixtures.");
  for (const [name, value] of Object.entries(values)) {
    if (/[\r\n]/.test(value)) throw new Error("Invalid fixture environment value.");
    appendFileSync(path, name + "=" + value + "\n", "utf8");
  }
}

async function seed() {
  const now = new Date().toISOString();
  const alphaKey = newApiKey();
  const betaKey = newApiKey();
  const noReadKey = newApiKey();
  const commonScopes = [
    "tasks:fetch", "tasks:map", "tasks:crawl", "tasks:extract",
    "tasks:search", "tasks:research", "tasks:read",
  ];
  const entries = [
    [TENANTS.alpha, alphaKey, commonScopes],
    [TENANTS.beta, betaKey, commonScopes],
    [TENANTS.noRead, noReadKey, ["tasks:fetch"]],
  ];
  const statements = [
    "INSERT INTO plan_policies (plan_code, quota_period, request_limit, policy_version, status, created_at, updated_at) VALUES (" +
      [sql(PLAN_CODE), sql("daily"), "2", sql("durable-task-acceptance-v1"), sql("active"), sql(now), sql(now)].join(", ") +
      ") ON CONFLICT(plan_code) DO NOTHING;",
  ];
  for (const tenantId of Object.values(TENANTS)) {
    statements.push(
      "INSERT INTO tenants (tenant_id, plan_code, status, created_at, updated_at) VALUES (" +
      [sql(tenantId), sql(PLAN_CODE), sql("active"), sql(now), sql(now)].join(", ") +
      ") ON CONFLICT(tenant_id) DO NOTHING;",
    );
  }
  for (const [tenantId, key, scopes] of entries) {
    statements.push(
      "INSERT INTO api_keys (key_id, tenant_id, key_hash, status, scopes_json, expires_at, created_at) VALUES (" +
      [sql(key.keyId), sql(tenantId), sql(key.keyHash), sql("active"), sql(JSON.stringify(scopes)), "NULL", sql(now)].join(", ") +
      ") ON CONFLICT(key_id) DO NOTHING;",
    );
  }
  execD1(statements.join("\n"));
  writeGithubEnv({
    EF_TASK_ACCEPTANCE_RUN: RUN_ID,
    EF_TASK_ALPHA_TOKEN: alphaKey.token,
    EF_TASK_BETA_TOKEN: betaKey.token,
    EF_TASK_NOREAD_TOKEN: noReadKey.token,
  });
  console.log("Created three synthetic, run-scoped Acceptance tenants and API keys (tokens withheld).");
}

async function readJson(response, label) {
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new Error(label + " returned non-JSON HTTP " + response.status + ".");
  }
  return { response, body };
}

function taskFromApi(result, label) {
  assert.ok(result.body && typeof result.body.id === "string", label + " did not return a Task record.");
  assert.ok(["accepted", "running", "partial", "succeeded", "failed", "cancelled", "expired", "unsupported"].includes(result.body.state), label + " returned an invalid Task state.");
  return result.body;
}

async function restPost(token, key, url = "https://example.com/") {
  const response = await fetch(PLATFORM_URL + "/api/v1/tasks", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      "idempotency-key": key,
    },
    body: JSON.stringify({
      goal: "Synthetic durable-task Acceptance request",
      operation: "fetch",
      url,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  return readJson(response, "REST task submission");
}

async function restGet(token, taskId) {
  const response = await fetch(PLATFORM_URL + "/api/v1/tasks/" + encodeURIComponent(taskId), {
    headers: { authorization: "Bearer " + token },
    signal: AbortSignal.timeout(20_000),
  });
  return readJson(response, "REST task status");
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
    signal: AbortSignal.timeout(30_000),
  });
  return readJson(response, "MCP " + name);
}

async function smoke() {
  const alpha = process.env.EF_TASK_ALPHA_TOKEN;
  const beta = process.env.EF_TASK_BETA_TOKEN;
  const noRead = process.env.EF_TASK_NOREAD_TOKEN;
  assert.ok(alpha && beta && noRead, "Acceptance API-key fixtures are missing.");

  const healthResponse = await fetch(PLATFORM_URL + "/api/v1/health", { signal: AbortSignal.timeout(15_000) });
  assert.equal(healthResponse.status, 200, "Acceptance Platform health must be ready.");

  // Two callers submit the same key concurrently. One task row and one quota unit must win.
  const concurrentKey = "rest-concurrent-" + RUN_ID.slice(-24);
  const concurrent = await Promise.all([
    restPost(alpha, concurrentKey),
    restPost(alpha, concurrentKey),
  ]);
  for (const [index, result] of concurrent.entries()) {
    assert.ok([200, 202, 502].includes(result.response.status), "Concurrent REST submission " + index + " returned HTTP " + result.response.status + ".");
  }
  const firstTask = taskFromApi(concurrent[0], "first concurrent REST submission");
  const secondTask = taskFromApi(concurrent[1], "second concurrent REST submission");
  assert.equal(firstTask.id, secondTask.id, "Concurrent same-key requests must resolve to one Task.");
  assert.equal(Number(firstTask.quota?.used), 1, "The first Task must reserve exactly one quota unit.");
  assert.equal(Number(secondTask.quota?.used), 1, "The replay must not reserve a second quota unit.");

  const replay = await restPost(alpha, concurrentKey);
  assert.ok([200, 202, 502].includes(replay.response.status), "REST replay returned unexpected HTTP " + replay.response.status + ".");
  const replayTask = taskFromApi(replay, "REST idempotent replay");
  assert.equal(replayTask.id, firstTask.id);
  assert.equal(replay.response.headers.get("idempotency-replayed"), "true", "REST replay response must identify replay.");

  const conflict = await restPost(alpha, concurrentKey, "https://www.iana.org/");
  assert.equal(conflict.response.status, 409, "A reused key with a different request must return HTTP 409.");
  assert.equal(conflict.body.error?.code, "IDEMPOTENCY_KEY_REUSED");

  const status = await restGet(alpha, firstTask.id);
  assert.equal(status.response.status, 200, "Tenant-owned Task status must be readable.");
  assert.equal(status.body.id, firstTask.id);
  assert.equal("goal" in status.body, false, "Display-only goal must not be retained in D1.");
  assert.ok(Array.isArray(status.body.events) && status.body.events.some((event) => event.type === "task.accepted"));
  assert.ok(status.body.events.some((event) => event.type.startsWith("task.") && event.type !== "task.accepted"));
  assert.equal(status.body.persistence?.retentionHours, 24, "Task status must expose the 24-hour retention policy.");
  assert.equal(
    Date.parse(status.body.persistence.expiresAt) - Date.parse(status.body.timestamps.createdAt),
    24 * 60 * 60 * 1000,
    "Retained Task expiry must be exactly 24 hours after acceptance.",
  );

  const foreignStatus = await restGet(beta, firstTask.id);
  assert.equal(foreignStatus.response.status, 404, "A different tenant must not discover the Task.");
  assert.equal(foreignStatus.body.error?.code, "TASK_NOT_FOUND");

  const noReadStatus = await restGet(noRead, firstTask.id);
  assert.equal(noReadStatus.response.status, 403, "The separate tasks:read scope must be enforced.");
  assert.equal(noReadStatus.body.error?.code, "INSUFFICIENT_SCOPE");

  // MCP reuses the REST-created Task, then creates a second Task in the same D1 database.
  const mcpReplay = await mcpCall(alpha, 1, "web_fetch", {
    url: "https://example.com/",
    idempotencyKey: concurrentKey,
  });
  assert.equal(mcpReplay.response.status, 200);
  const mcpReplayTask = mcpReplay.body.result?.structuredContent;
  assert.equal(
    mcpReplay.body.result?.isError || false,
    firstTask.state === "failed" || firstTask.state === "unsupported",
    "MCP replay error state must match the persisted Task outcome.",
  );
  assert.equal(mcpReplayTask?.id, firstTask.id, "MCP must replay the REST-created Task.");

  const secondMcpKey = "mcp-second-" + RUN_ID.slice(-24);
  const mcpCreated = await mcpCall(alpha, 2, "web_fetch", {
    url: "https://example.com/",
    idempotencyKey: secondMcpKey,
  });
  assert.equal(mcpCreated.response.status, 200);
  const secondTask = mcpCreated.body.result?.structuredContent;
  assert.equal(
    mcpCreated.body.result?.isError || false,
    secondTask?.state === "failed" || secondTask?.state === "unsupported",
    "MCP result error state must match the persisted Task outcome.",
  );
  assert.ok(typeof secondTask?.id === "string", "MCP must create a second durable Task.");
  assert.equal(Number(secondTask.quota?.used), 2, "A distinct Task must reserve exactly one additional quota unit.");

  const secondRestStatus = await restGet(alpha, secondTask.id);
  assert.equal(secondRestStatus.response.status, 200, "REST must read the MCP-created Task from the shared D1 store.");
  assert.equal(secondRestStatus.body.id, secondTask.id);
  assert.equal("goal" in secondRestStatus.body, false);

  const mcpStatus = await mcpCall(alpha, 3, "web_task_status", { taskId: firstTask.id });
  assert.equal(mcpStatus.response.status, 200);
  assert.equal(mcpStatus.body.result?.isError || false, false);
  assert.equal(mcpStatus.body.result?.structuredContent?.id, firstTask.id);

  // At the exact quota ceiling, a new key is rejected but a valid replay remains readable.
  const exhausted = await restPost(alpha, "rest-quota-limit-" + RUN_ID.slice(-24));
  assert.equal(exhausted.response.status, 429, "A new logical Task beyond the quota ceiling must be rejected.");
  assert.equal(exhausted.body.error?.code, "PLAN_QUOTA_EXCEEDED");

  const replayAtLimit = await restPost(alpha, concurrentKey);
  assert.ok([200, 202, 502].includes(replayAtLimit.response.status), "An idempotency replay at the quota ceiling must remain available.");
  assert.equal(taskFromApi(replayAtLimit, "quota-ceiling replay").id, firstTask.id);

  console.log("Acceptance passed: concurrent idempotency, one-time quota reservation, 409 request identity, 24-hour expiry metadata, tenant isolation, tasks:read, REST/MCP parity and quota exhaustion.");
}

async function cleanup() {
  const tenantIds = Object.values(TENANTS);
  const inList = tenantIds.map(sql).join(", ");
  const statements = [
    "DELETE FROM tasks WHERE tenant_id IN (" + inList + ");",
    "DELETE FROM tenant_request_usage WHERE tenant_id IN (" + inList + ");",
    "DELETE FROM api_keys WHERE tenant_id IN (" + inList + ");",
    "DELETE FROM tenants WHERE tenant_id IN (" + inList + ");",
    "DELETE FROM plan_policies WHERE plan_code = " + sql(PLAN_CODE) + ";",
  ];
  execD1(statements.join("\n"));
  console.log("Removed run-scoped Acceptance Tasks, usage, API keys, tenants and plan policy.");
}

const mode = process.argv[2];
if (mode === "seed") await seed();
else if (mode === "smoke") await smoke();
else if (mode === "cleanup") await cleanup();
else throw new Error("Usage: node scripts/acceptance/durable-task-runtime.mjs <seed|smoke|cleanup>");
