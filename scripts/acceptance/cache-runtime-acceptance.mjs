import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "435030befbb9df09ab76f69209c05347";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const DB = "1f94eee0-219e-4a41-86ce-49c29067ef06";
const BASE = "https://exportflow-mcp-acceptance-20261122.hhameranede.workers.dev";
const MCP = BASE + "/mcp";
const RUN = process.env.GITHUB_RUN_ID;
const WORKER = "exportflow-mcp-acceptance-20261122";
const ACCEPTANCE_BASELINE = ["6ddb1195-dd6c-4024-b77f-bb140504f8cc", "e4d41640-762e-4410-b308-d67946a61c12"];
const EXPECTED = {
  acceptance: [
    process.env.EXPECTED_ACCEPTANCE_DEPLOYMENT_ID || "",
    process.env.EXPECTED_ACCEPTANCE_VERSION_ID || ""
  ],
  platform: ["b3c3a3b6-3b04-4781-a6a2-6de999b7dd32", "15e90133-8da9-42cd-9bdf-8dcc09468360"],
  mcp: ["2a2a965c-5e77-4376-8d98-c160b30722df", "cb8bea58-aeb7-49ea-8155-64081a4678e3"]
};
const stamp = () => new Date().toISOString();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = {
  schemaVersion: 1,
  target: { worker: WORKER, mcpUrl: MCP, databaseId: DB },
  startedAt: stamp(),
  calls: [],
  cleanup: { attempted: false, errors: [], verified: false },
  cacheAcceptance: "not_run",
  productionUntouchedByThisRun: true
};
let primaryError = null;
let planCreated = false, tenantCreated = false, keyCreated = false;
if (!TOKEN) throw new Error("Missing Cloudflare Actions secret; refusing to run.");
if (!RUN || !/^[0-9]+$/.test(RUN)) throw new Error("Missing GitHub Actions run id; refusing to provision fixtures.");

const planCode = "qa_cache_20261124_" + RUN;
const tenantId = "qa_cache_" + RUN + "_" + randomUUID().replaceAll("-", "");
const keyId = randomBytes(12).toString("base64url");
const keyToken = "ef_live_" + keyId + "_" + randomBytes(32).toString("base64url");
const keyHash = createHash("sha256").update("exportflow-api-key-v1:" + keyToken).digest("hex");
const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
const cacheUrl = "https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css?ef_cache_acceptance=" + RUN;
report.testRunId = RUN;
report.keyScope = "tasks:fetch";
report.quotaLimit = 3;
report.cacheUrl = cacheUrl;

function ensure(ok, message) { if (!ok) throw new Error(message); }

async function cf(method, path, body) {
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method,
    headers: { authorization: "Bearer " + TOKEN, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) throw new Error("Cloudflare API " + method + " failed (HTTP " + response.status + ").");
  return payload.result;
}

async function d1(sql, params = []) {
  const result = await cf("POST", "/accounts/" + ACCOUNT + "/d1/database/" + DB + "/query", {
    sql, params: params.map((v) => String(v))
  });
  const item = Array.isArray(result) ? result[0] : null;
  if (!item || item.success !== true) throw new Error("Acceptance D1 query failed; statement details omitted.");
  return item;
}

async function audit(action, type, id, details) {
  await d1(
    "INSERT INTO tenant_admin_audit_log (event_id, actor_id, action, resource_type, resource_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [randomUUID(), "github-actions-cache-acceptance", action, type, id, JSON.stringify(details || {}), stamp()]
  );
}

async function deployment(scriptName) {
  const result = await cf("GET", "/accounts/" + ACCOUNT + "/workers/scripts/" + scriptName + "/deployments");
  const item = result?.deployments?.[0];
  ensure(item && Array.isArray(item.versions), "Missing deployment for " + scriptName + ".");
  return {
    deploymentId: item.id,
    versions: item.versions.map((v) => ({ versionId: v.version_id, percentage: v.percentage })),
    createdOn: item.created_on
  };
}

function checkDeployment(actual, expected, label) {
  ensure(actual.deploymentId === expected[0], label + " deployment differs from the inspected target.");
  ensure(actual.versions.length === 1 && actual.versions[0].versionId === expected[1] && actual.versions[0].percentage === 100,
    label + " is not on the expected 100% version.");
}

async function rpc(method, params, id, bearer) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2025-11-25"
  };
  if (bearer) headers.authorization = "Bearer " + bearer;
  const response = await fetch(MCP, {
    method: "POST", headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(20000)
  });
  const raw = await response.text();
  let body;
  try { body = raw ? JSON.parse(raw) : null; }
  catch { throw new Error("Acceptance MCP returned a non-JSON response (HTTP " + response.status + ")."); }
  if (!response.ok || body?.error) throw new Error("Acceptance MCP " + method + " failed (HTTP " + response.status + ").");
  return body;
}

