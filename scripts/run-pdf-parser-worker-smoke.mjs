import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createSyntheticPdf } from "../tests/fixtures/synthetic-pdf.mjs";

const host = "127.0.0.1";
const port = Number(process.env.PDF_PARSER_SMOKE_PORT || 8791);
const baseUrl = "http://" + host + ":" + port;
// Local-only fixture token. Remote Acceptance must provision a different secret.
const localSmokeToken = "local-only-pdf-parser-smoke-token-2026";
const authorization = "Bearer " + localSmokeToken;

async function fetchWithTimeout(path, options = {}, timeoutMs = 15_000) {
  return fetch(baseUrl + path, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

const child = spawn("npx", [
  "--yes",
  "wrangler@4",
  "dev",
  "--local",
  "--ip",
  host,
  "--port",
  String(port),
  "--config",
  "cloudflare/pdf-parser-compat/wrangler.toml",
  "--var",
  "PDF_PARSER_SMOKE_TOKEN:" + localSmokeToken,
], {
  stdio: ["ignore", "pipe", "pipe"],
  detached: process.platform !== "win32",
  env: {
    ...process.env,
    CI: "true",
    NO_COLOR: "1",
    WRANGLER_SEND_METRICS: "false",
  },
});

function signalWorkerTree(signal) {
  if (process.platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to signaling the direct child if its process group is unavailable.
    }
  }
  try { child.kill(signal); } catch {}
}

let output = "";
child.stdout.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
child.stderr.setEncoding("utf8").on("data", (chunk) => { output += chunk; });

const watchdogId = setTimeout(() => {
  process.stderr.write("PDF parser smoke exceeded its 90-second overall deadline.\\n" + output);
  signalWorkerTree("SIGKILL");
  process.exit(1);
}, 90_000);

async function readJsonWithTimeout(response, stage, timeoutMs = 15_000) {
  let timeoutId;
  try {
    return await Promise.race([
      response.json(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(stage + " response body timed out after " + timeoutMs + "ms")), timeoutMs);
      }),
    ]);
  } catch (error) {
    try { await response.body?.cancel(); } catch {}
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Local Workerd PDF parser Worker exited early.\\n" + output);
    }
    try {
      const response = await fetchWithTimeout("/health", {}, 1_500);
      if (response.ok) return;
    } catch {
      // Wrangler may still be compiling the Worker.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the local Workerd PDF parser Worker.\\n" + output);
}

try {
  process.stdout.write("Starting local Workerd PDF parser Worker...\\n");
  await waitForServer();
  process.stdout.write("PASS local Workerd health endpoint is responding.\\n");

  const healthResponse = await fetchWithTimeout("/health");
  const health = await readJsonWithTimeout(healthResponse, "health");

  assert.equal(health.status, "ok");
  assert.equal(health.parser, "unpdf");
  assert.equal(health.parserVersion, "2.2.3");

  const validPdf = createSyntheticPdf(["Cloudflare Workerd PDF smoke"]);
  const unauthorizedResponse = await fetchWithTimeout("/parse", {
    method: "POST",
    headers: { "content-type": "application/pdf" },
    body: validPdf,
  });
  assert.equal(unauthorizedResponse.status, 401);
  const unauthorizedBody = await readJsonWithTimeout(unauthorizedResponse, "unauthorized rejection");
  assert.equal(unauthorizedBody.error.code, "UNAUTHORIZED");
  process.stdout.write("PASS unauthenticated parse requests are rejected.\\n");

  process.stdout.write("Sending valid synthetic PDF...\\n");
  const parsedResponse = await fetchWithTimeout("/parse", {
    method: "POST",
    headers: {
      "content-type": "application/pdf",
      authorization,
    },
    body: validPdf,
  });
  assert.equal(parsedResponse.status, 200);
  const parsed = await readJsonWithTimeout(parsedResponse, "valid PDF parse");
  process.stdout.write("PASS valid PDF text extraction returned.\\n");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.totalPages, 1);
  assert.match(parsed.text, /Cloudflare Workerd PDF smoke/);
  assert.equal("bodyBytes" in parsed, false);

  const wrongMime = await fetchWithTimeout("/parse", {
    method: "POST",
    headers: {
      "content-type": "text/html",
      authorization,
    },
    body: validPdf,
  });
  assert.equal(wrongMime.status, 415);
  const wrongMimeBody = await readJsonWithTimeout(wrongMime, "wrong MIME rejection");
  process.stdout.write("PASS wrong MIME rejection returned.\\n");
  assert.equal(wrongMimeBody.error.code, "UNSUPPORTED_CONTENT_TYPE");

  const wrongSignature = await fetchWithTimeout("/parse", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      authorization,
    },
    body: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
  });
  assert.equal(wrongSignature.status, 415);
  const wrongSignatureBody = await readJsonWithTimeout(wrongSignature, "wrong signature rejection");
  process.stdout.write("PASS wrong PDF signature rejection returned.\\n");
  assert.equal(wrongSignatureBody.error.code, "PDF_INVALID_SIGNATURE");

  process.stdout.write("PASS local Workerd PDF parser smoke: auth gate, valid PDF text, MIME rejection, signature rejection.\\n");
} catch (error) {
  process.stderr.write((error?.stack || String(error)) + "\\n" + output);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdogId);
  if (child.exitCode === null && child.signalCode === null) {
    signalWorkerTree("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(() => {
        signalWorkerTree("SIGKILL");
        resolve();
      }, 4000)),
    ]);
  }
}
