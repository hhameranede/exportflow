import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createNodeHandler } from "../src/server.js";

test("Node HTTP adapter preserves every Set-Cookie header from Worker responses", async (t) => {
  const expectedCookies = [
    "exportflow.session_token=session-token; Path=/; HttpOnly; SameSite=Lax",
    "exportflow.two_factor=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
    "exportflow.trust_device=trusted-device; Path=/; HttpOnly; SameSite=Lax",
  ];

  const workerInstance = {
    async fetch() {
      const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
      for (const cookie of expectedCookies) headers.append("set-cookie", cookie);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    },
  };

  const server = http.createServer(createNodeHandler({ workerInstance, env: {} }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const address = server.address();
  assert.ok(address && typeof address === "object" && address.port > 0);
  const response = await fetch("http://127.0.0.1:" + address.port + "/test");
  assert.equal(response.status, 200);
  assert.deepEqual(response.headers.getSetCookie(), expectedCookies);
  assert.deepEqual(await response.json(), { ok: true });
});
