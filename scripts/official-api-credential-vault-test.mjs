import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  createOfficialApiCredentialVault,
  OfficialApiCredentialVaultError,
  sanitizeOfficialApiCredentials
} from "../functions/lib/official-api-credential-vault.mjs";

const key1 = Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString("base64");
const key2 = Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString("base64");

function fakeD1() {
  const rows = new Map();
  const calls = [];
  return {
    rows, calls,
    prepare(sql) {
      return { bind(...values) {
        if (sql.startsWith("INSERT INTO merchant_official_api_credentials")) return { run: async () => {
          calls.push("write");
          const [merchant, provider, key_id, iv, ciphertext, consented_at, created_at, updated_at] = values;
          const id = merchant + ":" + provider;
          const prior = rows.get(id);
          rows.set(id, {
            key_id, iv, ciphertext, scope: "sandbox_track", consented_at,
            created_at: prior?.created_at || created_at, updated_at
          });
          return { meta: { changes: 1 } };
        }};
        if (sql.startsWith("SELECT scope")) return { first: async () => {
          calls.push("status");
          const row = rows.get(values[0] + ":" + values[1]);
          return row ? { scope: row.scope, consented_at: row.consented_at, updated_at: row.updated_at } : null;
        }};
        if (sql.startsWith("SELECT key_id")) return { first: async () => {
          calls.push("read");
          return rows.get(values[0] + ":" + values[1]) || null;
        }};
        if (sql.startsWith("DELETE FROM merchant_official_api_credentials")) return { run: async () => {
          calls.push("delete");
          const removed = rows.delete(values[0] + ":" + values[1]);
          return { meta: { changes: removed ? 1 : 0 } };
        }};
        throw new Error("Unexpected SQL in official API vault test");
      }};
    }
  };
}

const db = fakeD1();
const audit = [];
const vault = createOfficialApiCredentialVault({
  db,
  keys: { old: key1 },
  activeKeyId: "old",
  crypto: webcrypto,
  clock: () => new Date("2026-11-09T13:00:00.000Z"),
  authorizeMerchantProvider: async context => {
    audit.push(context);
    return true;
  }
});

await assert.rejects(
  () => vault.save({
    merchantId: "merchant_1",
    provider: "fedex",
    credentials: { apiKey: "fedex-key", apiSecret: "fedex-secret" },
    consent: false
  }),
  error => error instanceof OfficialApiCredentialVaultError && error.code === "consent_required"
);
assert.equal(db.calls.length, 0, "No database access before explicit merchant consent");

const saved = await vault.save({
  merchantId: "merchant_1",
  provider: "fedex",
  credentials: {
    apiKey: "fedex-key",
    apiSecret: "fedex-secret",
    baseUrl: "https://attacker.invalid",
    fetch: "attacker-controlled",
    unknown: "discard-me"
  },
  consent: true
});
assert.deepEqual(saved, {
  provider: "fedex",
  connected: true,
  scope: "sandbox_track",
  consentedAt: "2026-11-09T13:00:00.000Z",
  updatedAt: "2026-11-09T13:00:00.000Z"
});
assert.equal(audit[0].operation, "connect");

const stored = db.rows.get("merchant_1:fedex");
assert.ok(stored);
assert.equal(stored.scope, "sandbox_track");
assert.equal(JSON.stringify(stored).includes("fedex-secret"), false);
assert.equal(JSON.stringify(stored).includes("attacker.invalid"), false);
assert.deepEqual(await vault.resolveCredentials({ merchantId: "merchant_1", provider: "fedex" }), {
  apiKey: "fedex-key",
  apiSecret: "fedex-secret"
});
const fedexStatus = await vault.getStatus({ merchantId: "merchant_1", provider: "fedex" });
assert.deepEqual(fedexStatus, {
  provider: "fedex",
  connected: true,
  scope: "sandbox_track",
  consentedAt: "2026-11-09T13:00:00.000Z",
  updatedAt: "2026-11-09T13:00:00.000Z"
});
assert.equal(JSON.stringify(fedexStatus).includes("fedex-secret"), false,
  "Connection status must not expose credential material");

