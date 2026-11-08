import assert from "node:assert/strict";
import { classifyCredentialLiteralFindings } from "./credential-literal-classifier.mjs";

const sentinel = "DO_NOT_SERIALIZE_THIS_SECRET_VALUE";
const findings = classifyCredentialLiteralFindings([
  { path: "adapter.ts", content: 'const API_KEY = "' + sentinel + '";\nconst SHORT = "secret";' },
  { path: "adapter.test.ts", content: 'const PASSWORD = "' + sentinel + '";' },
  { path: "fixtures/app.js", content: 'const CLIENT_SECRET = "' + sentinel + '";' },
  { path: "browser/vision-model.test.ts", content: 'const access_token = "' + sentinel + '";' }
]);

assert.equal(findings.length, 4);
assert.deepEqual(findings.map(x => x.sourceKind), ["test", "runtime", "test", "fixture"]);
assert.ok(findings.every(x => x.valueLength === sentinel.length));
assert.ok(findings.every(x => !Object.hasOwn(x, "value")));
assert.ok(findings.every(x => !Object.hasOwn(x, "secret")));
assert.ok(!JSON.stringify(findings).includes(sentinel));
assert.deepEqual(findings.map(x => x.field), ["password", "api_key", "access_token", "client_secret"]);
assert.equal(findings[0].line, 1);
console.log("credential-literal-classifier: 4 synthetic cases passed; no literal values retained");
