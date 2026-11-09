import assert from "node:assert/strict";
import { classifyAdapterSourceKind, classifyCredentialLiteralFindings } from "./credential-literal-classifier.mjs";

const sentinel = "DO_NOT_SERIALIZE_THIS_SECRET_VALUE";
const expectedKinds = {
  "adapter.ts": "runtime",
  "adapter.test.ts": "test",
  "fixtures/app.js": "fixture",
  "browser/vision-model.test.ts": "test",
  "__tests__/nested/server.ts": "test",
  "tests/helpers/request.ts": "test",
  "__fixtures__/payload.json": "fixture",
  "C:\\workspace\\fixtures\\mock.fixture.js": "fixture",
  "specs/client.ts": "test"
};

for (const [path, expected] of Object.entries(expectedKinds)) {
  assert.equal(classifyAdapterSourceKind(path), expected, "source kind for " + path);
}

const findings = classifyCredentialLiteralFindings([
  { path: "adapter.ts", content: 'const API_KEY = "' + sentinel + '";' },
  { path: "adapter.test.ts", content: 'const PASSWORD = "' + sentinel + '";' },
  { path: "fixtures/app.js", content: 'const CLIENT_SECRET = "' + sentinel + '";' },
  { path: "browser/vision-model.test.ts", content: 'const access_token = "' + sentinel + '";' },
  { path: "__tests__/nested/server.ts", content: 'const API_KEY = "' + sentinel + '";' },
  { path: "tests/helpers/request.ts", content: 'const PASSWORD = "' + sentinel + '";' },
  { path: "__fixtures__/payload.json", content: '{"client_secret":"' + sentinel + '"}' },
  { path: "C:\\workspace\\fixtures\\mock.fixture.js", content: 'const access_token = "' + sentinel + '";' }
]);

assert.equal(findings.length, 8);
const kindsByPath = Object.fromEntries(findings.map(item => [item.file, item.sourceKind]));
for (const [path, expected] of Object.entries(expectedKinds)) {
  if (path === "specs/client.ts") continue;
  assert.equal(kindsByPath[path], expected, "finding source kind for " + path);
}
assert.ok(findings.every(item => item.valueLength === sentinel.length));
assert.ok(findings.every(item => !Object.hasOwn(item, "value")));
assert.ok(findings.every(item => !Object.hasOwn(item, "secret")));
assert.ok(!JSON.stringify(findings).includes(sentinel));
assert.ok(findings.some(item => item.file === "__fixtures__/payload.json" && item.field === "client_secret" && item.sourceKind === "fixture"));
assert.ok(findings.some(item => item.file === "__tests__/nested/server.ts" && item.sourceKind === "test"));
console.log("credential-literal-classifier: 8 synthetic source-scope cases passed; no literal values retained");
