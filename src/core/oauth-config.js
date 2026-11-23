const DEFAULT_AUTH_BASE_URL = "https://exportflow.me";
const DEFAULT_MCP_RESOURCE_URL = "https://mcp.exportflow.me/mcp";

function parseHttpsUrl(value, name, expectedPath) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(name + " must be an absolute HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || url.pathname !== expectedPath) {
    throw new TypeError(name + " must be a credential-free HTTPS URL with path " + expectedPath + ".");
  }
  return url;
}

/**
 * Resolves the OAuth issuer, MCP audience, JWKS and protected-resource metadata
 * from the current deployment environment. Production defaults remain stable,
 * while isolated acceptance Workers can use their own workers.dev origins.
 */
export function getOAuthRuntimeConfig(env = {}) {
  let authBaseUrl;
  if (typeof env.BETTER_AUTH_URL === "string" && env.BETTER_AUTH_URL.trim()) {
    authBaseUrl = parseHttpsUrl(env.BETTER_AUTH_URL.trim().replace(/\/+$/, ""), "BETTER_AUTH_URL", "/");
  } else if (typeof env.AUTH_ISSUER_URL === "string" && env.AUTH_ISSUER_URL.trim()) {
    const issuerBase = parseHttpsUrl(env.AUTH_ISSUER_URL.trim(), "AUTH_ISSUER_URL", "/api/auth");
    authBaseUrl = new URL(issuerBase.origin + "/");
  } else {
    authBaseUrl = new URL(DEFAULT_AUTH_BASE_URL);
  }

  const issuerValue = typeof env.AUTH_ISSUER_URL === "string" && env.AUTH_ISSUER_URL.trim()
    ? env.AUTH_ISSUER_URL.trim().replace(/\/+$/, "")
    : new URL("/api/auth", authBaseUrl.origin).toString().replace(/\/$/, "");
  const issuerUrl = parseHttpsUrl(issuerValue, "AUTH_ISSUER_URL", "/api/auth");
  if (issuerUrl.origin !== authBaseUrl.origin) {
    throw new TypeError("AUTH_ISSUER_URL must use the configured Better Auth origin.");
  }

  const resourceValue = typeof env.MCP_RESOURCE_URL === "string" && env.MCP_RESOURCE_URL.trim()
    ? env.MCP_RESOURCE_URL.trim()
    : DEFAULT_MCP_RESOURCE_URL;
  const resourceUrl = parseHttpsUrl(resourceValue, "MCP_RESOURCE_URL", "/mcp");

  return Object.freeze({
    issuer: issuerUrl.toString().replace(/\/$/, ""),
    jwksUrl: issuerUrl.toString().replace(/\/$/, "") + "/jwks",
    resource: resourceUrl.toString(),
    resourceMetadataUrl: new URL("/.well-known/oauth-protected-resource/mcp", resourceUrl.origin).toString(),
  });
}
