import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const AUTH_BASE = "https://exportflow-auth-acceptance-20261122.hhameranede.workers.dev";
export const AUTH_DATABASE_ID = "0dd14d21-5d56-4b01-8c0f-a14959521dde";
export const TENANT_DATABASE_ID = "1f94eee0-219e-4a41-86ce-49c29067ef06";
export const ACCOUNT_ID = "435030befbb9df09ab76f69209c05347";
export const OWNER_STEP_UP_COOKIE = "__Host-exportflow-owner-step-up";

const OWNER_FACTOR_PATHS = [
  ["/api/auth/two-factor/get-totp-uri", {}],
  ["/api/auth/two-factor/generate-backup-codes", {}],
  ["/api/auth/two-factor/verify-totp", { code: "000000", trustDevice: false }],
  ["/api/auth/two-factor/verify-backup-code", { code: "invalid-acceptance-code" }],
  ["/api/auth/two-factor/verify-otp", { code: "000000" }],
  ["/api/auth/two-factor/send-otp", {}],
  ["/api/auth/two-factor/enable", { method: "totp" }],
  ["/api/auth/two-factor/disable", {}],
];

function stateFilePath() {
  const raw = process.env.MFA_ACCEPTANCE_STATE_FILE;
  const runnerTemp = process.env.RUNNER_TEMP;
  if (!raw || !runnerTemp) {
    throw new Error("MFA_ACCEPTANCE_STATE_FILE and RUNNER_TEMP are required.");
  }
  const file = resolve(raw);
  const root = resolve(runnerTemp) + sep;
  if (!file.startsWith(root)) {
    throw new Error("MFA state must stay inside the ephemeral GitHub runner temp directory.");
  }
  return file;
}

async function saveState(state) {
  const file = stateFilePath();
  await writeFile(file, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
}

async function loadState({ allowPartial = false } = {}) {
  const file = stateFilePath();
  const value = JSON.parse(await readFile(file, "utf8"));
  assert.ok(value && typeof value === "object", "MFA acceptance state is invalid.");
  assert.ok(typeof value.email === "string" && value.email.length > 0, "Synthetic account email is missing.");
  if (!allowPartial) {
    assert.ok(typeof value.password === "string" && value.password.length > 0, "Synthetic account password is missing.");
    assert.ok(typeof value.userId === "string" && value.userId.length > 0, "Synthetic owner ID is missing.");
    assert.ok(typeof value.totpSecret === "string" && value.totpSecret.length > 0, "TOTP seed is missing.");
    assert.ok(Array.isArray(value.cookies), "Synthetic owner cookies are missing.");
  }
  return value;
}

export function decodeBase32(value) {
  if (typeof value !== "string" || !/^[A-Z2-7]+=*$/i.test(value)) {
    throw new TypeError("Invalid Base32 secret.");
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const text = value.toUpperCase().replace(/=+$/g, "");
  let buffer = 0;
  let bits = 0;
  const bytes = [];
  for (const character of text) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new TypeError("Invalid Base32 secret.");
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secret, timestampMs = Date.now(), digits = 6, period = 30) {
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0 ||
      ![6, 8].includes(digits) || !Number.isSafeInteger(period) || period < 1 || period > 120) {
    throw new TypeError("Invalid TOTP generation parameters.");
  }
  const counter = BigInt(Math.floor(timestampMs / 1000 / period));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % (10 ** digits)).padStart(digits, "0");
}

export function parseTotpSecret(uri) {
  const parsed = new URL(uri);
  if (parsed.protocol !== "otpauth:" || parsed.hostname !== "totp") {
    throw new TypeError("Better Auth did not return a TOTP enrollment URI.");
  }
  const secret = parsed.searchParams.get("secret");
  if (!secret) throw new TypeError("TOTP enrollment URI did not contain a secret.");
  return {
    secret,
    digits: Number(parsed.searchParams.get("digits") || 6),
    period: Number(parsed.searchParams.get("period") || 30),
  };
}

