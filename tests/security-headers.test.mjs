import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { withAuthSecurityHeaders } from "../src/core/auth-app.js";

function assertBaseline(response) {
  assert.equal(response.headers.get("strict-transport-security"), "max-age=63072000");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy") !== null, true);
}

test("API JSON responses include HSTS and baseline security headers", async () => {
  const response = await createWorker().fetch(new Request("https://exportflow.test/health"));
  assert.equal(response.status, 200);
  assertBaseline(response);
});

test("Better Auth config responses include HSTS and no-store", async () => {
  const response = await createWorker().fetch(new Request("https://exportflow.test/api/auth/config"));
  assert.equal(response.status, 200);
  assertBaseline(response);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("favicon and generated HTML not-found responses include baseline security headers", async () => {
  const worker = createWorker();
  const favicon = await worker.fetch(new Request("https://exportflow.test/favicon.ico"));
  assert.equal(favicon.status, 204);
  assertBaseline(favicon);

  const notFound = await worker.fetch(new Request("https://exportflow.test/not-a-route", {
    headers: { accept: "text/html" },
  }));
  assert.equal(notFound.status, 404);
  assertBaseline(notFound);
  assert.equal(notFound.headers.get("cache-control"), "no-store");
  assert.equal(notFound.headers.get("content-security-policy") !== null, true);
  assert.equal(notFound.headers.get("x-frame-options"), "DENY");
});

test("auth response wrapper preserves multiple Set-Cookie values", () => {
  const headers = new Headers();
  headers.append("set-cookie", "first=one; Path=/; HttpOnly");
  headers.append("set-cookie", "second=two; Path=/; HttpOnly");
  const response = withAuthSecurityHeaders(new Response("ok", { headers }));
  const cookies = response.headers.getSetCookie();
  assert.deepEqual(cookies, [
    "first=one; Path=/; HttpOnly",
    "second=two; Path=/; HttpOnly",
  ]);
  assertBaseline(response);
});
