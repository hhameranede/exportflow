import { chooseExecutionPath } from "./core/router.js";
import { getAdapterCatalog } from "./core/adapters.js";
import { authenticateRequest, createRateLimiter } from "./core/auth.js";
import { reservePlanRequest } from "./core/plan-quota.js";
import { readBoundedJsonBody, TaskContractError, validateTaskRequest } from "./core/task-contract.js";
import { executeWebTask } from "./core/tasks.js";
import { handleWebsiteRequest } from "./site/router.js";

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
      ...extraHeaders,
    },
  });
}

function isAuthConfigured(env) {
  return typeof env?.EXPORTFLOW_AUTH_DB?.prepare === "function";
}

async function hasLiveFetchTenant(env) {
  const db = env?.EXPORTFLOW_AUTH_DB;
  if (typeof db?.prepare !== "function") return false;

  try {
    // Confirm the persistent quota table exists before advertising Fetch as live.
    await db.prepare("SELECT 1 FROM tenant_request_usage LIMIT 0").first();
    const row = await db.prepare(`
      SELECT 1 AS tenant_auth_ready
      FROM api_keys AS k
      JOIN tenants AS t ON t.tenant_id = k.tenant_id
      JOIN plan_policies AS p ON p.plan_code = t.plan_code
      WHERE k.status = 'active'
        AND t.status = 'active'
        AND p.status = 'active'
        AND (k.expires_at IS NULL OR k.expires_at > ?1)
        AND EXISTS (
          SELECT 1
          FROM json_each(
            CASE WHEN json_valid(k.scopes_json) THEN k.scopes_json ELSE '[]' END
          ) AS scope
          WHERE scope.value IN ('tasks:fetch', 'tasks:*', '*')
        )
      LIMIT 1
    `).bind(new Date().toISOString()).first();

    return Boolean(row);
  } catch {
    // A binding without the expected schema or a usable tenant must fail closed.
    return false;
  }
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

        if (url.pathname === "/api/v1/tasks") {
          if (request.method !== "POST") {
            return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
          }

          const auth = await authenticateRequest(request, env, { requiredScope: "tasks:fetch" });
          if (!auth.ok) {
            return json(
              { error: { code: auth.code, message: auth.message } },
              auth.httpStatus,
              auth.headers,
            );
          }

          const rate = rateLimiter.check(auth.tenantId);
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

          let quota;
          try {
            quota = await reservePlanRequest({
              db: env.EXPORTFLOW_AUTH_DB,
              identity: auth,
            });
          } catch {
            return json(
              { error: { code: "QUOTA_BACKEND_UNAVAILABLE", message: "Plan quota storage is temporarily unavailable." } },
              503,
            );
          }

          if (!quota.allowed) {
            return json(
              { error: { code: "PLAN_QUOTA_EXCEEDED", message: "The plan request allowance for this window has been exhausted." } },
              429,
              {
                "retry-after": String(quota.retryAfterSec),
                "x-plan-limit": String(quota.limit),
                "x-plan-remaining": "0",
                "x-plan-reset": quota.resetAt,
              },
            );
          }

          const task = await executeWebTask(contract, {
            fetchImpl: options.fetchImpl,
            now: options.now,
            idFactory: options.idFactory,
            signal: request.signal,
          });
          return json(task, taskHttpStatus(task), {
            "x-plan-limit": String(quota.limit),
            "x-plan-remaining": String(quota.remaining),
            "x-plan-reset": quota.resetAt,
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
          const fetchReady = authConfigured && await hasLiveFetchTenant(env);
          return json({
            name: "ExportFlow",
            positioning: "Model-agnostic agentic web infrastructure",
            lifecycle: ["discover", "retrieve", "escalate", "extract", "return"],
            executionPaths: ["http", "browser"],
            adapterCatalog: getAdapterCatalog(),
            status: "foundation",
            auth: {
              mode: "tenant-api-key",
              configured: authConfigured,
              ready: fetchReady,
            },
            endpoints: {
              health: "/api/v1/health",
              platform: "/api/v1/platform",
              routerPreview: "/api/v1/router-preview",
              tasks: "/api/v1/tasks",
            },
            liveCapabilities: fetchReady ? ["http.fetch.v1"] : [],
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
          return new Response(null, { status: 204 });
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
