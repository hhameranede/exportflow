import { setTimeout as delay } from "node:timers/promises";

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountTag = process.env.CLOUDFLARE_ACCOUNT_ID;
const scriptName = "exportflow-pdf-parser-compat";
const datetimeStart =
  process.env.ACCEPTANCE_START_TIME ??
  new Date(Date.now() - 10 * 60 * 1000).toISOString();

if (!token || !accountTag) {
  console.warn("WARN Cloudflare CPU analytics skipped: account token or account ID is unavailable.");
  process.exit(0);
}

const query = `query GetWorkersAnalytics($accountTag: string!, $datetimeStart: string!, $datetimeEnd: string!, $scriptName: string!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(limit: 100, filter: {
        scriptName: $scriptName,
        datetime_geq: $datetimeStart,
        datetime_leq: $datetimeEnd
      }) {
        sum { subrequests requests errors }
        quantiles { cpuTimeP50 cpuTimeP99 memoryUsageBytesP50 memoryUsageBytesP90 memoryUsageBytesP99 memoryUsageBytesP999 }
        dimensions { datetime scriptName status }
      }
    }
  }
}`;

for (let attempt = 1; attempt <= 6; attempt += 1) {
  const datetimeEnd = new Date().toISOString();
  let response;
  try {
    response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { accountTag, datetimeStart, datetimeEnd, scriptName },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.warn("WARN Cloudflare CPU analytics request failed: " + String(error?.message || error));
    process.exit(0);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    console.warn("WARN Cloudflare CPU analytics returned a non-JSON response (HTTP " + response.status + ").");
    process.exit(0);
  }

  if (!response.ok || payload.errors?.length) {
    const messages = (payload.errors || []).map((item) => item.message).filter(Boolean).join("; ");
    console.warn(
      "WARN Cloudflare CPU analytics unavailable (HTTP " + response.status + ")" +
      (messages ? ": " + messages : "") +
      ". The token may need Account Analytics: Read.",
    );
    process.exit(0);
  }

  const rows = payload.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
  if (rows.length > 0) {
    const samples = rows.map((row) => ({
      datetime: row.dimensions?.datetime ?? null,
      status: row.dimensions?.status ?? null,
      requests: row.sum?.requests ?? null,
      errors: row.sum?.errors ?? null,
      subrequests: row.sum?.subrequests ?? null,
      cpuTimeP50: row.quantiles?.cpuTimeP50 ?? null,
      cpuTimeP99: row.quantiles?.cpuTimeP99 ?? null,
      memoryUsageBytesP50: row.quantiles?.memoryUsageBytesP50 ?? null,
      memoryUsageBytesP90: row.quantiles?.memoryUsageBytesP90 ?? null,
      memoryUsageBytesP99: row.quantiles?.memoryUsageBytesP99 ?? null,
      memoryUsageBytesP999: row.quantiles?.memoryUsageBytesP999 ?? null,
    }));
    console.log("Cloudflare Workers CPU analytics (CPU quantiles reported by Cloudflare):");
    console.log(JSON.stringify({ scriptName, datetimeStart, datetimeEnd, samples }, null, 2));
    console.log("Note: memory quantiles are isolate-memory snapshots at invocation time, not exact per-request peak allocations.");
    process.exit(0);
  }

  if (attempt < 6) await delay(10_000);
}

console.warn("WARN Cloudflare CPU analytics has no samples in the acceptance window yet; do not infer CPU time from wall-clock duration.");
