import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { CARRIER_IDS } from "universal-parcel-scraper";
import { createTracker } from "universal-parcel-scraper/node";

const UPSTREAM_COMMIT = "e64a466772ef25ce68e02d9c7c9f1613eec1208b";
const RAW_BASE = `https://raw.githubusercontent.com/plhery/universal-parcel-scraper/${UPSTREAM_COMMIT}/benchmark`;
const REQUEST_BUDGET_MS = Math.min(
  30_000,
  Math.max(5_000, Number(process.env.EXPORTFLOW_CANARY_BUDGET_MS) || 18_000)
);
const CONCURRENCY = Math.min(
  4,
  Math.max(1, Number(process.env.EXPORTFLOW_CANARY_CONCURRENCY) || 2)
);

async function fetchText(path) {
  const response = await fetch(`${RAW_BASE}/${path}`, {
    headers: { Accept: "application/json,text/plain" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Could not load upstream benchmark data (${response.status})`);
  return response.text();
}

const [carrierText, resultText] = await Promise.all([
  fetchText("carriers.json"),
  fetchText("results.jsonl")
]);

const benchmark = JSON.parse(carrierText);
assert.ok(Array.isArray(benchmark.carriers), "Upstream benchmark must contain a carriers array");
assert.ok(benchmark.carriers.length >= 50, "Upstream benchmark unexpectedly contains too few carriers");

const previousDirectHistory = new Map();
for (const line of resultText.split("\n")) {
  if (!line.trim()) continue;
  const record = JSON.parse(line);
  if (record.source !== "direct" || record.outcome !== "history") continue;
  const previous = previousDirectHistory.get(record.carrier);
  if (!previous || String(record.checked ?? "") > String(previous.checked ?? "")) {
    previousDirectHistory.set(record.carrier, record);
  }
}

function chooseSample(entry) {
  const knownGood = previousDirectHistory.get(entry.carrier);
  if (knownGood) {
    const match = entry.numbers.find(item => item.number === knownGood.number);
    if (match) return match;
  }
  return entry.numbers[0];
}

function classifyError(error) {
  const kind = error?.hint?.kind ?? error?.kind ?? "";
  if (kind === "not_found") return "no_history";
  if (kind === "invalid_input") return "refused";
  if (kind === "input_required") return "needs_input";
  if (kind === "rate_limited") return "rate_limited";
  if (kind === "challenge") return "blocked";
  if (error?.name === "AbortError" || /timeout|timed out/i.test(error?.message ?? "")) return "timeout";
  return "error";
}

const tracker = createTracker({ providers: [] });
const queue = [];
const skipped = [];

for (const entry of benchmark.carriers) {
  if (!Array.isArray(entry.numbers) || entry.numbers.length === 0) {
    skipped.push({ carrier: entry.carrier, outcome: "no_sample" });
    continue;
  }

  const carrierId = entry.aliasOf ?? entry.carrier;
  if (!CARRIER_IDS.includes(carrierId)) {
    skipped.push({ carrier: entry.carrier, outcome: "not_in_catalog" });
    continue;
  }

  const sample = chooseSample(entry);
  queue.push({
    carrier: entry.carrier,
    adapter: carrierId,
    number: sample.number,
    postcode: sample.postcode
  });
}

assert.ok(queue.length >= 40, "Too few benchmark carriers map to this engine catalog");

const results = new Array(queue.length);
let cursor = 0;

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= queue.length) return;

    const item = queue[index];
    const started = Date.now();
    try {
      const tracked = await tracker.track({
        number: item.number,
        carrier: item.adapter,
        ...(item.postcode ? { postcode: item.postcode } : {})
      }, { budgetMs: REQUEST_BUDGET_MS });

      const result = tracked?.result ?? {};
      const eventCount = Array.isArray(result.events) ? result.events.length : 0;
      results[index] = {
        carrier: item.carrier,
        adapter: item.adapter,
        outcome: eventCount > 0 ? "history" : result.current_stage ? "status_only" : "empty",
        stage: typeof result.current_stage === "string" ? result.current_stage : "unknown",
        eventCount,
        source: typeof tracked?.source === "string" ? tracked.source : "unknown",
        durationMs: Date.now() - started
      };
    } catch (error) {
      results[index] = {
        carrier: item.carrier,
        adapter: item.adapter,
        outcome: classifyError(error),
        durationMs: Date.now() - started
      };
    }

    const row = results[index];
    console.log(JSON.stringify({
      carrier: row.carrier,
      outcome: row.outcome,
      ...(row.stage ? { stage: row.stage } : {}),
      ...(Number.isInteger(row.eventCount) ? { events: row.eventCount } : {}),
      durationMs: row.durationMs
    }));
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));

const counts = Object.fromEntries(
  [...new Set(results.map(item => item.outcome))].sort().map(outcome => [
    outcome,
    results.filter(item => item.outcome === outcome).length
  ])
);
const report = {
  testedAt: new Date().toISOString(),
  engineCommit: UPSTREAM_COMMIT,
  mode: "direct-adapters-only",
  fallbackProvidersEnabled: [],
  datasetCarriers: benchmark.carriers.length,
  attempted: results.length,
  skipped,
  counts,
  results
};

const reportPath = process.env.EXPORTFLOW_CANARY_REPORT || "carrier-canary-report.json";
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  summary: "ExportFlow direct-carrier canary complete",
  report: reportPath,
  datasetCarriers: report.datasetCarriers,
  attempted: report.attempted,
  skipped: skipped.length,
  counts
}, null, 2));

if (results.every(item => item.outcome !== "history" && item.outcome !== "status_only")) {
  console.error("No carrier returned shipment history or a known status; inspect the report before relying on live tracking.");
  process.exitCode = 1;
}
