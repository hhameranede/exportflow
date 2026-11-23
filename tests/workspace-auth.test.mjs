import test from "node:test";
import assert from "node:assert/strict";
import { createLocalRuntimeEnv } from "../src/core/local-runtime.js";
import { createWorker } from "../src/index.js";

function extractSessionCookie(headers) {
  const raw = headers.getSetCookie ? headers.getSetCookie() : [headers.get("set-cookie")].filter(Boolean);
  for (const item of raw) {
    const tokenMatch = item.match(/exportflow\.session_token=[^;]+/);
    if (tokenMatch) return tokenMatch[0];
  }
  return null;
}

test("unauthenticated workspace endpoints fail closed with 401 and public marketing gates render locked", async () => {
  const env = await createLocalRuntimeEnv({ dbPath: ":memory:", port: 3000 });
  const worker = createWorker();

  const overview = await worker.fetch(new Request("http://127.0.0.1:3000/api/v1/workspace/overview"), env);
  assert.equal(overview.status, 401);
  assert.equal((await overview.json()).error.code, "UNAUTHORIZED");

  const execRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/v1/workspace/execute", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify({ goal: "Test", url: "https://example.com", mode: "simulate" }),
  }), env);
  assert.equal(execRes.status, 401);

  for (const route of ["/demo", "/platform", "/use-cases", "/developers", "/ar/demo"]) {
    const page = await worker.fetch(new Request(`http://127.0.0.1:3000${route}`), env);
    assert.equal(page.status, 200, `${route} should return 200`);
    const html = await page.text();
    assert.match(html, /data-requires-auth="true"/);
    assert.match(html, /data-auth-gate/);
  }

  for (const route of ["/account", "/workspace", "/ar/account", "/ar/workspace"]) {
    const page = await worker.fetch(new Request(`http://127.0.0.1:3000${route}`), env);
    assert.equal(page.status, 200, `${route} should return 200`);
    const html = await page.text();
    assert.match(html, /ef-auth-wide-wrap/);
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  }
});

