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
  UNSUPPORTED_CHARSET: 415,
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

async function hasTaskExecutionSchema(env) {
  const db = env?.EXPORTFLOW_AUTH_DB;
  if (typeof db?.prepare !== "function") return false;

  const requiredTriggers = [
    "guard_task_quota_capacity_before_insert",
    "reserve_quota_for_new_task",
    "guard_task_state_transitions",
    "record_task_state_transitions",
    "guard_task_identity_immutable",
    "guard_task_events_immutable",
  ];

  try {
    await db.prepare(
      "SELECT task_id, tenant_id, idempotency_key_hash, request_hash, operation, state, " +
      "quota_period, quota_window_id, plan_code, policy_version, quota_limit, quota_used, " +
      "quota_remaining, quota_reset_at, created_at, updated_at, started_at, completed_at, " +
      "lease_expires_at, expires_at, attempt_count, revision, response_json, result_available, " +
      "error_code, usage_json, execution_json FROM tasks LIMIT 0",
    ).first();
    await db.prepare(
      "SELECT event_id, task_id, tenant_id, revision, event_type, occurred_at, details_json " +
      "FROM task_events LIMIT 0",
    ).first();
    const triggerRows = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name IN (" +
      "'guard_task_quota_capacity_before_insert', 'reserve_quota_for_new_task', " +
      "'guard_task_state_transitions', 'record_task_state_transitions', " +
      "'guard_task_identity_immutable', 'guard_task_events_immutable')",
    ).all();
    const available = new Set((triggerRows?.results || []).map((row) => row.name));
    return requiredTriggers.every((name) => available.has(name));
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

const ACCEPTANCE_NETWORK_PROBE_TARGETS = Object.freeze([
  { host: "example.com", url: "https://example.com/", marker: "Example Domain" },
  { host: "iana.org", url: "https://www.iana.org/domains/reserved", marker: "IANA" },
  { host: "cloudflare.com", url: "https://www.cloudflare.com/robots.txt", marker: "User-agent: *" },
]);

function safeDiagnosticField(value, maxLength = 240) {
  if (typeof value !== "string") return null;
  return value.replace(/[\r\n\t]/g, " ").slice(0, maxLength);
}

async function readProbeSample(response) {
  const reader = response.body?.getReader();
  if (!reader) return { bytesRead: 0, sample: "" };
  try {
    const { value } = await reader.read();
    const bytes = value ? value.subarray(0, 4096) : new Uint8Array();
    return { bytesRead: bytes.byteLength, sample: new TextDecoder().decode(bytes) };
  } finally {
    try {
      const cancellation = reader.cancel();
      if (cancellation && typeof cancellation.catch === "function") void cancellation.catch(() => {});
    } catch {
      // Diagnostic cleanup is best-effort.
    }
  }
}

async function runAcceptanceNetworkProbe(fetchImpl = globalThis.fetch) {
  const results = [];
  if (typeof fetchImpl !== "function") {
    return { status: "unavailable", probes: [], reason: "fetch is not available in this Worker runtime." };
  }

  for (const target of ACCEPTANCE_NETWORK_PROBE_TARGETS) {
    for (const mode of ["default", "bypass"]) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      const init = {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml,application/json,application/xml,text/plain;q=0.9",
        },
        ...(mode === "bypass" ? { cache: "no-store" } : {}),
      };
      try {
        const response = await fetchImpl(target.url, init);
        const sample = await readProbeSample(response);
        results.push({
          host: target.host,
          mode,
          ok: response.status === 200 && sample.sample.includes(target.marker),
          status: response.status,
          contentType: safeDiagnosticField(response.headers.get("content-type"), 120),
          server: safeDiagnosticField(response.headers.get("server"), 80),
          cfRay: safeDiagnosticField(response.headers.get("cf-ray"), 100),
          cfCacheStatus: safeDiagnosticField(response.headers.get("cf-cache-status"), 40),
          bytesRead: sample.bytesRead,
          expectedMarkerFound: sample.sample.includes(target.marker),
        });
      } catch (error) {
        const cause = error?.cause;
        results.push({
          host: target.host,
          mode,
          ok: false,
          error: {
            name: safeDiagnosticField(error?.name, 80) || "Error",
            message: safeDiagnosticField(error?.message, 300) || "Worker fetch failed.",
            code: safeDiagnosticField(typeof error?.code === "string" ? error.code : null, 80),
            causeName: safeDiagnosticField(cause?.name, 80),
            causeMessage: safeDiagnosticField(cause?.message, 300),
            causeCode: safeDiagnosticField(typeof cause?.code === "string" ? cause.code : null, 80),
          },
        });
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  return {
    status: results.some((item) => item.ok) ? "reachable" : "unreachable",
    probes: results,
  };
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

        if (options.acceptanceNetworkProbe === true &&
            env?.EXPORTFLOW_ACCEPTANCE_RUN === "durable-task-20261124" &&
            url.pathname === "/__acceptance/network-probe") {
          if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
          const auth = await tenantTaskGateway.authenticate(request, env, { requiredScope: "tasks:fetch" });
          if (!auth.ok) {
            return json({ error: { code: auth.code, message: auth.message } }, auth.httpStatus);
          }
          const diagnostics = await runAcceptanceNetworkProbe(options.acceptanceFetch);
          return json({
            status: diagnostics.status,
            probes: diagnostics.probes,
            ...(diagnostics.reason ? { reason: diagnostics.reason } : {}),
          }, 200, { "cache-control": "no-store" });
        }

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
            executeOptions: { fetchImpl: options.fetchImpl, now: options.now },
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
          let taskStoreReady = false;
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
            taskStoreReady = authReady && await hasTaskExecutionSchema(env);
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
            taskStore: {
              ready: taskStoreReady,
            },
            endpoints: {
              health: "/api/v1/health",
              platform: "/api/v1/platform",
              routerPreview: "/api/v1/router-preview",
              tasks: "/api/v1/tasks",
            },
            liveCapabilities: taskStoreReady ? [
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
