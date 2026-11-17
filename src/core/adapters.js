import { fetchPublicResource, HTTP_FETCH_LIMITS } from "./http-fetch.js";
import { normalizeResult } from "./result.js";

const registry = new Map();

export function registerAdapter(adapter) {
  if (!adapter || typeof adapter.id !== "string" || !adapter.id.trim()) {
    throw new TypeError("Adapter requires a non-empty id");
  }
  if (typeof adapter.execute !== "function") {
    throw new TypeError("Adapter requires execute()");
  }
  if (registry.has(adapter.id)) {
    throw new Error("Adapter already registered: " + adapter.id);
  }

  const item = Object.freeze({
    id: adapter.id,
    family: adapter.family || "unknown",
    capabilities: Object.freeze([...(adapter.capabilities || [])]),
    authMode: adapter.authMode || "none",
    limits: Object.freeze({ ...(adapter.limits || {}) }),
    restrictions: Object.freeze([...(adapter.restrictions || [])]),
    execute: adapter.execute,
  });
  registry.set(adapter.id, item);
  return item;
}

export function getAdapterCatalog() {
  return [...registry.values()].map(({ id, family, capabilities, authMode, limits, restrictions }) => ({
    id, family, capabilities, authMode, limits, restrictions,
  }));
}

export async function executeAdapter(id, input) {
  const adapter = registry.get(id);
  if (!adapter) throw new Error("Unknown adapter: " + id);
  return adapter.execute(input);
}

registerAdapter({
  id: "http.fetch.v1",
  family: "http",
  capabilities: ["fetch", "html", "text", "json", "xml"],
  authMode: "none",
  limits: {
    maxResponseBytes: HTTP_FETCH_LIMITS.maxResponseBytes,
    timeoutMs: HTTP_FETCH_LIMITS.timeoutMs,
    maxRedirects: HTTP_FETCH_LIMITS.maxRedirects,
  },
  restrictions: [
    "GET-only",
    "HTTP-and-HTTPS-only",
    "application-egress-policy-enforced",
    "cloudflare-workers-outbound-proxy-required",
    "no-separate-unpinned-DNS-lookup",
    "IP-literals-and-private-hostname-forms-rejected",
    "ExportFlow-owned-hostnames-blocked",
    "default-ports-only",
    "redirects-revalidated",
    "no-cookies-or-origin-credentials",
    "text-content-only",
    "SSRF-hostname-filters",
  ],
  async execute(input = {}) {
    const response = await fetchPublicResource(input.url);
    return normalizeResult({
      status: response.ok ? "succeeded" : "failed",
      data: {
        status: response.status,
        contentType: response.contentType,
        body: response.body,
        bytes: response.bytes,
        originalUrl: response.originalUrl,
        finalUrl: response.finalUrl,
        redirects: response.redirects,
      },
      sources: [{
        url: response.finalUrl,
        retrievedAt: response.retrievedAt,
        title: null,
        evidence: [{ type: "http_response", status: response.status, contentType: response.contentType }],
      }],
      warnings: response.ok ? [] : ["Upstream returned HTTP " + response.status + "."],
    });
  },
});