function safeErrorCode(value) {
  return typeof value === "string" && /^[A-Z0-9_]{2,64}$/.test(value) ? value : null;
}

function safeErrorMessage(value) {
  if (typeof value !== "string") return null;
  return value
    .replace(/ef_live_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}/g, "[redacted-api-key]")
    .replace(/(bearer\\s+)[^\\s,;]+/gi, "$1[redacted]")
    .replace(/(authorization|cookie|client_secret|access_token|refresh_token|secret)\\s*[:=]\\s*[^\\s,;]+/gi, "$1=[redacted]")
    .replace(/https?:\\/\\/[^\\s"'<>]+/gi, (value) => {
      try {
        const url = new URL(value);
        return url.origin + url.pathname;
      } catch {
        return "[redacted-url]";
      }
    })
    .slice(0, 300);
}

function getStructuredToolValue(tool) {
  if (tool?.structuredContent && typeof tool.structuredContent === "object") return tool.structuredContent;
  for (const item of Array.isArray(tool?.content) ? tool.content : []) {
    if (item?.type !== "text" || typeof item.text !== "string") continue;
    try {
      const parsed = JSON.parse(item.text);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Do not retain raw tool text; an unknown format is represented by a generic diagnostic.
    }
  }
  return null;
}

async function oneFetch(mode, id) {
  const started = performance.now();
  let response;
  try {
    response = await rpc(
      "tools/call",
      { name: "web_fetch", arguments: { url: cacheUrl, cacheMode: mode } },
      id,
      keyToken
    );
  } catch (error) {
    const record = {
      call: id,
      cacheMode: mode,
      taskSucceeded: false,
      transportError: safeErrorMessage(error?.message) || "MCP transport failed."
    };
    report.calls.push(record);
    return record;
  }

  const wallMs = Math.round((performance.now() - started) * 100) / 100;
  const tool = response?.result;
  const value = getStructuredToolValue(tool);
  const taskErrors = Array.isArray(value?.errors) ? value.errors.slice(0, 3).map((entry) => ({
    code: safeErrorCode(entry?.code),
    message: safeErrorMessage(entry?.message)
  })) : [];
  const data = value?.result?.data && typeof value.result.data === "object" ? value.result.data : {};
  const quota = value?.quota && typeof value.quota === "object" ? {
    period: typeof value.quota.period === "string" ? value.quota.period : null,
    limit: Number.isSafeInteger(value.quota.limit) ? value.quota.limit : null,
    remaining: Number.isSafeInteger(value.quota.remaining) ? value.quota.remaining : null
  } : null;
  const taskState = typeof value?.state === "string" ? value.state : null;
  const taskSucceeded = tool?.isError !== true &&
    taskState === "succeeded" &&
    Number(data.status) === 200 &&
    typeof data.contentType === "string" &&
    data.contentType.toLowerCase().startsWith("text/css") &&
    typeof data.body === "string" &&
    data.body.length > 0;

  const record = {
    call: id,
    cacheMode: mode,
    taskSucceeded,
    isError: tool?.isError === true,
    taskState,
    errorCode: safeErrorCode(value?.error) || taskErrors[0]?.code || safeErrorCode(data.errorCode),
    errorMessage: safeErrorMessage(value?.message) || taskErrors[0]?.message,
    taskErrors,
    warnings: Array.isArray(value?.result?.warnings)
      ? value.result.warnings.slice(0, 4).map(safeErrorMessage).filter(Boolean)
      : [],
    httpStatus: Number.isInteger(data.status) ? data.status : null,
    contentType: typeof data.contentType === "string" ? data.contentType.slice(0, 120) : null,
    cacheStatus: typeof data.cacheStatus === "string" ? data.cacheStatus : null,
    responseBytes: Number.isSafeInteger(data.bytes) ? data.bytes : null,
    workerDurationMs: Number.isFinite(value?.usage?.durationMs) ? value.usage.durationMs : null,
    quota,
    runnerWallMs: wallMs
  };
  report.calls.push(record);
  return record;
}
async function cleanup() {
  report.cleanup.attempted = true;
  const errors = [];
  async function attempt(name, fn) {
    try { await fn(); } catch { errors.push(name); }
  }
  const time = stamp();
  if (keyCreated) await attempt("revoke_key", async () => {
    await d1("UPDATE api_keys SET status = 'revoked', revoked_at = ? WHERE key_id = ? AND status = 'active'", [time, keyId]);
    await audit("cache_acceptance.api_key_revoked", "api_key", keyId, { scope: "tasks:fetch" });
  });
  if (tenantCreated) await attempt("close_tenant", async () => {
    await d1("UPDATE tenants SET status = 'closed', updated_at = ? WHERE tenant_id = ? AND status = 'active'", [time, tenantId]);
    await audit("cache_acceptance.tenant_closed", "tenant", tenantId, { planCode });
  });
  if (planCreated) await attempt("retire_plan", async () => {
    await d1("UPDATE plan_policies SET status = 'retired', updated_at = ? WHERE plan_code = ? AND status = 'active'", [time, planCode]);
    await audit("cache_acceptance.plan_retired", "plan_policy", planCode, { requestLimit: 3 });
  });
  if (planCreated) await attempt("verify_cleanup_state", async () => {
    const result = await d1(
      "SELECT p.status AS plan_status, t.status AS tenant_status, k.status AS key_status, k.scopes_json, " +
      "(SELECT COALESCE(MAX(u.requests_used), 0) FROM tenant_request_usage AS u WHERE u.tenant_id = t.tenant_id) AS requests_used " +
      "FROM plan_policies AS p LEFT JOIN tenants AS t ON t.tenant_id = ? AND t.plan_code = p.plan_code " +
      "LEFT JOIN api_keys AS k ON k.key_id = ? AND k.tenant_id = t.tenant_id WHERE p.plan_code = ? LIMIT 1",
      [tenantId, keyId, planCode]
    );
    const row = result.results?.[0];
    ensure(row?.plan_status === "retired", "Plan not retired.");
    if (tenantCreated) ensure(row.tenant_status === "closed", "Tenant not closed.");
    if (keyCreated) {
      ensure(row.key_status === "revoked", "API key not revoked.");
      ensure(row.scopes_json === '["tasks:fetch"]', "API key scope changed.");
    }
    const used = Number(row.requests_used || 0);
    ensure(used <= 3, "Quota exceeded.");
    report.cleanup.requestsUsed = used;
    report.cleanup.verified = true;
  });
  await attempt("verify_deployments_unchanged", async () => {
    const after = await Promise.all([
      deployment(WORKER), deployment("exportflow-platform"), deployment("exportflow-mcp-preview")
    ]);
    checkDeployment(after[0], EXPECTED.acceptance, "Acceptance MCP after test");
    checkDeployment(after[1], EXPECTED.platform, "Production Platform after test");
    checkDeployment(after[2], EXPECTED.mcp, "Production MCP after test");
    report.deploymentsAfter = { acceptance: after[0], productionPlatform: after[1], productionMcp: after[2] };
  });
  report.cleanup.errors = errors;
  if (errors.length) report.cleanup.verified = false;
}

