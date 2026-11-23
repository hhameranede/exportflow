import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ciWorkflowPath = new URL("../.github/workflows/ci.yml", import.meta.url);
const acceptancePath = new URL("../.github/workflows/oauth-acceptance.yml", import.meta.url);
const mfaAcceptancePath = new URL("../.github/workflows/owner-mfa-acceptance.yml", import.meta.url);
const tenantBurstAcceptancePath = new URL("../.github/workflows/tenant-burst-acceptance.yml", import.meta.url);
const oauthSmokePath = new URL("../scripts/oauth-acceptance-smoke.mjs", import.meta.url);
const authAcceptanceConfigPath = new URL("../cloudflare/auth-acceptance/wrangler.toml", import.meta.url);
const mcpAcceptanceConfigPath = new URL("../cloudflare/mcp-acceptance/wrangler.toml", import.meta.url);
const [ciWorkflow, acceptanceWorkflow, mfaAcceptanceWorkflow, tenantBurstAcceptanceWorkflow, authAcceptanceConfig, mcpAcceptanceConfig, oauthSmoke] = await Promise.all([
  readFile(ciWorkflowPath, "utf8"),
  readFile(acceptancePath, "utf8"),
  readFile(mfaAcceptancePath, "utf8"),
  readFile(tenantBurstAcceptancePath, "utf8"),
  readFile(authAcceptanceConfigPath, "utf8"),
  readFile(mcpAcceptanceConfigPath, "utf8"),
  readFile(oauthSmokePath, "utf8"),
]);

test("ordinary Worker CI does not deploy OAuth Acceptance", () => {
  assert.doesNotMatch(ciWorkflow, /deploy-oauth-acceptance:/);
  assert.match(ciWorkflow, /pull_request:/);
});

test("OAuth Acceptance is gated to this exact branch and approval sentinel", () => {
  assert.match(acceptanceWorkflow, /on:\s*\n\s+push:/);
  assert.match(acceptanceWorkflow, /branches:\s*\n\s+- fix\/oauth-acceptance-reconciled-20261123/);
  assert.match(acceptanceWorkflow, /paths:\s*\n\s+- \.github\/acceptance\/oauth-acceptance\.approved/);
  assert.doesNotMatch(acceptanceWorkflow, /pull_request:/);
  assert.match(acceptanceWorkflow, /group: exportflow-oauth-acceptance-20261122/);
});

test("Acceptance preserves Better Auth signing secret and existing JWKS rows", () => {
  assert.match(acceptanceWorkflow, /wrangler@4 secret list/);
  assert.match(acceptanceWorkflow, /names\.has\("BETTER_AUTH_SECRET"\)/);
  assert.doesNotMatch(acceptanceWorkflow, /secret put BETTER_AUTH_SECRET/);
  assert.match(acceptanceWorkflow, /secret put AUTH_MIGRATION_TOKEN/);
  assert.doesNotMatch(acceptanceWorkflow, /DELETE FROM jwks/i);
  assert.match(acceptanceWorkflow, /SELECT COUNT\(\*\) AS preserved_jwks FROM jwks/);
});

test("OAuth D1 migrations resolve through the pinned Tenant Acceptance binding", () => {
  assert.match(acceptanceWorkflow, /d1 execute EXPORTFLOW_AUTH_DB --config cloudflare\/auth-acceptance\/wrangler\.toml --remote --yes --file/);
  assert.equal((acceptanceWorkflow.match(/d1 execute EXPORTFLOW_AUTH_DB/g) || []).length, 2);
  assert.match(authAcceptanceConfig, /binding = "EXPORTFLOW_AUTH_DB"[\s\S]*?database_id = "1f94eee0-219e-4a41-86ce-49c29067ef06"/);
  assert.match(mcpAcceptanceConfig, /database_id = "1f94eee0-219e-4a41-86ce-49c29067ef06"/);
  assert.doesNotMatch(authAcceptanceConfig, /database_id = "0bd9f873-a1d5-4d90-b3fc-1c4b47e1aa67"/);
  assert.doesNotMatch(mcpAcceptanceConfig, /database_id = "0bd9f873-a1d5-4d90-b3fc-1c4b47e1aa67"/);
});

test("unit and syntax checks run before any Acceptance deployment", () => {
  const tests = acceptanceWorkflow.indexOf("run: npm test && npm run check");
  const deploy = acceptanceWorkflow.indexOf("Deploy isolated Auth Acceptance Worker");
  assert.ok(tests >= 0 && deploy > tests, "tests must precede the first Worker deployment");
  assert.match(acceptanceWorkflow, /0dd14d21-5d56-4b01-8c0f-a14959521dde/);
  assert.match(acceptanceWorkflow, /1f94eee0-219e-4a41-86ce-49c29067ef06/);
  assert.doesNotMatch(acceptanceWorkflow, /database_id = "0bd9f873-a1d5-4d90-b3fc-1c4b47e1aa67"/);
  assert.match(acceptanceWorkflow, /if grep -q '0bd9f873-a1d5-4d90-b3fc-1c4b47e1aa67'/);
});

test("consumed one-shot Acceptance sentinels cannot rerun on deletion or workflow edits", () => {
  assert.ok(acceptanceWorkflow.includes("contains(github.event.head_commit.added, '.github/acceptance/oauth-acceptance.approved')"));
  assert.ok(mfaAcceptanceWorkflow.includes("contains(github.event.head_commit.added, '.github/acceptance/mfa-acceptance.approved')"));
  assert.ok(tenantBurstAcceptanceWorkflow.includes("git cat-file -e HEAD:.github/acceptance/tenant-burst.approved"));
  assert.ok(tenantBurstAcceptanceWorkflow.includes("git cat-file -e HEAD^:.github/acceptance/tenant-burst.approved"));
});

test("OAuth Acceptance exercises refresh rotation, retry replay and RFC 7009 revocation", () => {
  assert.match(oauthSmoke, /grant_type: "refresh_token"/);
  assert.match(oauthSmoke, /Refresh rotation must replace the presented refresh token/);
  assert.match(oauthSmoke, /equivalent retry inside the configured reuse window/);
  assert.match(oauthSmoke, /OAuth refresh-token revocation/);
  assert.match(oauthSmoke, /revokedRefreshAttempt\.body\?\.error, "invalid_grant"/);
  assert.match(oauthSmoke, /DELETE FROM oauthAccessToken WHERE clientId = \?/);
  assert.match(oauthSmoke, /DELETE FROM oauthRefreshToken WHERE clientId = \?/);
  assert.match(oauthSmoke, /DELETE FROM oauthConsent WHERE clientId = \?/);
});
