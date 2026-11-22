import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "435030befbb9df09ab76f69209c05347";
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const authDatabaseId = "0dd14d21-5d56-4b01-8c0f-a14959521dde";
const tenantDatabaseId = "1f94eee0-219e-4a41-86ce-49c29067ef06";
const authBase = "https://exportflow-auth-acceptance-20261122.hhameranede.workers.dev";
const issuer = authBase + "/api/auth";
const resource = "https://exportflow-mcp-acceptance-20261122.hhameranede.workers.dev/mcp";
const redirectUri = "https://oauth-client.example.com/callback";
const resourceMetadataUrl = resource.replace(/\/mcp$/, "/.well-known/oauth-protected-resource/mcp");

assert.ok(apiToken, "CLOUDFLARE_API_TOKEN is required for isolated D1 acceptance setup");

class CookieJar {
  #cookies = new Map();

  absorb(headers) {
    const values = typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : (headers.get("set-cookie") ? [headers.get("set-cookie")] : []);
    for (const value of values) {
      const first = value.split(";", 1)[0];
      const separator = first.indexOf("=");
      if (separator < 1) continue;
      const name = first.slice(0, separator).trim();
      const content = first.slice(separator + 1).trim();
      if (/max-age=0/i.test(value) || /expires=Thu, 01 Jan 1970/i.test(value)) {
        this.#cookies.delete(name);
      } else {
        this.#cookies.set(name, content);
      }
    }
  }

