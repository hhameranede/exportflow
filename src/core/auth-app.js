import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { authorizePlatformOwnerRequest, parsePlatformOwnerIds } from "./platform-admin-auth.js";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { readBoundedJsonBody, TaskContractError } from "./task-contract.js";
import {
  createTenantOAuthAccessTokenClaims,
  getSelectedOAuthTenant,
  listActiveTenantMemberships,
  storeOAuthTenantSelection,
} from "./tenant-membership.js";

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
const REQUIRED_OAUTH_AUTH_TABLES = Object.freeze([
  "jwks", "oauthClient", "oauthResource", "oauthClientResource",
  "oauthRefreshToken", "oauthAccessToken", "oauthConsent", "oauthClientAssertion",
]);
const REQUIRED_TENANT_OAUTH_TABLES = Object.freeze([
  "tenants", "plan_policies", "tenant_request_usage",
  "tenant_memberships", "tenant_oauth_selections",
]);
const REQUIRED_TENANT_OAUTH_TRIGGERS = Object.freeze([
  "guard_tenant_membership_last_owner",
  "prevent_tenant_membership_identity_update",
  "prevent_tenant_membership_delete",
  "bump_tenant_membership_version_on_tenant_state_change",
]);
const AUTH_ISSUER = "https://exportflow.me/api/auth";
const MCP_RESOURCE = "https://mcp.exportflow.me/mcp";
const MCP_SCOPES = Object.freeze([
  "openid", "profile", "email", "offline_access",
  "tasks:fetch", "tasks:map", "tasks:crawl", "tasks:extract",
]);

async function hasSqliteObjects(binding, type, names) {
  if (!isD1Binding(binding)) return false;
  try {
    const placeholders = names.map(() => "?").join(", ");
    const result = await binding.prepare(
      "SELECT name FROM sqlite_master WHERE type = ? AND name IN (" + placeholders + ")"
    ).bind(type, ...names).all();
    const existing = new Set((result?.results || []).map((row) => row.name));
    return names.every((name) => existing.has(name));
  } catch {
    return false;
  }
}

async function isOAuthAuthSchemaReady(binding) {
  return await hasSqliteObjects(binding, "table", REQUIRED_OAUTH_AUTH_TABLES);
}

