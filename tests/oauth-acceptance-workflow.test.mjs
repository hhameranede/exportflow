import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ciWorkflowPath = new URL("../.github/workflows/ci.yml", import.meta.url);
const acceptancePath = new URL("../.github/workflows/oauth-acceptance.yml", import.meta.url);
const [ciWorkflow, acceptanceWorkflow] = await Promise.all([
  readFile(ciWorkflowPath, "utf8"),
  readFile(acceptancePath, "utf8"),
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

test("unit and syntax checks run before any Acceptance deployment", () => {
  const tests = acceptanceWorkflow.indexOf("run: npm test && npm run check");
  const deploy = acceptanceWorkflow.indexOf("Deploy isolated Auth Acceptance Worker");
  assert.ok(tests >= 0 && deploy > tests, "tests must precede the first Worker deployment");
  assert.match(acceptanceWorkflow, /0dd14d21-5d56-4b01-8c0f-a14959521dde/);
  assert.match(acceptanceWorkflow, /1f94eee0-219e-4a41-86ce-49c29067ef06/);
  assert.doesNotMatch(acceptanceWorkflow, /database_id = "0bd9f873-a1d5-4d90-b3fc-1c4b47e1aa67"/);
  assert.match(acceptanceWorkflow, /if grep -q '0bd9f873-a1d5-4d90-b3fc-1c4b47e1aa67'/);
});
