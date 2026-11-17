import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 8799;
const url = `http://127.0.0.1:${port}/`;
const child = spawn(
  "wrangler",
  [
    "dev",
    "--local",
    "--config",
    "wrangler.defuddle-test.toml",
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--log-level",
    "error",
  ],
  {
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let output = "";
child.stdout.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
child.stderr.setEncoding("utf8").on("data", (chunk) => { output += chunk; });

async function waitForWorker() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Wrangler exited before the test request.\n" + output);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status >= 500) {
        const body = await response.text();
        throw new Error("Worker returned HTTP " + response.status + ": " + body + "\n" + output);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Worker returned")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for local workerd.\n" + output);
}

try {
  const response = await waitForWorker();
  const result = await response.json();

  assert.equal(result.parserVersion, "0.19.6");
  assert.equal(result.fixtures.length, 4);

  const article = result.fixtures.find((item) => item.id === "article-multilingual");
  const docs = result.fixtures.find((item) => item.id === "technical-documentation");
  const product = result.fixtures.find((item) => item.id === "product-detail");
  const jsonLd = result.fixtures.find((item) => item.id === "jsonld-articlebody-fallback");

  assert.ok(article && docs && product && jsonLd);
  assert.match(article.markdown, /This is the primary article paragraph/);
  assert.match(article.markdown, /هذا نص عربي/);
  assert.match(article.markdown, /Fetch through ExportFlow and parse locally/);
  assert.match(article.markdown, /\| Layer \| Role \|/);
  assert.doesNotMatch(article.markdown, /javascript:|onclick=|onerror=|<script/i);
  assert.ok(article.wordCount > 100);

  assert.match(docs.markdown, /API section 1/);
  assert.match(docs.markdown, /Fetch a public resource/);
  assert.match(docs.markdown, /timeoutMs/);
  assert.match(docs.markdown, /maxBytes/);
  assert.match(docs.markdown, /await fetch/);
  assert.ok(docs.wordCount > 100);

  assert.match(product.title, /Research Notebook/);
  assert.match(product.markdown, /Product section 1/);
  assert.ok(product.wordCount > 100);

  assert.match(jsonLd.markdown, /Structured JSON-LD article section 1/);
  assert.doesNotMatch(jsonLd.markdown, /javascript:|onerror=|<script/i);
  assert.ok(jsonLd.wordCount > 100);

  for (const fixture of result.fixtures) {
    assert.deepEqual(fixture.globalsAfter, fixture.globalsBefore);
    assert.ok(Number.isFinite(fixture.workerElapsedMs) && fixture.workerElapsedMs > 0);
    process.stdout.write(
      "workerd Defuddle " + fixture.id +
      ": words=" + fixture.wordCount +
      ", parserMs=" + fixture.parseTimeMs +
      ", workerMs=" + fixture.workerElapsedMs + "\n",
    );
  }
  process.stdout.write("workerd Defuddle smoke tests passed: version=" + result.parserVersion + "\n");
} catch (error) {
  process.stderr.write(String(error) + "\n" + output);
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once("exit", resolve);
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 5_000).unref();
  });
}