test("full local auth lifecycle: signup, verification, session login, workspace API keys, bounded execution, password reset, and signout", async () => {
  const env = await createLocalRuntimeEnv({ dbPath: ":memory:", port: 3000 });
  const worker = createWorker({
    fetchImpl: async (targetUrl) => new Response(`<html><title>Verified Target</title><body>Hello ${targetUrl}</body></html>`, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  });

  const email = "architect@exportflow.test";
  const password = "StrongPassword!2026";
  const nextPassword = "RotatedPassword!2026";

  // 1. Auth config reveals email/password + local mailbox enabled
  const cfgRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/auth/config"), env);
  assert.equal(cfgRes.status, 200);
  const cfg = await cfgRes.json();
  assert.equal(cfg.authConfigured, true);
  assert.equal(cfg.authReady, true);
  assert.equal(cfg.emailPasswordEnabled, true);
  assert.equal(cfg.localMailboxEnabled, true);

  // 2. Sign up
  const signUpRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/auth/sign-up/email", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify({ name: "Ada Lovelace", email, password }),
  }), env);
  assert.equal(signUpRes.status, 200);

  // 3. Retrieve verification link from local mailbox & verify email
  const verifyBoxRes = await worker.fetch(new Request(`http://127.0.0.1:3000/api/auth/dev-mailbox?email=${encodeURIComponent(email)}&kind=verify`), env);
  assert.equal(verifyBoxRes.status, 200);
  const verifyBox = await verifyBoxRes.json();
  assert.equal(verifyBox.hasMessage, true);
  assert.ok(verifyBox.actionPath?.startsWith("/api/auth/verify-email"));

  const verifyRes = await worker.fetch(new Request(`http://127.0.0.1:3000${verifyBox.actionPath}`), env);
  const cookie = extractSessionCookie(verifyRes.headers);
  assert.ok(cookie, "email verification should establish a session cookie");

  // 4. Create and revoke Workspace API key
  const createKeyRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/v1/workspace/keys", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", cookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "CI Runner Key", scopes: ["tasks:fetch", "workspace:read"] }),
  }), env);
  assert.equal(createKeyRes.status, 201);
  const createdKey = await createKeyRes.json();
  assert.match(createdKey.rawKey, /^ef_ws_[0-9a-f]{16}_[0-9a-f]{40}$/);

  const listKeysRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/v1/workspace/keys", {
    headers: { cookie },
  }), env);
  assert.equal(listKeysRes.status, 200);
  const listedKeys = await listKeysRes.json();
  assert.equal(listedKeys.keys.length, 1);
  assert.equal(listedKeys.keys[0].id, createdKey.key.id);
  assert.ok(!JSON.stringify(listedKeys).includes(createdKey.rawKey), "stored keys must never expose rawKey");

  // 5. Execute dry-run simulate (200), live task (200), & verify SSRF blocking (400)
  const simRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/v1/workspace/execute", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", cookie, "content-type": "application/json" },
    body: JSON.stringify({
      goal: "Dry run check",
      url: "https://example.com/docs",
      operation: "fetch",
      mode: "simulate",
    }),
  }), env);
  assert.equal(simRes.status, 200);
  const simBody = await simRes.json();
  assert.equal(simBody.execution.state, "succeeded");
  assert.equal(simBody.execution.execution.adapterId, "http.fetch.v1");

  const liveRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/v1/workspace/execute", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", cookie, "content-type": "application/json" },
    body: JSON.stringify({
      goal: "Fetch verified example document",
      url: "https://example.com/docs",
      operation: "fetch",
      mode: "live",
      limits: { timeoutMs: 4000, maxBytes: 65536, maxRedirects: 1 },
    }),
  }), env);
  assert.equal(liveRes.status, 200);
  const liveBody = await liveRes.json();
  assert.equal(liveBody.execution.state, "succeeded");
  assert.equal(liveBody.execution.execution.adapterId, "http.fetch.v1");

  const ssrfRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/v1/workspace/execute", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", cookie, "content-type": "application/json" },
    body: JSON.stringify({
      goal: "Attempt loopback access",
      url: "http://127.0.0.1/admin",
      operation: "fetch",
      mode: "live",
    }),
  }), env);
  assert.equal(ssrfRes.status, 400);
  const ssrfBody = await ssrfRes.json();
  assert.equal(ssrfBody.error.code, "URL_NOT_ALLOWED");

  const overviewRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/v1/workspace/overview", {
    headers: { cookie },
  }), env);
  assert.equal(overviewRes.status, 200);
  const overview = await overviewRes.json();
  assert.equal(overview.stats.activeKeys, 1);
  assert.equal(overview.stats.totalExecutions, 2);
  assert.equal(overview.stats.succeededExecutions, 2);

  const revokeRes = await worker.fetch(new Request(`http://127.0.0.1:3000/api/v1/workspace/keys?id=${encodeURIComponent(createdKey.key.id)}`, {
    method: "DELETE",
    headers: { origin: "http://127.0.0.1:3000", cookie },
  }), env);
  assert.equal(revokeRes.status, 200);

  // 6. Sign out invalidates workspace access
  const signOutRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/auth/sign-out", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", cookie, "content-type": "application/json" },
    body: "{}",
  }), env);
  assert.equal(signOutRes.status, 200);

  const afterSignOut = await worker.fetch(new Request("http://127.0.0.1:3000/api/v1/workspace/overview", {
    headers: { cookie },
  }), env);
  assert.equal(afterSignOut.status, 401);

  // 7. Account recovery (request reset -> local mailbox -> reset password -> sign in)
  const forgotRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/auth/request-password-reset", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify({ email, redirectTo: "/reset-password" }),
  }), env);
  assert.equal(forgotRes.status, 200);

  const resetBoxRes = await worker.fetch(new Request(`http://127.0.0.1:3000/api/auth/dev-mailbox?email=${encodeURIComponent(email)}&kind=reset`), env);
  assert.equal(resetBoxRes.status, 200);
  const resetBox = await resetBoxRes.json();
  assert.equal(resetBox.hasMessage, true);
  assert.ok(resetBox.actionPath?.startsWith("/api/auth/reset-password/"));

  const resetRedirectRes = await worker.fetch(new Request(`http://127.0.0.1:3000${resetBox.actionPath}`, {
    redirect: "manual",
  }), env);
  assert.equal(resetRedirectRes.status, 302);
  const locationHeader = resetRedirectRes.headers.get("location");
  assert.ok(locationHeader, "reset callback should redirect to /reset-password");
  const token = new URL(locationHeader, "http://127.0.0.1:3000").searchParams.get("token");
  assert.ok(token, "password reset token should be present in redirect location");

  const resetConfirmRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/auth/reset-password", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify({ token, newPassword: nextPassword }),
  }), env);
  assert.equal(resetConfirmRes.status, 200);

  const loginRes = await worker.fetch(new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify({ email, password: nextPassword }),
  }), env);
  assert.equal(loginRes.status, 200);
  const nextCookie = extractSessionCookie(loginRes.headers);
  assert.ok(nextCookie);

  const restoredOverview = await worker.fetch(new Request("http://127.0.0.1:3000/api/v1/workspace/overview", {
    headers: { cookie: nextCookie },
  }), env);
  assert.equal(restoredOverview.status, 200);
});

