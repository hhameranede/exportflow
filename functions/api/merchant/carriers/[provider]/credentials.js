import {
  createSessionBoundMerchantCredentialVault,
  sessionBoundVaultErrorResponse
} from "../../../../lib/session-bound-merchant-vault.mjs";

const MAX_BODY_BYTES = 12 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Pragma": "no-cache",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function trustedSameOrigin(request, env) {
  if (typeof env?.MERCHANT_APP_ORIGIN !== "string") return false;
  let expected;
  try {
    const parsed = new URL(env.MERCHANT_APP_ORIGIN);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if ((parsed.protocol !== "https:" && !local) || parsed.origin !== env.MERCHANT_APP_ORIGIN) return false;
    expected = parsed.origin;
  } catch {
    return false;
  }
  return request.headers.get("Origin") === expected;
}

async function readJsonBody(request) {
  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") throw Object.assign(new Error("invalid_content_type"), { status: 415 });

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
        await reader.cancel();
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
    payload = JSON.parse(decoder.decode(bytes));
  } catch {
    throw Object.assign(new Error("invalid_request_body"), { status: 400 });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Object.keys(payload).some(key => !["credentials", "consent"].includes(key)) ||
    !payload.credentials ||
    typeof payload.credentials !== "object" ||
    Array.isArray(payload.credentials)
  ) {
    throw Object.assign(new Error("invalid_request_body"), { status: 400 });
  }
  return payload;
}

export async function onRequestPost({ request, env, params }) {
  if (!trustedSameOrigin(request, env)) return jsonResponse({ error: "origin_forbidden" }, 403);

  try {
    // Session identity is resolved server-side; request data cannot select a merchant.
    const vault = await createSessionBoundMerchantCredentialVault(request, env);
    const payload = await readJsonBody(request);
    const result = await vault.save({
      provider: params?.provider,
      credentials: payload.credentials,
      consent: payload.consent
    });
    return jsonResponse(result, 201);
  } catch (error) {
    if (error?.status === 400 || error?.status === 413 || error?.status === 415) {
      return jsonResponse({ error: error.message }, error.status);
    }
    return sessionBoundVaultErrorResponse(error);
  }
}

export async function onRequestDelete({ request, env, params }) {
  if (!trustedSameOrigin(request, env)) return jsonResponse({ error: "origin_forbidden" }, 403);

  try {
    const vault = await createSessionBoundMerchantCredentialVault(request, env);
    const result = await vault.revoke({ provider: params?.provider });
    return jsonResponse(result);
  } catch (error) {
    return sessionBoundVaultErrorResponse(error);
  }
}
