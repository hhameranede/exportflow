import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import net from "node:net";
import path from "node:path";

const projectRoot = process.cwd();
const routePath = path.join(projectRoot, "functions", "api", "__telemetry_runtime_test.js");
const cli = process.platform === "win32" ? "npx.cmd" : "npx";
const wranglerArgs = ["--yes", "wrangler@3.114.17"];
const previewDatabaseId = "decef588-a198-4bdd-9764-e0ce2e2caaee";
const migrationSql = readFileSync(
  path.join(projectRoot, "migrations", "telemetry", "0001_create_tracking_events.sql"),
  "utf8"
);
let pagesProcess;
let output = "";

const routeSource = `import { scheduleTrackingEvent } from "../lib/tracking-telemetry.mjs";

const MIGRATION_SQL = ${JSON.stringify(migrationSql.replace(/^\s*--.*$/gm, "").trim())};

export async function onRequest(context) {
  const database = context.env?.EXPORTFLOW_TELEMETRY_DB;
  if (!database) {
    return Response.json({ error: "preview_d1_binding_missing" }, { status: 503 });
  }

  const url = new URL(context.request.url);
  if (context.request.method === "GET" && !url.searchParams.has("requestId")) {
    // Apply the repository migration to the isolated local D1 database only.
    await database.exec(MIGRATION_SQL);
    return Response.json({ ready: true, binding: true });
  }

  if (context.request.method === "POST") {
    const requestId = crypto.randomUUID();
    const scheduled = scheduleTrackingEvent(context, context.env, {
      requestId,
      outcome: "failure",
      carrier: "DHL Express",
      errorClass: "synthetic_failure",
      durationMs: 17,
      attempts: [{
        carrier: "DHL Express",
        failureKind: "transport",
        durationMs: 9,
        trackingNumber: "PRIVATE_TRACKING_CANARY",
        postcode: "PRIVATE_POSTCODE_CANARY",
        message: "PRIVATE_UPSTREAM_CANARY"
      }],
      trackingNumber: "PRIVATE_TRACKING_CANARY",
      postcode: "PRIVATE_POSTCODE_CANARY",
      ipAddress: "PRIVATE_IP_CANARY",
      recipient: "PRIVATE_RECIPIENT_CANARY"
    });
    return Response.json({ requestId, scheduled }, { status: 202 });
  }

  if (context.request.method === "GET") {
    const requestId = url.searchParams.get("requestId");
    if (!requestId) return Response.json({ error: "request_id_required" }, { status: 400 });
    const row = await database.prepare(
      "SELECT request_id, outcome, carrier, error_class, duration_ms, attempts_json FROM exportflow_tracking_events WHERE request_id = ?"
    ).bind(requestId).first();
    const serialized = JSON.stringify(row ?? {});
    const privateMarkers = [
      "PRIVATE_TRACKING_CANARY",
      "PRIVATE_POSTCODE_CANARY",
      "PRIVATE_UPSTREAM_CANARY",
      "PRIVATE_IP_CANARY",
      "PRIVATE_RECIPIENT_CANARY"
    ];
    return Response.json({
      persisted: Boolean(row),
      containsPrivateData: privateMarkers.some(marker => serialized.includes(marker)),
      outcome: row?.outcome ?? null,
      carrier: row?.carrier ?? null,
      errorClass: row?.error_class ?? null,
      durationMs: row?.duration_ms ?? null,
      attempts: row?.attempts_json ?? null
    });
  }

  return Response.json({ error: "method_not_allowed" }, { status: 405 });
}
`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function reservePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForReady(baseUrl) {
  let lastResponse = "No HTTP response received yet.";
  let lastError = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (pagesProcess.exitCode !== null) {
      throw new Error("Wrangler Pages dev exited before readiness (exit " +
        pagesProcess.exitCode + "). Last response: " + lastResponse +
        (lastError ? "; last fetch error: " + lastError : "") + "\n" + output);
    }
    try {
      const response = await fetch(baseUrl + "/api/__telemetry_runtime_test", {
        signal: AbortSignal.timeout(2_000)
      });
      const body = await response.text();
      lastResponse = "HTTP " + response.status + " " + body.slice(0, 2_000);
      if (response.ok) {
        let data;
        try {
          data = JSON.parse(body);
        } catch {
          throw new Error("Readiness route returned non-JSON response: " + lastResponse);
        }
        if (data.ready === true && data.binding === true) return;
      }
    } catch (error) {
      lastError = error?.message || String(error);
    }
    await sleep(250);
  }
  throw new Error("Timed out waiting for local Pages/D1 runtime after 30 seconds. " +
    "Last response: " + lastResponse +
    (lastError ? "; last fetch error: " + lastError : "") + "\n" + output);
}
async function waitForRow(baseUrl, requestId) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(
      baseUrl + "/api/__telemetry_runtime_test?requestId=" + encodeURIComponent(requestId),
      { signal: AbortSignal.timeout(3_000) }
    );
    if (!response.ok) {
      throw new Error("Local telemetry read returned HTTP " + response.status);
    }
    const result = await response.json();
    if (result.persisted) return result;
    await sleep(250);
  }
  throw new Error("Scheduled waitUntil task did not persist the local D1 row.\n" + output);
}

