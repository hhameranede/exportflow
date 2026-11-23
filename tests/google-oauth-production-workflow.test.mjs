import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/google-oauth-production.yml", import.meta.url),
  "utf8",
);

test("Production Google OAuth handoff is manual and restricted to main", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s*(push|pull_request):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /ENABLE_GOOGLE_OAUTH_ON_EXPORTFLOW_PRODUCTION/);
});

test("the workflow passes only the two Google credentials to the Platform Worker", () => {
  assert.match(workflow, /secrets\.GOOGLE_CLIENT_ID/);
  assert.match(workflow, /secrets\.GOOGLE_CLIENT_SECRET/);
  assert.match(workflow, /--name exportflow-platform/);
  assert.match(workflow, /secret bulk/);
  assert.doesNotMatch(workflow, /exportflow-mcp-preview|mcp\.wrangler\.toml/);
  assert.doesNotMatch(workflow, /wrangler@4 deploy/);
  assert.doesNotMatch(workflow, /wrangler@4 secret put/);
});

test("secret handoff uses a protected temporary file and never prints values", () => {
  assert.match(workflow, /mode: 0o600/);
  assert.match(workflow, /trap 'rm -f "\$secrets_file"' EXIT/);
  assert.match(workflow, /google-oauth-production-secrets\.json/);
  assert.match(workflow, /values were not logged/);
  assert.doesNotMatch(workflow, /echo\s+["']?\$GOOGLE_CLIENT_(ID|SECRET)/);
});

test("tests and live preflight run before any Production secret mutation", () => {
  const tests = workflow.indexOf("run: npm test && npm run check");
  const preflight = workflow.indexOf("Verify the live Platform health");
  const mutation = workflow.indexOf("Add Google OAuth secrets");
  const postflight = workflow.indexOf("Verify Google OAuth is enabled");
  assert.ok(tests >= 0 && preflight > tests && mutation > preflight && postflight > mutation);
  assert.match(workflow, /api\/v1\/health/);
  assert.match(workflow, /api\/auth\/config/);
  assert.match(workflow, /config\.googleEnabled !== true/);
});
