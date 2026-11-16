import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const projectRoot = process.cwd();
const routePath = path.join(projectRoot, "functions", "api", "__telemetry_runtime_test.js");
const stateDirectory = mkdtempSync(path.join(os.tmpdir(), "exportflow-telemetry-local-"));
const cli = process.platform === "win32" ? "npx.cmd" : "npx";
const wranglerArgs = ["--yes", "wrangler@3.114.17"];
let pagesProcess;
let output = "";

const routeSource = `import { scheduleTrackingEvent } from "../lib/tracking-telemetry.mjs";

export async function onRequest(context) {
  const database = context.env?.EXPORTFLOW_TELEMETRY_DB;
  if (!database) {
    return Response.json({ error: "preview_d1_binding_missing" }, { status: 503 });
  }

  const url = new URL(context.request.url);
  if (context.request.method === "GET" && !url.searchParams.has("requestId")) {
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

function runLocalMigration() {
  const args = [
    ...wranglerArgs,
    "d1", "migrations", "apply",
    "exportflow-tracking-telemetry-preview-db",
    "--env", "preview",
    "--persist-to", stateDirectory,
    "--yes"
  ];
  const result = spawnSync(cli, args, {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      NO_COLOR: "1"
    },
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      "Local-only D1 migration failed.\n" +
      (result.stdout || "") + "\n" + (result.stderr || "")
    );
  }
  return (result.stdout || "") + (result.stderr || "");
}

async function waitForReady(baseUrl) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (pagesProcess.exitCode !== null) {
      throw new Error("Wrangler Pages dev exited before readiness.\n" + output);
    }
    try {
      const response = await fetch(baseUrl + "/api/__telemetry_runtime_test", {
        signal: AbortSignal.timeout(1_500)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.ready === true && data.binding === true) return;
      }
    } catch {
      // Wrangler is still starting.
    }
    await sleep(250);
  }
  throw new Error("Timed out waiting for local Pages/D1 runtime.\n" + output);
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
  if (!pagesProcess || pagesProcess.exitCode !== null || pagesProcess.killed) return;
  const exited = new Promise(resolve => pagesProcess.once("exit", resolve));
  pagesProcess.kill("SIGTERM");
  await Promise.race([exited, sleep(5_000)]);
  if (pagesProcess.exitCode === null) pagesProcess.kill("SIGKILL");
}

try {
  if (existsSync(routePath)) {
    throw new Error("Refusing to overwrite existing file: " + routePath);
  }

  // The D1 migration command explicitly uses --local. Pages dev runs against
  // local resources by default; this test must never use --remote or call a carrier.
  const migrationOutput = runLocalMigration();
  writeFileSync(routePath, routeSource, { flag: "wx" });

  const port = await reservePort();
  const baseUrl = "http://127.0.0.1:" + port;
  const args = [
    ...wranglerArgs,
    "pages", "dev", "dist",
    "--local",
    "--env", "preview",
    "--ip", "127.0.0.1",
    "--port", String(port),
    "--persist-to", stateDirectory
  ];

  pagesProcess = spawn(cli, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      NO_COLOR: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  pagesProcess.stdout.on("data", chunk => { output = (output + chunk.toString()).slice(-12_000); });
  pagesProcess.stderr.on("data", chunk => { output = (output + chunk.toString()).slice(-12_000); });
  pagesProcess.once("error", error => { output += "\n" + error.message; });

  await waitForReady(baseUrl);

  const canaryResponse = await fetch(baseUrl + "/api/__telemetry_runtime_test", {
    method: "POST",
    signal: AbortSignal.timeout(5_000)
  });
  assert.equal(canaryResponse.status, 202);
  const canary = await canaryResponse.json();
  assert.equal(canary.scheduled, true);
  assert.match(canary.requestId, /^[0-9a-f-]{36}$/i);

  const persisted = await waitForRow(baseUrl, canary.requestId);
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
  console.log("Verified: Preview binding resolution, context.waitUntil(), real local D1 batch write, migration and privacy allow-list.");
  console.log("No remote D1 database or carrier API was contacted.");
} catch (error) {
  console.error(error?.stack || error);
  if (output) console.error(output);
  process.exitCode = 1;
} finally {
  await stopPages();
  if (existsSync(routePath)) unlinkSync(routePath);
  rmSync(stateDirectory, { recursive: true, force: true });
}
