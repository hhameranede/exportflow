// Reports one Datadog manual test event per Node-based regression script.
// Loaded only in CI when DD_API_KEY is configured.
"use strict";

const path = require("node:path");
const { channel } = require("node:diagnostics_channel");

if (
  process.env.DD_CIVISIBILITY_AGENTLESS_ENABLED === "true" &&
  process.env.DD_API_KEY &&
  process.env.DD_SITE
) {
  const scriptPath = typeof process.argv[1] === "string" ? process.argv[1] : "";
  const normalizedPath = scriptPath.replace(/\\/g, "/");
  const match = normalizedPath.match(/(?:^|\/)scripts\/([^/]+)\.mjs$/);

  if (match && !match[1].startsWith("datadog-")) {
    const testName = match[1];
    const testSuite = "exportflow-regression";
    const start = channel("dd-trace:ci:manual:test:start");
    const finish = channel("dd-trace:ci:manual:test:finish");
    const addTags = channel("dd-trace:ci:manual:test:addTags");
    let finished = false;

    start.publish({ testName, testSuite });
    addTags.publish({
      project: "exportflow",
      "test.scope": "node-regression-script"
    });

    const publishFinish = () => {
      if (finished) return;
      finished = true;
      const failed = Number(process.exitCode || 0) !== 0;
      finish.publish({
        status: failed ? "fail" : "pass",
        error: failed ? new Error("Regression script exited with code " + process.exitCode) : undefined
      });
    };

    process.once("beforeExit", publishFinish);
    process.once("exit", publishFinish);
  }
}
