import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.PARSER_COMPAT_PORT || 8789);
const origin = "http://127.0.0.1:" + port;
const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(executable, [
  "--yes",
  "wrangler@4",
  "dev",
  "--local",
  "--ip",
  "127.0.0.1",
  "--port",
  String(port),
  "--config",
  "cloudflare/parser-compat/wrangler.toml",
], {
  cwd: process.cwd(),
  stdio: "ignore",
});

let response;
let lastError;
try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error("Wrangler local runtime exited before becoming ready (code " + child.exitCode + ").");
    }
    try {
      response = await fetch(origin + "/health", { signal: AbortSignal.timeout(1_000) });
      if (response.ok) break;
      lastError = new Error("Local Worker returned HTTP " + response.status + ".");
    } catch (error) {
      lastError = error;
    }
    await delay(1_000);
  }

  if (!response?.ok) {
    throw new Error("Local Workers runtime did not become ready: " + String(lastError || "unknown error"));
  }

  const result = await response.json();
  assert.equal(result.status, "ok");
  assert.equal(result.articleStatus, "succeeded");
  assert.equal(result.articleHasExpectedText, true);
  assert.equal(result.csvMethod, "papaparse");
  assert.equal(result.csvRows, 2);
  console.log("local-workers-parser-runtime: PASS (LinkeDOM + Readability + PapaParse)");
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(5_000)]);
  }
}
