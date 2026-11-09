import { UPSApiClient } from "../../../../../node_modules/universal-parcel-scraper/dist/carriers/ups/api.js";
import { FedExApiClient } from "../../../../../node_modules/universal-parcel-scraper/dist/carriers/fedex/api.js";
import {
  createSessionBoundOfficialApiCredentialVault,
  officialApiCredentialVaultErrorResponse
} from "../../../../../lib/official-api-credential-vault.mjs";
import {
  consumeGlobalRateLimit,
  globalRateLimitHeaders
} from "../../../../../lib/global-rate-limiter.mjs";

const SANDBOXES = Object.freeze({
  ups: Object.freeze({
    endpoint: "https://wwwcie.ups.com",
    syntheticReference: "1Z999AA10123456784"
  }),
  fedex: Object.freeze({
    endpoint: "https://apis-sandbox.fedex.com",
    syntheticReference: "999999999999"
  })
});
const TIMEOUT_MS = 12_000;

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Pragma": "no-cache",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      ...extraHeaders
    }
  });
}

function trustedSameOrigin(request, env) {
  if (typeof env?.MERCHANT_APP_ORIGIN !== "string") return false;
  try {
    const parsed = new URL(env.MERCHANT_APP_ORIGIN);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if ((parsed.protocol !== "https:" && !local) || parsed.origin !== env.MERCHANT_APP_ORIGIN) return false;
    return request.headers.get("Origin") === parsed.origin && new URL(request.url).origin === parsed.origin;
  } catch {
    return false;
  }
}

function createSandboxClient(provider, credentials, fetcher = fetch) {
  const sandbox = SANDBOXES[provider];
  if (!sandbox) throw new Error("unsupported_provider");
  if (provider === "ups") {
    return new UPSApiClient({
      id: credentials.clientId,
      secret: credentials.clientSecret,
      url: sandbox.endpoint
    }, fetcher);
  }
  return new FedExApiClient({
    key: credentials.apiKey,
    secret: credentials.apiSecret,
    url: sandbox.endpoint
  }, fetcher);
}

function validResponse(provider, response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) return false;
  if (provider === "ups") {
    return !!response.trackResponse && Array.isArray(response.trackResponse.shipment);
  }
  return !!response.output && Array.isArray(response.output.completeTrackResults);
}

function isSyntheticNotFound(error, provider) {
  return provider === "ups" &&
    (error?.name === "NotFoundError" || error?.code === "not_found");
}

function errorStatus(error) {
  if (error?.code === "forbidden") return 403;
  if (error?.code === "rate_limited") return 429;
  if (error?.code === "unauthenticated") return 401;
  if (error?.code === "credentials_missing") return 409;
  if (error?.code === "credential_vault_not_configured" || error?.code === "merchant_auth_not_configured") return 503;
  if (error?.name === "RateLimitedError") return 429;
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return 504;
  return 502;
}

export function createOfficialApiSandboxHandler({
  createVault = createSessionBoundOfficialApiCredentialVault,
  createClient = createSandboxClient,
  consumeRateLimit = consumeGlobalRateLimit,
  now = () => new Date()
} = {}) {
  return async function onRequestPost({ request, env, params } = {}) {
    if (!request || request.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "POST" });
    }
    if (!trustedSameOrigin(request, env)) return jsonResponse({ error: "origin_forbidden" }, 403);

    const provider = String(params?.provider || "").trim().toLowerCase();
    if (!Object.hasOwn(SANDBOXES, provider)) return jsonResponse({ error: "unsupported_provider" }, 400);

    let vault;
    try {
      vault = await createVault(request, env);
    } catch (error) {
      return officialApiCredentialVaultErrorResponse(error);
    }
    const merchantId = vault?.user?.id;
    if (typeof merchantId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(merchantId) ||
        typeof vault?.resolveCredentials !== "function") {
      return jsonResponse({ error: "merchant_session_invalid" }, 401);
    }

    let quota;
    try { quota = await consumeRateLimit(request, env); }
    catch { return jsonResponse({ error: "global_rate_limiter_unavailable" }, 503, { "Retry-After": "10" }); }
    if (!quota || typeof quota.allowed !== "boolean") {
      return jsonResponse({ error: "global_rate_limiter_not_configured" }, 503, { "Retry-After": "10" });
    }
    if (!quota.allowed) return jsonResponse({ error: "rate_limited" }, 429, globalRateLimitHeaders(quota));

    try {
      const credentials = await vault.resolveCredentials({ provider });
      if (!credentials) return jsonResponse({ error: "carrier_not_connected" }, 409);

      const client = await createClient(provider, credentials, fetch);
      if (!client || typeof client.track !== "function") {
        return jsonResponse({ error: "sandbox_client_unavailable" }, 503);
      }

      const syntheticReference = SANDBOXES[provider].syntheticReference;
      let response;
      try {
        response = await client.track(
          syntheticReference,
          AbortSignal.timeout(TIMEOUT_MS),
          TIMEOUT_MS
        );
      } catch (error) {
        if (!isSyntheticNotFound(error, provider)) {
          const status = errorStatus(error);
          return jsonResponse({ error: status === 429 ? "carrier_sandbox_rate_limited" : "carrier_sandbox_unavailable" },
            status, status === 429 ? globalRateLimitHeaders(quota) : {});
        }
        // UPS may legitimately return its documented not-found result for the synthetic fixture.
      }

      if (response !== undefined && !validResponse(provider, response)) {
        return jsonResponse({ error: "carrier_sandbox_response_invalid" }, 502);
      }

      return jsonResponse({
        provider,
        environment: "official_sandbox",
        result: "passed",
        fixture: "synthetic",
        checkedAt: now().toISOString()
      }, 200, globalRateLimitHeaders(quota));
    } catch (error) {
      const status = errorStatus(error);
      return jsonResponse({
        error: status === 403 ? "carrier_connection_forbidden" :
          status === 401 ? "merchant_session_invalid" :
          status === 429 ? "carrier_sandbox_rate_limited" :
          status === 409 ? "carrier_not_connected" : "carrier_sandbox_unavailable"
      }, status, status === 429 ? globalRateLimitHeaders(quota) : {});
    }
  };
}

export const onRequestPost = createOfficialApiSandboxHandler();