export class CookieJar {
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

  get(name) {
    return this.#cookies.get(name) || null;
  }

  header(extraCookie = null) {
    const values = [...this.#cookies];
    if (extraCookie) {
      const name = extraCookie.slice(0, extraCookie.indexOf("="));
      return values
        .filter(([cookieName]) => cookieName !== name)
        .map(([cookieName, value]) => cookieName + "=" + value)
        .concat([extraCookie])
        .join("; ");
    }
    return values.map(([name, value]) => name + "=" + value).join("; ");
  }

  snapshot() {
    return [...this.#cookies];
  }

  static restore(values) {
    const jar = new CookieJar();
    for (const [name, value] of values) jar.#cookies.set(name, value);
    return jar;
  }
}

async function request(path, {
  jar = null,
  method = "GET",
  payload,
  extraCookie = null,
} = {}) {
  const headers = {
    accept: "application/json",
    origin: AUTH_BASE,
    referer: AUTH_BASE + "/account",
    "sec-fetch-site": "same-origin",
  };
  const cookie = jar?.header(extraCookie) || (extraCookie || "");
  if (cookie) headers.cookie = cookie;
  if (payload !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(AUTH_BASE + path, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
    redirect: "manual",
    cache: "no-store",
  });
  jar?.absorb(response.headers);
  return response;
}

async function responseJson(response, label) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new Error(label + " returned a non-JSON response (HTTP " + response.status + ").");
  }
  if (!response.ok) {
    const code = data?.error?.code || data?.error || data?.code || "UNKNOWN_ERROR";
    throw new Error(label + " failed (HTTP " + response.status + ", " + String(code).slice(0, 100) + ").");
  }
  return data;
}

function assertTarget() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || ACCOUNT_ID;
  if (accountId !== ACCOUNT_ID) throw new Error("Refusing MFA acceptance against an unexpected Cloudflare account.");
  if (process.env.CLOUDFLARE_API_TOKEN === undefined || process.env.CLOUDFLARE_API_TOKEN.length < 1) {
    throw new Error("CLOUDFLARE_API_TOKEN is required for isolated D1 cleanup.");
  }
}

