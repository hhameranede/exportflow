import { chooseExecutionPath } from "./core/router.js";
import { getAdapterCatalog } from "./core/adapters.js";
import { authenticateRequest, createRateLimiter } from "./core/auth.js";
import { readBoundedJsonBody, TaskContractError, validateTaskRequest } from "./core/task-contract.js";
import { executeWebTask } from "./core/tasks.js";
import { handleWebsiteRequest, HTML_SECURITY_HEADERS } from "./site/router.js";
import { renderMarketingNotFoundPage } from "./site/marketing.js";
import { handleAuthRequest } from "./core/auth-app.js";

const ERROR_CODE_TO_HTTP_STATUS = Object.freeze({
  INVALID_TASK: 400,
  INVALID_GOAL: 400,
  INVALID_LIMIT: 400,
  UNSUPPORTED_OPERATION: 400,
  URL_NOT_ALLOWED: 400,
  RESPONSE_TOO_LARGE: 413,
  UNSUPPORTED_CONTENT_TYPE: 415,
  UPSTREAM_TIMEOUT: 504,
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
      "strict-transport-security": "max-age=63072000",
      ...extraHeaders,
    },
  });
}

function isAuthConfigured(env) {
  return typeof env?.EXPORTFLOW_API_TOKEN === "string" && env.EXPORTFLOW_API_TOKEN.trim().length > 0;
}

function taskHttpStatus(task) {
  if (task.state === "unsupported") return 501;
  if (task.state === "failed" && task.result?.data?.errorCode) {
    return ERROR_CODE_TO_HTTP_STATUS[task.result.data.errorCode] || 502;
  }
  return 200;
}

export function createWorker(options = {}) {
  const rateLimiter = options.rateLimiter || createRateLimiter();

  return {
    async fetch(request, env = {}) {
      try {
        const url = new URL(request.url);

        const authResponse = await handleAuthRequest(request, env);
        if (authResponse) return authResponse;

        if (url.pathname === "/api/v1/tasks") {
          if (request.method !== "POST") {
            return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
          }

          const auth = await authenticateRequest(request, env);
          if (!auth.ok) {
            return json(
              { error: { code: auth.code, message: auth.message } },
              auth.httpStatus,
              auth.headers,
            );
          }

          const rate = rateLimiter.check(auth.clientId);
          if (!rate.allowed) {
            return json(
              { error: { code: "RATE_LIMITED", message: "Too many task requests; retry later." } },
              429,
              { "retry-after": String(rate.retryAfterSec) },
            );
          }

          let contract;
          try {
            const payload = await readBoundedJsonBody(request);
            contract = validateTaskRequest(payload);
          } catch (error) {
            if (error instanceof TaskContractError) {
              return json(
                { error: { code: error.code, message: error.message } },
                error.httpStatus,
              );
            }
            return json(
              { error: { code: "INVALID_TASK", message: "Task request validation failed." } },
              400,
            );
          }

          const task = await executeWebTask(contract, {
            fetchImpl: options.fetchImpl,
            now: options.now,
            idFactory: options.idFactory,
            signal: request.signal,
          });
          return json(task, taskHttpStatus(task));
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
          const authReady = isAuthConfigured(env);
          return json({
            name: "ExportFlow",
            positioning: "Model-agnostic agentic web infrastructure",
            lifecycle: ["discover", "retrieve", "escalate", "extract", "return"],
            executionPaths: ["http", "browser"],
            adapterCatalog: getAdapterCatalog(),
            status: "foundation",
            auth: {
              mode: "bearer",
              configured: authReady,
            },
            endpoints: {
              health: "/api/v1/health",
              platform: "/api/v1/platform",
              routerPreview: "/api/v1/router-preview",
              tasks: "/api/v1/tasks",
            },
            liveCapabilities: authReady ? ["http.fetch.v1"] : [],
          });
        }

        if (url.pathname === "/api/v1/router-preview") {
          return json({
            decision: chooseExecutionPath({
              requiresInteraction: url.searchParams.get("interaction") === "true",
              requiresJavascript: url.searchParams.get("javascript") === "true",
            }),
            note: "Planning primitive only; submit tasks via authenticated POST /api/v1/tasks.",
          });
        }

        const websiteResponse = handleWebsiteRequest(request, url);
        if (websiteResponse) {
          return websiteResponse;
        }

        if (url.pathname === "/favicon.ico") {
          return new Response(null, {
            status: 204,
            headers: {
              "cache-control": "public, max-age=300",
              "x-content-type-options": "nosniff",
              "referrer-policy": "strict-origin-when-cross-origin",
              "strict-transport-security": "max-age=63072000",
            },
          });
        }

        const acceptsHtml = request.headers.get("accept")?.includes("text/html") && !url.pathname.startsWith("/api/");
        if (acceptsHtml) {
          const localeMatch = /^\/(en|ar|fr|es|de|pt|zh|ja)(\/|$)/.exec(url.pathname);
          const notFoundHtml = renderMarketingNotFoundPage(request.url, localeMatch?.[1] || "en");
          return new Response(request.method === "HEAD" ? null : notFoundHtml, {
            status: 404,
            headers: { ...HTML_SECURITY_HEADERS, "cache-control": "no-store" },
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
