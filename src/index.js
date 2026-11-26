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


const ACCEPTANCE_DNS_REBINDING_PRIVATE_IPS = new Set([
  "127.0.0.1",
  "0.0.0.0",
  "10.0.0.1",
]);

function parseIpv4Octets(value) {
  if (typeof value !== "string") return null;
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^(0|[1-9]\d{0,2})$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function isPublicRoutableIpv4(value) {
  const octets = parseIpv4Octets(value);
  if (!octets) return false;
  const [a, b, c] = octets;
  if (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 2 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  ) return false;
  return true;
}

async function cancelProbeResponseBody(response) {
  if (!response?.body) return;
  try {
    await response.body.cancel();
  } catch {
    // HEAD responses normally have no body; cancellation is best-effort.
  }
}

function createDnsRebindingHostname(publicIp, privateIp, sessionId) {
  return "make-" + publicIp + "-rebindfor2mafter1times-" + privateIp + "-rr-" + sessionId + ".1u.ms";
}

async function runAcceptanceDnsRebindingProbe(publicIp, privateIp, sessionId, fetchImpl = globalThis.fetch, probeIntervalMs = 1_100) {
  if (typeof fetchImpl !== "function" ||
      !isPublicRoutableIpv4(publicIp) ||
      !ACCEPTANCE_DNS_REBINDING_PRIVATE_IPS.has(privateIp) ||
      typeof sessionId !== "string" ||
      !/^[a-z0-9-]{8,48}$/.test(sessionId)) {
    return { status: "invalid_target", publicIp, privateIp, sessionId, probes: [] };
  }

  // 1u.ms returns the public IP once, then the private test target while
  // requests continue within the configured two-minute rebinding window.
  const hostname = createDnsRebindingHostname(publicIp, privateIp, sessionId);
  const requestInit = {
    method: "HEAD",
    redirect: "manual",
    cache: "no-store",
    headers: {
      accept: "*/*",
      // Identify this controlled request instead of relying on a generic Worker UA.
      "user-agent": "ExportFlow-Acceptance/1.0 (+https://exportflow.me)",
    },
  };

  const fingerprint = (response) => ({
    status: response.status,
    server: safeDiagnosticField(response.headers.get("server"), 80),
    contentType: safeDiagnosticField(response.headers.get("content-type"), 120),
    contentLength: safeDiagnosticField(response.headers.get("content-length"), 40),
    etag: safeDiagnosticField(response.headers.get("etag"), 120),
    cfErrorType: safeDiagnosticField(response.headers.get("cf-error-type"), 120),
    cfErrorOrigin: safeDiagnosticField(response.headers.get("cf-error-origin"), 120),
    cfRay: safeDiagnosticField(response.headers.get("cf-ray"), 120),
    cfCacheStatus: safeDiagnosticField(response.headers.get("cf-cache-status"), 80),
    serverTiming: safeDiagnosticField(response.headers.get("server-timing"), 180),
  });

  let baseline;
  const baselineController = new AbortController();
  const baselineTimeout = setTimeout(() => baselineController.abort(), 8_000);
  try {
    // The first lookup for this unique hostname must reach the public control
    // origin. Every subsequent lookup during the rebinding window targets the
    // fixed private address. No private response body is read.
    const response = await fetchImpl(
      "http://" + hostname + "/?exportflow_acceptance_control=1",
      { ...requestInit, signal: baselineController.signal },
    );
    baseline = fingerprint(response);
    await cancelProbeResponseBody(response);
  } catch (error) {
    return {
      status: "inconclusive",
      hostname,
      sessionId,
      publicIp,
      privateIp,
      reason: safeDiagnosticField(error?.message, 240) || "The first public DNS-rebinding response did not return an HTTP response.",
      probes: [],
    };
  } finally {
    clearTimeout(baselineTimeout);
  }

  if (baseline.status < 200 || baseline.status >= 500 ||
      !baseline.server ||
      baseline.server.toLowerCase() === "cloudflare") {
    return {
      status: "inconclusive",
      hostname,
      sessionId,
      publicIp,
      privateIp,
      baseline,
      reason: baseline.server?.toLowerCase() === "cloudflare"
        ? "The first public DNS-rebinding response came from the Cloudflare edge, not the direct public control origin."
        : "The first public DNS-rebinding response must be an HTTP response with a non-empty non-Cloudflare server header.",
      probes: [],
    };
  }

  const probes = [];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetchImpl(
        "http://" + hostname + "/?exportflow_acceptance_probe=" + attempt,
        { ...requestInit, signal: controller.signal },
      );
      const observed = fingerprint(response);
      const matchesPublicControl =
        observed.status === baseline.status &&
        observed.server === baseline.server &&
        observed.contentType === baseline.contentType &&
        observed.contentLength === baseline.contentLength &&
        observed.etag === baseline.etag;
      probes.push({
        attempt: attempt + 1,
        outcome: matchesPublicControl ? "public_control_match" : "unexpected_http_response",
        ...observed,
      });
      await cancelProbeResponseBody(response);
    } catch (error) {
      probes.push({
        attempt: attempt + 1,
        outcome: "network_error",
        error: {
          name: safeDiagnosticField(error?.name, 80) || "Error",
          message: safeDiagnosticField(error?.message, 240) || "Worker HEAD request failed.",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
    // 1u.ms uses zero-TTL answers. Keep consecutive probes inside its
    // rebinding window so DNS is re-resolved to the private test target.
    if (attempt < 11 && probeIntervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, probeIntervalMs));
    }
  }

  const probePublicResponses = probes.filter((probe) => probe.outcome === "public_control_match").length;
  const baselinePublicResponses = 1;
  const publicResponses = baselinePublicResponses + probePublicResponses;
  const networkErrors = probes.filter((probe) => probe.outcome === "network_error").length;
  const unexpectedResponses = probes.filter((probe) => probe.outcome === "unexpected_http_response").length;
  const status = unexpectedResponses > 0
    ? "unexpected_http_response"
    : publicResponses > 0 && networkErrors > 0
      ? "mixed"
      : "inconclusive";

  return {
    status,
    hostname,
    sessionId,
    publicIp,
    privateIp,
    baseline,
    baselinePublicResponses,
    attempts: probes.length,
    publicResponses,
    probePublicResponses,
    networkErrors,
    unexpectedResponses,
    probes,
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

        if (options.acceptanceDnsRebindingProbe === true &&
            env?.EXPORTFLOW_ACCEPTANCE_RUN === "durable-task-20261124" &&
            url.pathname === "/__acceptance/dns-rebinding-probe") {
          if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
          const auth = await tenantTaskGateway.authenticate(request, env, { requiredScope: "tasks:fetch" });
          if (!auth.ok) {
            return json({ error: { code: auth.code, message: auth.message } }, auth.httpStatus);
          }
          const publicIp = url.searchParams.get("public");
          const privateIp = url.searchParams.get("private");
          const sessionId = url.searchParams.get("session");
          if (!isPublicRoutableIpv4(publicIp) || !ACCEPTANCE_DNS_REBINDING_PRIVATE_IPS.has(privateIp)) {
            return json({ error: { code: "INVALID_DNS_REBINDING_TARGET", message: "A public origin IP and one of the fixed private test targets are required." } }, 400);
          }
          if (typeof sessionId !== "string" || !/^[a-z0-9-]{8,48}$/.test(sessionId)) {
            return json({ error: { code: "INVALID_DNS_REBINDING_SESSION", message: "A unique lowercase alphanumeric DNS-rebinding session identifier is required." } }, 400);
          }
          const diagnostics = await runAcceptanceDnsRebindingProbe(
            publicIp,
            privateIp,
            sessionId,
            options.acceptanceDnsRebindingFetch,
            options.acceptanceDnsRebindingProbeIntervalMs ?? 1_100,
          );
          return json(diagnostics, 200, { "cache-control": "no-store" });
        }

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
