import {
  finishGoogleOAuth
} from "../../../../lib/merchant-identity.mjs";

export async function onRequestGet({ request, env }) {
  return finishGoogleOAuth(request, env);
}
