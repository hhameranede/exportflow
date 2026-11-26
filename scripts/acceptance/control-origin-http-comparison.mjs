import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";

const CONTROL_PATH = "/?exportflow_acceptance_control=1";
const USER_AGENT = "ExportFlow-Acceptance/1.0 (+https://exportflow.me)";
const PRIVATE_TARGETS = new Set(["127.0.0.1", "0.0.0.0", "10.0.0.1"]);
const RESPONSE_HEADERS = Object.freeze([
  "server",
  "content-type",
  "content-length",
  "etag",
  "location",
  "cf-ray",
  "cf-cache-status",
  "cf-error-type",
  "cf-error-origin",
  "server-timing",
  "via",
  "x-cache",
  "x-served-by",
  "date",
]);

function safeField(value, maxLength = 512) {
  if (typeof value !== "string") return null;
  return value.replace(/[\r\n\t]/g, " ").slice(0, maxLength);
}

export function isPublicIPv4(value) {
  if (isIP(value) !== 4) return false;
  const [a, b, c] = value.split(".").map(Number);
  if (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 2 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  ) return false;
  return true;
}

export function validateControlTarget({ publicIp, hostname, cfWorkerZone }) {
  assert.ok(isPublicIPv4(publicIp), "A globally routable public IPv4 address is required.");
  const escapedIp = publicIp.replaceAll(".", "\\.");
  const escapedTargets = [...PRIVATE_TARGETS].map((ip) => ip.replaceAll(".", "\\.")).join("|");
  const hostnamePattern = new RegExp(
    "^make-" + escapedIp + "-rebindfor2mafter6times-(?:" + escapedTargets + ")-rr-[a-z0-9-]{8,48}\\.1u\\.ms$",
  );
  assert.match(hostname, hostnamePattern, "Hostname must be a run-scoped 1u.ms test name matching the supplied public IP and an allowed private target.");
  assert.match(cfWorkerZone, /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i, "CF-Worker must be a zone hostname.");
}

export function buildControlOriginVariants({ hostname, cfWorkerZone }) {
  const commonHeaders = {
    host: hostname,
    accept: "*/*",
    "user-agent": USER_AGENT,
    "cache-control": "no-cache",
    pragma: "no-cache",
    connection: "close",
  };
  const { "cache-control": _cacheControl, pragma: _pragma, ...headersWithoutCacheHints } = commonHeaders;
  return [
    {
      name: "worker-request-headers-without-cf-worker",
      headers: { ...commonHeaders },
      note: "Pinned direct HTTP request with the Worker-equivalent Accept, User-Agent, Cache-Control: no-cache and Pragma: no-cache headers; CF-Worker omitted.",
    },
    {
      name: "worker-request-headers-with-cf-worker",
      headers: { ...commonHeaders, "cf-worker": cfWorkerZone },
      note: "Same request with the documented CF-Worker zone header added.",
    },
    {
      name: "cf-worker-without-workers-cache-hints",
      headers: { ...headersWithoutCacheHints, "cf-worker": cfWorkerZone },
      note: "Differential only: same synthetic CF-Worker header but omits Cache-Control/Pragma that Workers fetch cache: no-store forwards to the origin.",
    },
  ];
}

export function summarizeResponse(statusCode, headers = {}) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(", ") : value]),
  );
  const selectedHeaders = {};
  for (const name of RESPONSE_HEADERS) {
    selectedHeaders[name] = safeField(normalized[name], name === "location" ? 512 : 240);
  }
  return { status: Number(statusCode || 0), headers: selectedHeaders };
}

export function requestPinnedControlOrigin({ publicIp, hostname, headers, timeoutMs = 8_000, requestImpl = httpRequest }) {
  return new Promise((resolve, reject) => {
    const request = requestImpl({
      hostname: publicIp,
      port: 80,
      method: "HEAD",
      path: CONTROL_PATH,
      headers,
    }, (response) => {
      const summary = summarizeResponse(response.statusCode, response.headers);
      response.resume();
      resolve(summary);
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Direct public control-origin request timed out.")));
    request.on("error", reject);
    request.end();
  });
}

export async function compareControlOrigin({
  publicIp,
  hostname,
  cfWorkerZone = "exportflow.me",
  requestImpl = httpRequest,
  timeoutMs = 8_000,
}) {
  validateControlTarget({ publicIp, hostname, cfWorkerZone });
  const variants = buildControlOriginVariants({ hostname, cfWorkerZone });
  const results = [];
  for (const variant of variants) {
    try {
      const response = await requestPinnedControlOrigin({
        publicIp,
        hostname,
        headers: variant.headers,
        timeoutMs,
        requestImpl,
      });
      results.push({ name: variant.name, note: variant.note, requestHeaders: variant.headers, response });
    } catch (error) {
      results.push({
        name: variant.name,
        note: variant.note,
        requestHeaders: variant.headers,
        error: safeField(error?.message || String(error), 300),
      });
    }
  }
  return {
    target: { publicIp, hostname, cfWorkerZone, method: "HEAD", path: CONTROL_PATH, redirect: "not followed" },
    results,
    interpretation: "This is a direct-to-IP origin comparison, not a Cloudflare Worker runtime test. A matching CF-Worker header isolates one request-header difference but cannot reproduce Cloudflare egress, DNS, or cache behavior.",
  };
}

async function main() {
  const publicIp = process.env.DNS_REBINDING_PUBLIC_IP;
  const hostname = process.env.DNS_REBINDING_HOSTNAME;
  const cfWorkerZone = process.env.CF_WORKER_ZONE || "exportflow.me";
  if (!publicIp || !hostname) {
    throw new Error("Set DNS_REBINDING_PUBLIC_IP and DNS_REBINDING_HOSTNAME to one run-scoped 1u.ms test target.");
  }
  const report = await compareControlOrigin({ publicIp, hostname, cfWorkerZone });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (report.results.every((result) => result.error)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(String(error?.stack || error) + "\n");
    process.exitCode = 1;
  });
}