  header() {
    return [...this.#cookies].map(([name, value]) => name + "=" + value).join("; ");
  }
}

async function d1Query(databaseId, sql, params = []) {
  const response = await fetch(
    "https://api.cloudflare.com/client/v4/accounts/" + accountId + "/d1/database/" + databaseId + "/query",
    {
      method: "POST",
      headers: {
        authorization: "Bearer " + apiToken,
        "content-type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true || !Array.isArray(body.result)) {
    throw new Error("Acceptance D1 query failed (HTTP " + response.status + "): " + JSON.stringify(body?.errors || body));
  }
  return body.result[0];
}

const jar = new CookieJar();
async function authRequest(path, { method = "GET", payload, signedQuery, redirect = "manual" } = {}) {
  const body = payload && typeof payload === "object" && signedQuery
    ? { ...payload, oauth_query: signedQuery }
    : payload;
  const headers = {
    accept: "application/json",
    origin: authBase,
    referer: authBase + "/signin",
  };
  const cookie = jar.header();
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  if (path === "tenant/select") headers["sec-fetch-site"] = "same-origin";
  const response = await fetch(authBase + "/api/auth/" + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect,
  });
  jar.absorb(response.headers);
  return response;
}

function getSignedOAuthQuery(url) {
  const names = url.searchParams.getAll("ba_param");
  if (!url.searchParams.has("sig") || !names.length) return null;
  const allowed = new Set(["sig", "ba_param", ...names]);
  const signed = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (allowed.has(key)) signed.append(key, value);
  }
  return signed.toString();
}

async function expectJson(response, label) {
  const data = await response.json().catch(async () => ({ raw: (await response.text()).slice(0, 400) }));
  if (!response.ok) {
    throw new Error(label + " failed (HTTP " + response.status + "): " + JSON.stringify(data));
  }
  return data;
}

async function setupSyntheticTenantMembership(userId) {
  const verified = await d1Query(
    authDatabaseId,
    "UPDATE user SET emailVerified = 1 WHERE id = ?",
    [userId],
  );
  assert.equal(verified.meta?.changes, 1, "Synthetic acceptance user should be marked verified");

  // Each run gets its own small-quota workspace; the shared QA fixtures may already be exhausted.
  const tenantId = "qa_oauth_" + randomUUID().replaceAll("-", "");
  const timestamp = new Date().toISOString();
  const tenant = await d1Query(
    tenantDatabaseId,
    "INSERT INTO tenants (tenant_id, plan_code, status, created_at, updated_at) " +
      "SELECT ?, 'qa_daily', 'active', ?, ? FROM plan_policies " +
      "WHERE plan_code = 'qa_daily' AND status = 'active'",
    [tenantId, timestamp, timestamp],
  );
  assert.equal(tenant.meta?.changes, 1, "A dedicated per-run OAuth acceptance workspace should be created");

  const membershipId = "ef_accept_" + randomUUID();
  const membership = await d1Query(
    tenantDatabaseId,
    "INSERT INTO tenant_memberships (membership_id, user_id, tenant_id, role, membership_version, status, created_by, created_at, updated_at, revoked_at) " +
      "SELECT ?, ?, ?, 'member', 1, 'active', 'oauth-acceptance-workflow', ?, ?, NULL " +
      "FROM tenants AS t JOIN plan_policies AS p ON p.plan_code = t.plan_code " +
      "WHERE t.tenant_id = ? AND t.status = 'active' AND p.status = 'active'",
    [membershipId, userId, tenantId, timestamp, timestamp, tenantId],
  );
  assert.equal(membership.meta?.changes, 1, "Synthetic user should receive one active test workspace membership");
  return { membershipId, tenantId };
}

const suffix = randomUUID();
const email = "oauth-acceptance-" + suffix + "@example.net";
const password = randomBytes(24).toString("base64url");
const signUpResponse = await authRequest("sign-up/email", {
  method: "POST",
  payload: { name: "ExportFlow Acceptance User", email, password },
});
const signUp = await expectJson(signUpResponse, "Better Auth sign-up");
assert.ok(signUp.user?.id, "Better Auth sign-up should return a user id");
assert.ok(jar.header(), "Better Auth sign-up should set a session cookie");
const membership = await setupSyntheticTenantMembership(signUp.user.id);

const registrationResponse = await fetch(issuer + "/oauth2/register", {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({
    client_name: "ExportFlow OAuth Acceptance",
    application_type: "web",
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: "openid profile email tasks:fetch",
  }),
});
const registration = await expectJson(registrationResponse, "OAuth dynamic client registration");
assert.ok(registration.client_id, "OAuth registration should return a public client id");
assert.equal(registration.token_endpoint_auth_method, "none", "Acceptance client must be a public OAuth client");

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = randomBytes(24).toString("base64url");
const nonce = randomBytes(24).toString("base64url");
const authorizationUrl = new URL(issuer + "/oauth2/authorize");
authorizationUrl.searchParams.set("client_id", registration.client_id);
authorizationUrl.searchParams.set("redirect_uri", redirectUri);
authorizationUrl.searchParams.set("response_type", "code");
authorizationUrl.searchParams.set("scope", "openid profile email tasks:fetch");
authorizationUrl.searchParams.set("state", state);
authorizationUrl.searchParams.set("nonce", nonce);
authorizationUrl.searchParams.set("code_challenge", challenge);
authorizationUrl.searchParams.set("code_challenge_method", "S256");
authorizationUrl.searchParams.set("resource", resource);

const authorizationResponse = await fetch(authorizationUrl, {
  headers: { cookie: jar.header(), accept: "text/html" },
  redirect: "manual",
});
jar.absorb(authorizationResponse.headers);
assert.ok([302, 303, 307, 308].includes(authorizationResponse.status), "OAuth authorization should redirect to the account consent flow");
const firstLocation = authorizationResponse.headers.get("location");
assert.ok(firstLocation, "OAuth authorization should provide a continuation URL");

let pageUrl = new URL(firstLocation, authBase);
for (let index = 0; index < 4 && pageUrl.pathname === "/oauth/select-tenant"; index += 1) {
  const page = await fetch(pageUrl, { headers: { cookie: jar.header(), accept: "text/html" }, redirect: "manual" });
  jar.absorb(page.headers);
  assert.equal(page.status, 200, "Tenant selection page should render");
  const signedQuery = getSignedOAuthQuery(pageUrl);
  assert.ok(signedQuery, "Tenant selection page must carry signed OAuth query parameters");

  const listResponse = await authRequest("tenant/list");
  const list = await expectJson(listResponse, "List test tenant memberships");
  const selected = list.tenants?.find(item => item.tenantId === membership.tenantId);
  assert.ok(selected, "Acceptance user should see the assigned synthetic workspace");

  const selectResponse = await authRequest("tenant/select", {
    method: "POST",
    payload: { tenantId: membership.tenantId },
  });
  await expectJson(selectResponse, "Select synthetic test workspace");

  const continueResponse = await authRequest("oauth2/continue", {
    method: "POST",
    payload: { postLogin: true },
    signedQuery,
  });
  const continuation = await expectJson(continueResponse, "Continue OAuth after workspace selection");
  assert.equal(continuation.redirect, true);
  pageUrl = new URL(continuation.url, authBase);
}

assert.equal(pageUrl.pathname, "/oauth/consent", "OAuth should arrive at the consent page after selecting a workspace");
const consentSignedQuery = getSignedOAuthQuery(pageUrl);
assert.ok(consentSignedQuery, "Consent page must contain the signed OAuth request");
const consentPage = await fetch(pageUrl, {
  headers: { cookie: jar.header(), accept: "text/html" },
  redirect: "manual",
});
jar.absorb(consentPage.headers);
assert.equal(consentPage.status, 200, "Custom ExportFlow consent page should render");
const consentHtml = await consentPage.text();
assert.ok(consentHtml.includes("Authorize ExportFlow"), "Consent page should show the ExportFlow authorization UI");

const consentResponse = await authRequest("oauth2/consent", {
  method: "POST",
  payload: { accept: true },
  signedQuery: consentSignedQuery,
});
const consent = await expectJson(consentResponse, "Accept OAuth consent");
assert.equal(consent.redirect, true);
assert.ok(typeof consent.url === "string");

let nextUrl = new URL(consent.url, authBase);
let authorizationCode = null;
for (let index = 0; index < 6; index += 1) {
  if (nextUrl.origin === new URL(redirectUri).origin) {
    authorizationCode = nextUrl.searchParams.get("code");
    assert.equal(nextUrl.searchParams.get("state"), state, "OAuth callback must preserve state");
    break;
  }
  assert.equal(nextUrl.origin, authBase, "Authorization continuation must stay on the isolated Auth Worker until the registered callback");
  const response = await fetch(nextUrl, { headers: { cookie: jar.header(), accept: "text/html, application/json" }, redirect: "manual" });
  jar.absorb(response.headers);
  const location = response.headers.get("location");
  if (!location) {
    const body = await response.text();
    throw new Error("OAuth authorization continuation did not redirect: HTTP " + response.status + " " + body.slice(0, 300));
  }
  nextUrl = new URL(location, nextUrl);
}
assert.ok(authorizationCode, "OAuth authorization should issue a code to the registered callback");

const tokenBody = new URLSearchParams({
  grant_type: "authorization_code",
  client_id: registration.client_id,
  code: authorizationCode,
  redirect_uri: redirectUri,
  code_verifier: verifier,
  resource,
});
const tokenResponse = await fetch(issuer + "/oauth2/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
  body: tokenBody,
});
const token = await expectJson(tokenResponse, "Exchange authorization code with PKCE");
assert.ok(typeof token.access_token === "string" && token.access_token.length > 50, "OAuth should issue an access token");
assert.equal(token.token_type?.toLowerCase(), "bearer");
assert.ok(token.expires_in > 0);
assert.ok(!JSON.stringify(token).includes(password), "OAuth response must not expose the sign-up password");

