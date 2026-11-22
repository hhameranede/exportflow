const BLOCKED_HOSTS = Object.freeze([
  "localhost", "metadata", "metadata.google.internal", "metadata.azure.internal",
  "instance-data", "exportflow.me", "exportflow-platform.hhameranede.workers.dev",
]);
const BLOCKED_SUFFIXES = Object.freeze([
  ".localhost", ".local", ".localdomain", ".internal", ".home", ".lan",
  ".test", ".invalid", ".example", ".onion", ".arpa", ".home.arpa",
  ".svc", ".cluster.local", ".corp", ".intranet", ".exportflow.me",
]);
const blockedHostExact = new Set(BLOCKED_HOSTS);

export function validateUrlForPreview(rawUrl) {
  if (!rawUrl || rawUrl.length > 2048) {
    return { ok: false, code: "URL_NOT_ALLOWED", message: "Destination URL is missing or exceeds 2048 characters." };
  }
  let parsed;
  try { parsed = new URL(rawUrl); }
  catch { return { ok: false, code: "URL_NOT_ALLOWED", message: "Destination URL could not be parsed." }; }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, code: "URL_NOT_ALLOWED", message: "Only HTTP and HTTPS protocols are permitted." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, code: "URL_NOT_ALLOWED", message: "Embedded credentials in URLs are rejected." };
  }
  if (parsed.port) {
    return { ok: false, code: "URL_NOT_ALLOWED", message: "Non-default ports are disallowed by egress policy." };
  }

  // URL.hostname may retain a trailing DNS root dot. Normalize before policy checks.
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.startsWith("[") || host.indexOf(":") !== -1 ||
      /^[0-9.]+$/.test(host) || host.indexOf(".") === -1) {
    return { ok: false, code: "URL_NOT_ALLOWED", message: "IP literals and non-public domain forms are blocked by egress policy." };
  }
  if (blockedHostExact.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { ok: false, code: "URL_NOT_ALLOWED", message: "Local, reserved, and ExportFlow-owned hostnames are disallowed." };
  }

  parsed.hostname = host;
  parsed.hash = "";
  return { ok: true, href: parsed.href };
}

export function evaluateDemoLimits({ timeoutMs, maxBytes, maxRedirects, durationMs, responseBytes, redirectCount }) {
  if (redirectCount > maxRedirects) {
    return { httpStatus: 502, code: "TOO_MANY_REDIRECTS", message: "Illustrative redirect chain exceeds the configured maxRedirects limit." };
  }
  if (durationMs > timeoutMs) {
    return { httpStatus: 504, code: "UPSTREAM_TIMEOUT", message: "Illustrative request duration exceeds the configured timeoutMs limit." };
  }
  if (responseBytes > maxBytes) {
    return { httpStatus: 413, code: "RESPONSE_TOO_LARGE", message: "Illustrative response size exceeds the configured maxBytes limit." };
  }
  return null;
}

// The browser receives the same policy functions that are unit-tested in Node.
export const DEMO_POLICY_SOURCE = [
  "var blockedHostExact = new Set(" + JSON.stringify(BLOCKED_HOSTS) + ");",
  "var BLOCKED_SUFFIXES = " + JSON.stringify(BLOCKED_SUFFIXES) + ";",
  validateUrlForPreview.toString(),
  evaluateDemoLimits.toString(),
].join("\n");
