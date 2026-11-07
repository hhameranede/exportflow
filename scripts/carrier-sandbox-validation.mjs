import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { channel } from "node:diagnostics_channel";
import { UPSApiClient, upsApiCredentials } from "../node_modules/universal-parcel-scraper/dist/carriers/ups/api.js";
import { FedExApiClient, fedexApiCredentials } from "../node_modules/universal-parcel-scraper/dist/carriers/fedex/api.js";
import { NotFoundError } from "../node_modules/universal-parcel-scraper/dist/core/errors/index.js";
import { parseFedExApiResponse } from "../node_modules/universal-parcel-scraper/dist/carriers/fedex/adapter.js";

const UPS_SANDBOX_ORIGIN = "https://wwwcie.ups.com";
const FEDEX_SANDBOX_ORIGIN = "https://apis-sandbox.fedex.com";
const UPS_SYNTHETIC_TRACKING_NUMBER = "1Z999AA10123456784";
const FEDEX_SYNTHETIC_TRACKING_NUMBER = "999999999999";
const TIMEOUT_MS = 25_000;

export function parseRequestedProviders(value) {
  const providers = String(value || "").split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
  if (providers.length === 1 && providers[0] === "both") return ["ups", "fedex"];
  if (!providers.length || providers.some(item => !["ups", "fedex"].includes(item))) {
    throw new Error("Select ups, fedex, or both.");
  }
  return [...new Set(providers)];
}

export function validateSandboxEnvironment(provider, env = process.env) {
  if (provider === "ups") {
    if (env.UPS_API_URL !== UPS_SANDBOX_ORIGIN) {
      throw new Error("UPS sandbox validation refuses any endpoint other than the official CIE host.");
    }
    const credentials = upsApiCredentials(env);
    if (!credentials || credentials.url !== UPS_SANDBOX_ORIGIN) {
      throw new Error("UPS Sandbox Client ID and Client Secret are required.");
    }
    return { endpoint: UPS_SANDBOX_ORIGIN, credentialsPresent: true };
  }

  if (provider === "fedex") {
    if (env.FEDEX_API_URL !== FEDEX_SANDBOX_ORIGIN) {
      throw new Error("FedEx sandbox validation refuses any endpoint other than the official sandbox host.");
    }
    const credentials = fedexApiCredentials(env);
    if (!credentials || credentials.url !== FEDEX_SANDBOX_ORIGIN) {
      throw new Error("FedEx Sandbox API key and secret are required.");
    }
    return { endpoint: FEDEX_SANDBOX_ORIGIN, credentialsPresent: true };
  }

  throw new Error("Unsupported sandbox provider.");
}

function writeSummary(row, env = process.env) {
  if (!env.GITHUB_STEP_SUMMARY) return;
  const result = row.ok ? "PASS" : "FAIL";
  appendFileSync(env.GITHUB_STEP_SUMMARY,
    "| " + row.provider + " | " + row.environment + " | " + result + " | " +
    row.elapsedMs + " ms | " + row.note + " |\n"
  );
}

async function validateUps() {
  const config = validateSandboxEnvironment("ups");
  const credentials = upsApiCredentials(process.env);
  const started = performance.now();
  const client = new UPSApiClient(credentials);
  let note = "CIE returned a structurally valid Track API response.";

  try {
    const reply = await client.track(
      UPS_SYNTHETIC_TRACKING_NUMBER,
      AbortSignal.timeout(TIMEOUT_MS),
      TIMEOUT_MS
    );
    if (!reply || typeof reply !== "object" || Array.isArray(reply) ||
        !reply.trackResponse || typeof reply.trackResponse !== "object" ||
        !Array.isArray(reply.trackResponse.shipment)) {
      throw new Error("UPS CIE returned an unexpected response envelope.");
    }
  } catch (error) {
    if (error instanceof NotFoundError) {
      note = "UPS CIE authenticated successfully and returned its expected synthetic-number not-found response.";
    } else {
      throw error;
    }
  }

  return {
    provider: "UPS",
    environment: "CIE",
    endpoint: config.endpoint,
    ok: true,
    elapsedMs: Math.max(0, Math.round(performance.now() - started)),
    note
  };
}

