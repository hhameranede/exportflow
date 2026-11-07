import {
  merchantSessionResponse,
  revokeMerchantSession
} from "../../lib/merchant-identity.mjs";

export async function onRequestGet({ request, env }) {
  return merchantSessionResponse(request, env);
}

export async function onRequestDelete({ request, env }) {
  return revokeMerchantSession(request, env);
}
