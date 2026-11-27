import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createSyntheticPdf } from "../tests/fixtures/synthetic-pdf.mjs";

const host = "127.0.0.1";
const port = Number(process.env.PDF_PARSER_SMOKE_PORT || 8791);
const baseUrl = "http://" + host + ":" + port;
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
], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NO_COLOR: "1" },
});

let output = "";
child.stdout.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
child.stderr.setEncoding("utf8").on("data", (chunk) => { output += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Local Workerd PDF parser Worker exited early.\n" + output);
    }
    try {
      const response = await fetch(baseUrl + "/health", { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {
      // Wrangler may still be compiling the Worker.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the local Workerd PDF parser Worker.\n" + output);
}

try {
  await waitForServer();

  const health = await fetch(baseUrl + "/health").then((response) => response.json());
  assert.equal(health.status, "ok");
  assert.equal(health.parser, "unpdf");
  assert.equal(health.parserVersion, "2.2.3");

  const validPdf = createSyntheticPdf(["Cloudflare Workerd PDF smoke"]);
  const parsedResponse = await fetch(baseUrl + "/parse", {
    method: "POST",
    headers: { "content-type": "application/pdf" },
    body: validPdf,
  });
  assert.equal(parsedResponse.status, 200);
  const parsed = await parsedResponse.json();
  assert.equal(parsed.ok, true);
  assert.equal(parsed.totalPages, 1);
  assert.match(parsed.text, /Cloudflare Workerd PDF smoke/);
  assert.equal("bodyBytes" in parsed, false);

  const wrongMime = await fetch(baseUrl + "/parse", {
    method: "POST",
    headers: { "content-type": "text/html" },
    body: validPdf,
  });
  assert.equal(wrongMime.status, 415);
  const wrongMimeBody = await wrongMime.json();
  assert.equal(wrongMimeBody.error.code, "UNSUPPORTED_CONTENT_TYPE");

  const wrongSignature = await fetch(baseUrl + "/parse", {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
  });
  assert.equal(wrongSignature.status, 415);
  const wrongSignatureBody = await wrongSignature.json();
  assert.equal(wrongSignatureBody.error.code, "PDF_INVALID_SIGNATURE");

  process.stdout.write("PASS local Workerd PDF parser smoke: valid PDF text, MIME rejection, signature rejection.\n");
} catch (error) {
  process.stderr.write((error?.stack || String(error)) + "\n" + output);
  process.exitCode = 1;
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      }, 4000).unref();
    });
  }
}
