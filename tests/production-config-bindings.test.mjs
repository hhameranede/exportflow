import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const platformConfig = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const mcpConfig = readFileSync(new URL("../cloudflare/mcp/wrangler.toml", import.meta.url), "utf8");

const PRODUCTION_AUTH_DB_ID = "0bd9f873-a1d5-4d90-b3fc-1c4b47e1aa67";
const PRODUCTION_TENANT_DB_ID = "535fce81-b961-4097-b83f-c87e56c390bb";

function parseD1Bindings(config) {
  const entries = [];
  let current = null;

  for (const line of config.split(/\r?\n/)) {
    if (line.trim() === "[[d1_databases]]") {
      current = {};
      entries.push(current);
      continue;
    }

    if (/^\s*\[/.test(line)) {
      current = null;
      continue;
    }

    if (!current) continue;
    const match = line.match(/^\s*([a-z_]+)\s*=\s*"([^"]*)"\s*$/);
    if (match) current[match[1]] = match[2];
  }

  return entries;
}

function bindingFor(config, name) {
  const matches = parseD1Bindings(config).filter((entry) => entry.binding === name);
  assert.equal(matches.length, 1, `Expected exactly one D1 binding named ${name}.`);
  return matches[0];
}

test("Platform keeps human Auth D1 separate from tenant data D1", () => {
  const auth = bindingFor(platformConfig, "AUTH_DB");
  assert.equal(auth.database_name, "exportflow-auth-production");
  assert.equal(auth.database_id, PRODUCTION_AUTH_DB_ID);

  const tenant = bindingFor(platformConfig, "EXPORTFLOW_AUTH_DB");
  assert.equal(tenant.database_name, "exportflow-tenant-production");
  assert.equal(tenant.database_id, PRODUCTION_TENANT_DB_ID);
  assert.notEqual(tenant.database_id, auth.database_id);
});

test("MCP uses the same dedicated Production Tenant D1 as Platform", () => {
  const tenant = bindingFor(mcpConfig, "EXPORTFLOW_AUTH_DB");
  assert.equal(tenant.database_name, "exportflow-tenant-production");
  assert.equal(tenant.database_id, PRODUCTION_TENANT_DB_ID);
  assert.notEqual(tenant.database_id, PRODUCTION_AUTH_DB_ID);
});

test("MCP config no longer describes the tenant D1 binding as intentionally absent", () => {
  assert.equal(
    mcpConfig.includes("EXPORTFLOW_AUTH_DB is deliberately not bound"),
    false,
  );
});
