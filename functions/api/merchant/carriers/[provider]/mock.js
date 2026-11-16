import { resolveMerchantSession } from "../../../../lib/merchant-identity.mjs";

const PROVIDERS = new Set(["ups", "fedex"]);
const FIXTURES = Object.freeze({
  ups: Object.freeze([
    Object.freeze({ status: "LABEL_CREATED", label: "Label created (simulated)" }),
    Object.freeze({ status: "IN_TRANSIT", label: "In transit (simulated)" }),
    Object.freeze({ status: "DELIVERED", label: "Delivered (simulated)" })
  ]),
  fedex: Object.freeze([
    Object.freeze({ status: "PICKED_UP", label: "Picked up (simulated)" }),
    Object.freeze({ status: "IN_TRANSIT", label: "In transit (simulated)" }),
    Object.freeze({ status: "DELIVERED", label: "Delivered (simulated)" })
  ])
});

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
    return request.headers.get("Origin") === parsed.origin &&
      new URL(request.url).origin === parsed.origin;
  } catch {
    return false;
  }
}

export function createOfficialApiMockHandler({
  resolveSession = resolveMerchantSession,
  now = () => new Date()
} = {}) {
  return async function onRequestPost({ request, env, params } = {}) {
    if (!request || request.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "POST" });
    }
    if (!trustedSameOrigin(request, env)) {
      return jsonResponse({ error: "origin_forbidden" }, 403);
    }

    const provider = String(params?.provider || "").trim().toLowerCase();
    if (!PROVIDERS.has(provider)) {
      return jsonResponse({ error: "unsupported_provider" }, 400);
    }

    let session;
    try {
      session = await resolveSession(request, env?.MERCHANT_DB);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 503;
      const code = typeof error?.code === "string" ? error.code : "merchant_auth_unavailable";
      return jsonResponse({ error: code }, status);
    }

    if (typeof session?.user?.id !== "string" || !session.user.id) {
      return jsonResponse({ error: "merchant_session_invalid" }, 401);
    }

    return jsonResponse({
      provider,
      environment: "simulated",
      source: "exportflow_fixture",
      scenario: "standard_delivery",
      result: "passed",
      fixture: "deterministic_mock",
      events: FIXTURES[provider].map(event => ({ ...event })),
      outboundRequests: 0,
      realShipmentLookup: false,
      checkedAt: now().toISOString()
    });
  };
}

export const onRequestPost = createOfficialApiMockHandler();
