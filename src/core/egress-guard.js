export class EgressPolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "EgressPolicyError";
    this.code = code;
  }
}

export const EGRESS_POLICY = Object.freeze({
  id: "cloudflare-public-egress-v1",
  maxUrlLength: 2048,
  blockedHosts: Object.freeze([
    "localhost",
    "metadata",
    "metadata.google.internal",
    "metadata.azure.internal",
    "instance-data",
    "exportflow.me",
    "hhameranede.workers.dev",
    "exportflow-mcp-preview.hhameranede.workers.dev",
    "exportflow-egress-preview.hhameranede.workers.dev",
    "exportflow-task-mcp-acceptance-20261124.hhameranede.workers.dev",
    "exportflow-task-platform-acceptance-20261124.hhameranede.workers.dev",
    "exportflow-mcp-acceptance-20261122.hhameranede.workers.dev",
    "exportflow-auth-acceptance-20261122.hhameranede.workers.dev",
    "exportflow-tenant-acceptance-20261122.hhameranede.workers.dev",
    "exportflow-auth-lab.hhameranede.workers.dev",
    "exportflow-cost-router-lab.hhameranede.workers.dev",
    "exportflow-usage-receipts-preview.hhameranede.workers.dev",
    "exportflow-browser-lab.hhameranede.workers.dev",
  ]),
  blockedSuffixes: Object.freeze([
    ".localhost",
    ".local",
    ".localdomain",
    ".internal",
    ".home",
    ".lan",
    ".test",
    ".invalid",
    ".example",
    ".onion",
    ".arpa",
    ".home.arpa",
    ".svc",
    ".cluster.local",
    ".corp",
    ".intranet",
    ".exportflow.me",
    ".hhameranede.workers.dev",
  ]),
});

function reject(code, message) {
  throw new EgressPolicyError(code, message);
}

function isIpLiteral(hostname) {
  // WHATWG URL canonicalization normalizes legacy IPv4 spellings (decimal,
  // octal, hexadecimal, shortened dotted forms) before this check.
  return hostname.startsWith("[") ||
    hostname.includes(":") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
    /^[0-9.]+$/.test(hostname);
}

function isBlockedHostname(hostname, blockedHosts, blockedSuffixes) {
  return blockedHosts.has(hostname) ||
    blockedSuffixes.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Application-layer outbound destination policy.
 *
 * This does not perform a separate DNS lookup. The actual outbound connection
 * must continue to use the Cloudflare Workers fetch runtime, whose network
 * proxy enforces the platform's public-Internet/internal-network boundary.
 * A standalone DNS lookup followed by fetch() would not pin that DNS answer.
 */
export function validateEgressTarget(input, options = {}) {
  const maxUrlLength = options.maxUrlLength ?? EGRESS_POLICY.maxUrlLength;
  const blockedHosts = new Set([
    ...EGRESS_POLICY.blockedHosts,
    ...(options.additionalBlockedHosts || []),
  ]);
  const blockedSuffixes = [
    ...EGRESS_POLICY.blockedSuffixes,
    ...(options.additionalBlockedSuffixes || []),
  ];

  if (typeof input !== "string" || input.length === 0 || input.length > maxUrlLength) {
    reject("URL_LENGTH_INVALID", "URL is missing or exceeds the allowed length.");
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    reject("URL_PARSE_FAILED", "URL could not be parsed.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    reject("SCHEME_NOT_ALLOWED", "Only HTTP and HTTPS destinations are allowed.");
  }
  if (url.username || url.password) {
    reject("EMBEDDED_CREDENTIALS", "URLs containing embedded credentials are not allowed.");
  }
  if (url.port) {
    reject("PORT_NOT_ALLOWED", "Only the default HTTP and HTTPS ports are allowed.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || isIpLiteral(hostname)) {
    reject("IP_LITERAL_NOT_ALLOWED", "IP-literal and non-domain destinations are not allowed.");
  }
  if (!hostname.includes(".") || isBlockedHostname(hostname, blockedHosts, blockedSuffixes)) {
    reject("HOSTNAME_NOT_ALLOWED", "Local, reserved, and ExportFlow-owned hostnames are not allowed.");
  }

  const labels = hostname.split(".");
  const validHostname = labels.every((label) =>
    label.length > 0 &&
    label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
  if (!validHostname || hostname.length > 253) {
    reject("HOSTNAME_INVALID", "Destination must be a valid public DNS hostname.");
  }

  url.hostname = hostname;
  url.hash = "";
  return url;
}
