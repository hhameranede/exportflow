import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";

const REQUIRED_HTML_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
];

test("HTML 404 responses use the same security policy as rendered site pages", async () => {
  const worker = createWorker();
  const home = await worker.fetch(new Request("https://exportflow.local/"), {});
  const missing = await worker.fetch(new Request("https://exportflow.local/en/not-a-real-page", {
    headers: { accept: "text/html" },
  }), {});

  assert.equal(home.status, 200);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("cache-control"), "no-store");

  for (const header of REQUIRED_HTML_HEADERS) {
    assert.equal(typeof home.headers.get(header), "string", `home missing ${header}`);
    assert.equal(missing.headers.get(header), home.headers.get(header), `404 mismatch for ${header}`);
  }
});

test("JSON API responses include HSTS and nosniff headers", async () => {
  const worker = createWorker();
  const response = await worker.fetch(new Request("https://exportflow.local/api/v1/not-a-real-route"), {});

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("strict-transport-security"), "max-age=63072000");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cache-control"), "no-store");
});
