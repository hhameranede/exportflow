import assert from "node:assert/strict";
import test from "node:test";
import { applyTwoFactorSchema } from "../scripts/mfa-acceptance-migrate.mjs";

function fakeD1() {
  const userColumns = new Set(["id", "email", "emailVerified"]);
  const tables = new Set(["user", "session", "account", "verification", "jwks"]);
  const indexes = new Set();
  const statements = [];

  return {
    statements,
    async query(sql) {
      statements.push(sql);
      if (sql === "PRAGMA table_info('user')") {
        return { results: [...userColumns].map((name) => ({ name })) };
      }
      if (sql.includes("sqlite_master") && sql.includes("name = 'twoFactor'")) {
        return { results: tables.has("twoFactor") ? [{ name: "twoFactor" }] : [] };
      }
      if (sql.startsWith("ALTER TABLE user ADD COLUMN twoFactorEnabled")) {
        userColumns.add("twoFactorEnabled");
        return { results: [] };
      }
      if (sql.startsWith("CREATE TABLE twoFactor")) {
        tables.add("twoFactor");
        return { results: [] };
      }
      if (sql.startsWith("CREATE INDEX IF NOT EXISTS twoFactor_secret_idx")) {
        indexes.add("twoFactor_secret_idx");
        return { results: [] };
      }
      if (sql.startsWith("CREATE INDEX IF NOT EXISTS twoFactor_userId_idx")) {
        indexes.add("twoFactor_userId_idx");
        return { results: [] };
      }
      if (sql === "PRAGMA index_list('twoFactor')") {
        return { results: [...indexes].map((name) => ({ name })) };
      }
      throw new Error("Unexpected D1 statement: " + sql);
    },
    snapshot() {
      return { userColumns: new Set(userColumns), tables: new Set(tables), indexes: new Set(indexes) };
    },
  };
}

test("Acceptance MFA schema migration is additive and creates Better Auth 1.7.27 fields", async () => {
  const db = fakeD1();
  const result = await applyTwoFactorSchema((sql) => db.query(sql));

  assert.deepEqual(result, { addedUserColumn: true, createdTwoFactorTable: true });
  const state = db.snapshot();
  assert.ok(state.userColumns.has("twoFactorEnabled"));
  assert.ok(state.tables.has("twoFactor"));
  assert.deepEqual(
    [...state.indexes].sort(),
    ["twoFactor_secret_idx", "twoFactor_userId_idx"],
  );
  assert.equal(state.tables.has("user"), true);
  assert.equal(state.tables.has("session"), true);
  assert.equal(state.tables.has("jwks"), true);
  assert.equal(db.statements.some((sql) => /\b(DELETE|DROP|TRUNCATE)\b/i.test(sql)), false);
});

test("Acceptance MFA schema migration is safe to rerun without replacing existing schema", async () => {
  const db = fakeD1();
  await applyTwoFactorSchema((sql) => db.query(sql));
  const before = db.statements.length;

  const result = await applyTwoFactorSchema((sql) => db.query(sql));

  assert.deepEqual(result, { addedUserColumn: false, createdTwoFactorTable: false });
  assert.equal(db.statements.length, before + 5);
  assert.equal(db.statements.some((sql) => /\b(DELETE|DROP|TRUNCATE)\b/i.test(sql)), false);
});