test("brand mark, SVG favicon, spec metrics, task SVGs, and command palette render across routes", async () => {
  const env = await createLocalRuntimeEnv({ dbPath: ":memory:", port: 3000 });
  const worker = createWorker();

  const favRes = await worker.fetch(new Request("http://127.0.0.1:3000/favicon.ico"), env);
  assert.equal(favRes.status, 200);
  assert.match(favRes.headers.get("content-type") || "", /image\/svg\+xml/);
  const favSvg = await favRes.text();
  assert.match(favSvg, /viewBox="0 0 64 64"/);
  assert.match(favSvg, /M44\.5 56\.5/);

  const markRes = await worker.fetch(new Request("http://127.0.0.1:3000/assets/mark.svg"), env);
  assert.equal(markRes.status, 200);
  assert.equal(await markRes.text(), favSvg);

  for (const route of ["/", "/ar/"]) {
    const home = await worker.fetch(new Request(`http://127.0.0.1:3000${route}`), env);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /ef-mark ef-mark-cat/);
    assert.match(html, /href="\/assets\/mark\.svg"/);
    assert.doesNotMatch(html, /assets\/aistudio\//);
    assert.match(html, /<span class="ef-spec-num">8<\/span><span class="ef-spec-unit">sec<\/span>/);
    assert.doesNotMatch(html, /ef-section-glyph/);
    assert.match(html, /ef-feature-icon/);
    assert.match(html, /data-cmd-backdrop/);
  }

  for (const sub of ["/platform", "/use-cases", "/product", "/developers", "/demo"]) {
    const res = await worker.fetch(new Request(`http://127.0.0.1:3000${sub}`), env);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.doesNotMatch(html, /ef-section-glyph/);
  }

  const signInRes = await worker.fetch(new Request("http://127.0.0.1:3000/signin"), env);
  assert.equal(signInRes.status, 200);
  const signInHtml = await signInRes.text();
  assert.match(signInHtml, /<h1 class="ef-auth-card-title">/);
  assert.doesNotMatch(signInHtml, /ef-auth-brand-badge|ef-kicker/);
});

test("feature SVGs remain useful and all locales render without English leakage", async () => {
  const env = await createLocalRuntimeEnv({ dbPath: ":memory:", port: 3000 });
  const worker = createWorker();

  const homeAr = await worker.fetch(new Request("http://127.0.0.1:3000/ar/"), env);
  assert.equal(homeAr.status, 200);
  const arHtml = await homeAr.text();
  assert.match(arHtml, /<html[^>]+lang="ar"[^>]+dir="rtl"/);
  assert.match(arHtml, /class="ef-section-title-row">\s*<h2/);
  assert.doesNotMatch(arHtml, /ef-section-glyph|ef-kicker/);
  assert.match(arHtml, /class="ef-title-icon-row">\s*<span class="ef-feature-icon"[^>]*><svg[^>]*width="16" height="16"[\s\S]*?<h3/);
  assert.match(arHtml, /الوكيل الذكي/);
  assert.match(arHtml, /سياسة الأمان/);
  assert.doesNotMatch(arHtml, />Skip to content</);

  const homeFr = await worker.fetch(new Request("http://127.0.0.1:3000/fr/"), env);
  assert.equal(homeFr.status, 200);
  const frHtml = await homeFr.text();
  assert.match(frHtml, /<html[^>]+lang="fr"/);
  assert.doesNotMatch(frHtml, /dir="rtl"/);
  assert.match(frHtml, /Agent IA/);
  assert.match(frHtml, /Aller au contenu/);

  const wsAr = await worker.fetch(new Request("http://127.0.0.1:3000/ar/workspace"), env);
  assert.equal(wsAr.status, 200);
  const wsArHtml = await wsAr.text();
  assert.doesNotMatch(wsArHtml, />Max Redirects</);
  assert.doesNotMatch(wsArHtml, />JSON Response</);
  assert.match(wsArHtml, /استجابة JSON/);

  const jsRes = await worker.fetch(new Request("http://127.0.0.1:3000/assets/marketing.js"), env);
  assert.equal(jsRes.status, 200);
  const jsText = await jsRes.text();
  assert.match(jsText, /window\.location\.search \|\| ""/);
  assert.match(jsText, /window\.location\.hash \|\| ""/);
});