async function d1Query(databaseId, sql, params = []) {
  if (![AUTH_DATABASE_ID, TENANT_DATABASE_ID].includes(databaseId)) {
    throw new Error("Refusing D1 access outside the two pinned Acceptance databases.");
  }
  const response = await fetch(
    "https://api.cloudflare.com/client/v4/accounts/" + ACCOUNT_ID + "/d1/database/" + databaseId + "/query",
    {
      method: "POST",
      headers: {
        authorization: "Bearer " + process.env.CLOUDFLARE_API_TOKEN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true || !Array.isArray(body.result)) {
    throw new Error("Pinned Acceptance D1 query failed (HTTP " + response.status + ").");
  }
  return body.result[0];
}

async function bootstrap() {
  assertTarget();
  const suffix = randomUUID().replaceAll("-", "");
  const state = {
    email: "mfa-acceptance-" + suffix + "@example.net",
    password: randomBytes(24).toString("base64url"),
    userId: null,
    sessionId: null,
    totpSecret: null,
    totpDigits: 6,
    totpPeriod: 30,
    planCode: "mfa_qa_" + suffix.slice(0, 20),
    cookies: [],
  };
  const jar = new CookieJar();
  await saveState(state);

  const signUpResponse = await request("/api/auth/sign-up/email", {
    method: "POST",
    jar,
    payload: { name: "ExportFlow MFA Acceptance", email: state.email, password: state.password },
  });
  const signUp = await responseJson(signUpResponse, "Acceptance sign-up");
  assert.ok(signUp.user?.id, "Acceptance sign-up did not return a synthetic user ID.");
  state.userId = signUp.user.id;
  state.cookies = jar.snapshot();
  await saveState(state);
  assert.ok(jar.header(), "Acceptance sign-up did not create a session cookie.");

  // Tenant administration accepts only verified-email owners. Mark only this
  // new synthetic account as verified in the pinned Acceptance Auth D1.
  const verifiedEmail = await d1Query(
    AUTH_DATABASE_ID,
    "UPDATE user SET emailVerified = 1 WHERE id = ?",
    [state.userId],
  );
  assert.equal(verifiedEmail.meta?.changes, 1, "Synthetic acceptance user must be email-verified.");


  const enableResponse = await request("/api/auth/two-factor/enable", {
    method: "POST",
    jar,
    payload: { method: "totp", issuer: "ExportFlow MFA Acceptance" },
  });
  const enabled = await responseJson(enableResponse, "TOTP enrollment");
  assert.equal(enabled.method, "totp");
  const totp = parseTotpSecret(enabled.totpURI);
  state.totpSecret = totp.secret;
  state.totpDigits = totp.digits;
  state.totpPeriod = totp.period;
  state.cookies = jar.snapshot();
  await saveState(state);

  const firstCode = generateTotpCode(state.totpSecret, Date.now(), state.totpDigits, state.totpPeriod);
  const verifyResponse = await request("/api/auth/two-factor/verify-totp", {
    method: "POST",
    jar,
    payload: { code: firstCode, trustDevice: false },
  });
  await responseJson(verifyResponse, "First TOTP confirmation");
  const statusResponse = await request("/api/auth/two-factor/status", { jar });
  const factorStatus = await responseJson(statusResponse, "Read TOTP status");
  assert.equal(factorStatus.twoFactorEnabled, true);
  assert.equal(factorStatus.twoFactorVerified, true);

  const sessionResponse = await request("/api/auth/get-session", { jar });
  const session = await responseJson(sessionResponse, "Read owner session after enrollment");
  assert.equal(session.user?.id, state.userId);
  assert.ok(session.session?.id, "Enrollment did not leave an authenticated session.");
  state.sessionId = session.session.id;
  state.cookies = jar.snapshot();
  await saveState(state);
  console.log("MFA acceptance bootstrap passed: synthetic account created and TOTP factor enrolled and verified.");
}

async function verifyAcceptance() {
  assertTarget();
  const state = await loadState();
  const jar = CookieJar.restore(state.cookies);

  const sessionResponse = await request("/api/auth/get-session", { jar });
  const session = await responseJson(sessionResponse, "Read synthetic owner session");
  assert.equal(session.user?.id, state.userId);
  assert.equal(session.session?.id, state.sessionId, "Acceptance session changed unexpectedly.");

  const statusResponse = await request("/api/auth/two-factor/status", { jar });
  const factorStatus = await responseJson(statusResponse, "Read verified owner TOTP state");
  assert.deepEqual(factorStatus, { twoFactorEnabled: true, twoFactorVerified: true });

  for (const [path, payload] of OWNER_FACTOR_PATHS) {
    const response = await request(path, { method: "POST", jar, payload });
    const body = await response.json().catch(() => null);
    assert.equal(response.status, 403, path + " must be blocked for an authenticated allowlisted owner.");
    assert.equal(body?.error, "OWNER_TWO_FACTOR_MANAGEMENT_BLOCKED", path);
  }

  // Prove the ordinary sign-in challenge is not blocked by the owner management guard.
  const loginJar = new CookieJar();
  const signInResponse = await request("/api/auth/sign-in/email", {
    method: "POST",
    jar: loginJar,
    payload: { email: state.email, password: state.password },
  });
  const signIn = await responseJson(signInResponse, "Sessionless two-factor sign-in challenge");
  assert.equal(signIn.twoFactorRedirect, true, "A verified account should receive a sessionless two-factor challenge.");
  assert.ok(signIn.twoFactorMethods?.includes("totp"), "The sessionless challenge must advertise TOTP.");
  const loginCode = generateTotpCode(state.totpSecret, Date.now(), state.totpDigits, state.totpPeriod);
  const loginVerifyResponse = await request("/api/auth/two-factor/verify-totp", {
    method: "POST",
    jar: loginJar,
    payload: { code: loginCode, trustDevice: false },
  });
  await responseJson(loginVerifyResponse, "Sessionless TOTP sign-in verification");
  const loginSessionResponse = await request("/api/auth/get-session", { jar: loginJar });
  const loginSession = await responseJson(loginSessionResponse, "Read second owner session");
  assert.equal(loginSession.user?.id, state.userId);
  assert.ok(loginSession.session?.id);
  assert.notEqual(loginSession.session.id, state.sessionId, "The second sign-in must create a distinct session.");

  const code = generateTotpCode(state.totpSecret, Date.now(), state.totpDigits, state.totpPeriod);
  const stepUpResponse = await request("/api/v1/admin/step-up", {
    method: "POST",
    jar,
    payload: { code },
  });
  await responseJson(stepUpResponse, "Owner step-up verification");
  const proof = jar.get(OWNER_STEP_UP_COOKIE);
  assert.ok(proof, "Step-up response did not set the one-time proof cookie.");

  const mismatchResponse = await request("/api/v1/admin/plan-policies", {
    method: "POST",
    jar: loginJar,
    extraCookie: OWNER_STEP_UP_COOKIE + "=" + proof,
    payload: {
      planCode: state.planCode,
      quotaPeriod: "daily",
      requestLimit: 1,
      policyVersion: "mfa-acceptance-v1",
      status: "active",
    },
  });
  const mismatchBody = await mismatchResponse.json().catch(() => null);
  assert.equal(mismatchResponse.status, 403, "A proof from a different session must be denied.");
  assert.equal(mismatchBody?.error?.code, "OWNER_STEP_UP_REQUIRED");

  const mutationResponse = await request("/api/v1/admin/plan-policies", {
    method: "POST",
    jar,
    payload: {
      planCode: state.planCode,
      quotaPeriod: "daily",
      requestLimit: 1,
      policyVersion: "mfa-acceptance-v1",
      status: "active",
    },
  });
  const mutation = await responseJson(mutationResponse, "One-time proof protected admin mutation");
  assert.equal(mutation.data?.planCode, state.planCode);

  const replayResponse = await request("/api/v1/admin/plan-policies", {
    method: "POST",
    jar,
    extraCookie: OWNER_STEP_UP_COOKIE + "=" + proof,
    payload: {
      planCode: state.planCode + "_replay",
      quotaPeriod: "daily",
      requestLimit: 1,
      policyVersion: "mfa-acceptance-replay-v1",
      status: "active",
    },
  });
  const replay = await replayResponse.json().catch(() => null);
  assert.equal(replayResponse.status, 403, "A consumed proof must not authorize a second mutation.");
  assert.equal(replay?.error?.code, "OWNER_STEP_UP_REQUIRED");

  for (let index = 0; index < 5; index += 1) {
    const current = generateTotpCode(state.totpSecret, Date.now(), state.totpDigits, state.totpPeriod);
    const wrong = (current[0] === "9" ? "8" : String(Number(current[0]) + 1)) + current.slice(1);
    const failedResponse = await request("/api/v1/admin/step-up", {
      method: "POST",
      jar,
      payload: { code: wrong },
    });
    const failed = await failedResponse.json().catch(() => null);
    assert.equal(failedResponse.status, 401, "Invalid TOTP attempt " + (index + 1) + " must be rejected.");
    assert.equal(failed?.error?.code, "INVALID_TOTP_CODE");
  }

  const limitedCode = generateTotpCode(state.totpSecret, Date.now(), state.totpDigits, state.totpPeriod);
  const limitedResponse = await request("/api/v1/admin/step-up", {
    method: "POST",
    jar,
    payload: { code: limitedCode },
  });
  const limited = await limitedResponse.json().catch(() => null);
  assert.equal(limitedResponse.status, 429, "The sixth attempt in the rolling window must be rejected.");
  assert.equal(limited?.error?.code, "OWNER_MFA_RATE_LIMITED");

  state.cookies = jar.snapshot();
  await saveState(state);
  console.log("MFA Worker Acceptance passed: enrollment, verified status, all direct factor-management bypass guards, sessionless 2FA sign-in, session binding, one-time admin proof, replay denial and durable attempt limit.");
}

async function cleanupAcceptance() {
  const file = stateFilePath();
  let state = null;
  try {
    state = await loadState({ allowPartial: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.log("MFA acceptance cleanup: no synthetic account state was created.");
      return;
    }
    throw error;
  }
  assertTarget();
  const now = new Date().toISOString();
  if (state.userId) {
    await d1Query(
      AUTH_DATABASE_ID,
      "DELETE FROM verification WHERE identifier = ? OR identifier = ?",
      ["exportflow:owner-step-up-attempt:" + state.userId, "exportflow:owner-step-up-proof:" + state.userId],
    );
    await d1Query(AUTH_DATABASE_ID, "DELETE FROM user WHERE id = ?", [state.userId]);
  } else if (state.email) {
    await d1Query(AUTH_DATABASE_ID, "DELETE FROM user WHERE email = ?", [state.email]);
  }
  if (state.planCode) {
    await d1Query(
      TENANT_DATABASE_ID,
      "DELETE FROM plan_policies WHERE plan_code = ? AND NOT EXISTS (SELECT 1 FROM tenants WHERE plan_code = ?)",
      [state.planCode, state.planCode],
    );
  }
  if (state.userId) {
    const userCount = await d1Query(
      AUTH_DATABASE_ID,
      "SELECT COUNT(*) AS count FROM user WHERE id = ?",
      [state.userId],
    );
    assert.equal(Number(userCount.results?.[0]?.count), 0, "Synthetic MFA account cleanup was incomplete.");
    const factorCount = await d1Query(
      AUTH_DATABASE_ID,
      "SELECT COUNT(*) AS count FROM twoFactor WHERE userId = ?",
      [state.userId],
    );
    assert.equal(Number(factorCount.results?.[0]?.count), 0, "Synthetic TOTP factor cleanup was incomplete.");
    const attemptCount = await d1Query(
      AUTH_DATABASE_ID,
      "SELECT COUNT(*) AS count FROM verification WHERE identifier IN (?, ?)",
      ["exportflow:owner-step-up-attempt:" + state.userId, "exportflow:owner-step-up-proof:" + state.userId],
    );
    assert.equal(Number(attemptCount.results?.[0]?.count), 0, "Synthetic MFA proof/attempt cleanup was incomplete.");
  }
  if (state.planCode) {
    const planCount = await d1Query(
      TENANT_DATABASE_ID,
      "SELECT COUNT(*) AS count FROM plan_policies WHERE plan_code = ?",
      [state.planCode],
    );
    assert.equal(Number(planCount.results?.[0]?.count), 0, "Synthetic MFA test plan cleanup was incomplete.");
  }
  await unlink(file);
  console.log("MFA acceptance cleanup verified: synthetic auth user, sessions, TOTP factor, step-up proof/attempt rows and test plan removed. Append-only audit evidence is retained.");
}

async function printOwnerId() {
  const state = await loadState();
  process.stdout.write(state.userId + "\n");
}

async function main() {
  const mode = process.argv[2];
  if (mode === "bootstrap") return bootstrap();
  if (mode === "owner-id") return printOwnerId();
  if (mode === "verify") return verifyAcceptance();
  if (mode === "cleanup") return cleanupAcceptance();
  throw new Error("Usage: node scripts/mfa-acceptance-smoke.mjs <bootstrap|owner-id|verify|cleanup>");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error("MFA acceptance failed: " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
