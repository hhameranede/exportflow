import { chooseExecutionPath } from "./core/router.js";
import { getAdapterCatalog } from "./core/adapters.js";
import { createTenantTaskGateway } from "./core/tenant-task-gateway.js";
import { readBoundedJsonBody, TaskContractError, validateTaskRequest } from "./core/task-contract.js";
import { executeWebTask } from "./core/tasks.js";
import { handleWebsiteRequest } from "./site/router.js";
import { BRAND_MARK_SVG } from "./site/diagrams.js";
import { renderMarketingNotFoundPage } from "./site/marketing.js";
import { handleAuthRequest, handleOAuthBrowserPage } from "./core/auth-app.js";
import { handleWorkspaceRequest } from "./core/workspace-api.js";

// Shared namespace owner: the separate MCP Worker binds to this exported class.
export { TenantBurstRateLimiter } from "./core/durable-tenant-burst-limiter.js";
import { createTenantAdminHttpHandler } from "./core/tenant-admin-http.js";

const ERROR_CODE_TO_HTTP_STATUS = Object.freeze({
  INVALID_TASK: 400,
  INVALID_GOAL: 400,
  INVALID_LIMIT: 400,
  UNSUPPORTED_OPERATION: 400,
  URL_NOT_ALLOWED: 400,
  RESPONSE_TOO_LARGE: 413,
  UNSUPPORTED_CONTENT_TYPE: 415,
  UPSTREAM_TIMEOUT: 504,
  TASK_TIMEOUT: 504,
  TASK_CANCELLED: 499,
  TOO_MANY_REDIRECTS: 502,
  REDIRECT_LOOP: 502,
  REDIRECT_NOT_ALLOWED: 502,
  REDIRECT_DOWNGRADE: 502,
  INVALID_REDIRECT: 502,
  UPSTREAM_FETCH_FAILED: 502,
});

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

function isAuthConfigured(env) {
  return typeof env?.EXPORTFLOW_AUTH_DB?.prepare === "function";
}

async function hasQuotaSchema(env) {
  const db = env?.EXPORTFLOW_AUTH_DB;
  if (typeof db?.prepare !== "function") return false;
  try {
    await db.prepare(
      "SELECT tenant_id, window_id, plan_code, policy_version, request_limit, requests_used, updated_at FROM tenant_request_usage LIMIT 0",
    ).first();
    return true;
  } catch {
    return false;
  }
}

function taskHttpStatus(task) {
  if (task.state === "unsupported") return 501;
  if ((task.state === "failed" || task.state === "cancelled") && task.result?.data?.errorCode) {
    return ERROR_CODE_TO_HTTP_STATUS[task.result.data.errorCode] || 502;
  }
  return 200;
}

