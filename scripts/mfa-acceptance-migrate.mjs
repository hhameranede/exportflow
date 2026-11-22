import assert from "node:assert/strict";

export const ACCEPTANCE_ACCOUNT_ID = "435030befbb9df09ab76f69209c05347";
export const ACCEPTANCE_AUTH_DATABASE_ID = "0dd14d21-5d56-4b01-8c0f-a14959521dde";
export const PRODUCTION_AUTH_DATABASE_ID = "0bd9f873-a1d5-4d90-b3fc-1c4b47e1aa67";

export async function applyTwoFactorSchema(query) {
  assert.equal(typeof query, "function", "A D1 query function is required.");

  const userInfo = await query("PRAGMA table_info('user')");
  const userColumns = new Set((userInfo.results || []).map((row) => row.name));
  let addedUserColumn = false;

  if (!userColumns.has("twoFactorEnabled")) {
    await query("ALTER TABLE user ADD COLUMN twoFactorEnabled INTEGER DEFAULT 0");
    addedUserColumn = true;
  }

  const existingTable = await query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'twoFactor' LIMIT 1",
  );
  let createdTwoFactorTable = false;

  if (!(existingTable.results || []).some((row) => row.name === "twoFactor")) {
    await query(
      "CREATE TABLE twoFactor (" +
        "id TEXT NOT NULL PRIMARY KEY, " +
        "userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, " +
        "secret TEXT NOT NULL, " +
        "backupCodes TEXT NOT NULL, " +
        "verified INTEGER DEFAULT 1, " +
        "failedVerificationCount INTEGER DEFAULT 0, " +
        "lockedUntil DATE" +
      ")",
    );
    createdTwoFactorTable = true;
  }

  await query("CREATE INDEX IF NOT EXISTS twoFactor_secret_idx ON twoFactor(secret)");
  await query("CREATE INDEX IF NOT EXISTS twoFactor_userId_idx ON twoFactor(userId)");

  const verifiedUserInfo = await query("PRAGMA table_info('user')");
  const verifiedColumns = new Set((verifiedUserInfo.results || []).map((row) => row.name));
  assert.ok(verifiedColumns.has("twoFactorEnabled"), "Acceptance user.twoFactorEnabled column is missing.");

  const verifiedTable = await query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'twoFactor' LIMIT 1",
  );
  assert.ok(
    (verifiedTable.results || []).some((row) => row.name === "twoFactor"),
    "Acceptance twoFactor table is missing.",
  );

  const indexInfo = await query("PRAGMA index_list('twoFactor')");
  const indexes = new Set((indexInfo.results || []).map((row) => row.name));
  assert.ok(indexes.has("twoFactor_secret_idx"), "Acceptance TOTP secret index is missing.");
  assert.ok(indexes.has("twoFactor_userId_idx"), "Acceptance user ID index is missing.");

  return { addedUserColumn, createdTwoFactorTable };
}

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || ACCEPTANCE_ACCOUNT_ID;
  const databaseId = ACCEPTANCE_AUTH_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  assert.equal(accountId, ACCEPTANCE_ACCOUNT_ID, "Refusing an unexpected Cloudflare account.");
  assert.notEqual(databaseId, PRODUCTION_AUTH_DATABASE_ID, "Refusing the Production Auth database.");
  assert.ok(typeof token === "string" && token.length > 0, "CLOUDFLARE_API_TOKEN is required.");

  const query = async (sql, params = []) => {
    const response = await fetch(
      "https://api.cloudflare.com/client/v4/accounts/" + ACCEPTANCE_ACCOUNT_ID +
        "/d1/database/" + databaseId + "/query",
      {
        method: "POST",
        headers: {
          authorization: "Bearer " + token,
          "content-type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
      },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.success !== true || !Array.isArray(body.result) ||
        body.result[0]?.success !== true) {
      throw new Error("Pinned Auth Acceptance D1 migration query failed (HTTP " + response.status + ").");
    }
    return body.result[0];
  };

  const result = await applyTwoFactorSchema(query);
  console.log(
    "Auth Acceptance Better Auth 1.7.27 two-factor schema is ready. " +
    "user.twoFactorEnabled added: " + result.addedUserColumn +
    "; twoFactor table created: " + result.createdTwoFactorTable +
    ". Existing users, sessions, and JWKS were not deleted or reset.",
  );
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => {
    console.error("MFA Acceptance schema migration failed: " +
      (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
