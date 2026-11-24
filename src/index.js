import { chooseExecutionPath } from "./core/router.js";
import { getAdapterCatalog } from "./core/adapters.js";
import { createTenantTaskGateway } from "./core/tenant-task-gateway.js";
import { readBoundedJsonBody, TaskContractError, validateTaskRequest } from "./core/task-contract.js";
import { executeWebTask } from "./core/tasks.js";
import { executeDurableTask, getDurableTask } from "./core/task-store.js";
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
  INVALID_QUERY: 400,
  INVALID_SCHEMA: 400,
  INVALID_CACHE_MODE: 400,
  INVALID_SEARCH_SOURCE: 400,
  SEARCH_UNAVAILABLE: 503,
  SEARCH_RATE_LIMITED: 429,
  SEARCH_UPSTREAM_FAILED: 502,
  SEARCH_UPSTREAM_INVALID_RESPONSE: 502,
  RESEARCH_UNAVAILABLE: 503,
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

        const taskReadMatch = /^\/api\/v1\/tasks\/([A-Za-z0-9_-]{8,64})$/.exec(url.pathname);
        if (taskReadMatch) {
          if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
          const auth = await tenantTaskGateway.authenticate(request, env, { requiredScope: "tasks:read" });
          if (!auth.ok) {
            return json({ error: { code: auth.code, message: auth.message } }, auth.httpStatus, {
              ...(auth.headers || {}), ...(auth.retryAfterSec ? { "retry-after": String(auth.retryAfterSec) } : {}),
            });
          }
          const found = await getDurableTask({
            db: env?.EXPORTFLOW_AUTH_DB,
            tenantId: auth.identity.tenantId,
            taskId: taskReadMatch[1],
            ...(options.now ? { now: options.now } : {}),
          });
          if (!found.ok) return json({ error: { code: found.code, message: found.message } }, found.httpStatus);
          return json(found.task, 200, { "cache-control": "no-store" });
        }

        if (url.pathname === "/api/v1/tasks") {
          if (request.method !== "POST") {
            return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
          }

          const auth = await tenantTaskGateway.authenticate(request, env, { requiredScope: null });
          if (!auth.ok) {
            return json({ error: { code: auth.code, message: auth.message } }, auth.httpStatus, {
              ...(auth.headers || {}), ...(auth.retryAfterSec ? { "retry-after": String(auth.retryAfterSec) } : {}),
            });
          }

          let contract;
          try {
            contract = validateTaskRequest(await readBoundedJsonBody(request));
          } catch (error) {
            const validationError = error instanceof TaskContractError
              ? error
              : new TaskContractError("INVALID_TASK", "Task request validation failed.", 400);
            return json({ error: { code: validationError.code, message: validationError.message } }, validationError.httpStatus);
          }
          const requiredScope = ({
            fetch: "tasks:fetch", map: "tasks:map", crawl: "tasks:crawl",
            extract: "tasks:extract", search: "tasks:search", research: "tasks:research",
          })[contract.operation];
          const scopeAuth = tenantTaskGateway.authorizeScope(auth.identity, requiredScope);
          if (!scopeAuth.ok) {
            return json({ error: { code: scopeAuth.code, message: scopeAuth.message } }, scopeAuth.httpStatus);
          }

          const outcome = await executeDurableTask({
            db: env?.EXPORTFLOW_AUTH_DB,
            identity: auth.identity,
            input: contract,
            idempotencyKey: request.headers.get("idempotency-key") || undefined,
            signal: request.signal,
            executeTask: executeWebTask,
            ...(options.now ? { now: options.now } : {}),
            ...(options.idFactory ? { idFactory: options.idFactory } : {}),
            ...(options.taskTimeoutMs ? { taskTimeoutMs: options.taskTimeoutMs } : {}),
          });
          if (!outcome.ok) {
            return json(
              { error: { code: outcome.code, message: outcome.message } },
              outcome.httpStatus,
              {
                ...(outcome.retryAfterSec ? { "retry-after": String(outcome.retryAfterSec) } : {}),
                ...(outcome.quota?.limit ? { "x-plan-limit": String(outcome.quota.limit), "x-plan-remaining": "0" } : {}),
                ...(outcome.quota?.resetAt ? { "x-plan-reset": outcome.quota.resetAt } : {}),
              },
            );
          }
          const quota = outcome.quota || outcome.task.quota;
          return json(outcome.task, outcome.httpStatus === 202 ? 202 : taskHttpStatus(outcome.task), {
            ...(quota?.limit ? { "x-plan-limit": String(quota.limit) } : {}),
            ...(Number.isInteger(quota?.remaining) ? { "x-plan-remaining": String(quota.remaining) } : {}),
            ...(quota?.resetAt ? { "x-plan-reset": quota.resetAt } : {}),
            ...(outcome.replayed ? { "idempotency-replayed": "true" } : {}),
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
          let platformScopes = [];
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
            platformScopes = auth.identity.scopes;
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
            liveCapabilities: authReady ? [
              ...getAdapterCatalog().filter((adapter) => {
                const required = {
                  "http.fetch.v1": "tasks:fetch", "web.map.v1": "tasks:map",
                  "web.crawl.v1": "tasks:crawl", "web.extract.v1": "tasks:extract",
                  "web.search.v1": "tasks:search",
                }[adapter.id];
                return required && (platformScopes.includes(required) || platformScopes.includes("tasks:*") || platformScopes.includes("*"));
              }).map((adapter) => adapter.id),
              ...(platformScopes.some((scope) => ["tasks:research", "tasks:*", "*"].includes(scope)) ? ["web.research.v1"] : []),
            ] : [],
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
