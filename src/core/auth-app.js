import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";

const authInstances = new WeakMap();

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isD1Binding(binding) {
  return Boolean(
    binding &&
    typeof binding === "object" &&
    typeof binding.prepare === "function" &&
    typeof binding.batch === "function"
  );
}

function validOrigin(value) {
  try {
    const parsed = new URL(value);
    const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
    const allowedProtocol = parsed.protocol === "https:" || (parsed.protocol === "http:" && localHost);
    return allowedProtocol && !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

function htmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const REQUIRED_AUTH_TABLES = Object.freeze(["user", "session", "account", "verification"]);

async function isAuthSchemaReady(binding) {
  try {
    const placeholders = REQUIRED_AUTH_TABLES.map(() => "?").join(", ");
    const result = await binding
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`)
      .bind(...REQUIRED_AUTH_TABLES)
      .all();
    const existing = new Set((result?.results || []).map((row) => row.name));
    return REQUIRED_AUTH_TABLES.every((name) => existing.has(name));
  } catch {
    return false;
  }
}

async function getPublicAuthFeatureStatus(env, configuredStatus) {
  const authReady = configuredStatus.authConfigured && await isAuthSchemaReady(env.AUTH_DB);
  return Object.freeze({
    ...configuredStatus,
    authReady,
    googleEnabled: configuredStatus.googleEnabled && authReady,
    emailPasswordEnabled: configuredStatus.emailPasswordEnabled && authReady,
  });
}

function textResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

export function getAuthFeatureStatus(env = {}) {
  const baseUrl = isNonEmptyString(env.BETTER_AUTH_URL)
    ? env.BETTER_AUTH_URL.trim()
    : "https://exportflow.me";
  const authConfigured = Boolean(
    isD1Binding(env.AUTH_DB) &&
    isNonEmptyString(env.BETTER_AUTH_SECRET) && env.BETTER_AUTH_SECRET.trim().length >= 32 &&
    validOrigin(baseUrl)
  );
  const googleCredentialsPresent =
    isNonEmptyString(env.GOOGLE_CLIENT_ID) &&
    isNonEmptyString(env.GOOGLE_CLIENT_SECRET);
  const emailServiceReady =
    env.EMAIL &&
    typeof env.EMAIL.send === "function" &&
    isNonEmptyString(env.AUTH_EMAIL_FROM);
  return Object.freeze({
    authConfigured,
    googleEnabled: authConfigured && googleCredentialsPresent,
    emailPasswordEnabled: authConfigured && Boolean(emailServiceReady),
  });
}

function createEmailSender(env) {
  const from = isNonEmptyString(env.AUTH_EMAIL_FROM) ? env.AUTH_EMAIL_FROM.trim() : "";
  return async function sendAccountEmail({ to, subject, heading, message, actionUrl, actionLabel }) {
    if (!env.EMAIL || typeof env.EMAIL.send !== "function" || !from) {
      throw new Error("Account email delivery is not configured.");
    }
    const safeHeading = htmlEscape(heading);
    const safeMessage = htmlEscape(message);
    const safeUrl = htmlEscape(actionUrl);
    const safeLabel = htmlEscape(actionLabel);
    const html = [
      "<!doctype html><html><body>",
      "<main style=\"font-family:Arial,sans-serif;max-width:560px;margin:32px auto;padding:24px;color:#0b1220\">",
      "<h1 style=\"font-size:22px\">" + safeHeading + "</h1>",
      "<p style=\"line-height:1.6\">" + safeMessage + "</p>",
      "<p style=\"margin:28px 0\"><a href=\"" + safeUrl + "\" style=\"display:inline-block;padding:12px 18px;border-radius:8px;background:#1d4ed8;color:#fff;text-decoration:none\">" + safeLabel + "</a></p>",
      "<p style=\"font-size:12px;color:#64748b\">If you did not request this, you can ignore this email.</p>",
      "</main></body></html>",
    ].join("");
    const text = heading + "\n\n" + message + "\n\n" + actionLabel + ": " + actionUrl;
    await env.EMAIL.send({ from, to, subject, html, text });
  };
}

export function getAuthInstance(env = {}) {
  const status = getAuthFeatureStatus(env);
  if (!status.authConfigured) return null;

  const binding = env.AUTH_DB;
  const cached = authInstances.get(binding);
  if (cached) return cached;

  const baseUrl = (env.BETTER_AUTH_URL || "https://exportflow.me").trim().replace(/\/+$/, "");
  const sendAccountEmail = createEmailSender(env);
  const socialProviders = {};

  if (status.googleEnabled) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID.trim(),
      clientSecret: env.GOOGLE_CLIENT_SECRET.trim(),
      prompt: "select_account",
    };
  }

  const options = {
    appName: "ExportFlow",
    baseURL: baseUrl,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [baseUrl],
    database: binding,
    socialProviders,
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 12,
      freshAge: 60 * 10,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
    },
    advanced: {
      cookiePrefix: "exportflow",
      useSecureCookies: baseUrl.startsWith("https://"),
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: baseUrl.startsWith("https://"),
        path: "/",
      },
    },
  };

  if (status.emailPasswordEnabled) {
    options.emailAndPassword = {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAccountEmail({
          to: user.email,
          subject: "Reset your ExportFlow password",
          heading: "Reset your password",
          message: "We received a request to reset the password for your ExportFlow account.",
          actionUrl: url,
          actionLabel: "Reset password",
        });
      },
    };
    options.emailVerification = {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAccountEmail({
          to: user.email,
          subject: "Verify your ExportFlow email",
          heading: "Verify your email address",
          message: "Confirm this email address to finish creating your ExportFlow account.",
          actionUrl: url,
          actionLabel: "Verify email",
        });
      },
    };
  } else {
    options.emailAndPassword = { enabled: false };
  }

  const instance = betterAuth(options);
  authInstances.set(binding, instance);
  return instance;
}

async function safeTokenMatch(provided, expected) {
  if (!isNonEmptyString(provided) || !isNonEmptyString(expected)) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < aa.length; index += 1) {
    difference |= aa[index] ^ bb[index];
  }
  return difference === 0;
}

export async function handleAuthRequest(request, env = {}) {
  const url = new URL(request.url);
  const status = getAuthFeatureStatus(env);

  if (url.pathname === "/api/auth/config") {
    if (request.method !== "GET") {
      return textResponse({ error: "method_not_allowed" }, 405);
    }
    return textResponse(await getPublicAuthFeatureStatus(env, status));
  }

  if (!url.pathname.startsWith("/api/auth/")) return null;

  if (url.pathname === "/api/auth/_ops/migrate") {
    if (request.method !== "POST") {
      return textResponse({ error: "method_not_allowed" }, 405);
    }
    if (!status.authConfigured || !isNonEmptyString(env.AUTH_MIGRATION_TOKEN) || env.AUTH_MIGRATION_TOKEN.trim().length < 32) {
      return textResponse({ error: "not_found" }, 404);
    }
    const authorization = request.headers.get("authorization") || "";
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match || !(await safeTokenMatch(match[1], env.AUTH_MIGRATION_TOKEN))) {
      return textResponse({ error: "unauthorized" }, 401);
    }

    try {
      const auth = getAuthInstance(env);
      const migration = await getMigrations(auth.options);
      await migration.runMigrations();
      return textResponse({ ok: true, message: "Authentication schema migration completed." });
    } catch {
      return textResponse({ error: "migration_failed" }, 500);
    }
  }

  const auth = getAuthInstance(env);
  if (!auth) {
    return textResponse({
      error: "AUTH_NOT_CONFIGURED",
      message: "Account services are not configured yet.",
    }, 503);
  }

  if (!(await isAuthSchemaReady(env.AUTH_DB))) {
    return textResponse({
      error: "AUTH_SCHEMA_NOT_READY",
      message: "Account storage has not been initialized yet.",
    }, 503);
  }

  try {
    return await auth.handler(request);
  } catch {
    return textResponse({ error: "AUTH_REQUEST_FAILED" }, 500);
  }
}
