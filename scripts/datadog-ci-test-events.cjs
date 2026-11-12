// Wrap ExportFlow's custom Node regression suite as one Datadog manual test event.
"use strict";

const { spawnSync } = require("node:child_process");
const { channel } = require("node:diagnostics_channel");

const start = channel("dd-trace:ci:manual:test:start");
const finish = channel("dd-trace:ci:manual:test:finish");
const addTags = channel("dd-trace:ci:manual:test:addTags");

start.publish({
  testName: "exportflow-regression-suite",
  testSuite: "ExportFlow CI"
});
addTags.publish({
  project: "exportflow",
  "test.scope": "node-regression-suite"
});

const childEnv = { ...process.env };
for (const key of Object.keys(childEnv)) {
  if (key.startsWith("DD_") || key === "NODE_OPTIONS") delete childEnv[key];
}

const result = spawnSync("npm", ["test"], {
  stdio: "inherit",
  env: childEnv
});
const exitCode = result.error || typeof result.status !== "number"
  ? 1
  : result.status;
const failed = exitCode !== 0;

finish.publish({
  status: failed ? "fail" : "pass",
  error: failed
    ? (result.error || new Error("npm test exited with code " + exitCode))
    : undefined
});

process.exitCode = exitCode;