export function createWorker(options = {}) {
  const tenantTaskGateway = options.tenantTaskGateway || createTenantTaskGateway({
    preAuthRateLimiter: options.preAuthRateLimiter,
    tenantRateLimiter: options.tenantRateLimiter ?? options.rateLimiter,
    tenantBurstLimit: options.tenantBurstLimit,
    tenantBurstWindowMs: options.tenantBurstWindowMs,
  });
  const tenantAdminHandler = options.tenantAdminHandler || createTenantAdminHttpHandler({
    authorizeOwner: options.authorizePlatformOwner,
  });

  return {
    async fetch(request, env = {}) {
      try {
        const url = new URL(request.url);

        const authResponse = await handleAuthRequest(request, env);
        if (authResponse) return authResponse;

        const oauthPageResponse = await handleOAuthBrowserPage(request, env);
        if (oauthPageResponse) return oauthPageResponse;

        const adminResponse = await tenantAdminHandler(request, env);
        if (adminResponse) return adminResponse;

        const workspaceResponse = await handleWorkspaceRequest(request, env, options);
        if (workspaceResponse) return workspaceResponse;

        if (url.pathname === "/api/v1/tasks") {
          if (request.method !== "POST") {
            return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
          }

          let contract;
          let validationError = null;
          try {
            contract = validateTaskRequest(await readBoundedJsonBody(request));
          } catch (error) {
            validationError = error instanceof TaskContractError ? error
              : new TaskContractError("INVALID_TASK", "Task request validation failed.", 400);
          }
          const requiredScope = validationError ? "tasks:fetch" : ({
            fetch: "tasks:fetch", map: "tasks:map", crawl: "tasks:crawl",
            extract: "tasks:extract", search: "tasks:search", research: "tasks:research",
          })[contract.operation];
          const auth = await tenantTaskGateway.authenticate(request, env, { requiredScope });
          if (!auth.ok) {
            return json({ error: { code: auth.code, message: auth.message } }, auth.httpStatus, {
              ...(auth.headers || {}), ...(auth.retryAfterSec ? { "retry-after": String(auth.retryAfterSec) } : {}),
            });
          }
          if (validationError) {
            return json({ error: { code: validationError.code, message: validationError.message } }, validationError.httpStatus);
          }

          const reservation = await tenantTaskGateway.reserve(env, auth.identity);
          if (!reservation.ok) {
            return json(
              { error: { code: reservation.code, message: reservation.message } },
              reservation.httpStatus,
              reservation.retryAfterSec
                ? { "retry-after": String(reservation.retryAfterSec), "x-plan-limit": String(reservation.quota?.limit ?? auth.identity.requestLimit), "x-plan-remaining": "0", ...(reservation.quota?.resetAt ? { "x-plan-reset": reservation.quota.resetAt } : {}) }
                : {},
            );
          }

          const task = await executeWebTask(contract, {
            fetchImpl: options.fetchImpl,
            now: options.now,
            idFactory: options.idFactory,
            taskTimeoutMs: options.taskTimeoutMs,
            signal: request.signal,
          });
          return json(task, taskHttpStatus(task), {
            "x-plan-limit": String(reservation.quota.limit),
            "x-plan-remaining": String(reservation.quota.remaining),
            "x-plan-reset": reservation.quota.resetAt,
          });
        }

        if (request.method !== "GET" && request.method !== "HEAD") {
          return json({ error: "method_not_allowed" }, 405, { allow: "GET, HEAD" });
        }

        if (url.pathname === "/health" || url.pathname === "/api/v1/health") {
          return json({
            status: "ok",
            service: "exportflow",
            runtime: "cloudflare-workers",
            version: "0.1.0",
            stage: "foundation",
          });
        }

        if (url.pathname === "/api/v1/platform") {
          const authConfigured = isAuthConfigured(env);
          let authReady = false;
          if (request.headers.has("authorization")) {
            const auth = await tenantTaskGateway.authenticate(request, env, {
              requiredScope: "tasks:fetch",
            });
            if (!auth.ok) {
              return json(
                { error: { code: auth.code, message: auth.message } },
                auth.httpStatus,
                {
                  ...(auth.headers || {}),
                  ...(auth.retryAfterSec ? { "retry-after": String(auth.retryAfterSec) } : {}),
                },
              );
            }
            authReady = await hasQuotaSchema(env);
          }
          return json({
            name: "ExportFlow",
            positioning: "Model-agnostic agentic web infrastructure",
            lifecycle: ["discover", "retrieve", "extract", "return"],
            executionPaths: ["http"],
            adapterCatalog: getAdapterCatalog(),
            status: "foundation",
            auth: {
              mode: "bearer",
              configured: authConfigured,
              ready: authReady,
            },
            endpoints: {
              health: "/api/v1/health",
              platform: "/api/v1/platform",
              routerPreview: "/api/v1/router-preview",
              tasks: "/api/v1/tasks",
            },
            liveCapabilities: authReady ? [...getAdapterCatalog().map((adapter) => adapter.id), "web.research.v1"] : [],
          });
        }

        if (url.pathname === "/api/v1/router-preview") {
          return json({
            decision: chooseExecutionPath(),
            note: "Planning primitive only; submit tasks via authenticated POST /api/v1/tasks.",
          });
        }

        const websiteResponse = handleWebsiteRequest(request, url);
        if (websiteResponse) {
          return websiteResponse;
        }

        if (url.pathname === "/favicon.ico") {
          return new Response(request.method === "HEAD" ? null : BRAND_MARK_SVG, {
            status: 200,
            headers: {
              "content-type": "image/svg+xml; charset=utf-8",
              "cache-control": "public, max-age=3600",
              "x-content-type-options": "nosniff",
            },
          });
        }

        const acceptsHtml = request.headers.get("accept")?.includes("text/html") && !url.pathname.startsWith("/api/");
        if (acceptsHtml) {
          const localeMatch = /^\/(en|ar|fr|es|de|pt|zh|ja)(\/|$)/.exec(url.pathname);
          const notFoundHtml = renderMarketingNotFoundPage(request.url, localeMatch?.[1] || "en");
          return new Response(request.method === "HEAD" ? null : notFoundHtml, {
            status: 404,
            headers: { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff" },
          });
        }

        return json({ error: "not_found" }, 404);
      } catch {
        return json(
          { error: { code: "INTERNAL_ERROR", message: "Unexpected internal error." } },
          500,
        );
      }
    },
  };
}

export default createWorker();