async function callMcp(name, argumentsValue) {
  const response = await fetch(resource, {
    method: "POST",
    headers: {
      authorization: "Bearer " + token.access_token,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method: "tools/call", params: { name, arguments: argumentsValue } }),
  });
  const body = await expectJson(response, "Authenticated MCP " + name);
  return body.result;
}

const fetchResult = await callMcp("web_fetch", { url: "https://example.com/" });
assert.notEqual(fetchResult?.isError, true, "OAuth token should authorize web_fetch");
assert.equal(fetchResult?.structuredContent?.state, "succeeded", "web_fetch should finish in the real MCP Worker");
assert.equal(fetchResult?.structuredContent?.quota?.limit, 2, "MCP execution should use the tenant's D1 quota policy");

const scopeDenied = await callMcp("web_map", { url: "https://example.com/" });
assert.equal(scopeDenied?.isError, true, "web_map should be rejected when the OAuth client only has tasks:fetch");
assert.equal(scopeDenied?.structuredContent?.error, "insufficient_scope");

const bumped = await d1Query(
  tenantDatabaseId,
  "UPDATE tenant_memberships SET membership_version = membership_version + 1, updated_at = ? WHERE membership_id = ?",
  [new Date().toISOString(), membership.membershipId],
);
assert.equal(bumped.meta?.changes, 1, "Membership version change should invalidate the existing OAuth token");

const staleTokenResult = await callMcp("web_fetch", { url: "https://example.com/" });
assert.equal(staleTokenResult?.isError, true, "A token with stale membership must be rejected");
assert.equal(staleTokenResult?.structuredContent?.error, "TENANT_MEMBERSHIP_CHANGED");

console.log("OAuth acceptance passed: signup, active tenant selection, consent, authorization-code + S256 PKCE, token exchange, real MCP web_fetch, scope enforcement, D1 quota and membership-version invalidation.");