async function isTenantOAuthSchemaReady(binding) {
  return await hasSqliteObjects(binding, "table", REQUIRED_TENANT_OAUTH_TABLES) &&
    await hasSqliteObjects(binding, "trigger", REQUIRED_TENANT_OAUTH_TRIGGERS);
}


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
  const tenantOAuthReady = configuredStatus.tenantOAuthConfigured &&
    await isOAuthAuthSchemaReady(env.AUTH_DB) &&
    await isTenantOAuthSchemaReady(env.EXPORTFLOW_AUTH_DB);
  return Object.freeze({
    ...configuredStatus,
    authReady,
    oauthReady: Boolean(tenantOAuthReady),
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
    tenantOAuthConfigured: authConfigured && isD1Binding(env.EXPORTFLOW_AUTH_DB),
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

function buildAuthOptions(env, status) {
  const binding = env.AUTH_DB;
  let baseUrl = (env.BETTER_AUTH_URL || "https://exportflow.me").trim();
  while (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
  const sendAccountEmail = createEmailSender(env);
  const socialProviders = {};

  if (status.googleEnabled) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID.trim(),
      clientSecret: env.GOOGLE_CLIENT_SECRET.trim(),
      prompt: "select_account",
      requireEmailVerification: true,
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
        // Existing accounts must authenticate first and link Google explicitly from account settings.
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
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
    },
    advanced: {
      cookiePrefix: "exportflow",
      ipAddress: {
        // Workers expose the visitor IP in CF-Connecting-IP, not X-Forwarded-For.
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      useSecureCookies: baseUrl.startsWith("https://"),
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: baseUrl.startsWith("https://"),
        path: "/",
      },
    },
  };

  if (status.tenantOAuthConfigured) {
    options.plugins = [
      jwt({ jwt: { issuer: AUTH_ISSUER } }),
      mcp({
        resource: MCP_RESOURCE,
        scopes: [...MCP_SCOPES],
        requireOpenId: true,
        loginPage: "/signin",
        consentPage: "/oauth/consent",
        accessTokenExpiresIn: 10 * 60,
        refreshTokenExpiresIn: 30 * 24 * 60 * 60,
        refreshTokenReuseInterval: 30,
        subjectType: "public",
        // ChatGPT supports OAuth DCR. Public registration is rate-limited by Better Auth,
        // clients are restricted to authorization-code + PKCE and the single MCP resource.
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        clientRegistrationRequirePKCE: true,
        clientRegistrationDefaultApplicationType: "web",
        clientRegistrationDefaultScopes: [...MCP_SCOPES],
        clientRegistrationAllowedScopes: [...MCP_SCOPES],
        clientRegistrationDefaultResources: [MCP_RESOURCE],
        clientRegistrationAllowedResources: [MCP_RESOURCE],
        grantTypes: ["authorization_code", "refresh_token"],
        postLogin: {
          page: "/oauth/select-tenant",
          consentReferenceId: async ({ user, session }) => {
            if (!user?.emailVerified || !session?.id) {
              throw new Error("A verified user session is required before issuing tenant-scoped OAuth consent.");
            }
            const selected = await getSelectedOAuthTenant(env.EXPORTFLOW_AUTH_DB, {
              sessionId: session.id,
              userId: user.id,
            });
            if (!selected) throw new Error("An active tenant selection is required before OAuth consent.");
            return selected.tenantId;
          },
          shouldRedirect: async ({ user, session, isContinuation }) => {
            if (!user?.emailVerified || !user?.id || !session?.id) return true;
            const selected = await getSelectedOAuthTenant(env.EXPORTFLOW_AUTH_DB, {
              sessionId: session.id,
              userId: user.id,
            });
            if (selected) return false;
            if (!isContinuation) {
              const memberships = await listActiveTenantMemberships(env.EXPORTFLOW_AUTH_DB, user.id);
              if (memberships.length === 1) {
                const stored = await storeOAuthTenantSelection(env.EXPORTFLOW_AUTH_DB, {
                  sessionId: session.id,
                  userId: user.id,
                  tenantId: memberships[0].tenantId,
                  sessionExpiresAt: session.expiresAt,
                });
                return !stored;
              }
            }
            return true;
          },
        },
        customAccessTokenClaims: async ({ user, referenceId }) => (
          await createTenantOAuthAccessTokenClaims(env.EXPORTFLOW_AUTH_DB, { user, referenceId })
        ),
        advertisedMetadata: {
          token_endpoint_auth_methods_supported: ["none"],
        },
      }),
    ];
  }

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

  return options;
}

export function getAuthOptions(env = {}) {
  const status = getAuthFeatureStatus(env);
  if (!status.authConfigured) return null;
  return buildAuthOptions(env, status);
}

export function getAuthInstance(env = {}) {
  const status = getAuthFeatureStatus(env);
  if (!status.authConfigured) return null;

  const binding = env.AUTH_DB;
  const cached = authInstances.get(binding);
  if (cached) return cached;

  const instance = betterAuth(buildAuthOptions(env, status));
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


function isSameOriginAuthRequest(request, env = {}) {
  const expectedOrigin = new URL(isNonEmptyString(env.BETTER_AUTH_URL) ? env.BETTER_AUTH_URL.trim() : "https://exportflow.me").origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === expectedOrigin && (!fetchSite || fetchSite === "same-origin");
}

async function handleTenantOAuthApi(request, env, auth) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/auth/tenant/list" && url.pathname !== "/api/auth/tenant/select") return null;
  if (!isD1Binding(env.EXPORTFLOW_AUTH_DB) || !(await isTenantOAuthSchemaReady(env.EXPORTFLOW_AUTH_DB))) {
    return textResponse({ error: "TENANT_OAUTH_NOT_READY", message: "Tenant membership services are not initialized." }, 503);
  }

  if (url.pathname === "/api/auth/tenant/list" && request.method !== "GET") {
    return textResponse({ error: "method_not_allowed" }, 405);
  }
  if (url.pathname === "/api/auth/tenant/select") {
    if (request.method !== "POST") return textResponse({ error: "method_not_allowed" }, 405);
    if (!isSameOriginAuthRequest(request, env)) return textResponse({ error: "origin_not_allowed" }, 403);
  }

  let session;
  try {
    session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  } catch {
    return textResponse({ error: "AUTH_SESSION_UNAVAILABLE" }, 503);
  }
  if (!session?.user?.id || !session?.session?.id) {
    return textResponse({ error: "UNAUTHORIZED" }, 401);
  }
  if (session.user.emailVerified !== true) {
    return textResponse({ error: "EMAIL_VERIFICATION_REQUIRED" }, 403);
  }

  if (url.pathname === "/api/auth/tenant/list") {
    try {
      const memberships = await listActiveTenantMemberships(env.EXPORTFLOW_AUTH_DB, session.user.id);
      return textResponse({
        tenants: memberships.map((member) => ({
          tenantId: member.tenantId,
          role: member.role,
          planCode: member.planCode,
        })),
      });
    } catch {
      return textResponse({ error: "TENANT_MEMBERSHIP_UNAVAILABLE" }, 503);
    }
  }

  let payload;
  try {
    payload = await readBoundedJsonBody(request, 2048);
  } catch (error) {
    if (error instanceof TaskContractError) {
      return textResponse({ error: error.code, message: error.message }, error.httpStatus);
    }
    return textResponse({ error: "INVALID_BODY" }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      Object.keys(payload).some((key) => key !== "tenantId") ||
      typeof payload.tenantId !== "string") {
    return textResponse({ error: "INVALID_TENANT_SELECTION" }, 400);
  }

  try {
    const selection = await storeOAuthTenantSelection(env.EXPORTFLOW_AUTH_DB, {
      sessionId: session.session.id,
      userId: session.user.id,
      tenantId: payload.tenantId,
      sessionExpiresAt: session.session.expiresAt,
    });
    if (!selection) return textResponse({ error: "TENANT_MEMBERSHIP_REQUIRED" }, 403);
    return textResponse({
      selected: true,
      tenant: { tenantId: selection.tenantId, role: selection.role, planCode: selection.planCode },
      expiresAt: selection.expiresAt,
    });
  } catch {
    return textResponse({ error: "TENANT_SELECTION_FAILED" }, 503);
  }
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

  if (!status.authConfigured) {
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

  const auth = getAuthInstance(env);
  if (!auth) {
    return textResponse({
      error: "AUTH_NOT_CONFIGURED",
      message: "Account services are not configured yet.",
    }, 503);
  }

  const tenantOAuthResponse = await handleTenantOAuthApi(request, env, auth);
  if (tenantOAuthResponse) return tenantOAuthResponse;

  try {
    return await auth.handler(request);
  } catch {
    return textResponse({ error: "AUTH_REQUEST_FAILED" }, 500);
  }
}


/**
 * Resolves the current request to a deployment-allowlisted platform owner.
 * The allowlist is configuration-only; no client field or Better Auth role
 * assignment endpoint can promote an account into this owner set.
 */
export async function authorizePlatformOwner(request, env = {}) {
  const ownerUserIds = parsePlatformOwnerIds(env.EXPORTFLOW_OWNER_USER_IDS);
  if (ownerUserIds.size === 0) return Object.freeze({ allowed: false });

  const status = getAuthFeatureStatus(env);
  if (!status.authConfigured || !(await isAuthSchemaReady(env.AUTH_DB))) {
    return Object.freeze({ allowed: false });
  }

  const auth = getAuthInstance(env);
  if (!auth || typeof auth.api?.getSession !== "function") {
    return Object.freeze({ allowed: false });
  }

  return authorizePlatformOwnerRequest(request, {
    ownerUserIds,
    expectedOrigin: isNonEmptyString(env.BETTER_AUTH_URL)
      ? env.BETTER_AUTH_URL.trim()
      : "https://exportflow.me",
    getSession: ({ headers, query }) => auth.api.getSession({ headers, query }),
  });
}
