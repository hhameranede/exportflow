import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve4 } from "node:dns/promises";
import { assertSuccessfulFetchTask } from "./fetch-assertions.mjs";
import { collectDnsRebindingObservations, createStageScopedDnsRebindingSuffix } from "./dns-rebinding-preflight.mjs";

const FETCH_CANDIDATES = Object.freeze([
  { url: "https://example.com/", expectedContent: "Example Domain", expectedHost: "example.com" },
  { url: "https://www.iana.org/domains/reserved", expectedContent: "IANA", expectedHost: "iana.org" },
  { url: "https://www.cloudflare.com/robots.txt", expectedContent: "User-agent: *", expectedHost: "cloudflare.com" },
]);


const DNS_REBINDING_RESOLVERS = Object.freeze([
  { id: "google-doh", name: "Google Public DNS DoH", endpoint: "https://dns.google/resolve", required: true },
  { id: "runner-system", name: "GitHub runner system DNS", system: true, required: false },
]);
// The DNS service returns the public control IP for the first two A queries,
// then rebinds the same hostname to the fixed private test target.
const DNS_REBINDING_PUBLIC_IP = "185.199.108.153";
const DNS_REBINDING_PRIVATE_TARGETS = Object.freeze([
  { name: "loopback", ip: "127.0.0.1" },
  { name: "unspecified", ip: "0.0.0.0" },
  { name: "private-10", ip: "10.0.0.1" },
]);

const DATABASE = "exportflow-tenant-acceptance-20261122";
const CONFIG = "cloudflare/task-acceptance/platform.wrangler.toml";
const PLATFORM_URL = "https://exportflow-task-platform-acceptance-20261124.hhameranede.workers.dev";
const MCP_URL = "https://exportflow-task-mcp-acceptance-20261124.hhameranede.workers.dev/mcp";
const RUN_ID = String(process.env.GITHUB_RUN_ID || process.env.CI_RUN_ID || "local-acceptance").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
const PLAN_CODE = "qa_task_acceptance_" + RUN_ID;
const PROBE_PLAN_CODE = "qa_task_probe_" + RUN_ID;
const TENANTS = {
  alpha: "qa_task_alpha_" + RUN_ID,
  beta: "qa_task_beta_" + RUN_ID,
  noRead: "qa_task_noread_" + RUN_ID,
  probe: "qa_task_probe_" + RUN_ID,
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
    if (name.endsWith("_TOKEN") && process.env.GITHUB_ACTIONS === "true") {
      // Register the mask before GitHub Actions emits the next step's environment.
      process.stdout.write("::add-mask::" + value + "\n");
    }
    appendFileSync(path, name + "=" + value + "\n", "utf8");
  }
}

