import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const platformConfig = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const mcpConfig = readFileSync(new URL("../cloudflare/mcp/wrangler.toml", import.meta.url), "utf8");
const platformEntrypoint = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const mcpEntrypoint = readFileSync(new URL("../cloudflare/mcp/index.js", import.meta.url), "utf8");
const tenantPlatformAcceptanceConfig = readFileSync(new URL("../cloudflare/acceptance/tenant-platform.wrangler.toml", import.meta.url), "utf8");
const tenantMcpAcceptanceConfig = readFileSync(new URL("../cloudflare/acceptance/tenant-mcp.wrangler.toml", import.meta.url), "utf8");
const taskPlatformAcceptanceConfig = readFileSync(new URL("../cloudflare/task-acceptance/platform.wrangler.toml", import.meta.url), "utf8");
const taskMcpAcceptanceConfig = readFileSync(new URL("../cloudflare/task-acceptance/mcp.wrangler.toml", import.meta.url), "utf8");

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


test("Platform, MCP, and task acceptance Workers route same-zone fetches through the public Cloudflare front door", () => {
  const configurations = [
    ["Platform", platformConfig],
    ["MCP", mcpConfig],
    ["tenant Platform acceptance", tenantPlatformAcceptanceConfig],
    ["tenant MCP acceptance", tenantMcpAcceptanceConfig],
    ["task Platform acceptance", taskPlatformAcceptanceConfig],
    ["task MCP acceptance", taskMcpAcceptanceConfig],
  ];

  for (const [name, config] of configurations) {
    assert.match(
      config,
      /^compatibility_flags\s*=\s*\[[^\]]*["']global_fetch_strictly_public["'][^\]]*\]/m,
      `${name} must route same-zone global fetches through Cloudflare's public front door.`,
    );
    assert.doesNotMatch(
      config,
      /["']global_fetch_private_origin["']/,
      `${name} must not opt out of same-zone public routing.`,
    );
  }
});


test("untrusted URL-fetch Workers do not bind VPC private networks", () => {
  const configurations = [
    ["Platform", platformConfig],
    ["MCP", mcpConfig],
    ["tenant Platform acceptance", tenantPlatformAcceptanceConfig],
    ["tenant MCP acceptance", tenantMcpAcceptanceConfig],
    ["task Platform acceptance", taskPlatformAcceptanceConfig],
    ["task MCP acceptance", taskMcpAcceptanceConfig],
  ];

  for (const [name, config] of configurations) {
    assert.doesNotMatch(
      config,
      /^\\s*\\[\\[(?:vpc_networks|vpc_services)\\]\\]\\s*(?:#.*)?$/m,
      `${name} must not grant the untrusted URL-fetch path a private VPC Network or VPC Service binding.`,
    );
  }
});

test("Production Platform and MCP use the default global Fetch network", () => {
  assert.match(
    platformEntrypoint,
    /export default createWorker\\(\\);/,
    "Platform must not inject a custom fetch transport into the deployed Worker.",
  );
  assert.match(
    mcpEntrypoint,
    /export default createExportFlowPreviewWorker\\(/,
    "MCP must use the standard preview-worker factory.",
  );
  assert.doesNotMatch(
    mcpEntrypoint,
    /\\bfetchImpl\\b/,
    "MCP must not inject a custom fetch transport into untrusted URL retrieval.",
  );
});
