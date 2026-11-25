import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSuccessfulFetchTask } from "./fetch-assertions.mjs";

const PLATFORM_URL = "https://exportflow.me";
const MCP_URL = "https://mcp.exportflow.me/mcp";
const RUN_ID = (String(process.env.GITHUB_RUN_ID || process.env.CI_RUN_ID || "local") + "_" +
  String(process.env.GITHUB_RUN_ATTEMPT || "1"))
  .replace(/[^a-zA-Z0-9_-]/g, "").slice(-20);
const PLAN_CODE = "qa_prod_" + RUN_ID;
const PROBE_PLAN_CODE = "qa_probe_" + RUN_ID;
const TENANTS = Object.freeze({
  alpha: "qa_prod_task_alpha_" + RUN_ID,
  beta: "qa_prod_task_beta_" + RUN_ID,
  noRead: "qa_prod_task_noread_" + RUN_ID,
  probe: "qa_prod_task_probe_" + RUN_ID,
});
const FETCH_CANDIDATES = Object.freeze([
  { url: "https://example.com/", expectedContent: "Example Domain", expectedHost: "example.com" },
  { url: "https://www.iana.org/domains/reserved", expectedContent: "IANA", expectedHost: "iana.org" },
  { url: "https://www.cloudflare.com/robots.txt", expectedContent: "User-agent: *", expectedHost: "cloudflare.com" },
]);