async function validateFedEx() {
  const config = validateSandboxEnvironment("fedex");
  const credentials = fedexApiCredentials(process.env);
  const started = performance.now();
  const client = new FedExApiClient(credentials);
  const reply = await client.track(
    FEDEX_SYNTHETIC_TRACKING_NUMBER,
    AbortSignal.timeout(TIMEOUT_MS),
    TIMEOUT_MS
  );

  // Reuse the same strict response parser as production. The synthetic test
  // number may be unknown; an unknown result is still a successful auth/shape
  // handshake, whereas malformed/gated/unexpected replies fail closed.
  const normalized = parseFedExApiResponse(reply, FEDEX_SYNTHETIC_TRACKING_NUMBER);
  if (!normalized || typeof normalized.status !== "string" || !Array.isArray(normalized.events)) {
    throw new Error("FedEx sandbox response did not normalize to the expected tracking result.");
  }

  return {
    provider: "FedEx",
    environment: "Developer Sandbox",
    endpoint: config.endpoint,
    ok: true,
    elapsedMs: Math.max(0, Math.round(performance.now() - started)),
    note: "OAuth and Track API returned a response accepted by the production parser; synthetic input only."
  };
}

function safeFailure(error) {
  const name = error && typeof error.name === "string" && /^[A-Za-z][A-Za-z0-9]{0,48}$/.test(error.name)
    ? error.name
    : "SandboxError";
  const status = error && Number.isInteger(error.status) && error.status >= 100 && error.status <= 599
    ? " HTTP " + error.status
    : "";
  const reason = error && typeof error.reason === "string" &&
    ["credentials_rejected", "rate_limited", "network", "timeout"].includes(error.reason)
    ? " (" + error.reason + ")"
    : "";
  return name + status + reason;
}

async function runOne(provider) {
  const started = performance.now();
  const testName = "carrier-sandbox-" + provider;
  const start = channel("dd-trace:ci:manual:test:start");
  const finish = channel("dd-trace:ci:manual:test:finish");
  start.publish({ testName, testSuite: "ExportFlow carrier Sandbox validation" });

  try {
    const result = provider === "ups" ? await validateUps() : await validateFedEx();
    finish.publish({ status: "pass" });
    writeSummary(result);
    console.log(JSON.stringify({
      provider: result.provider,
      environment: result.environment,
      result: "passed",
      elapsedMs: result.elapsedMs,
      note: result.note
    }));
    return true;
  } catch (error) {
    const message = safeFailure(error);
    finish.publish({ status: "fail", error: new Error(message) });
    writeSummary({
      provider: provider.toUpperCase(),
      environment: provider === "ups" ? "CIE" : "Developer Sandbox",
      ok: false,
      elapsedMs: Math.max(0, Math.round(performance.now() - started)),
      note: message
    });
    console.error(provider.toUpperCase() + " sandbox validation failed: " + message);
    return false;
  }
}

export async function runSandboxValidation(requested, env = process.env) {
  const providers = parseRequestedProviders(requested);
  // Validate the entire selected batch before any network call. A missing key
  // or a production endpoint therefore causes zero provider requests.
  for (const provider of providers) validateSandboxEnvironment(provider, env);
  const outcomes = [];
  for (const provider of providers) outcomes.push(await runOne(provider));
  return outcomes.every(Boolean);
}

async function main() {
  const requested = process.argv[2] || "";
  const providers = parseRequestedProviders(requested);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    appendFileSync(summary,
      "## ExportFlow carrier Sandbox validation\n\n" +
      "Only official non-production endpoints and synthetic tracking references are permitted. " +
      "No raw carrier responses, API keys or parcel details are recorded.\n\n" +
      "| Provider | Environment | Result | Duration | Notes |\n" +
      "| --- | --- | --- | ---: | --- |\n"
    );
  }
  const ok = await runSandboxValidation(providers.join(","), process.env);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
