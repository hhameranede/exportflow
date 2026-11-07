import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  createMerchantCredentialVault,
  MerchantCredentialVaultError
} from "../functions/lib/merchant-credential-vault.mjs";

const key1 = Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString("base64");
const key2 = Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString("base64");
const events = [];

function fakeD1() {
  const rows = new Map();
  const calls = [];
  return {
    rows, calls,
    prepare(sql) {
      return { bind(...values) {
        if (sql.startsWith("INSERT")) return { run: async () => {
          calls.push("write"); events.push("database:write");
          const [merchant, provider, key_id, iv, ciphertext, consented_at, created_at, updated_at] = values;
          const id = merchant + ":" + provider;
          const prior = rows.get(id);
          rows.set(id, { key_id, iv, ciphertext, scope: "track", consented_at, created_at: prior?.created_at || created_at, updated_at });
          return { meta: { changes: 1 } };
        }};
        if (sql.startsWith("SELECT")) return { first: async () => {
          calls.push("read"); return rows.get(values[0] + ":" + values[1]) || null;
        }};
        if (sql.startsWith("DELETE")) return { run: async () => {
          calls.push("delete"); const removed = rows.delete(values[0] + ":" + values[1]);
          return { meta: { changes: removed ? 1 : 0 } };
        }};
        throw new Error("Unexpected D1 SQL");
      }};
    }
  };
}

const db = fakeD1();
const auth = [];
const vault = createMerchantCredentialVault({
  db,
  keys: { old: key1 },
  activeKeyId: "old",
  clock: () => new Date("2026-11-07T12:00:00.000Z"),
  crypto: webcrypto,
  authorizeMerchantProvider: async context => {
    auth.push(context); events.push("authorize:" + context.operation); return true;
  }
});

await assert.rejects(() => vault.save({
  merchantId: "merchant_1", provider: "yalidine",
  credentials: { apiId: "acct", apiToken: "private-token" }, consent: false
}), e => e instanceof MerchantCredentialVaultError && e.code === "consent_required");
assert.equal(db.calls.length, 0, "No DB operation before consent");

const saved = await vault.save({
  merchantId: "merchant_1", provider: "yalidine",
  credentials: { apiId: "acct", apiToken: "private-token", baseUrl: "https://attacker.invalid", unknown: "drop" },
  consent: true
});
assert.deepEqual(saved, {
  provider: "yalidine", connected: true, scope: "track",
  consentedAt: "2026-11-07T12:00:00.000Z", updatedAt: "2026-11-07T12:00:00.000Z"
});
assert.ok(events.indexOf("authorize:connect") < events.indexOf("database:write"));
const stored = db.rows.get("merchant_1:yalidine");
assert.ok(stored);
assert.equal(stored.scope, "track");
assert.equal(JSON.stringify(stored).includes("private-token"), false);
assert.equal(JSON.stringify(stored).includes("attacker.invalid"), false);
assert.deepEqual(await vault.resolveCredentials({ merchantId: "merchant_1", provider: "yalidine" }), {
  apiId: "acct", apiToken: "private-token"
});

const readsBeforeDenied = db.calls.filter(x => x === "read").length;
const denied = createMerchantCredentialVault({
  db, keys: { old: key1 }, activeKeyId: "old", crypto: webcrypto,
  authorizeMerchantProvider: async () => false
});
await assert.rejects(
  () => denied.resolveCredentials({ merchantId: "merchant_1", provider: "yalidine" }),
  e => e instanceof MerchantCredentialVaultError && e.code === "forbidden"
);
assert.equal(db.calls.filter(x => x === "read").length, readsBeforeDenied, "Denied access must not query D1");

const copied = { ...stored };
db.rows.set("merchant_2:yalidine", copied);
await assert.rejects(
  () => vault.resolveCredentials({ merchantId: "merchant_2", provider: "yalidine" }),
  e => e instanceof MerchantCredentialVaultError && e.code === "credential_decryption_failed",
  "AAD must bind ciphertext to the merchant ID"
);
db.rows.delete("merchant_2:yalidine");

await assert.rejects(
  () => vault.save({
    merchantId: "merchant_1", provider: "ecotrack",
    credentials: { token: "secret", courier: "https://attacker.invalid" }, consent: true
  }),
  e => e instanceof MerchantCredentialVaultError && e.code === "invalid_credentials"
);
await assert.rejects(
  () => vault.save({
    merchantId: "merchant_1", provider: "unsupported",
    credentials: { apiKey: "secret" }, consent: true
  }),
  e => e instanceof MerchantCredentialVaultError && e.code === "unsupported_provider"
);
await assert.rejects(
  () => vault.save({
    merchantId: "merchant_1", provider: "yalidine",
    credentials: { apiId: "acct", apiToken: "x".repeat(9000) }, consent: true
  }),
  e => e instanceof MerchantCredentialVaultError && e.code === "credentials_too_large"
);

const rotated = createMerchantCredentialVault({
  db, keys: { old: key1, next: key2 }, activeKeyId: "next",
  crypto: webcrypto, authorizeMerchantProvider: async () => true
});
assert.deepEqual(
  await rotated.resolveCredentials({ merchantId: "merchant_1", provider: "yalidine" }),
  { apiId: "acct", apiToken: "private-token" }
);
await rotated.save({
  merchantId: "merchant_1", provider: "yalidine",
  credentials: { apiId: "acct", apiToken: "private-token" }, consent: true
});
assert.equal(db.rows.get("merchant_1:yalidine").key_id, "next", "New writes use the active key");

assert.deepEqual(
  await rotated.revoke({ merchantId: "merchant_1", provider: "yalidine" }),
  { provider: "yalidine", revoked: true }
);
assert.equal(db.rows.size, 0);
assert.equal(await rotated.resolveCredentials({ merchantId: "merchant_1", provider: "yalidine" }), null);

console.log("Encrypted merchant credential vault tests passed.");