function sql(value) {
  if (value === null) return "NULL";
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function execD1(sqlText) {
  const directory = mkdtempSync(join(tmpdir(), "exportflow-production-task-smoke-"));
  const file = join(directory, "query.sql");
  writeFileSync(file, sqlText, "utf8");
  try {
    const result = spawnSync("npx", [
      "--yes", "wrangler@4", "d1", "execute", "exportflow-tenant-production",
      "--remote", "--file", file, "--config", "wrangler.toml", "--yes",
    ], {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
      const detail = (result.stderr || result.stdout || result.error?.message || "unknown Wrangler failure").slice(-1800);
      throw new Error("Production synthetic-fixture D1 operation failed: " + detail);
    }
    return result.stdout || "";
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function newApiKey(expiresAt) {
  const keyId = randomBytes(12).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const token = "ef_live_" + keyId + "_" + secret;
  const keyHash = createHash("sha256").update("exportflow-api-key-v1:" + token).digest("hex");
  return { keyId, token, keyHash, expiresAt };
}

function writeGithubEnv(values) {
  const path = process.env.GITHUB_ENV;
  if (!path) throw new Error("GITHUB_ENV is required for synthetic Production test fixtures.");
  for (const [name, value] of Object.entries(values)) {
    if (/[\r\n]/.test(value)) throw new Error("Invalid fixture environment value.");
    if (name.endsWith("_TOKEN")) process.stdout.write("::add-mask::" + value + "\n");
    appendFileSync(path, name + "=" + value + "\n", "utf8");
  }
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
  assert.ok(result.body && typeof result.body.id === "string", label + " did not return a Task record (HTTP " + result.response.status + ").");
  assert.ok(["accepted", "running", "partial", "succeeded", "failed", "cancelled", "expired", "unsupported"].includes(result.body.state),
    label + " returned an invalid Task state.");
  return result.body;
}

async function seed() {
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const alphaKey = newApiKey(expiresAt);
  const betaKey = newApiKey(expiresAt);
  const noReadKey = newApiKey(expiresAt);
  const probeKey = newApiKey(expiresAt);
  const commonScopes = [
    "tasks:fetch", "tasks:map", "tasks:crawl", "tasks:extract",
    "tasks:search", "tasks:research", "tasks:read",
  ];
  const entries = [
    [TENANTS.alpha, alphaKey, commonScopes],
    [TENANTS.beta, betaKey, commonScopes],
    [TENANTS.noRead, noReadKey, ["tasks:fetch"]],
    [TENANTS.probe, probeKey, commonScopes],
  ];
  const tenantList = Object.values(TENANTS).map(sql).join(", ");
  const statements = [
    "INSERT INTO plan_policies (plan_code, quota_period, request_limit, policy_version, status, created_at, updated_at) VALUES (" +
      [sql(PLAN_CODE), sql("daily"), "2", sql("production-task-smoke-v1"), sql("active"), sql(createdAt), sql(createdAt)].join(", ") + ");",
    "INSERT INTO plan_policies (plan_code, quota_period, request_limit, policy_version, status, created_at, updated_at) VALUES (" +
      [sql(PROBE_PLAN_CODE), sql("daily"), String(FETCH_CANDIDATES.length), sql("production-fetch-probe-v1"), sql("active"), sql(createdAt), sql(createdAt)].join(", ") + ");",
  ];
  for (const [label, tenantId] of Object.entries(TENANTS)) {
    const planCode = label === "probe" ? PROBE_PLAN_CODE : PLAN_CODE;
    statements.push(
      "INSERT INTO tenants (tenant_id, plan_code, status, created_at, updated_at) VALUES (" +
      [sql(tenantId), sql(planCode), sql("active"), sql(createdAt), sql(createdAt)].join(", ") + ");",
    );
  }
  for (const [tenantId, key, scopes] of entries) {
    statements.push(
      "INSERT INTO api_keys (key_id, tenant_id, key_hash, status, scopes_json, expires_at, created_at) VALUES (" +
      [sql(key.keyId), sql(tenantId), sql(key.keyHash), sql("active"), sql(JSON.stringify(scopes)), sql(key.expiresAt), sql(createdAt)].join(", ") + ");",
    );
  }
  // Refuse to overwrite a pre-existing record even if a run ID were reused.
  const collisionCheck = "SELECT " +
    "(SELECT COUNT(*) FROM tenants WHERE tenant_id IN (" + tenantList + ")) AS tenants, " +
    "(SELECT COUNT(*) FROM api_keys WHERE tenant_id IN (" + tenantList + ")) AS api_keys, " +
    "(SELECT COUNT(*) FROM plan_policies WHERE plan_code IN (" + [sql(PLAN_CODE), sql(PROBE_PLAN_CODE)].join(", ") + ")) AS plans";
  const collisionResult = execD1(collisionCheck);
  if (/("tenants"\s*:\s*[1-9]|"api_keys"\s*:\s*[1-9]|"plans"\s*:\s*[1-9])/.test(collisionResult)) {
    throw new Error("Production synthetic fixture namespace already exists; refusing to overwrite it.");
  }
  execD1(statements.join("\n"));
  writeGithubEnv({
    EF_PROD_TASK_RUN: RUN_ID,
    EF_PROD_TASK_ALPHA_TOKEN: alphaKey.token,
    EF_PROD_TASK_BETA_TOKEN: betaKey.token,
    EF_PROD_TASK_NOREAD_TOKEN: noReadKey.token,
    EF_PROD_TASK_PROBE_TOKEN: probeKey.token,
  });
  console.log("Seeded four run-scoped synthetic Production tenants; all API keys expire in two hours. Tokens are masked and never printed.");
}

async function restPost(token, key, url) {
  const response = await fetch(PLATFORM_URL + "/api/v1/tasks", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      "idempotency-key": key,
    },
    body: JSON.stringify({
      goal: "Synthetic Production durable-task smoke test",
      operation: "fetch",
      url,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  return readJson(response, "Production REST task submission");
}

async function restGet(token, taskId) {
  const response = await fetch(PLATFORM_URL + "/api/v1/tasks/" + encodeURIComponent(taskId), {
    headers: { authorization: "Bearer " + token },
    signal: AbortSignal.timeout(20_000),
  });
  return readJson(response, "Production REST task status");
}

async function waitForRestTask(token, taskId) {
  const deadline = Date.now() + 30_000;
  let latest;
  do {
    latest = await restGet(token, taskId);
    assert.equal(latest.response.status, 200, "Tenant-owned Production Task status must be readable.");
    if (!["accepted", "running"].includes(latest.body?.state)) return latest;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  } while (Date.now() < deadline);
  throw new Error("Production Durable Task did not reach a terminal state within 30 seconds.");
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
  return readJson(response, "Production MCP " + name);
}

async function findWorkingFetchTarget(token) {
  const failures = [];
  for (const [index, candidate] of FETCH_CANDIDATES.entries()) {
    const key = "prod-fetch-probe-" + RUN_ID + "-" + index;
    try {
      const submission = await restPost(token, key, candidate.url);
      assert.ok([200, 202, 502].includes(submission.response.status),
        "Production Fetch probe returned HTTP " + submission.response.status + ".");
      const task = taskFromApi(submission, "Production public Fetch probe");
      const status = await waitForRestTask(token, task.id);
      const proof = assertSuccessfulFetchTask({
        transport: "REST",
        httpStatus: status.response.status,
        task: status.body,
        expectedContent: candidate.expectedContent,
        expectedHost: candidate.expectedHost,
      });
      return { ...candidate, proof };
    } catch (error) {
      failures.push({ url: candidate.url, diagnostic: String(error?.message || "Fetch probe failed").slice(0, 900) });
    }
  }
  throw new Error("No fixed public source passed real Production Worker Fetch: " + JSON.stringify(failures));
}

async function smoke() {
  const alpha = process.env.EF_PROD_TASK_ALPHA_TOKEN;
  const beta = process.env.EF_PROD_TASK_BETA_TOKEN;
  const noRead = process.env.EF_PROD_TASK_NOREAD_TOKEN;
  const probe = process.env.EF_PROD_TASK_PROBE_TOKEN;
  assert.ok(alpha && beta && noRead && probe, "Production synthetic API-key fixtures are missing.");

  const [platformHealth, mcpHealth] = await Promise.all([
    fetch(PLATFORM_URL + "/api/v1/health", { signal: AbortSignal.timeout(15_000) }),
    fetch("https://mcp.exportflow.me/health", { signal: AbortSignal.timeout(15_000) }),
  ]);
  assert.equal(platformHealth.status, 200, "Production Platform health must be HTTP 200.");
  assert.equal(mcpHealth.status, 200, "Production MCP health must be HTTP 200.");

  const fetchTarget = await findWorkingFetchTarget(probe);
  const concurrentKey = "prod-rest-concurrent-" + RUN_ID;
  const concurrent = await Promise.all([
    restPost(alpha, concurrentKey, fetchTarget.url),
    restPost(alpha, concurrentKey, fetchTarget.url),
  ]);
  for (const [index, result] of concurrent.entries()) {
    assert.ok([200, 202, 502].includes(result.response.status),
      "Concurrent Production REST submission " + index + " returned HTTP " + result.response.status + ".");
  }
  const firstTask = taskFromApi(concurrent[0], "first Production concurrent REST submission");
  const secondTask = taskFromApi(concurrent[1], "second Production concurrent REST submission");
  assert.equal(firstTask.id, secondTask.id, "Concurrent same-key Production REST requests must resolve to one Task.");
  assert.equal(Number(firstTask.quota?.used), 1, "The first Production Task must reserve exactly one quota unit.");
  assert.equal(Number(secondTask.quota?.used), 1, "The Production replay must not reserve another quota unit.");

  const replay = await restPost(alpha, concurrentKey, fetchTarget.url);
  assert.ok([200, 202, 502].includes(replay.response.status), "Production REST replay returned an unexpected status.");
  const replayTask = taskFromApi(replay, "Production REST idempotent replay");
  assert.equal(replayTask.id, firstTask.id);
  assert.equal(replay.response.headers.get("idempotency-replayed"), "true", "Production REST replay header must be present.");

  const conflict = await restPost(alpha, concurrentKey, "https://www.iana.org/");
  assert.equal(conflict.response.status, 409, "Production idempotency conflict must return HTTP 409.");
  assert.equal(conflict.body.error?.code, "IDEMPOTENCY_KEY_REUSED");

  const status = await waitForRestTask(alpha, firstTask.id);
  assert.equal(status.body.id, firstTask.id);
  const restProof = assertSuccessfulFetchTask({
    transport: "REST",
    httpStatus: status.response.status,
    task: status.body,
    expectedContent: fetchTarget.expectedContent,
    expectedHost: fetchTarget.expectedHost,
  });
  assert.equal("goal" in status.body, false, "Production display-only goal must not be retained in D1.");
  assert.ok(status.body.events?.some((event) => event.type === "task.accepted"));
  assert.ok(status.body.events?.some((event) => event.type.startsWith("task.") && event.type !== "task.accepted"));
  assert.equal(status.body.persistence?.retentionHours, 24);
  assert.equal(Date.parse(status.body.persistence.expiresAt) - Date.parse(status.body.timestamps.createdAt), 24 * 60 * 60 * 1000);

  const foreignStatus = await restGet(beta, firstTask.id);
  assert.equal(foreignStatus.response.status, 404, "Another Production tenant must not discover the Task.");
  assert.equal(foreignStatus.body.error?.code, "TASK_NOT_FOUND");

  const noReadStatus = await restGet(noRead, firstTask.id);
  assert.equal(noReadStatus.response.status, 403, "Production tasks:read scope must be enforced.");
  assert.equal(noReadStatus.body.error?.code, "INSUFFICIENT_SCOPE");

  const mcpReplay = await mcpCall(alpha, 1, "web_fetch", {
    url: fetchTarget.url,
    idempotencyKey: concurrentKey,
  });
  assert.equal(mcpReplay.response.status, 200);
  const mcpReplayTask = mcpReplay.body.result?.structuredContent;
  const mcpReplayProof = assertSuccessfulFetchTask({
    transport: "MCP",
    httpStatus: mcpReplay.response.status,
    task: mcpReplayTask,
    toolIsError: mcpReplay.body.result?.isError || false,
    expectedContent: fetchTarget.expectedContent,
    expectedHost: fetchTarget.expectedHost,
  });
  assert.equal(mcpReplayTask?.id, firstTask.id, "Production MCP must replay the REST-created Task.");

  const secondMcpKey = "prod-mcp-second-" + RUN_ID;
  const secondMcp = await mcpCall(alpha, 2, "web_fetch", {
    url: fetchTarget.url,
    idempotencyKey: secondMcpKey,
  });
  assert.equal(secondMcp.response.status, 200);
  const secondMcpTask = secondMcp.body.result?.structuredContent;
  const secondMcpProof = assertSuccessfulFetchTask({
    transport: "MCP",
    httpStatus: secondMcp.response.status,
    task: secondMcpTask,
    toolIsError: secondMcp.body.result?.isError || false,
    expectedContent: fetchTarget.expectedContent,
    expectedHost: fetchTarget.expectedHost,
  });
  assert.ok(typeof secondMcpTask?.id === "string");
  assert.equal(Number(secondMcpTask.quota?.used), 2, "Production MCP new Task must reserve one additional quota unit.");

  const secondRestStatus = await waitForRestTask(alpha, secondMcpTask.id);
  assert.equal(secondRestStatus.body.id, secondMcpTask.id);
  assertSuccessfulFetchTask({
    transport: "REST",
    httpStatus: secondRestStatus.response.status,
    task: secondRestStatus.body,
    expectedContent: fetchTarget.expectedContent,
    expectedHost: fetchTarget.expectedHost,
  });
  assert.equal("goal" in secondRestStatus.body, false);

  const mcpStatus = await mcpCall(alpha, 3, "web_task_status", { taskId: firstTask.id });
  assert.equal(mcpStatus.response.status, 200);
  assert.equal(mcpStatus.body.result?.isError || false, false);
  assert.equal(mcpStatus.body.result?.structuredContent?.id, firstTask.id);
  assertSuccessfulFetchTask({
    transport: "MCP",
    httpStatus: mcpStatus.response.status,
    task: mcpStatus.body.result?.structuredContent,
    toolIsError: mcpStatus.body.result?.isError || false,
    expectedContent: fetchTarget.expectedContent,
    expectedHost: fetchTarget.expectedHost,
  });

  const exhausted = await restPost(alpha, "prod-quota-limit-" + RUN_ID, fetchTarget.url);
  assert.equal(exhausted.response.status, 429, "Production Task beyond the test quota ceiling must return HTTP 429.");
  assert.equal(exhausted.body.error?.code, "PLAN_QUOTA_EXCEEDED");
  const replayAtLimit = await restPost(alpha, concurrentKey, fetchTarget.url);
  assert.ok([200, 202, 502].includes(replayAtLimit.response.status));
  assert.equal(taskFromApi(replayAtLimit, "Production replay at quota limit").id, firstTask.id);

  console.log("Production durable-task smoke passed: real REST/MCP Fetch, one-time quota reservation, concurrent idempotency, same-key replay, 409 identity conflict, status/events, 24-hour retention metadata, tenant isolation, tasks:read, REST/MCP parity and quota exhaustion.");
  console.log("Verified public source: " + JSON.stringify({ url: fetchTarget.url, proof: fetchTarget.proof }));
  console.log("Task proofs: " + JSON.stringify({ rest: restProof, mcpReplay: mcpReplayProof, mcpCreated: secondMcpProof }));
}

async function cleanup() {
  const tenantList = Object.values(TENANTS).map(sql).join(", ");
  const planList = [sql(PLAN_CODE), sql(PROBE_PLAN_CODE)].join(", ");
  const statements = [
    "DELETE FROM tasks WHERE tenant_id IN (" + tenantList + ");",
    "DELETE FROM tenant_request_usage WHERE tenant_id IN (" + tenantList + ");",
    "DELETE FROM api_keys WHERE tenant_id IN (" + tenantList + ");",
    "DELETE FROM tenants WHERE tenant_id IN (" + tenantList + ");",
    "DELETE FROM plan_policies WHERE plan_code IN (" + planList + ");",
  ];
  execD1(statements.join("\n"));
  console.log("Production cleanup attempted for this exact run namespace: Tasks/events (via cascade), quota usage, API keys, tenants and test-only plan policies.");
}

const mode = process.argv[2];
if (mode === "seed") await seed();
else if (mode === "smoke") await smoke();
else if (mode === "cleanup") await cleanup();
else throw new Error("Usage: node scripts/acceptance/durable-task-production-smoke.mjs <seed|smoke|cleanup>");