const upsSaved = await vault.save({
  merchantId: "merchant_1",
  provider: "ups",
  credentials: { clientId: "ups-client-id", clientSecret: "ups-client-secret" },
  consent: true
});
assert.equal(upsSaved.provider, "ups");
assert.deepEqual(await vault.resolveCredentials({ merchantId: "merchant_1", provider: "ups" }), {
  clientId: "ups-client-id",
  clientSecret: "ups-client-secret"
});

const readsBeforeDenied = db.calls.filter(call => call === "read").length;
const denied = createOfficialApiCredentialVault({
  db, keys: { old: key1 }, activeKeyId: "old", crypto: webcrypto,
  authorizeMerchantProvider: async () => false
});
await assert.rejects(
  () => denied.resolveCredentials({ merchantId: "merchant_1", provider: "fedex" }),
  error => error instanceof OfficialApiCredentialVaultError && error.code === "forbidden"
);
assert.equal(db.calls.filter(call => call === "read").length, readsBeforeDenied,
  "Denied merchant access must not read D1");

const copied = { ...stored };
db.rows.set("merchant_2:fedex", copied);
await assert.rejects(
  () => vault.resolveCredentials({ merchantId: "merchant_2", provider: "fedex" }),
  error => error instanceof OfficialApiCredentialVaultError && error.code === "credential_decryption_failed",
  "AES-GCM additional authenticated data must bind ciphertext to its merchant ID"
);
db.rows.delete("merchant_2:fedex");

let getterExecuted = false;
const withGetter = { apiKey: "valid-key" };
Object.defineProperty(withGetter, "apiSecret", {
  enumerable: true,
  get() { getterExecuted = true; throw new Error("getter must not run"); }
});
await assert.rejects(
  () => vault.save({ merchantId: "merchant_1", provider: "fedex", credentials: withGetter, consent: true }),
  error => error instanceof OfficialApiCredentialVaultError && error.code === "invalid_credentials"
);
assert.equal(getterExecuted, false);

await assert.rejects(
  () => vault.save({
    merchantId: "merchant_1", provider: "dhl-express",
    credentials: { apiKey: "not-allowed" }, consent: true
  }),
  error => error instanceof OfficialApiCredentialVaultError && error.code === "unsupported_provider"
);

assert.deepEqual(
  sanitizeOfficialApiCredentials("ups", { clientId: "id", clientSecret: "secret", apiUrl: "https://attacker.invalid" }),
  { clientId: "id", clientSecret: "secret" }
);

const rotated = createOfficialApiCredentialVault({
  db, keys: { old: key1, next: key2 }, activeKeyId: "next",
  crypto: webcrypto, authorizeMerchantProvider: async () => true
});
assert.deepEqual(await rotated.resolveCredentials({ merchantId: "merchant_1", provider: "fedex" }), {
  apiKey: "fedex-key",
  apiSecret: "fedex-secret"
});
await rotated.save({
  merchantId: "merchant_1", provider: "fedex",
  credentials: { apiKey: "fedex-key", apiSecret: "fedex-secret" }, consent: true
});
assert.equal(db.rows.get("merchant_1:fedex").key_id, "next", "New ciphertext uses the active key");

assert.deepEqual(await rotated.revoke({ merchantId: "merchant_1", provider: "ups" }), {
  provider: "ups",
  revoked: true
});
assert.equal(await rotated.resolveCredentials({ merchantId: "merchant_1", provider: "ups" }), null);
assert.deepEqual(await rotated.getStatus({ merchantId: "merchant_1", provider: "ups" }), {
  provider: "ups", connected: false, scope: null, consentedAt: null, updatedAt: null
});

console.log("Official API credential vault tests passed: AES-GCM tenant binding, consent, provider allowlist, status minimization, no plaintext and key rotation.");
