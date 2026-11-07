import {
  ALGERIAN_CARRIER_IDS,
  AlgerianConnectorError,
  createAlgerianCarrierConnector
} from "../../lib/algerian-carrier-connectors.mjs";
import {
  createSessionBoundMerchantCredentialVault,
  sessionBoundVaultErrorResponse
} from "../../lib/session-bound-merchant-vault.mjs";
import {
  consumeGlobalRateLimit,
  globalRateLimitHeaders
} from "../../lib/global-rate-limiter.mjs";

const MAX_BODY_BYTES = 4_096;
const MAX_CONCURRENT_LOOKUPS = 4;
let activeLookups = 0;

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
  let origin;
  try {
    const parsed = new URL(env.MERCHANT_APP_ORIGIN);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if ((parsed.protocol !== "https:" && !local) || parsed.origin !== env.MERCHANT_APP_ORIGIN) return false;
    origin = parsed.origin;
  } catch {
    return false;
  }
  return request.headers.get("Origin") === origin && new URL(request.url).origin === origin;
}

async function readJsonBody(request) {
  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw Object.assign(new Error("content_type_must_be_json"), { status: 415 });
  }

  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) {
    throw Object.assign(new Error("request_too_large"), { status: 413 });
  }
  if (!request.body) throw Object.assign(new Error("invalid_request_body"), { status: 400 });

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        throw Object.assign(new Error("request_too_large"), { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw Object.assign(new Error("invalid_request_body"), { status: 400 });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Object.keys(payload).some(key => !["provider", "trackingNumber"].includes(key)) ||
    typeof payload.provider !== "string" ||
    typeof payload.trackingNumber !== "string"
  ) {
    throw Object.assign(new Error("invalid_request_body"), { status: 400 });
  }

  return {
    provider: payload.provider.trim().toLowerCase(),
    trackingNumber: payload.trackingNumber.trim()
  };
}

function connectorErrorResponse(error, rateLimit = null) {
  if (!(error instanceof AlgerianConnectorError)) {
    return jsonResponse({ error: "merchant_tracking_unavailable" }, 502);
  }

  const status = {
    invalid_merchant_context: 400,
    invalid_tracking_number: 400,
    unsupported_provider: 400,
    unsupported_courier: 400,
    credentials_incomplete: 409,
    credentials_missing: 409,
    forbidden: 403,
    not_found: 404,
    upstream_rate_limited: 429,
    upstream_timeout: 504,
    authorization_unavailable: 503,
    credentials_unavailable: 503,
    adapter_unavailable: 503,
    invalid_upstream_response: 502,
    upstream_auth_failed: 502,
    upstream_unavailable: 502
  }[error.code] || 502;

  const code = error.code === "credentials_missing" || error.code === "credentials_incomplete"
    ? "carrier_not_connected"
    : error.code;
  return jsonResponse(
    { error: code },
    status,
    status === 429 && rateLimit ? globalRateLimitHeaders(rateLimit) : {}
  );
}

async function createPinnedSdkClient(provider, config) {
  // The upstream MIT-licensed source is pinned under vendor/sources/algeria/dz-delivery.
  // Wrangler bundles this TypeScript entrypoint into the Pages Function; no runtime
  // package download or arbitrary network import is used.
  const sdk = await import("../../../vendor/sources/algeria/dz-delivery/packages/ts/src/index.ts");
  return sdk.createClient(provider, config);
}

export function createMerchantTrackingHandler({
  createVault = createSessionBoundMerchantCredentialVault,
  createClient = createPinnedSdkClient,
  consumeRateLimit = consumeGlobalRateLimit
} = {}) {
  return async function onRequestPost({ request, env } = {}) {
    if (!request || request.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "POST" });
    }
    if (!trustedSameOrigin(request, env)) {
      return jsonResponse({ error: "origin_forbidden" }, 403);
    }

    let input;
    try {
      input = await readJsonBody(request);
    } catch (error) {
      const status = [400, 413, 415].includes(error?.status) ? error.status : 400;
      return jsonResponse({ error: error?.message || "invalid_request_body" }, status);
    }

    if (!ALGERIAN_CARRIER_IDS.includes(input.provider)) {
      return jsonResponse({ error: "unsupported_provider" }, 400);
    }
    // Elogistia places its API key in the request URL. Keep it disabled until
    // query-string redaction is independently confirmed in the full outbound path.
    if (input.provider === "elogistia" && env?.ALGERIAN_ELOGISTIA_ENABLED !== "true") {
      return jsonResponse({ error: "provider_temporarily_disabled" }, 409);
    }

    let vault;
    try {
      vault = await createVault(request, env);
    } catch (error) {
      return sessionBoundVaultErrorResponse(error);
    }
    const merchantId = vault?.user?.id;
    if (typeof merchantId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(merchantId) ||
        typeof vault?.resolveCredentials !== "function") {
      return jsonResponse({ error: "merchant_session_invalid" }, 401);
    }

    let rateLimit;
    try {
      rateLimit = await consumeRateLimit(request, env);
    } catch {
      return jsonResponse({ error: "global_rate_limiter_unavailable" }, 503, { "Retry-After": "10" });
    }
    // Merchant-linked carrier lookups require the global quota; do not fall back
    // to uncoordinated per-isolate accounting for these credentialed operations.
    if (!rateLimit || typeof rateLimit.allowed !== "boolean") {
      return jsonResponse({ error: "global_rate_limiter_not_configured" }, 503, { "Retry-After": "10" });
    }
    if (!rateLimit.allowed) {
      return jsonResponse({ error: "rate_limited" }, 429, globalRateLimitHeaders(rateLimit));
    }
    if (activeLookups >= MAX_CONCURRENT_LOOKUPS) {
      return jsonResponse({ error: "temporarily_busy" }, 503, { "Retry-After": "10" });
    }

    activeLookups += 1;
    try {
      const connector = createAlgerianCarrierConnector({
        createClient,
        authorizeMerchantProvider: async context =>
          context.merchantId === merchantId &&
          context.operation === "track" &&
          ALGERIAN_CARRIER_IDS.includes(context.provider),
        resolveCredentials: async context => {
          if (context.merchantId !== merchantId) {
            throw new AlgerianConnectorError("forbidden", context.provider);
          }
          return vault.resolveCredentials({ provider: context.provider });
        }
      });
      const result = await connector.track({
        merchantId,
        provider: input.provider,
        trackingNumber: input.trackingNumber
      });
      return jsonResponse(result, 200, globalRateLimitHeaders(rateLimit));
    } catch (error) {
      return connectorErrorResponse(error, rateLimit);
    } finally {
      activeLookups = Math.max(0, activeLookups - 1);
    }
  };
}

export const onRequestPost = createMerchantTrackingHandler();
