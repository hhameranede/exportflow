import { normalizeResult } from "./result.js";
import { FetchAdapterError, fetchPublicResource, validatePublicHttpUrl } from "./http-fetch.js";
import { EXPORTFLOW_CRAWLER_USER_AGENT, isAllowedByRobots, parseRobotsTxt } from "./map-crawl.js";

export const BROWSER_RENDER_LIMITS = Object.freeze({
  navigationTimeoutMs: 15_000,
  maxHtmlBytes: 524_288,
  maxRequests: 30,
  maxRobotsBytes: 524_288,
  maxRobotsTimeoutMs: 5_000,
});

export class BrowserAdapterError extends Error {
  constructor(code, message, httpStatus = 502) {
    super(message);
    this.name = "BrowserAdapterError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

async function loadRobotsPolicy(url, fetchResource, signal) {
  const robotsUrl = new URL("/robots.txt", url.origin).href;
  let response;
  try {
    response = await fetchResource(robotsUrl, {
      maxBytes: BROWSER_RENDER_LIMITS.maxRobotsBytes,
      timeoutMs: BROWSER_RENDER_LIMITS.maxRobotsTimeoutMs,
      maxRedirects: 2,
      allowedOrigin: url.origin,
      userAgent: EXPORTFLOW_CRAWLER_USER_AGENT,
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (signal?.aborted || error?.code === "TASK_CANCELLED") {
      throw Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" });
    }
    throw new BrowserAdapterError("ROBOTS_UNREACHABLE", "robots.txt could not be retrieved; browser navigation was stopped.", 503);
  }

  if ([401, 403, 429].includes(response.status) || response.status >= 500) {
    throw new BrowserAdapterError("ROBOTS_UNREACHABLE", "robots.txt denied access or returned a server error; browser navigation was stopped.", 503);
  }

  const finalRobotsUrl = validatePublicHttpUrl(response.finalUrl || robotsUrl);
  if (finalRobotsUrl.origin !== url.origin) {
    throw new BrowserAdapterError("ROBOTS_REDIRECT_OUT_OF_SCOPE", "robots.txt redirected outside the requested origin.", 403);
  }

  return {
    policy: response.status >= 400 ? parseRobotsTxt("") : parseRobotsTxt(response.body, "ExportFlowBot"),
    status: response.status,
    unavailable: response.status >= 400,
  };
}

function makeRequestGate({ origin, robotsPolicy, maxRequests }) {
  let requestCount = 0;
  let blockedRequests = 0;

  const handler = async (request) => {
    let rawUrl;
    try {
      rawUrl = request.url();
      if (rawUrl === "about:blank" || rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) {
        await request.continue();
        return;
      }
      const target = validatePublicHttpUrl(rawUrl);
      if (target.origin !== origin || !isAllowedByRobots(target.href, robotsPolicy)) {
        blockedRequests++;
        await request.abort("blockedbyclient");
        return;
      }
      requestCount++;
      if (requestCount > maxRequests) {
        blockedRequests++;
        await request.abort("blockedbyclient");
        return;
      }
      await request.continue();
    } catch {
      blockedRequests++;
      try {
        await request.abort("blockedbyclient");
      } catch {
        // Browser may have already canceled or closed the request.
      }
    }
  };

  return {
    handler,
    getRequestCount: () => requestCount,
    getBlockedRequests: () => blockedRequests,
  };
}

/**
 * Creates an internal Browser Run adapter from injected Worker bindings.
 *
 * This adapter is intentionally not registered by default: the repository has
 * no Browser Run binding configured and the browser network's private-IP/DNS
 * rebinding behavior has not been independently verified for this account.
 * The caller must pass Cloudflare's Puppeteer-compatible client and BROWSER
 * binding after those deployment/configuration gates are approved.
 */
export function createBrowserAdapter({
  browserBinding,
  puppeteer,
  fetchResource = fetchPublicResource,
  now = () => new Date().toISOString(),
} = {}) {
  return Object.freeze({
    id: "web.browser.v1",
    family: "browser",
    capabilities: ["render", "same-origin-navigation"],
    authMode: "none",
    limits: {
      navigationTimeoutMs: BROWSER_RENDER_LIMITS.navigationTimeoutMs,
      maxHtmlBytes: BROWSER_RENDER_LIMITS.maxHtmlBytes,
      maxRequests: BROWSER_RENDER_LIMITS.maxRequests,
    },
    restrictions: [
      "internal-only",
      "browser-run-binding-required",
      "exact-hostname-guardrail",
      "same-origin-subrequests-only",
      "robots.txt-respected",
      "user-interactions-not-implemented",
      "dns-rebinding-runtime-verification-required",
    ],
    async execute(input = {}) {
      let target;
      try {
        target = validatePublicHttpUrl(input.url);
      } catch {
        throw new BrowserAdapterError("URL_NOT_ALLOWED", "Browser target URL is not allowed.", 400);
      }

      if (input.requiresInteraction === true) {
        throw new BrowserAdapterError("BROWSER_INTERACTION_UNAVAILABLE", "User-directed browser interactions are not implemented in this adapter.", 501);
      }
      if (!browserBinding || !puppeteer || typeof puppeteer.launch !== "function") {
        throw new BrowserAdapterError("BROWSER_UNAVAILABLE", "Browser Run binding is not configured for this Worker.", 503);
      }

      if (input.signal?.aborted) throw Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" });
      const robots = await loadRobotsPolicy(target, fetchResource, input.signal);
      if (input.signal?.aborted) throw Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" });
      if (!isAllowedByRobots(target.href, robots.policy)) {
        throw new BrowserAdapterError("ROBOTS_DISALLOWED_TARGET", "The requested page is disallowed by robots.txt.", 403);
      }

      let browser;
      let abortHandler;
      try {
        browser = await puppeteer.launch(browserBinding, {
          guardrails: { allowedDomains: [target.hostname] },
        });
        if (input.signal) {
          abortHandler = () => {
            try {
              void browser?.close()?.catch(() => {});
            } catch {
              // Abort cleanup is best-effort; preserve the task cancellation result.
            }
          };
          if (input.signal.aborted) abortHandler();
          else input.signal.addEventListener("abort", abortHandler, { once: true });
        }
        if (input.signal?.aborted) throw Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" });
        const page = await browser.newPage();
        await page.setUserAgent(EXPORTFLOW_CRAWLER_USER_AGENT);
        await page.setRequestInterception(true);

        const gate = makeRequestGate({
          origin: target.origin,
          robotsPolicy: robots.policy,
          maxRequests: BROWSER_RENDER_LIMITS.maxRequests,
        });
        page.on("request", gate.handler);

        const response = await page.goto(target.href, {
          waitUntil: "domcontentloaded",
          timeout: BROWSER_RENDER_LIMITS.navigationTimeoutMs,
        });

        const finalUrl = validatePublicHttpUrl(page.url());
        if (finalUrl.origin !== target.origin) {
          throw new BrowserAdapterError("BROWSER_REDIRECT_OUT_OF_SCOPE", "Browser navigation left the requested origin.", 403);
        }

        const html = await page.content();
        const bytes = new TextEncoder().encode(html).byteLength;
        if (bytes > BROWSER_RENDER_LIMITS.maxHtmlBytes) {
          throw new BrowserAdapterError("RESPONSE_TOO_LARGE", "Rendered HTML exceeds the configured size limit.", 413);
        }

        const title = await page.title();
        const statusCode = typeof response?.status === "function" ? response.status() : null;
        const retrievedAt = now();
        const warnings = [];
        if (robots.unavailable) warnings.push("robots.txt was unavailable; the origin's standard robots policy could not be applied.");
        if (gate.getBlockedRequests()) {
          warnings.push(String(gate.getBlockedRequests()) + " off-origin, disallowed, or over-budget browser requests were blocked.");
        }

        return normalizeResult({
          status: statusCode !== null && (statusCode < 200 || statusCode >= 400) ? "failed" : "succeeded",
          data: {
            title,
            html,
            url: finalUrl.href,
            httpStatus: statusCode,
            bytes,
            requestCount: gate.getRequestCount(),
            blockedRequests: gate.getBlockedRequests(),
          },
          sources: [{
            url: finalUrl.href,
            retrievedAt,
            title: title || null,
            evidence: [{
              type: "browser_rendered_page",
              status: statusCode,
              bytes,
              browser: "cloudflare-browser-run",
              guardrailHost: target.hostname,
            }],
          }],
          warnings,
        });
      } catch (error) {
        if (input.signal?.aborted || error?.code === "TASK_CANCELLED") {
          throw Object.assign(new Error("Task was cancelled."), { code: "TASK_CANCELLED" });
        }
        if (error instanceof BrowserAdapterError) throw error;
        if (error instanceof FetchAdapterError) {
          throw new BrowserAdapterError(error.code, "Browser navigation failed its URL policy.", error.httpStatus);
        }
        throw new BrowserAdapterError("BROWSER_RENDER_FAILED", "Browser rendering failed or exceeded its execution budget.", 502);
      } finally {
        if (abortHandler && input.signal) input.signal.removeEventListener("abort", abortHandler);
        try {
          await browser?.close();
        } catch {
          // Preserve the original result or error if the session is already closed.
        }
      }
    },
  });
}
