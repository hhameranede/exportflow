import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { authorizePlatformOwner, handleAuthRequest } from "../../src/core/auth-app.js";

function labOrigin(request) {
  return new URL(request.url).origin;
}

function labOptions(env, origin) {
  return {
    appName: "ExportFlow",
    baseURL: origin,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: env.AUTH_DB,
    socialProviders: {},
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        trustedProviders: ["google"],
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 12,
      freshAge: 60 * 10,
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: true, window: 60, max: 30 },
    advanced: {
      cookiePrefix: "exportflow",
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
    },
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

function authorizedForLab(request, env) {
  return request.headers.get("x-session-lab-token") === env.SESSION_LAB_TOKEN &&
    typeof env.SESSION_LAB_TOKEN === "string" &&
    env.SESSION_LAB_TOKEN.length >= 32;
}

async function bootstrapVerifiedSession(request, env, origin) {
  const input = await request.json();
  if (!input || typeof input.email !== "string" || typeof input.password !== "string" ||
      input.email.length > 254 || input.password.length < 12 || input.password.length > 128 ||
      typeof input.name !== "string" || input.name.length > 80) {
    return json({ error: "invalid_test_signup_payload" }, 400);
  }

  const auth = betterAuth(labOptions(env, origin));
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();

  const signUp = await auth.handler(new Request(origin + "/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "user-agent": "ExportFlow-Owner-Session-Lab/1.0",
    },
    body: JSON.stringify(input),
  }));
  if (!signUp.ok) return signUp;

  const signUpBody = await signUp.clone().json();
  const userId = signUpBody?.user?.id;
  if (typeof userId !== "string" || userId.length < 1 || userId.length > 128) {
    return json({ error: "test_user_creation_failed" }, 500);
  }

  await env.AUTH_DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?1')
    .bind(userId)
    .run();

  const signIn = await auth.handler(new Request(origin + "/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "user-agent": "ExportFlow-Owner-Session-Lab/1.0",
    },
    body: JSON.stringify({ email: input.email, password: input.password }),
  }));
  if (!signIn.ok) return signIn;

  const signInBody = await signIn.clone().json();
  if (signInBody?.user?.id !== userId) {
    return json({ error: "test_session_identity_mismatch" }, 500);
  }

  const headers = new Headers(signIn.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-session-lab-user-id", userId);
  return new Response(signIn.body, { status: signIn.status, statusText: signIn.statusText, headers });
}

async function mutateTestRecord(request, env) {
  const { action, userId } = await request.json();
  if (typeof userId !== "string" || userId.length < 1 || userId.length > 128) {
    return json({ error: "invalid_user_id" }, 400);
  }

  const now = Date.now();
  const future = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(now - 12 * 60 * 1000).toISOString();

  if (action === "unverify") {
    await env.AUTH_DB.prepare('UPDATE "user" SET "emailVerified" = 0 WHERE id = ?1').bind(userId).run();
  } else if (action === "verify") {
    await env.AUTH_DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?1').bind(userId).run();
  } else if (action === "stale") {
    await env.AUTH_DB.prepare('UPDATE "session" SET "createdAt" = ?1 WHERE "userId" = ?2').bind(past, userId).run();
  } else if (action === "fresh") {
    await env.AUTH_DB.prepare('UPDATE "session" SET "createdAt" = ?1 WHERE "userId" = ?2').bind(new Date(now).toISOString(), userId).run();
  } else if (action === "expired") {
    await env.AUTH_DB.prepare('UPDATE "session" SET "expiresAt" = ?1 WHERE "userId" = ?2').bind(past, userId).run();
  } else if (action === "extend") {
    await env.AUTH_DB.prepare('UPDATE "session" SET "expiresAt" = ?1 WHERE "userId" = ?2').bind(future, userId).run();
  } else {
    return json({ error: "unsupported_lab_action" }, 400);
  }

  return json({ ok: true, action });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;
    const authEnv = { ...env, BETTER_AUTH_URL: origin };

    if (url.pathname.startsWith("/api/auth/")) {
      return handleAuthRequest(request, authEnv);
    }

    if (!url.pathname.startsWith("/__session_lab/")) {
      return new Response("Not found", { status: 404 });
    }

    // Temporary, non-sensitive liveness diagnostic used only while the lab Worker exists.
    if (url.pathname === "/__session_lab/health" && request.method === "GET") {
      return json({
        ok: true,
        sessionLabTokenConfigured: typeof env.SESSION_LAB_TOKEN === "string" && env.SESSION_LAB_TOKEN.length >= 32,
        authDbBindingPresent: Boolean(env.AUTH_DB && typeof env.AUTH_DB.prepare === "function"),
      });
    }

    if (!authorizedForLab(request, env)) {
      return json({ error: "lab_forbidden" }, 403);
    }

    if (url.pathname === "/__session_lab/signup" && request.method === "POST") {
      return bootstrapVerifiedSession(request, env, origin);
    }

    if (url.pathname === "/__session_lab/authorize" && request.method === "POST") {
      const ownerUserId = request.headers.get("x-session-lab-owner-id") || "";
      const decision = await authorizePlatformOwner(request, {
        ...authEnv,
        EXPORTFLOW_OWNER_USER_IDS: ownerUserId,
      });
      return json({
        allowed: decision.allowed === true,
        actorMatches: decision.allowed === true && decision.actorId === ownerUserId,
      });
    }

    if (url.pathname === "/__session_lab/control" && request.method === "POST") {
      return mutateTestRecord(request, env);
    }

    return json({ error: "not_found" }, 404);
  },
};