async function seed() {
  const now = new Date().toISOString();
  const alphaKey = newApiKey();
  const betaKey = newApiKey();
  const noReadKey = newApiKey();
  const probeKey = newApiKey();
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
  const statements = [
    "INSERT INTO plan_policies (plan_code, quota_period, request_limit, policy_version, status, created_at, updated_at) VALUES (" +
      [sql(PLAN_CODE), sql("daily"), "2", sql("durable-task-acceptance-v1"), sql("active"), sql(now), sql(now)].join(", ") +
      ") ON CONFLICT(plan_code) DO NOTHING;",
    "INSERT INTO plan_policies (plan_code, quota_period, request_limit, policy_version, status, created_at, updated_at) VALUES (" +
      [sql(PROBE_PLAN_CODE), sql("daily"), String(FETCH_CANDIDATES.length), sql("durable-task-fetch-probe-v1"), sql("active"), sql(now), sql(now)].join(", ") +
      ") ON CONFLICT(plan_code) DO NOTHING;",
  ];
  for (const [label, tenantId] of Object.entries(TENANTS)) {
    const planCode = label === "probe" ? PROBE_PLAN_CODE : PLAN_CODE;
    statements.push(
      "INSERT INTO tenants (tenant_id, plan_code, status, created_at, updated_at) VALUES (" +
      [sql(tenantId), sql(planCode), sql("active"), sql(now), sql(now)].join(", ") +
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
    EF_TASK_PROBE_TOKEN: probeKey.token,
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

async function restPost(token, key, url) {
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

async function waitForRestTask(token, taskId) {
  const deadline = Date.now() + 30_000;
  let latest;
  do {
    latest = await restGet(token, taskId);
    assert.equal(latest.response.status, 200, "Tenant-owned Task status must be readable while awaiting completion.");
    if (!["accepted", "running"].includes(latest.body?.state)) return latest;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  } while (Date.now() < deadline);
  throw new Error("Durable Task did not reach a terminal state within the Acceptance deadline.");
}


function isPublicIpv4(value) {
  if (typeof value !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^(0|[1-9]\d{0,2})$/.test(part))) return false;
  const [a, b, c, d] = parts.map(Number);
  if ([a, b, c, d].some((octet) => octet < 0 || octet > 255)) return false;
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 2 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function ipv4ToHex(value) {
  return value.split(".").map((octet) => Number(octet).toString(16).padStart(2, "0")).join("");
}

async function queryDnsA(resolver, hostname) {
  if (resolver.system === true) {
    const answers = await resolve4(hostname, { ttl: true });
    return answers.map((answer) => ({
      ip: answer.address,
      ttl: Number(answer.ttl),
    }));
  }

  const url = new URL(resolver.endpoint);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", "A");
  const response = await fetch(url, {
    headers: { accept: "application/dns-json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(resolver.name + " returned HTTP " + response.status + " for " + hostname + ".");
  const payload = await response.json();
  if (Number(payload.Status) !== 0 || !Array.isArray(payload.Answer)) {
    throw new Error(
      resolver.name + " returned DNS status " + String(payload.Status) +
      " with no A-answer array for " + hostname + ".",
    );
  }
  const answers = payload.Answer
    .filter((answer) => answer.type === 1 && typeof answer.data === "string")
    .map((answer) => ({ ip: answer.data, ttl: Number(answer.TTL) }));
  if (answers.length === 0) {
    throw new Error(resolver.name + " returned no A records for " + hostname + ".");
  }
  return answers;
}

function isRetryableDnsError(error) {
  const code = String(error?.code || "").toUpperCase();
  return ["ESERVFAIL", "ETIMEOUT", "EAI_AGAIN", "ECONNREFUSED", "EDNS"].includes(code) ||
    ["AbortError", "TimeoutError"].includes(error?.name) ||
    /DNS status 2|SERVFAIL|temporarily unavailable/i.test(String(error?.message || ""));
}

async function queryDnsAWithRetry(resolver, hostname) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await queryDnsA(resolver, hostname);
    } catch (error) {
      if (!isRetryableDnsError(error) || attempt === maxAttempts) {
        throw new Error(
          resolver.name + " failed to resolve " + hostname + " after " + attempt +
          " attempt(s): " + String(error?.code || error?.message || error),
          { cause: error },
        );
      }
      console.warn(
        "Retrying transient DNS resolver failure: " +
        JSON.stringify({ resolver: resolver.name, hostname, attempt, code: error?.code || error?.name || "DNS_ERROR" }),
      );
      await new Promise((resolve) => setTimeout(resolve, 1_100));
    }
  }
  throw new Error(resolver.name + " exhausted DNS retries for " + hostname + ".");
}

async function queryDnsBatches(resolver, hostname, count) {
  const collected = [];
  for (let offset = 0; offset < count; offset += 1) {
    // 1u.ms uses zero-TTL answers; serialize queries to observe each rotation
    // avoid observing the same recursive-resolver cache entry in one burst.
    collected.push(...await queryDnsAWithRetry(resolver, hostname));
    if (offset + 1 < count) {
      await new Promise((resolve) => setTimeout(resolve, 1_100));
    }
  }
  return collected;
}

function createDnsRebindingHostname(publicIp, privateIp, suffix) {
  const safeSuffix = String(suffix).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  if (!safeSuffix || !/^[a-z0-9-]{8,48}$/.test(safeSuffix)) {
    throw new Error("A unique DNS rebinding hostname suffix is required.");
  }
  return "make-" + publicIp + "-rebindfor2mafter2times-" + privateIp + "-rr-" + safeSuffix + ".1u.ms";
}

async function assertDnsRebindingAlternates(hostname, publicIp, privateIp, targetIndex) {
  const observations = await collectDnsRebindingObservations({
    hostname,
    hostnameForResolver: (resolver) => createDnsRebindingHostname(
      publicIp,
      privateIp,
      createStageScopedDnsRebindingSuffix({
        stage: "runtime", runId: RUN_ID, targetIndex, resolverId: resolver.id,
      }),
    ),
    expectedAddresses: [publicIp, privateIp],
    resolvers: DNS_REBINDING_RESOLVERS,
    queryDnsBatches,
  });
  const inconclusive = observations.filter((observation) => observation.status === "inconclusive");
  if (inconclusive.length > 0) {
    console.warn(
      "Optional runner DNS diagnostics were inconclusive; the Cloudflare Worker probe remains required: " +
      JSON.stringify({ hostname, observations: inconclusive }),
    );
  }
  console.log("DNS rebinding preflight: " + JSON.stringify({ hostname, observations }));
}

async function runDnsRebindingAcceptance(token) {
  const publicIp = DNS_REBINDING_PUBLIC_IP;
  assert.ok(isPublicIpv4(publicIp), "DNS rebinding control must use a globally routable IPv4 address.");

  for (const [index, target] of DNS_REBINDING_PRIVATE_TARGETS.entries()) {
    // Use a disposable hostname for the runner's DoH preflight so its first
    // public answer cannot consume the Cloudflare Worker's independent session.
    const targetIndex = index + 1;
    // Keep Worker-runtime DNS checks in a separate 1u.ms namespace from the CI runner preflight.
    const preflightHostname = createDnsRebindingHostname(
      publicIp,
      target.ip,
      createStageScopedDnsRebindingSuffix({
        stage: "runtime", runId: RUN_ID, targetIndex, resolverId: "base",
      }),
    );
    await assertDnsRebindingAlternates(preflightHostname, publicIp, target.ip, targetIndex);

    const sessionId = "worker-" + RUN_ID + "-" + String(index + 1);
    const url = new URL(PLATFORM_URL + "/__acceptance/dns-rebinding-probe");
    url.searchParams.set("public", publicIp);
    url.searchParams.set("private", target.ip);
    url.searchParams.set("session", sessionId);
    const response = await fetch(url, {
      headers: { authorization: "Bearer " + token, accept: "application/json" },
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
    const result = await readJson(response, "Acceptance DNS rebinding probe");
    assert.equal(response.status, 200, "Isolated Worker DNS rebinding probe must return HTTP 200.");
    assert.equal(
      result.body.status,
      "mixed",
      "The first public answer and later rejected private-target attempts must be observed without any private response: " +
        JSON.stringify(result.body),
    );
    assert.equal(result.body.baselinePublicResponses, 1);
    assert.ok(result.body.publicResponses >= 1);
    assert.ok(result.body.networkErrors > 0);
    assert.equal(result.body.unexpectedResponses, 0);
    console.log("DNS rebinding verified: " + JSON.stringify({
      target: target.name,
      hostname: result.body.hostname,
      publicIp,
      privateIp: target.ip,
      baselineStatus: result.body.baseline.status,
      baselineServer: result.body.baseline.server,
      baselinePublicResponses: result.body.baselinePublicResponses,
      publicResponses: result.body.publicResponses,
      networkErrors: result.body.networkErrors,
      unexpectedResponses: result.body.unexpectedResponses,
    }));
  }
  console.log("DNS rebinding preflight and isolated Worker probes passed for loopback, 0.0.0.0 and 10.0.0.1.");
}
async function runNetworkDiagnostics(token) {
  const response = await fetch(PLATFORM_URL + "/__acceptance/network-probe", {
    headers: { authorization: "Bearer " + token, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  const result = await readJson(response, "Acceptance network diagnostics");
  assert.equal(response.status, 200, "Acceptance network diagnostics endpoint must be available only on the isolated Worker.");
  console.log("Raw Worker network diagnostics: " + JSON.stringify(result.body));
  return result.body;
}

async function findWorkingFetchTarget(token) {
  const failures = [];
  for (const [index, candidate] of FETCH_CANDIDATES.entries()) {
    const key = "fetch-probe-" + index + "-" + RUN_ID.slice(-24);
    try {
      const submission = await restPost(token, key, candidate.url);
      const task = taskFromApi(submission, "Fetch probe " + candidate.url);
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
      failures.push({
        url: candidate.url,
        diagnostic: String(error?.message || "Fetch probe failed").slice(0, 1400),
      });
    }
  }
  throw new Error("No deterministic public Fetch endpoint passed real Worker Acceptance: " + JSON.stringify(failures));
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
  const probe = process.env.EF_TASK_PROBE_TOKEN;
  assert.ok(alpha && beta && noRead && probe, "Acceptance API-key fixtures are missing.");

  const healthResponse = await fetch(PLATFORM_URL + "/api/v1/health", { signal: AbortSignal.timeout(15_000) });
  assert.equal(healthResponse.status, 200, "Acceptance Platform health must be ready.");

  // Capture raw native Worker fetch failures before testing the adapter/task path.
  const networkDiagnostics = await runNetworkDiagnostics(probe);
  assert.equal(networkDiagnostics.status, "reachable", "Raw native Worker fetch must reach at least one fixed public source before Task acceptance can proceed.");

  // Prove the DNS rebinding test service actually alternates before any runtime probe.
  await runDnsRebindingAcceptance(probe);

  // Find one genuinely reachable public source before testing cross-transport replay.
  // Probe attempts use a separate synthetic tenant and separate quota policy.
  const fetchTarget = await findWorkingFetchTarget(probe);

  // Two callers submit the same key concurrently. One task row and one quota unit must win.
  const concurrentKey = "rest-concurrent-" + RUN_ID.slice(-24);
  const concurrent = await Promise.all([
    restPost(alpha, concurrentKey, fetchTarget.url),
    restPost(alpha, concurrentKey, fetchTarget.url),
  ]);
  for (const [index, result] of concurrent.entries()) {
    assert.ok([200, 202, 502].includes(result.response.status), "Concurrent REST submission " + index + " returned HTTP " + result.response.status + ".");
  }
  const firstTask = taskFromApi(concurrent[0], "first concurrent REST submission");
  const secondTask = taskFromApi(concurrent[1], "second concurrent REST submission");
  assert.equal(firstTask.id, secondTask.id, "Concurrent same-key requests must resolve to one Task.");
  assert.equal(Number(firstTask.quota?.used), 1, "The first Task must reserve exactly one quota unit.");
  assert.equal(Number(secondTask.quota?.used), 1, "The replay must not reserve a second quota unit.");

  const replay = await restPost(alpha, concurrentKey, fetchTarget.url);
  assert.ok([200, 202, 502].includes(replay.response.status), "REST replay returned unexpected HTTP " + replay.response.status + ".");
  const replayTask = taskFromApi(replay, "REST idempotent replay");
  assert.equal(replayTask.id, firstTask.id);
  assert.equal(replay.response.headers.get("idempotency-replayed"), "true", "REST replay response must identify replay.");

  const conflict = await restPost(alpha, concurrentKey, "https://www.iana.org/");
  assert.equal(conflict.response.status, 409, "A reused key with a different request must return HTTP 409.");
  assert.equal(conflict.body.error?.code, "IDEMPOTENCY_KEY_REUSED");

  const status = await waitForRestTask(alpha, firstTask.id);
  assert.equal(status.body.id, firstTask.id);
  const restFetchProof = assertSuccessfulFetchTask({
    transport: "REST",
    httpStatus: status.response.status,
    task: status.body,
    expectedContent: fetchTarget.expectedContent,
    expectedHost: fetchTarget.expectedHost,
  });
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
  assert.equal(mcpReplayTask?.id, firstTask.id, "MCP must replay the REST-created Task.");

  const secondMcpKey = "mcp-second-" + RUN_ID.slice(-24);
  const mcpCreated = await mcpCall(alpha, 2, "web_fetch", {
    url: fetchTarget.url,
    idempotencyKey: secondMcpKey,
  });
  assert.equal(mcpCreated.response.status, 200);
  const mcpSecondTask = mcpCreated.body.result?.structuredContent;
  const mcpSecondProof = assertSuccessfulFetchTask({
    transport: "MCP",
    httpStatus: mcpCreated.response.status,
    task: mcpSecondTask,
    toolIsError: mcpCreated.body.result?.isError || false,
    expectedContent: fetchTarget.expectedContent,
    expectedHost: fetchTarget.expectedHost,
  });
  assert.ok(typeof mcpSecondTask?.id === "string", "MCP must create a second durable Task.");
  assert.equal(Number(mcpSecondTask.quota?.used), 2, "A distinct Task must reserve exactly one additional quota unit.");

  const secondRestStatus = await waitForRestTask(alpha, mcpSecondTask.id);
  assert.equal(secondRestStatus.body.id, mcpSecondTask.id);
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

  // At the exact quota ceiling, a new key is rejected but a valid replay remains readable.
  const exhausted = await restPost(alpha, "rest-quota-limit-" + RUN_ID.slice(-24), fetchTarget.url);
  assert.equal(exhausted.response.status, 429, "A new logical Task beyond the quota ceiling must be rejected.");
  assert.equal(exhausted.body.error?.code, "PLAN_QUOTA_EXCEEDED");

  const replayAtLimit = await restPost(alpha, concurrentKey, fetchTarget.url);
  assert.ok([200, 202, 502].includes(replayAtLimit.response.status), "An idempotency replay at the quota ceiling must remain available.");
  assert.equal(taskFromApi(replayAtLimit, "quota-ceiling replay").id, firstTask.id);

  console.log("Acceptance passed: real REST/MCP Fetch with retained content and verified provenance, concurrent idempotency, one-time quota reservation, 409 request identity, 24-hour expiry metadata, tenant isolation, tasks:read, REST/MCP parity and quota exhaustion.");
  console.log("Selected deterministic public source: " + JSON.stringify({ url: fetchTarget.url, proof: fetchTarget.proof }));
  console.log("Verified Fetch proof: " + JSON.stringify({ rest: restFetchProof, mcpReplay: mcpReplayProof, mcpCreated: mcpSecondProof }));
}

async function cleanup() {
  const tenantIds = Object.values(TENANTS);
  const inList = tenantIds.map(sql).join(", ");
  const statements = [
    "DELETE FROM tasks WHERE tenant_id IN (" + inList + ");",
    "DELETE FROM tenant_request_usage WHERE tenant_id IN (" + inList + ");",
    "DELETE FROM api_keys WHERE tenant_id IN (" + inList + ");",
    "DELETE FROM tenants WHERE tenant_id IN (" + inList + ");",
    "DELETE FROM plan_policies WHERE plan_code IN (" + [sql(PLAN_CODE), sql(PROBE_PLAN_CODE)].join(", ") + ");",
  ];
  execD1(statements.join("\n"));
  console.log("Removed run-scoped Acceptance Tasks, usage, API keys, tenants and plan policy.");
}

const mode = process.argv[2];
if (mode === "seed") await seed();
else if (mode === "smoke") await smoke();
else if (mode === "cleanup") await cleanup();
else throw new Error("Usage: node scripts/acceptance/durable-task-runtime.mjs <seed|smoke|cleanup>");