if (process.argv.includes("--preflight-only")) {
  const before = await Promise.all([
    deployment(WORKER), deployment("exportflow-platform"), deployment("exportflow-mcp-preview")
  ]);
  checkDeployment(before[0], ACCEPTANCE_BASELINE, "Acceptance MCP baseline");
  checkDeployment(before[1], EXPECTED.platform, "Production Platform");
  checkDeployment(before[2], EXPECTED.mcp, "Production MCP");
  console.log(JSON.stringify({
    preflight: "passed",
    acceptanceBaseline: before[0],
    productionPlatform: before[1],
    productionMcp: before[2]
  }, null, 2));
  process.exit(0);
}

if (!/^[0-9a-f-]{36}$/i.test(EXPECTED.acceptance[0]) || !/^[0-9a-f-]{36}$/i.test(EXPECTED.acceptance[1])) {
  throw new Error("The new isolated Acceptance deployment was not pinned by the workflow.");
}

try {
  const before = await Promise.all([
    deployment(WORKER), deployment("exportflow-platform"), deployment("exportflow-mcp-preview")
  ]);
  checkDeployment(before[0], EXPECTED.acceptance, "Acceptance MCP after isolated patch deployment");
  checkDeployment(before[1], EXPECTED.platform, "Production Platform");
  checkDeployment(before[2], EXPECTED.mcp, "Production MCP");
  report.deploymentsBefore = { acceptance: before[0], productionPlatform: before[1], productionMcp: before[2] };

  const healthResponse = await fetch(BASE + "/health", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  const health = await healthResponse.json().catch(() => null);
  ensure(healthResponse.ok && health?.status === "ok", "Acceptance MCP health preflight failed.");

  const listed = await rpc("tools/list", {}, "cache-preflight", null);
  const tool = listed?.result?.tools?.find((entry) => entry.name === "web_fetch");
  ensure(tool?.inputSchema?.properties?.cacheMode?.enum?.join(",") === "default,bypass",
    "Acceptance MCP cacheMode contract is missing or changed.");
  report.preflight = {
    healthStatus: healthResponse.status,
    tools: (listed?.result?.tools || []).map((entry) => entry.name),
    cacheModes: tool.inputSchema.properties.cacheMode.enum
  };

  const collision = await d1("SELECT plan_code FROM plan_policies WHERE plan_code = ? LIMIT 1", [planCode]);
  ensure((collision.results || []).length === 0, "Temporary plan identifier already exists; refusing to reuse it.");

  const created = stamp();
  const policy = await d1(
    "INSERT INTO plan_policies (plan_code, quota_period, request_limit, policy_version, status, created_at, updated_at) VALUES (?, 'daily', 3, 'cache-runtime-acceptance-v1', 'active', ?, ?)",
    [planCode, created, created]
  );
  ensure(Number(policy.meta?.changes) === 1, "Temporary 3-request plan was not created.");
  planCreated = true;
  await audit("cache_acceptance.plan_created", "plan_policy", planCode, { requestLimit: 3 });

  const tenant = await d1(
    "INSERT INTO tenants (tenant_id, plan_code, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)",
    [tenantId, planCode, created, created]
  );
  ensure(Number(tenant.meta?.changes) === 1, "Temporary tenant was not created.");
  tenantCreated = true;
  await audit("cache_acceptance.tenant_created", "tenant", tenantId, { planCode });

  const key = await d1(
    "INSERT INTO api_keys (key_id, tenant_id, key_hash, status, scopes_json, expires_at, created_at, revoked_at) VALUES (?, ?, ?, 'active', '[\"tasks:fetch\"]', ?, ?, NULL)",
    [keyId, tenantId, keyHash, expiresAt, created]
  );
  ensure(Number(key.meta?.changes) === 1, "Temporary fetch-only key was not created.");
  keyCreated = true;
  await audit("cache_acceptance.api_key_created", "api_key", keyId, { scope: "tasks:fetch", expiresAt });

  report.provisioning = { keyScope: "tasks:fetch", quotaLimit: 3, keyExpiresAt: expiresAt };
  const first = await oneFetch("default", 1);
  await pause(500);
  const second = await oneFetch("default", 2);
  const bypass = await oneFetch("bypass", 3);
  const statuses = [first.cacheStatus, second.cacheStatus, bypass.cacheStatus];
  const allTasksSucceeded = report.calls.length === 3 && report.calls.every((call) => call.taskSucceeded === true);
  report.cacheEvidence = {
    observedStatuses: statuses,
    tasksSucceeded: allTasksSucceeded,
    firstDefaultMiss: statuses[0] === "MISS",
    secondDefaultHit: statuses[1] === "HIT",
    bypassExplicitlySkippedCache: statuses[2] === "BYPASS" || statuses[2] === "DYNAMIC",
    fullSequenceConfirmed: allTasksSucceeded && statuses[0] === "MISS" && statuses[1] === "HIT" &&
      (statuses[2] === "BYPASS" || statuses[2] === "DYNAMIC")
  };
  report.cacheAcceptance = report.cacheEvidence.fullSequenceConfirmed
    ? "PASS: MISS -> HIT -> BYPASS/DYNAMIC observed"
    : (allTasksSucceeded && report.cacheEvidence.firstDefaultMiss && report.cacheEvidence.secondDefaultHit
      ? "PARTIAL: MISS -> HIT observed; bypass status not conclusively exposed"
      : "NOT_CONFIRMED: all three authenticated Fetch calls were attempted; inspect sanitized per-call diagnostics");
  if (!allTasksSucceeded) primaryError = "One or more authenticated Fetch tasks failed; see sanitized per-call diagnostics.";
} catch (error) {
  primaryError = error instanceof Error ? error.message : "Unclassified acceptance failure";
} finally {
  try { await cleanup(); }
  catch { report.cleanup.errors.push("unexpected_cleanup_error"); report.cleanup.verified = false; }
  report.finishedAt = stamp();
  report.result = {
    outcome: primaryError ? "failed" : (report.cleanup.verified ? "completed" : "cleanup_incomplete"),
    error: primaryError
  };
  fs.writeFileSync("cache-runtime-acceptance-result.json", JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
}
if (primaryError || !report.cleanup.verified) process.exitCode = 1;
