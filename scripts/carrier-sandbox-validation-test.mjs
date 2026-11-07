import assert from "node:assert/strict";
import {
  parseRequestedProviders,
  validateSandboxEnvironment
} from "./carrier-sandbox-validation.mjs";

assert.deepEqual(parseRequestedProviders("ups"), ["ups"]);
assert.deepEqual(parseRequestedProviders("fedex"), ["fedex"]);
assert.deepEqual(parseRequestedProviders("both"), ["ups", "fedex"]);
assert.deepEqual(parseRequestedProviders("UPS, fedex, ups"), ["ups", "fedex"]);
assert.throws(() => parseRequestedProviders("dhl"), /Select ups, fedex, or both/);
assert.throws(() => parseRequestedProviders(""), /Select ups, fedex, or both/);

assert.deepEqual(validateSandboxEnvironment("ups", {
  UPS_CLIENT_ID: "sandbox-id",
  UPS_CLIENT_SECRET: "sandbox-secret",
  UPS_API_URL: "https://wwwcie.ups.com"
}), { endpoint: "https://wwwcie.ups.com", credentialsPresent: true });

assert.deepEqual(validateSandboxEnvironment("fedex", {
  FEDEX_API_KEY: "sandbox-key",
  FEDEX_SECRET_KEY: "sandbox-secret",
  FEDEX_API_URL: "https://apis-sandbox.fedex.com"
}), { endpoint: "https://apis-sandbox.fedex.com", credentialsPresent: true });

assert.throws(() => validateSandboxEnvironment("ups", {
  UPS_CLIENT_ID: "id",
  UPS_CLIENT_SECRET: "secret",
  UPS_API_URL: "https://onlinetools.ups.com"
}), /refuses any endpoint/);
assert.throws(() => validateSandboxEnvironment("fedex", {
  FEDEX_API_KEY: "key",
  FEDEX_SECRET_KEY: "secret",
  FEDEX_API_URL: "https://apis.fedex.com"
}), /refuses any endpoint/);
assert.throws(() => validateSandboxEnvironment("ups", {
  UPS_API_URL: "https://wwwcie.ups.com"
}), /Client ID and Client Secret are required/);
assert.throws(() => validateSandboxEnvironment("fedex", {
  FEDEX_API_URL: "https://apis-sandbox.fedex.com"
}), /API key and secret are required/);
assert.throws(() => validateSandboxEnvironment("dhl", {}), /Unsupported sandbox provider/);

console.log("Carrier Sandbox safety tests passed: provider selection, credential preflight and production-endpoint refusal.");
