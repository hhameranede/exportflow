import {
  createSessionBoundOfficialApiCredentialVault,
  officialApiCredentialVaultErrorResponse
} from "../../../../lib/official-api-credential-vault.mjs";

const MAX_BODY_BYTES = 12 * 1024;
const encoder = new TextEncoder();

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Pragma": "no-cache",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow"
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

async function readPayload(request) {
  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") throw Object.assign(new Error("content_type_must_be_json"), { status: 415 });
  const length = request.headers.get("Content-Length");
  if (length && /^\d+$/.test(length) && Number(length) > MAX_BODY_BYTES) {
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
  try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw Object.assign(new Error("invalid_request_body"), { status: 400 }); }

  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      Object.keys(payload).some(key => !["credentials", "consent"].includes(key)) ||
      !payload.credentials || typeof payload.credentials !== "object" || Array.isArray(payload.credentials) ||
      typeof payload.consent !== "boolean") {
    throw Object.assign(new Error("invalid_request_body"), { status: 400 });
  }
  if (payload.consent !== true) {
    throw Object.assign(new Error("consent_required"), { status: 400 });
  }
  return payload;
}

function allowedProvider(provider) {
  return provider === "fedex" || provider === "ups";
}

function trustedSameOriginRead(request, env) {
  if (typeof env?.MERCHANT_APP_ORIGIN !== "string") return false;
  try {
    const parsed = new URL(env.MERCHANT_APP_ORIGIN);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if ((parsed.protocol !== "https:" && !local) || parsed.origin !== env.MERCHANT_APP_ORIGIN) return false;
    return new URL(request.url).origin === parsed.origin;
  } catch {
    return false;
  }
}

export function createOfficialApiCredentialStatusHandler({
  createVault = createSessionBoundOfficialApiCredentialVault
} = {}) {
  return async function onRequestGet({ request, env, params } = {}) {
    if (!request || request.method !== "GET") {
      return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
    }
    if (!trustedSameOriginRead(request, env)) return jsonResponse({ error: "origin_forbidden" }, 403);
    const provider = String(params?.provider || "").trim().toLowerCase();
    if (!allowedProvider(provider)) return jsonResponse({ error: "unsupported_provider" }, 400);
    try {
      const vault = await createVault(request, env);
      return jsonResponse(await vault.getStatus({ provider }));
    } catch (error) {
      return officialApiCredentialVaultErrorResponse(error);
    }
  };
}

export const onRequestGet = createOfficialApiCredentialStatusHandler();

export function createOfficialApiCredentialMutationHandlers({
  createVault = createSessionBoundOfficialApiCredentialVault
} = {}) {
  return Object.freeze({
    async onRequestPost({ request, env, params } = {}) {
      if (!request || request.method !== "POST") {
        return jsonResponse({ error: "method_not_allowed" }, 405);
      }
      if (!trustedSameOrigin(request, env)) return jsonResponse({ error: "origin_forbidden" }, 403);
      const provider = String(params?.provider || "").trim().toLowerCase();
      if (!allowedProvider(provider)) return jsonResponse({ error: "unsupported_provider" }, 400);

      try {
        const vault = await createVault(request, env);
        const payload = await readPayload(request);
        const result = await vault.save({
          provider,
          credentials: payload.credentials,
          consent: payload.consent
        });
        return jsonResponse(result, 201);
      } catch (error) {
        if ([400, 413, 415].includes(error?.status)) return jsonResponse({ error: error.message }, error.status);
        return officialApiCredentialVaultErrorResponse(error);
      }
    },

    async onRequestDelete({ request, env, params } = {}) {
      if (!request || request.method !== "DELETE") {
        return jsonResponse({ error: "method_not_allowed" }, 405);
      }
      if (!trustedSameOrigin(request, env)) return jsonResponse({ error: "origin_forbidden" }, 403);
      const provider = String(params?.provider || "").trim().toLowerCase();
      if (!allowedProvider(provider)) return jsonResponse({ error: "unsupported_provider" }, 400);
      try {
        const vault = await createVault(request, env);
        return jsonResponse(await vault.revoke({ provider }));
      } catch (error) {
        return officialApiCredentialVaultErrorResponse(error);
      }
    }
  });
}

const credentialMutations = createOfficialApiCredentialMutationHandlers();
export const onRequestPost = credentialMutations.onRequestPost;
export const onRequestDelete = credentialMutations.onRequestDelete;
