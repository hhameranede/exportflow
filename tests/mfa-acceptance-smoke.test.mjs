import assert from "node:assert/strict";
import test from "node:test";
import {
  CookieJar,
  decodeBase32,
  generateTotpCode,
  parseTotpSecret,
} from "../scripts/mfa-acceptance-smoke.mjs";

test("TOTP generator matches the RFC 6238 SHA-1 reference vector", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(decodeBase32(secret).toString("ascii"), "12345678901234567890");
  assert.equal(generateTotpCode(secret, 59_000, 8, 30), "94287082");
});

test("TOTP generator returns six digits for the current account configuration", () => {
  const code = generateTotpCode("JBSWY3DPEHPK3PXP", 1_700_000_000_000, 6, 30);
  assert.match(code, /^\d{6}$/);
});

test("TOTP URI parser accepts only otpauth TOTP URIs and reads configured parameters", () => {
  const value = parseTotpSecret(
    "otpauth://totp/ExportFlow%20Acceptance?secret=JBSWY3DPEHPK3PXP&issuer=ExportFlow&digits=8&period=45",
  );
  assert.deepEqual(value, {
    secret: "JBSWY3DPEHPK3PXP",
    digits: 8,
    period: 45,
  });
  assert.throws(() => parseTotpSecret("https://example.com/not-a-secret"), /TOTP enrollment URI/);
});

test("acceptance CookieJar absorbs session cookies and honours explicit deletion", () => {
  const jar = new CookieJar();
  const initial = new Headers();
  initial.append("set-cookie", "exportflow.session_token=secret-session; Path=/; HttpOnly; Secure");
  initial.append("set-cookie", "__Host-exportflow-owner-step-up=proof-token; Path=/; HttpOnly; Secure");
  jar.absorb(initial);
  assert.match(jar.header(), /exportflow\.session_token=secret-session/);
  assert.match(jar.header(), /__Host-exportflow-owner-step-up=proof-token/);

  const cleared = new Headers();
  cleared.append("set-cookie", "__Host-exportflow-owner-step-up=; Path=/; Max-Age=0; HttpOnly; Secure");
  jar.absorb(cleared);
  assert.equal(jar.get("__Host-exportflow-owner-step-up"), null);
  assert.match(jar.header(), /exportflow\.session_token=secret-session/);
});

test("acceptance CookieJar can attach a one-time proof without replacing the auth session", () => {
  const jar = CookieJar.restore([["exportflow.session_token", "session"]]);
  const header = jar.header("__Host-exportflow-owner-step-up=proof");
  assert.match(header, /exportflow\.session_token=session/);
  assert.match(header, /__Host-exportflow-owner-step-up=proof/);
});