async function stopPages() {
  if (!pagesProcess) return;

  const signalProcessTree = signal => {
    try {
      if (process.platform === "win32" || !pagesProcess.pid) {
        if (pagesProcess.exitCode === null && pagesProcess.signalCode === null) {
          pagesProcess.kill(signal);
        }
      } else {
        // npx launches Wrangler as a child process. Kill the whole detached
        // process group so workerd/Wrangler cannot keep the CI runner alive.
        process.kill(-pagesProcess.pid, signal);
      }
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  };

  const exited = new Promise(resolve => {
    if (pagesProcess.exitCode !== null || pagesProcess.signalCode !== null) resolve();
    else pagesProcess.once("exit", resolve);
  });
  signalProcessTree("SIGTERM");
  await Promise.race([exited, sleep(1_500)]);
  // Also terminate any grandchildren if npx itself exited first.
  signalProcessTree("SIGKILL");
  await Promise.race([exited, sleep(1_500)]);
}

try {
  if (existsSync(routePath)) {
    throw new Error("Refusing to overwrite existing file: " + routePath);
  }

  writeFileSync(routePath, routeSource, { flag: "wx" });

  const port = await reservePort();
  const baseUrl = "http://127.0.0.1:" + port;
  const args = [
    ...wranglerArgs,
    "pages", "dev", "dist",
    "--local",
    "--d1", `EXPORTFLOW_TELEMETRY_DB=${previewDatabaseId}`,
    "--ip", "127.0.0.1",
    "--port", String(port)
  ];

  pagesProcess = spawn(cli, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      NO_COLOR: "1"
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32"
  });
  pagesProcess.stdout.on("data", chunk => { output = (output + chunk.toString()).slice(-12_000); });
  pagesProcess.stderr.on("data", chunk => { output = (output + chunk.toString()).slice(-12_000); });
  pagesProcess.once("error", error => { output += "\n" + error.message; });

  console.log("Starting local Pages runtime with an isolated D1 binding.");
  await waitForReady(baseUrl);
  console.log("Local Pages runtime and D1 binding are ready.");

  const canaryResponse = await fetch(baseUrl + "/api/__telemetry_runtime_test", {
    method: "POST",
    signal: AbortSignal.timeout(5_000)
  });
  assert.equal(canaryResponse.status, 202);
  console.log("Synthetic telemetry canary accepted by the Pages Function.");
  const canary = await canaryResponse.json();
  assert.equal(canary.scheduled, true);
  assert.match(canary.requestId, /^[0-9a-f-]{36}$/i);

  const persisted = await waitForRow(baseUrl, canary.requestId);
  console.log("D1 canary row became readable after waitUntil.");
  assert.equal(persisted.persisted, true);
  assert.equal(persisted.containsPrivateData, false);
  assert.equal(persisted.outcome, "failure");
  assert.equal(persisted.carrier, "dhl-express");
  assert.equal(persisted.errorClass, "synthetic-failure");
  assert.equal(persisted.durationMs, 17);
  const attempts = JSON.parse(persisted.attempts);
  assert.deepEqual(attempts, [{
    carrier: "dhl-express",
    failureKind: "transport",
    durationMs: 9
  }]);

  console.log("Local Pages runtime D1 persistence test passed.");
  console.log("Verified: local D1 binding, migration SQL, context.waitUntil(), real D1 batch write and privacy allow-list.");
  console.log("No remote D1 database or carrier API was contacted.");
} catch (error) {
  console.error(error?.stack || error);
  if (output) console.error(output);
  process.exitCode = 1;
} finally {
  await stopPages();
  if (existsSync(routePath)) unlinkSync(routePath);
}
