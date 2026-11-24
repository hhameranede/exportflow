import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATIONS = [
  "0001_tenant_auth_quota.sql",
  "0002_guard_quota_period_transitions.sql",
  "0003_tenant_admin_audit_log.sql",
  "0004_tenant_oauth_memberships.sql",
  "0005_durable_task_lifecycle.sql",
];

export function createDurableTaskD1({ requestLimit = 10, tenantIds = ["tenant_alpha"] } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const filename of MIGRATIONS) {
    sqlite.exec(readFileSync(resolve(REPO_ROOT, "migrations", filename), "utf8"));
  }

  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          const statement = sqlite.prepare(sql);
          return {
            async first() {
              return statement.get(...params) ?? null;
            },
            async all() {
              return { results: statement.all(...params) };
            },
            async run() {
              const result = statement.run(...params);
              return { success: true, meta: { changes: Number(result.changes) } };
            },
          };
        },
      };
    },
  };

  const timestamp = "2026-11-24T10:00:00.000Z";
  db.prepare(
    "INSERT INTO plan_policies (plan_code, quota_period, request_limit, policy_version, status, created_at, updated_at) " +
    "VALUES (?1, 'daily', ?2, 'test-v1', 'active', ?3, ?3)",
  ).bind("developer", requestLimit, timestamp).run();

  for (const tenantId of tenantIds) {
    db.prepare(
      "INSERT INTO tenants (tenant_id, plan_code, status, created_at, updated_at) " +
      "VALUES (?1, 'developer', 'active', ?2, ?2)",
    ).bind(tenantId, timestamp).run();
  }

  return {
    db,
    sqlite,
    close() {
      sqlite.close();
    },
  };
}
