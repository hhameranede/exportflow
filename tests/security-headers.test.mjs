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

test("auth response wrapper uses the Workers getAll API without folding cookies", () => {
  const downstream = new Response("ok", { status: 200 });
  downstream.headers.append("set-cookie", "exportflow.session=first; Path=/; HttpOnly; Secure; SameSite=Lax");
  downstream.headers.append("set-cookie", "exportflow.state=second; Path=/; HttpOnly; Secure; SameSite=Lax");

  Object.defineProperty(downstream.headers, "getAll", {
    value: (name) => name.toLowerCase() === "set-cookie"
      ? downstream.headers.getSetCookie()
      : (() => { throw new Error("getAll is only supported for Set-Cookie"); })(),
  });

  const secured = withAuthSecurityHeaders(downstream);
  const cookies = secured.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.ok(cookies[0].includes("exportflow.session=first"));
  assert.ok(cookies[1].includes("exportflow.state=second"));
});
