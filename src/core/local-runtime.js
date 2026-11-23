import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getMigrations } from "better-auth/db/migration";
import { getAuthInstance } from "./auth-app.js";

function normalizeSqlParam(value) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function createSqliteD1Adapter(sqlite) {
  function wrapStatement(sql, bound = []) {
    return {
      bind(...params) {
        return wrapStatement(sql, params.map(normalizeSqlParam));
      },
      async first(column) {
        const row = sqlite.prepare(sql).get(...bound);
        if (!row) return null;
        return typeof column === "string" ? row[column] : row;
      },
      async all() {
        const results = sqlite.prepare(sql).all(...bound);
        return { results, success: true, meta: {} };
      },
      async run() {
        const info = sqlite.prepare(sql).run(...bound);
        return {
          success: true,
          meta: {
            changes: info.changes,
            last_row_id: info.lastInsertRowid,
          },
        };
      },
      async raw() {
        const rows = sqlite.prepare(sql).all(...bound);
        return rows.map((row) => Object.values(row));
      },
    };
  }

  return {
    prepare(sql) {
      return wrapStatement(sql);
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const stmt of statements) {
          results.push(await stmt.all());
        }
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(sql) {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
}

function resolveOrCreateLocalSecret(dataDir, inMemory) {
  if (typeof process.env.BETTER_AUTH_SECRET === "string" && process.env.BETTER_AUTH_SECRET.trim().length >= 32) {
    return process.env.BETTER_AUTH_SECRET.trim();
  }
  if (inMemory) {
    return crypto.randomBytes(32).toString("hex");
  }
  const secretPath = path.join(dataDir, "local-secret.key");
  try {
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, "utf8").trim();
      if (existing.length >= 32) return existing;
    }
  } catch {
    // Regenerate below if unreadable
  }
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(secretPath, generated + "\n", { mode: 0o600 });
  return generated;
}

function ensureLocalTables(sqlite) {
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS local_dev_mailbox (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      kind TEXT NOT NULL,
      subject TEXT NOT NULL,
      action_url TEXT NOT NULL,
      action_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_local_dev_mailbox_email_created
      ON local_dev_mailbox(email, created_at DESC);

    CREATE TABLE IF NOT EXISTS workspace_api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      scopes_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_workspace_api_keys_user
      ON workspace_api_keys(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS workspace_executions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      goal TEXT NOT NULL,
      requested_url TEXT NOT NULL,
      operation TEXT NOT NULL,
      mode TEXT NOT NULL,
      adapter_id TEXT,
      state TEXT NOT NULL,
      http_status INTEGER,
      duration_ms INTEGER,
      response_bytes INTEGER,
      final_url TEXT,
      error_code TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workspace_executions_user
      ON workspace_executions(user_id, created_at DESC);
  `);
}

function extractActionPath(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return typeof rawUrl === "string" && rawUrl.startsWith("/") ? rawUrl : "/";
  }
}

function extractLinkFromHtml(html) {
  const match = /href="([^"]+)"/i.exec(String(html || ""));
  if (!match) return "";
  return match[1].replaceAll("&amp;", "&");
}

function classifyEmailKind(subject, actionPath) {
  const lowerSubject = String(subject || "").toLowerCase();
  const lowerPath = String(actionPath || "").toLowerCase();
  if (lowerPath.includes("reset-password") || lowerSubject.includes("reset")) {
    return "reset";
  }
  return "verify";
}

export async function createLocalRuntimeEnv({
  port = 3000,
  host = "127.0.0.1",
  dataDir = path.resolve(process.cwd(), ".data"),
  dbPath = path.join(dataDir, "exportflow-local.sqlite"),
  baseEnv = process.env,
} = {}) {
  const inMemory = dbPath === ":memory:";
  if (!inMemory) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const sqlite = new DatabaseSync(dbPath);
  ensureLocalTables(sqlite);

  const authDb = createSqliteD1Adapter(sqlite);
  const secret = resolveOrCreateLocalSecret(dataDir, inMemory);
  const resolvedHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  const betterAuthUrl = typeof baseEnv.BETTER_AUTH_URL === "string" && baseEnv.BETTER_AUTH_URL.trim()
    ? baseEnv.BETTER_AUTH_URL.trim()
    : `http://${resolvedHost}:${port}`;

  const hasCustomEmail =
    baseEnv.EMAIL &&
    typeof baseEnv.EMAIL.send === "function" &&
    typeof baseEnv.AUTH_EMAIL_FROM === "string" &&
    baseEnv.AUTH_EMAIL_FROM.trim().length > 0;

  const emailBinding = hasCustomEmail
    ? baseEnv.EMAIL
    : {
        async send(message) {
          const toEmail = String(message?.to || "").trim().toLowerCase();
          const subject = String(message?.subject || "ExportFlow account message");
          const actionUrl = extractLinkFromHtml(message?.html) || "";
          const actionPath = extractActionPath(actionUrl);
          const kind = classifyEmailKind(subject, actionPath);
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

          if (toEmail && actionUrl) {
            sqlite.prepare(
              "DELETE FROM local_dev_mailbox WHERE expires_at <= ?1",
            ).run(now.toISOString());

            sqlite.prepare(
              "INSERT INTO local_dev_mailbox (id, email, kind, subject, action_url, action_path, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            ).run(
              crypto.randomUUID(),
              toEmail,
              kind,
              subject,
              actionUrl,
              actionPath,
              now.toISOString(),
              expiresAt,
            );
          }
          return { messageId: "local-dev-" + crypto.randomUUID() };
        },
      };

  const env = {
    ...baseEnv,
    AUTH_DB: authDb,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: betterAuthUrl,
    EMAIL: emailBinding,
    AUTH_EMAIL_FROM: hasCustomEmail ? baseEnv.AUTH_EMAIL_FROM.trim() : "accounts@exportflow.local",
    LOCAL_DEV_RUNTIME: true,
    LOCAL_DEV_MAILBOX: !hasCustomEmail,
  };

  const auth = getAuthInstance(env);
  if (auth) {
    const migrations = await getMigrations(auth.options);
    if (Array.isArray(migrations?.toBeCreated) && migrations.toBeCreated.length > 0 ||
        Array.isArray(migrations?.toBeAdded) && migrations.toBeAdded.length > 0) {
      await migrations.runMigrations();
    }
  }

  return env;
}
