import { spawnSync } from "node:child_process";
import { channel } from "node:diagnostics_channel";

// ExportFlow uses focused Node.js assertion scripts rather than a supported
// test framework. These channels expose each script as a manual Datadog test.
const testStart = channel("dd-trace:ci:manual:test:start");
const testFinish = channel("dd-trace:ci:manual:test:finish");

const testScripts = [
  "scripts/engine-smoke-test.mjs",
  "scripts/carrier-engine-test.mjs",
  "scripts/cloudflare-fetch-test.mjs",
  "scripts/map-coordinates-test.mjs",
  "scripts/coverage-smoke-test.mjs",
  "scripts/shipment-truth-test.mjs",
  "scripts/batch-track-test.mjs",
  "scripts/openapi-test.mjs",
  "scripts/sdk-test.mjs",
  "scripts/merchant-workspace-test.mjs",
  "scripts/mcp-test.mjs",
  "scripts/smoke-test.mjs",
];

const failures = [];

for (const script of testScripts) {
  const testName = script.split("/").at(-1).replace(/\.mjs$/, "");
  testStart.publish({
    testName,
    testSuite: "ExportFlow CI regression",
  });

  const result = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error || result.status !== 0) {
    const reason = result.error
      ? result.error.message
      : result.signal
        ? `Process terminated by signal ${result.signal}`
        : `Process exited with status ${result.status}`;
    const error = new Error(`${script}: ${reason}`);
    testFinish.publish({ status: "fail", error });
    console.error(`✗ ${script}: ${reason}`);
    failures.push({ script, reason });
    continue;
  }

  testFinish.publish({ status: "pass" });
  console.log(`Datadog test result recorded: ${testName}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} of ${testScripts.length} regression tests failed:`);
  for (const failure of failures) {
    console.error(`- ${failure.script}: ${failure.reason}`);
  }
  process.exitCode = 1;
} else {
  console.log(`All ${testScripts.length} ExportFlow regression scripts passed.`);
}
