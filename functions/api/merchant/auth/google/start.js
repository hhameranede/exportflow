import {
  startGoogleOAuth,
  merchantIdentityErrorResponse
} from "../../../../lib/merchant-identity.mjs";

export async function onRequestPost({ request, env }) {
  try {
    return await startGoogleOAuth(request, env);
  } catch (error) {
    return merchantIdentityErrorResponse(error);
  }
}
