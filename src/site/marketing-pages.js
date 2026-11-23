import {
  CAPABILITIES,
  DEMO_PRESETS,
  DEVELOPER_ERROR_CODES,
  PLATFORM_LAYERS,
  USE_CASES,
  VALUE_PILLARS,
} from "./data.js";
import { renderFeatureIcon, renderSectionGlyph } from "./icons.js";

function pageHero({ eyebrow, title, description, badgeHtml = "", actionsHtml = "", glyph = "" }) {
  return `<section class="ef-page-hero">
    <div class="ef-container">
      <p class="ef-kicker">${eyebrow}</p>
      ${glyph ? `<div class="ef-section-title-row">${renderSectionGlyph(glyph)}<h1>${title}</h1></div>` : `<h1>${title}</h1>`}
      <p class="ef-page-lead">${description}</p>
      ${badgeHtml ? `<div class="ef-hero-meta ef-mt-20">${badgeHtml}</div>` : ""}
      ${actionsHtml ? `<div class="ef-hero-actions ef-mt-28">${actionsHtml}</div>` : ""}
    </div>
  </section>`;
}

function copyButtonHtml(copyId, label = "Copy") {
  return `<button type="button" class="ef-code-btn" data-copy-source="${copyId}" aria-label="${label}">
    <svg data-icon-copy class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    <svg data-icon-check class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><polyline points="20 6 9 17 4 12"/></svg>
    <span data-copy-label>${label}</span>
  </button>`;
}

function authGateWrap({ locale, hrefFor, escapeHtml, nextPath, titleEn, titleAr, descEn, descAr, innerHtml }) {
  const isAr = locale === "ar";
  const title = isAr ? titleAr : titleEn;
  const desc = isAr ? descAr : descEn;
  const signInLabel = isAr ? "تسجيل الدخول للمتابعة" : "Sign in to continue";
  const signUpLabel = isAr ? "إنشاء حساب" : "Create account";
  const signinHref = `${hrefFor("/signin", locale)}?next=${encodeURIComponent(hrefFor(nextPath, locale))}`;
  const signupHref = `${hrefFor("/signup", locale)}?next=${encodeURIComponent(hrefFor(nextPath, locale))}`;

  return `<div class="ef-auth-gate-shell" data-requires-auth="true" data-auth-locked="true">
    <div class="ef-auth-gate" data-auth-gate hidden role="region" aria-label="${escapeHtml(title)}">
      <div class="ef-auth-gate-card">
        <div class="ef-auth-gate-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="11" width="16" height="9" rx="2"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
          </svg>
        </div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(desc)}</p>
        <div class="ef-hero-actions">
          <a class="ef-btn ef-btn-primary ef-btn-sm" href="${escapeHtml(signinHref)}">${escapeHtml(signInLabel)}</a>
          <a class="ef-btn ef-btn-secondary ef-btn-sm" href="${escapeHtml(signupHref)}">${escapeHtml(signUpLabel)}</a>
        </div>
      </div>
    </div>
    <div class="ef-auth-gate-content" data-auth-gate-content>
      ${innerHtml}
    </div>
  </div>`;
}

export function renderUnifiedPlatformPage({ t, locale, hrefFor, escapeHtml, arrowRightIcon, arrowUpRightIcon, statusBadgeHtml }) {
  const pillarIcons = ["controlled", "transparent", "provenance", "resource-limits"];
  return `${pageHero({
    eyebrow: "Platform",
    title: "Seven-Layer Agent Execution Architecture",
    description: "Explore how ExportFlow separates agent intent from bounded HTTP retrieval, policy verification, deterministic routing, and verifiable source evidence.",
    badgeHtml: `${statusBadgeHtml("available", { available: `${t.available} · Core & REST` })} <span aria-hidden="true">·</span> ${statusBadgeHtml("development", t)}`,
    glyph: "architecture",
    actionsHtml: `
      <a class="ef-btn ef-btn-primary" href="${hrefFor("/demo", locale)}">
        <span>Inspect in interactive preview</span>
      </a>
      <a class="ef-text-link" href="${hrefFor("/developers", locale)}">
        <span>${escapeHtml(t.exploreDocs)}</span>
        ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
      </a>
    `,
  })}

  <section class="ef-section ef-section-tinted" aria-labelledby="layers-heading">
    <div class="ef-container">
      <div class="ef-section-head">
        <p class="ef-kicker">Architecture Explorer</p>
        <h2 id="layers-heading" class="ef-section-title">Inspect each execution boundary</h2>
        <p class="ef-section-lead">Select a layer to inspect its runtime maturity, module responsibility, and enforced fail-closed guardrails.</p>
      </div>

      ${authGateWrap({
        locale,
        hrefFor,
        escapeHtml,
        nextPath: "/platform",
        titleEn: "Sign in to explore platform layers",
        titleAr: "سجّل الدخول لاستكشاف طبقات المنصة",
        descEn: "Interactive architecture inspection requires an active ExportFlow account.",
        descAr: "يتطلب استعراض البنية التفاعلية حساباً نشطاً في ExportFlow.",
        innerHtml: `<div class="ef-layer-explorer" data-tab-group="platform-layers">
        <div class="ef-layer-tabs" role="tablist" aria-label="ExportFlow platform layers">
          ${PLATFORM_LAYERS.map((layer, index) => `<button
            type="button"
            class="ef-layer-tab"
            role="tab"
            id="tab-layer-${escapeHtml(layer.id)}"
            aria-controls="panel-layer-${escapeHtml(layer.id)}"
            aria-selected="${index === 0 ? "true" : "false"}"
            tabindex="${index === 0 ? "0" : "-1"}"
            data-tab-trigger="${escapeHtml(layer.id)}"
          >
            <span class="ef-layer-tab-step">${escapeHtml(layer.step)}</span>
            <strong>${escapeHtml(layer.name)}</strong>
          </button>`).join("")}
        </div>

        <div class="ef-layer-panels">
          ${PLATFORM_LAYERS.map((layer, index) => `<article
            class="ef-layer-panel"
            role="tabpanel"
            id="panel-layer-${escapeHtml(layer.id)}"
            aria-labelledby="tab-layer-${escapeHtml(layer.id)}"
            data-tab-panel="${escapeHtml(layer.id)}"
            ${index === 0 ? "" : "hidden"}
          >
            <div class="ef-layer-panel-head">
              <div>
                <p class="ef-kicker">${escapeHtml(layer.step)}</p>
                <h3>${escapeHtml(layer.name)}</h3>
              </div>
              <span class="ef-badge ${layer.maturity.includes("Local Runtime Verified") ? "ef-badge-available" : "ef-badge-dev"}">
                <span>${escapeHtml(layer.maturity)}</span>
              </span>
            </div>
            <dl class="ef-layer-dl">
              <div>
                <dt>Primary Responsibility</dt>
                <dd>${escapeHtml(layer.responsibility)}</dd>
              </div>
              <div>
                <dt>Verified Implementation in Core</dt>
                <dd>${escapeHtml(layer.howItWorks)}</dd>
              </div>
              <div>
                <dt>Enforced Guardrails</dt>
                <dd>${escapeHtml(layer.controls)}</dd>
              </div>
            </dl>
          </article>`).join("")}
        </div>
      </div>`,
      })}
    </div>
  </section>

  <section class="ef-section" aria-labelledby="pillars-heading">
    <div class="ef-container">
      <div class="ef-section-head">
        <p class="ef-kicker">Design Guarantees</p>
        <h2 id="pillars-heading" class="ef-section-title">Why agent infrastructure separates reasoning from transport</h2>
      </div>
      <div class="ef-sub-grid ef-pillars-grid">
        ${VALUE_PILLARS.map((pillar, idx) => `<article class="ef-info-card">
          <div class="ef-pillar-head">
            ${renderFeatureIcon(pillarIcons[idx] || "controlled")}
            <div>
              <p class="ef-kicker">${escapeHtml(pillar.number)}</p>
              <h3>${escapeHtml(pillar.title)}</h3>
            </div>
          </div>
          <p>${escapeHtml(pillar.description)}</p>
        </article>`).join("")}
      </div>
    </div>
  </section>`;
}

export function renderUnifiedUseCasesPage({ t, locale, hrefFor, escapeHtml, arrowRightIcon }) {
  const ucIconMap = {
    "public-search": "uc-search",
    "structured-extraction": "uc-extract",
    "deep-research": "uc-research",
    "site-mapping": "uc-map",
    "browser-escalation": "uc-browser",
  };
  return `${pageHero({
    eyebrow: "Use Cases",
    title: "Structured Workflows, Grounded in Evidence",
    description: "How AI agents delegate bounded web discovery, schema extraction, and guarded execution while preserving source provenance and explicit failure states.",
    glyph: "workflow",
    actionsHtml: `
      <a class="ef-btn ef-btn-primary" href="${hrefFor("/demo", locale)}">
        <span>Run interactive simulation</span>
      </a>
      <a class="ef-text-link" href="${hrefFor("/platform", locale)}">
        <span>${escapeHtml(t.explore)}</span>
        ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
      </a>
    `,
  })}

  <section class="ef-section ef-section-tinted" aria-labelledby="uc-heading">
    <div class="ef-container">
      <div class="ef-section-head">
        <p class="ef-kicker">Workflow Blueprints</p>
        <h2 id="uc-heading" class="ef-section-title">Execution patterns across Core adapters</h2>
        <p class="ef-section-lead">Each blueprint separates what is verified in local HTTP Fetch today from internal prototypes and planned escalation paths.</p>
      </div>

      ${authGateWrap({
        locale,
        hrefFor,
        escapeHtml,
        nextPath: "/use-cases",
        titleEn: "Sign in to access workflow blueprints",
        titleAr: "سجّل الدخول للوصول إلى نماذج سير العمل",
        descEn: "Sign in or create an account to inspect and copy agent workflow JSON contracts.",
        descAr: "سجّل الدخول أو أنشئ حساباً لاستعراض ونسخ عقود JSON لسير عمل الوكلاء.",
        innerHtml: `<div class="ef-uc-stack">
        ${USE_CASES.map((uc, index) => {
          const jsonStr = JSON.stringify(uc.sampleJson, null, 2);
          const badgeClass = uc.maturityKey === "prototype" ? "ef-badge-dev" : "ef-badge-planned";
          const codeId = `uc-json-${index}`;
          return `<article class="ef-uc-card" id="uc-${escapeHtml(uc.id)}">
            <div class="ef-uc-head">
              <div class="ef-uc-title-row">
                ${renderFeatureIcon(ucIconMap[uc.id] || "uc-search")}
                <div>
                  <h3>${escapeHtml(uc.title)}</h3>
                  <p class="ef-uc-summary">${escapeHtml(uc.summary)}</p>
                </div>
              </div>
              <span class="ef-badge ${badgeClass}"><span>${escapeHtml(uc.maturity)}</span></span>
            </div>

            <div class="ef-uc-grid">
              <div class="ef-uc-breakdown">
                <div class="ef-uc-block">
                  <span class="ef-uc-label">Failure Mode Solved</span>
                  <p>${escapeHtml(uc.problem)}</p>
                </div>
                <div class="ef-uc-block">
                  <span class="ef-uc-label">AI Agent Responsibility</span>
                  <p>${escapeHtml(uc.agentRole)}</p>
                </div>
                <div class="ef-uc-block">
                  <span class="ef-uc-label">ExportFlow Execution Boundary</span>
                  <p>${escapeHtml(uc.exportflowRole)}</p>
                </div>
              </div>

              <div class="ef-code-card ef-uc-code">
                <div class="ef-code-head">
                  <span class="ef-code-caption">Illustrative envelope</span>
                  ${copyButtonHtml(codeId, "Copy JSON")}
                </div>
                <pre class="ef-code-pre ef-code-pre-compact"><code id="${codeId}">${escapeHtml(jsonStr)}</code></pre>
              </div>
            </div>
          </article>`;
        }).join("")}
      </div>`,
      })}
    </div>
  </section>`;
}

export function renderUnifiedDevelopersPage({ t, locale, hrefFor, escapeHtml, arrowRightIcon, arrowUpRightIcon, statusBadgeHtml }) {
  const sampleRequest = JSON.stringify({
    goal: "Fetch official documentation header and verify final URL",
    url: "https://example.com/docs",
    operation: "fetch",
    requiresJavascript: false,
    requiresInteraction: false,
    limits: {
      timeoutMs: 5000,
      maxBytes: 262144,
      maxRedirects: 3,
    },
  }, null, 2);

  const sampleResponse = JSON.stringify({
    id: "7a1d84e2-3c1a-4b20-9f10-81c92a405110",
    goal: "Fetch official documentation header and verify final URL",
    requestedUrl: "https://example.com/docs",
    state: "succeeded",
    execution: {
      path: "http",
      operation: "fetch",
      adapterId: "http.fetch.v1",
      reason: "Static retrieval runs directly on bounded HTTP Fetch.",
    },
    timestamps: {
      createdAt: "2026-11-23T09:00:00.000Z",
      startedAt: "2026-11-23T09:00:00.002Z",
      completedAt: "2026-11-23T09:00:00.145Z",
    },
    usage: { durationMs: 143, requestsAttempted: 1, responseBytes: 1256, cost: null },
    errors: [],
    result: {
      status: "succeeded",
      data: {
        httpStatus: 200,
        contentType: "text/html; charset=utf-8",
        finalUrl: "https://example.com/docs",
        redirects: [],
      },
      sources: [{
        url: "https://example.com/docs",
        retrievedAt: "2026-11-23T09:00:00.145Z",
        evidence: [{ type: "http_response", status: 200, contentType: "text/html; charset=utf-8", bytes: 1256, redirectCount: 0 }],
      }],
      warnings: [],
    },
  }, null, 2);

  const localCommands = [
    "# Verify syntax and module loading",
    "npm run check",
    "",
    "# Run full automated test suite (Node test runner)",
    "npm test",
    "",
    "# Start local Node.js site & auth preview server (port 3000)",
    "npm run dev",
    "",
    "# Query live health and platform discovery endpoints locally",
    "curl -s http://127.0.0.1:3000/api/v1/platform",
    "curl -s \"http://127.0.0.1:3000/api/v1/router-preview?javascript=true\"",
  ].join("\n");

  return `${pageHero({
    eyebrow: "Developer Center",
    title: "Contract-First Execution Reference",
    description: "Inspect the Phase 1 Task Contract, fail-closed D1 tenant authentication, Durable Object burst guards, normalized source provenance, and error recovery table.",
    badgeHtml: `${statusBadgeHtml("available", { available: `${t.available} · HTTP Fetch` })} <span aria-hidden="true">·</span> ${statusBadgeHtml("development", t)}`,
    glyph: "developers",
    actionsHtml: `
      <a class="ef-btn ef-btn-primary" href="${hrefFor("/demo", locale)}">
        <span>Open interactive preview</span>
      </a>
      <a class="ef-text-link" href="${hrefFor("/platform", locale)}">
        <span>Architecture layers</span>
        ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}
      </a>
    `,
  })}

  <section class="ef-section" aria-labelledby="dev-spec-heading">
    <div class="ef-container">
      ${authGateWrap({
        locale,
        hrefFor,
        escapeHtml,
        nextPath: "/developers",
        titleEn: "Sign in to access developer specifications",
        titleAr: "سجّل الدخول للوصول إلى مرجع المطورين",
        descEn: "Sign in to read the full Task Contract tables, copy JSON payloads, and view error codes.",
        descAr: "سجّل الدخول لقراءة مواصفات العقود الكاملة ونسخ نماذج JSON وأكواد الأخطاء.",
        innerHtml: `<div class="ef-dev-doc-layout">
      <aside class="ef-doc-toc" aria-label="Documentation sections">
        <h2>On this page</h2>
        <nav>
          <a href="#dev-auth">1. Auth, Quotas &amp; Burst Limits</a>
          <a href="#dev-contract">2. Task Request Contract</a>
          <a href="#dev-routing">3. Deterministic Routing</a>
          <a href="#dev-response">4. Result &amp; Provenance</a>
          <a href="#dev-discovery">5. Discovery Endpoints</a>
          <a href="#dev-errors">6. Error Reference</a>
          <a href="#dev-local">7. Local Verification</a>
        </nav>
      </aside>

      <div class="ef-doc-body">
        <div class="ef-status-banner">
          ${statusBadgeHtml("available", t)}
          <span>Phase 1 enables bounded <code>http.fetch.v1</code> via <code>POST /api/v1/tasks</code> when D1 and Durable Object bindings are present. Crawl, Extract, Search, Research, and Browser return <code>501</code> until enabled.</span>
        </div>

        <section id="dev-auth" class="ef-doc-section">
          <h2 id="dev-spec-heading">1. Authentication, Tenant Quotas &amp; Burst Limits</h2>
          <p>Task execution in <code>src/core/tenant-task-gateway.js</code> enforces a fail-closed multi-stage gate before any outbound HTTP allocation begins:</p>
          <ul class="ef-spec-list">
            <li><strong>Pre-auth IP rate guard:</strong> Evaluates the connecting client IP before credential hashing.</li>
            <li><strong>Tenant credential verification:</strong> Accepts D1-backed tenant API keys (<code>Authorization: Bearer ef_live_&lt;keyId&gt;_&lt;secret&gt;</code>, verified via SHA-256 constant-time digest) or verified OAuth 2.0 / MCP tenant access claims requiring <code>tasks:fetch</code> scope.</li>
            <li><strong>Shared Durable Object burst limiter:</strong> <code>TenantBurstRateLimiter</code> serializes burst windows across REST and MCP Worker instances.</li>
            <li><strong>Atomic D1 UTC plan quota:</strong> Reserves quota in <code>tenant_request_usage</code> and emits <code>x-plan-limit</code>, <code>x-plan-remaining</code>, and <code>x-plan-reset</code> headers. Missing D1 or DO bindings fail closed with HTTP <code>503</code>.</li>
          </ul>
        </section>

        <section id="dev-contract" class="ef-doc-section">
          <h2>2. Task Request Contract (<code>POST /api/v1/tasks</code>)</h2>
          <p><code>readBoundedJsonBody()</code> rejects non-JSON media types (<code>415</code>) and bodies exceeding <code>32,768</code> bytes (<code>413</code>). <code>validateTaskRequest()</code> enforces a strict top-level key allowlist.</p>
          <div class="ef-table-wrap">
            <table class="ef-spec-table">
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Type &amp; Bounds</th>
                  <th scope="col">Behavior</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>goal</code></td>
                  <td>Non-empty string, 1–2,000 chars</td>
                  <td>Required intent description echoed on task envelope.</td>
                </tr>
                <tr>
                  <td><code>url</code></td>
                  <td>Public HTTP/HTTPS DNS URL</td>
                  <td>Checked by <code>egress-guard.js</code>; IP literals, localhost, private suffixes, credentials, and non-default ports return <code>400 URL_NOT_ALLOWED</code>.</td>
                </tr>
                <tr>
                  <td><code>operation</code></td>
                  <td><code>"fetch"</code> (default)</td>
                  <td>Other operations (<code>map</code>, <code>crawl</code>, <code>extract</code>, <code>search</code>, <code>research</code>) return <code>501 OPERATION_NOT_ENABLED</code> on Phase 1 REST.</td>
                </tr>
                <tr>
                  <td><code>requiresJavascript</code> / <code>requiresInteraction</code></td>
                  <td>Boolean (default <code>false</code>)</td>
                  <td>Routes to <code>browser</code> path and fails closed with <code>501 BROWSER_UNAVAILABLE</code> until a verified browser binding is configured.</td>
                </tr>
                <tr>
                  <td><code>limits</code></td>
                  <td><code>timeoutMs</code> (100–8000), <code>maxBytes</code> (1–1048576), <code>maxRedirects</code> (0–3)</td>
                  <td>Per-task resource ceiling enforced during streaming download and manual redirect hops.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="ef-code-card ef-mt-20">
            <div class="ef-code-head">
              <span class="ef-code-caption">POST /api/v1/tasks · Request</span>
              ${copyButtonHtml("dev-req-json", "Copy request JSON")}
            </div>
            <pre class="ef-code-pre ef-code-pre-compact"><code id="dev-req-json">${escapeHtml(sampleRequest)}</code></pre>
          </div>
        </section>

        <section id="dev-routing" class="ef-doc-section">
          <h2>3. Deterministic Routing</h2>
          <p><code>chooseExecutionPath()</code> in <code>src/core/router.js</code> evaluates <code>requiresJavascript</code> and <code>requiresInteraction</code> flags before adapter invocation so lightweight HTTP retrieval never incurs headless browser overhead unless explicitly required.</p>
        </section>

        <section id="dev-response" class="ef-doc-section">
          <h2>4. Normalized Result &amp; Provenance Envelope</h2>
          <p>All outcomes—whether <code>succeeded</code>, <code>partial</code>, <code>failed</code>, <code>cancelled</code>, or <code>unsupported</code>—return one predictable JSON structure with sanitized error codes and verifiable <code>sources[].evidence</code>.</p>
          <div class="ef-code-card ef-mt-20">
            <div class="ef-code-head">
              <span class="ef-code-caption">HTTP 200 · Response envelope</span>
              ${copyButtonHtml("dev-res-json", "Copy response JSON")}
            </div>
            <pre class="ef-code-pre ef-code-pre-compact"><code id="dev-res-json">${escapeHtml(sampleResponse)}</code></pre>
          </div>
        </section>

        <section id="dev-discovery" class="ef-doc-section">
          <h2>5. Unauthenticated &amp; Auth Discovery Endpoints</h2>
          <div class="ef-table-wrap">
            <table class="ef-spec-table">
              <thead>
                <tr>
                  <th scope="col">Endpoint</th>
                  <th scope="col">Method</th>
                  <th scope="col">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>/api/v1/health</code></td>
                  <td><code>GET</code></td>
                  <td>Liveness metadata (service name, runtime, stage).</td>
                </tr>
                <tr>
                  <td><code>/api/v1/platform</code></td>
                  <td><code>GET</code></td>
                  <td>Adapter catalog, lifecycle stages, and auth readiness indicator.</td>
                </tr>
                <tr>
                  <td><code>/api/v1/router-preview</code></td>
                  <td><code>GET</code></td>
                  <td>Pure routing preview for <code>?javascript=true&amp;interaction=true</code> flags.</td>
                </tr>
                <tr>
                  <td><code>/api/auth/*</code></td>
                  <td><code>GET/POST</code></td>
                  <td>Better Auth session, Google OAuth, TOTP 2FA, and OAuth/MCP consent routes (requires <code>AUTH_DB</code>).</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="dev-errors" class="ef-doc-section">
          <h2>6. Error Code &amp; Recovery Reference</h2>
          <div class="ef-table-wrap">
            <table class="ef-spec-table">
              <thead>
                <tr>
                  <th scope="col">Error Code</th>
                  <th scope="col">HTTP</th>
                  <th scope="col">Cause</th>
                  <th scope="col">Recovery</th>
                </tr>
              </thead>
              <tbody>
                ${DEVELOPER_ERROR_CODES.map((row) => `<tr>
                  <td><code>${escapeHtml(row.code)}</code></td>
                  <td><code>${escapeHtml(String(row.status))}</code></td>
                  <td>${escapeHtml(row.cause)}</td>
                  <td>${escapeHtml(row.recovery)}</td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </section>

        <section id="dev-local" class="ef-doc-section">
          <h2>7. Local Verification &amp; CLI Workflow</h2>
          <p>Run automated verification and inspect local routes directly from the repository root without external secrets:</p>
          <div class="ef-code-card ef-mt-20">
            <div class="ef-code-head">
              <span class="ef-code-caption">Local workspace commands</span>
              ${copyButtonHtml("dev-cli-cmds", "Copy commands")}
            </div>
            <pre class="ef-code-pre ef-code-pre-compact"><code id="dev-cli-cmds">${escapeHtml(localCommands)}</code></pre>
          </div>
        </section>
      </div>
    </div>
      `,
      })}
    </div>
  </section>`;
}

export function renderUnifiedDemoPage({ locale, hrefFor, escapeHtml, arrowRightIcon }) {
  const presets = Object.values(DEMO_PRESETS);
  const initialPreset = DEMO_PRESETS["public-fetch"];

  return `${pageHero({
    eyebrow: "Interactive Preview",
    title: "Bounded Execution Workbench",
    description: "Inspect how ExportFlow enforces task contract bounds, SSRF egress rules, deterministic routing, and normalized provenance — completely inside your browser.",
    badgeHtml: `<span class="ef-badge ef-badge-dev"><span>Simulation only · 0 external network requests</span></span>`,
    glyph: "workbench",
    actionsHtml: `
      <a class="ef-btn ef-btn-primary ef-btn-sm" href="${hrefFor("/workspace", locale)}"><span>Open Live Execution Workspace</span></a>
      <a class="ef-text-link" href="${hrefFor("/developers", locale)}"><span>Read contract specification</span>${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}</a>
    `,
  })}

  <section class="ef-section ef-section-tinted" aria-labelledby="demo-workbench-heading">
    <div class="ef-container" data-demo-workbench>
      ${authGateWrap({
        locale,
        hrefFor,
        escapeHtml,
        nextPath: "/demo",
        titleEn: "Sign in to use the Execution Workbench",
        titleAr: "سجّل الدخول لاستخدام منصة التنفيذ التفاعلية",
        descEn: "Sign in with your ExportFlow account to run presets, test SSRF egress rules, and inspect live execution envelopes.",
        descAr: "سجّل الدخول بحسابك لتجربة السيناريوهات واختبار قواعد الأمان واستعراض النتائج.",
        innerHtml: `<div class="ef-demo-preset-bar" role="group" aria-label="Simulation presets">
        <span class="ef-demo-preset-label" id="demo-workbench-heading">Load scenario preset:</span>
        ${presets.map((preset, index) => `<button
          type="button"
          class="ef-filter-pill ef-preset-btn"
          data-demo-preset="${escapeHtml(preset.id)}"
          aria-pressed="${index === 0 ? "true" : "false"}"
        >${escapeHtml(preset.label)}</button>`).join("")}
      </div>

      <div class="ef-demo-grid ef-mt-20">
        <form class="ef-contact-form ef-demo-form" data-demo-form novalidate>
          <div class="ef-demo-form-head">
            <h2>1. Agent Task Input</h2>
            <span class="ef-code-caption">32 KiB JSON cap</span>
          </div>

          <div class="ef-field">
            <label for="demo-goal">Task Goal</label>
            <input id="demo-goal" name="goal" type="text" required maxlength="2000" value="${escapeHtml(initialPreset.goal)}">
            <span class="ef-field-error" data-demo-error="goal"></span>
          </div>

          <div class="ef-field">
            <label for="demo-url">Target Public URL</label>
            <input id="demo-url" class="ef-ltr-input" name="url" type="url" required value="${escapeHtml(initialPreset.url)}" placeholder="https://example.com/">
            <span class="ef-field-error" data-demo-error="url"></span>
          </div>

          <div class="ef-field-row">
            <div class="ef-field">
              <label for="demo-operation">Operation</label>
              <select id="demo-operation" name="operation">
                <option value="fetch" selected>fetch (Phase 1 active)</option>
                <option value="map">map (501 preview)</option>
                <option value="crawl">crawl (501 preview)</option>
                <option value="extract">extract (501 preview)</option>
                <option value="search">search (501 preview)</option>
              </select>
            </div>
            <div class="ef-field">
              <label for="demo-redirects">Max Redirects (0–3)</label>
              <input id="demo-redirects" name="maxRedirects" type="number" min="0" max="3" value="${initialPreset.maxRedirects}">
            </div>
          </div>

          <div class="ef-field-row">
            <div class="ef-field">
              <label for="demo-timeout">Timeout ms (100–8000)</label>
              <input id="demo-timeout" name="timeoutMs" type="number" min="100" max="8000" value="${initialPreset.timeoutMs}">
            </div>
            <div class="ef-field">
              <label for="demo-max-bytes">Max Bytes (64–1048576)</label>
              <input id="demo-max-bytes" name="maxBytes" type="number" min="64" max="1048576" value="${initialPreset.maxBytes}">
            </div>
          </div>

          <div class="ef-demo-flags">
            <label class="ef-consent">
              <input type="checkbox" name="requiresJavascript">
              <span><code>requiresJavascript</code> — needs headless DOM rendering</span>
            </label>
            <label class="ef-consent">
              <input type="checkbox" name="requiresInteraction">
              <span><code>requiresInteraction</code> — needs clicks or form actions</span>
            </label>
          </div>

          <div class="ef-hero-actions">
            <button type="submit" class="ef-btn ef-btn-primary">
              <span>Simulate Bounded Execution</span>
              ${arrowRightIcon()}
            </button>
            <button type="button" class="ef-btn ef-btn-secondary" data-demo-reset>Reset</button>
          </div>
          <p class="ef-form-banner" role="status" data-demo-status>Ready. No live upstream fetch is sent from this browser workbench.</p>
        </form>

        <div class="ef-demo-output-col">
          <div class="ef-demo-stages" aria-label="Execution pipeline stages">
            <div class="ef-demo-stage" data-demo-stage="contract">
              <span>01 · Contract</span>
              <strong data-stage-state>PASS</strong>
            </div>
            <div class="ef-demo-stage" data-demo-stage="egress">
              <span>02 · Egress Guard</span>
              <strong data-stage-state>PASS</strong>
            </div>
            <div class="ef-demo-stage" data-demo-stage="router">
              <span>03 · Router</span>
              <strong data-stage-state>http</strong>
            </div>
            <div class="ef-demo-stage" data-demo-stage="engine">
              <span>04 · Engine</span>
              <strong data-stage-state>http.fetch.v1</strong>
            </div>
            <div class="ef-demo-stage" data-demo-stage="evidence">
              <span>05 · Evidence</span>
              <strong data-stage-state>200 OK</strong>
            </div>
          </div>

          <div class="ef-code-card ef-mt-20" data-tab-group="demo-output">
            <div class="ef-code-head">
              <div class="ef-code-tabs" role="tablist" aria-label="Simulation output views">
                <button type="button" class="ef-code-tab" role="tab" id="tab-demo-envelope" aria-controls="panel-demo-envelope" aria-selected="true" tabindex="0" data-tab-trigger="envelope">Task Envelope</button>
                <button type="button" class="ef-code-tab" role="tab" id="tab-demo-policy" aria-controls="panel-demo-policy" aria-selected="false" tabindex="-1" data-tab-trigger="policy">Policy &amp; Guardrails</button>
                <button type="button" class="ef-code-tab" role="tab" id="tab-demo-evidence" aria-controls="panel-demo-evidence" aria-selected="false" tabindex="-1" data-tab-trigger="evidence">Provenance</button>
                <button type="button" class="ef-code-tab" role="tab" id="tab-demo-curl" aria-controls="panel-demo-curl" aria-selected="false" tabindex="-1" data-tab-trigger="curl">cURL</button>
              </div>
              <div class="ef-code-tools">
                <span class="ef-code-caption" data-demo-http-badge>Simulated HTTP 200</span>
                ${copyButtonHtml("demo-active-pre", "Copy output")}
              </div>
            </div>

            <div role="tabpanel" id="panel-demo-envelope" aria-labelledby="tab-demo-envelope" data-tab-panel="envelope">
              <pre class="ef-code-pre ef-demo-pre"><code id="demo-active-pre" data-demo-out="envelope"></code></pre>
            </div>
            <div role="tabpanel" id="panel-demo-policy" aria-labelledby="tab-demo-policy" data-tab-panel="policy" hidden>
              <pre class="ef-code-pre ef-demo-pre"><code data-demo-out="policy"></code></pre>
            </div>
            <div role="tabpanel" id="panel-demo-evidence" aria-labelledby="tab-demo-evidence" data-tab-panel="evidence" hidden>
              <pre class="ef-code-pre ef-demo-pre"><code data-demo-out="evidence"></code></pre>
            </div>
            <div role="tabpanel" id="panel-demo-curl" aria-labelledby="tab-demo-curl" data-tab-panel="curl" hidden>
              <pre class="ef-code-pre ef-demo-pre"><code data-demo-out="curl"></code></pre>
            </div>

            <div class="ef-code-foot">
              <span>Deterministic browser simulation matching src/core/egress-guard.js &amp; task-contract.js</span>
              <span>JSON</span>
            </div>
          </div>
        </div>
      </div>
      <script type="application/json" data-demo-presets-json>${JSON.stringify(DEMO_PRESETS).replaceAll("<", "\\u003c")}</script>
      `,
      })}
    </div>
  </section>`;
}

export function renderUnifiedRichRoute(routePath, route, { t, locale, hrefFor, escapeHtml, arrowRightIcon, arrowUpRightIcon, statusBadgeHtml }) {
  if (routePath === "/platform") {
    return renderUnifiedPlatformPage({ t, locale, hrefFor, escapeHtml, arrowRightIcon, arrowUpRightIcon, statusBadgeHtml });
  }
  if (routePath === "/use-cases") {
    return renderUnifiedUseCasesPage({ t, locale, hrefFor, escapeHtml, arrowRightIcon, arrowUpRightIcon });
  }
  if (routePath === "/developers") {
    return renderUnifiedDevelopersPage({ t, locale, hrefFor, escapeHtml, arrowRightIcon, arrowUpRightIcon, statusBadgeHtml });
  }
  if (routePath === "/demo") {
    return renderUnifiedDemoPage({ locale, hrefFor, escapeHtml, arrowRightIcon });
  }

  const [url, title, description, type] = route;

  if (routePath === "/product") {
    const productLinks = [
      ["/product/web-intelligence", "Web Intelligence", "available", "Bounded HTTP Fetch (http.fetch.v1) plus internal map/crawl/extract modules.", "web-intelligence"],
      ["/product/execution-orchestration", "Execution Orchestration", "development", "Task Contract validation, deterministic routing, and tenant gateway controls.", "execution-orchestration"],
      ["/product/developer-platform", "Developer Platform", "development", "REST endpoints, Better Auth / 2FA, and OAuth 2.0 / MCP preview flows.", "developer-platform"],
      ["/product/browser-automation", "Browser Automation", "planned", "Isolated rendering escalation path (currently returns 501 BROWSER_UNAVAILABLE).", "browser-automation"],
      ["/product/persistent-intelligence", "Persistent Intelligence", "planned", "Future durable queues, long-running task storage, and resumption.", "persistent-intelligence"],
    ];
    return `${pageHero({
      eyebrow: "Product",
      title: escapeHtml(title),
      description: escapeHtml(description),
      glyph: "capabilities",
      actionsHtml: `
        <a class="ef-btn ef-btn-primary" href="${hrefFor("/platform", locale)}"><span>Inspect 7-layer architecture</span></a>
        <a class="ef-text-link" href="${hrefFor("/demo", locale)}"><span>Interactive preview</span>${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}</a>
      `,
    })}
    <section class="ef-section">
      <div class="ef-container">
        <div class="ef-sub-grid">
          ${productLinks.map(([href, name, state, summary, iconName]) => `<a class="ef-info-card ef-card-link" href="${hrefFor(href, locale)}">
            <div class="ef-cap-card-head">
              ${renderFeatureIcon(iconName)}
              <div class="ef-cap-top">${statusBadgeHtml(state, t)}</div>
            </div>
            <h2 class="ef-card-title">${escapeHtml(name)}</h2>
            <p>${escapeHtml(summary)}</p>
            <span class="ef-cap-link ef-mt-12"><span>${escapeHtml(t.learn)}</span>${arrowUpRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}</span>
          </a>`).join("")}
        </div>
      </div>
    </section>`;
  }

  if (routePath.startsWith("/product/")) {
    const moduleSpecs = {
      "/product/web-intelligence": {
        state: "available",
        modules: "src/core/http-fetch.js · src/core/egress-guard.js · src/core/map-crawl.js · src/core/extract.js",
        summary: "Static public HTTP(S) retrieval is verified locally via http.fetch.v1 with 1 MiB body streaming caps, 8s timeouts, manual 3-hop redirect revalidation, and source provenance.",
        details: "Map, Crawl (ExportFlowBot/0.1), and Schema Extract exist as unit-tested internal adapters and remain disabled on the public task endpoint (501) until Phase 2 rollout.",
      },
      "/product/execution-orchestration": {
        state: "development",
        modules: "src/core/tasks.js · src/core/router.js · src/core/tenant-task-gateway.js · src/core/durable-tenant-burst-limiter.js",
        summary: "Validates strict JSON payloads, authenticates tenant keys against D1 SHA-256 records, enforces Durable Object burst limits, reserves UTC quotas, and routes to the lightest permitted engine.",
        details: "Single-request execution runs ephemerally today; durable queues, streaming progress, and async job storage are future stages.",
      },
      "/product/developer-platform": {
        state: "development",
        modules: "src/index.js · src/core/auth-app.js · src/mcp/preview-worker.js",
        summary: "Exposes /api/v1/health, /api/v1/platform, /api/v1/router-preview, and authenticated POST /api/v1/tasks alongside Better Auth (TOTP 2FA) and OAuth 2.0 / MCP preview authorization.",
        details: "Local developer commands and interactive browser simulations are available directly without remote credentials.",
      },
      "/product/browser-automation": {
        state: "planned",
        modules: "src/core/browser-render.js · src/core/router.js",
        summary: "Escalation path designed for JavaScript-rendered applications and explicitly authorized browser workflows when static HTTP retrieval is insufficient.",
        details: "Requests specifying requiresJavascript or requiresInteraction fail closed with HTTP 501 (BROWSER_UNAVAILABLE / BROWSER_INTERACTION_UNAVAILABLE) until a vetted Browser binding and security review are attached.",
      },
      "/product/persistent-intelligence": {
        state: "planned",
        modules: "Planned durable task store & async queue layer",
        summary: "Planned execution continuity layer for multi-step workflows, resumable checkpoints, cancellation webhooks, and tenant usage audits.",
        details: "Foundation models already emit lifecycle timestamps and cancellation AbortSignals per task; durable cross-request job state is planned rather than deployed.",
      },
    }[routePath];

    return `${pageHero({
      eyebrow: "Product",
      title: escapeHtml(title),
      description: escapeHtml(description),
      badgeHtml: statusBadgeHtml(moduleSpecs.state, t),
    })}
    <section class="ef-section">
      <article class="ef-container ef-article">
        <div class="ef-status-banner">
          ${statusBadgeHtml(moduleSpecs.state, t)}
          <span>Repository modules: <code>${escapeHtml(moduleSpecs.modules)}</code></span>
        </div>
        <h2>Current Runtime Scope</h2>
        <p>${escapeHtml(moduleSpecs.summary)}</p>
        <h2>Boundaries &amp; Next Stages</h2>
        <p>${escapeHtml(moduleSpecs.details)}</p>
        <div class="ef-sub-grid">
          <div class="ef-info-card">
            <h3>Developer Reference</h3>
            <p>Review the Task Contract, D1/DO auth gates, and error reference table.</p>
            <p class="ef-mt-12"><a class="ef-cap-link" href="${hrefFor("/developers", locale)}">${escapeHtml(t.exploreDocs)} ${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}</a></p>
          </div>
          <div class="ef-info-card">
            <h3>Interactive Workbench</h3>
            <p>Test URL egress validation, byte limits, and 501 escalation paths in-browser.</p>
            <p class="ef-mt-12"><a class="ef-cap-link" href="${hrefFor("/demo", locale)}">Launch preview ${arrowUpRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}</a></p>
          </div>
        </div>
      </article>
    </section>`;
  }

  if (routePath === "/solutions") {
    return `${pageHero({
      eyebrow: "Solutions",
      title: "Controlled Execution for Real Agent Workloads",
      description: "See how bounded retrieval, deterministic extraction, and fail-closed security boundaries fit agent pipelines without coupling to one LLM vendor.",
      actionsHtml: `<a class="ef-btn ef-btn-primary" href="${hrefFor("/use-cases", locale)}"><span>Inspect 5 workflow blueprints</span></a>`,
    })}
    <section class="ef-section">
      <div class="ef-container ef-sub-grid">
        ${USE_CASES.map((uc) => `<article class="ef-info-card">
          <div class="ef-cap-top"><span class="ef-badge ${uc.maturityKey === "prototype" ? "ef-badge-dev" : "ef-badge-planned"}"><span>${escapeHtml(uc.maturity)}</span></span></div>
          <h3>${escapeHtml(uc.title)}</h3>
          <p>${escapeHtml(uc.summary)}</p>
          <p class="ef-mt-12"><a class="ef-cap-link" href="${hrefFor("/use-cases", locale)}#uc-${escapeHtml(uc.id)}">Inspect JSON envelope ${arrowUpRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}</a></p>
        </article>`).join("")}
      </div>
    </section>`;
  }

  if (routePath === "/pricing") {
    return `${pageHero({
      eyebrow: "Pricing",
      title: "Transparent Infrastructure Limits Before Billing Launches",
      description: "Public commercial plans are not open yet. D1 quota windows and Durable Object burst controls are implemented in Core ahead of future plan publication.",
      badgeHtml: statusBadgeHtml("planned", t),
    })}
    <section class="ef-section">
      <div class="ef-container ef-article">
        <div class="ef-status-banner">
          ${statusBadgeHtml("development", t)}
          <span>Plan quota enforcement (<code>src/core/plan-quota.js</code>) and shared burst rate limiting (<code>TenantBurstRateLimiter</code>) exist in Core; self-serve billing and checkout are not implemented.</span>
        </div>
        <h2>What exists in the foundation</h2>
        <p>Tenants authenticate with D1-issued keys (<code>ef_live_*</code>) tied to UTC daily and monthly request quotas snapshotted per window in <code>tenant_request_usage</code>. Successful task responses return <code>x-plan-limit</code>, <code>x-plan-remaining</code>, and <code>x-plan-reset</code> headers while leaving <code>usage.cost</code> as <code>null</code>.</p>
        <h2>How commercial tiers will be published</h2>
        <p>Usage pricing, SLA commitments, and Stripe/billing workflows will only appear here once production multi-region workers and customer onboarding are completed.</p>
        <p class="ef-mt-20"><a class="ef-btn ef-btn-secondary" href="${hrefFor("/contact", locale)}"><span>Contact engineering</span>${arrowRightIcon()}</a></p>
      </div>
    </section>`;
  }

  if (routePath === "/integrations") {
    return `${pageHero({
      eyebrow: "Integrations",
      title: "Provider-Neutral REST & OAuth / MCP Entry Points",
      description: "Connect any model, agent framework, or internal backend through versioned JSON contracts without vendor lock-in.",
    })}
    <section class="ef-section">
      <div class="ef-container ef-sub-grid">
        <article class="ef-info-card">
          <div class="ef-cap-top">${statusBadgeHtml("available", t)}</div>
          <h3>Versioned HTTP Task API</h3>
          <p>Submit bounded JSON tasks to <code>POST /api/v1/tasks</code> using tenant Bearer keys (<code>ef_live_*</code>) and inspect discovery via <code>/api/v1/platform</code>.</p>
        </article>
        <article class="ef-info-card">
          <div class="ef-cap-top">${statusBadgeHtml("development", t)}</div>
          <h3>MCP Preview &amp; OAuth 2.0 Consent</h3>
          <p><code>src/mcp/preview-worker.js</code> pairs Better Auth OAuth 2.0 flows (<code>/oauth/consent</code>, <code>/oauth/select-tenant</code>) with the shared Durable Object burst limiter.</p>
        </article>
        <article class="ef-info-card">
          <div class="ef-cap-top">${statusBadgeHtml("development", t)}</div>
          <h3>Account Identity &amp; Google Sign-In</h3>
          <p>Human workspace operators authenticate via Better Auth with optional Google linking, email verification, and mandatory TOTP 2FA for administrative actions.</p>
        </article>
        <article class="ef-info-card">
          <div class="ef-cap-top">${statusBadgeHtml("planned", t)}</div>
          <h3>Official SDKs &amp; Async Webhooks</h3>
          <p>Dedicated TypeScript/Python SDK wrappers and durable webhook callbacks are planned once Phase 2 adapters stabilize.</p>
        </article>
      </div>
    </section>`;
  }

  if (routePath === "/docs" || routePath === "/api-reference" || routePath === "/resources" || routePath === "/changelog" || routePath === "/blog" || routePath === "/about") {
    const milestones = [
      ["Phase 1 Core Foundation", "available", "Bounded http.fetch.v1 adapter, 32 KiB task contract, SSRF egress policy, redirect revalidation, and normalized source evidence."],
      ["Multi-Tenant D1 Auth & Quotas", "available", "Per-tenant ef_live_* API keys, atomic UTC plan quota windows, and shared TenantBurstRateLimiter Durable Object."],
      ["Better Auth, TOTP 2FA & MCP Preview", "development", "Account portal (/signin, /account), owner MFA step-up, OAuth tenant consent UI, and MCP preview worker."],
      ["Internal Web Intelligence Adapters", "development", "Unit-tested web.map.v1, web.crawl.v1, web.extract.v1, web.search.v1, and web.research.v1 factories."],
      ["Browser Runtime & Durable Queues", "planned", "Isolated JS rendering binding (currently 501) and persistent async task orchestration."],
    ];

    return `${pageHero({
      eyebrow: escapeHtml(title),
      title: escapeHtml(title),
      description: escapeHtml(description),
      actionsHtml: `
        <a class="ef-btn ef-btn-primary" href="${hrefFor("/developers", locale)}"><span>Open Developer Center</span></a>
        <a class="ef-text-link" href="${hrefFor("/demo", locale)}"><span>Interactive preview</span>${arrowRightIcon("ef-icon ef-icon-xs ef-dir-arrow")}</a>
      `,
    })}
    <section class="ef-section">
      <div class="ef-container">
        <div class="ef-sub-grid">
          ${milestones.map(([name, state, summary]) => `<article class="ef-info-card">
            <div class="ef-cap-top">${statusBadgeHtml(state, t)}</div>
            <h3>${escapeHtml(name)}</h3>
            <p>${escapeHtml(summary)}</p>
          </article>`).join("")}
        </div>
        <div class="ef-sub-grid ef-mt-20">
          ${CAPABILITIES.slice(0, 2).map((cap) => `<article class="ef-info-card">
            <p class="ef-kicker">${escapeHtml(cap.adapterId)}</p>
            <h3>${escapeHtml(cap.name)} — ${escapeHtml(cap.maturity)}</h3>
            <p>${escapeHtml(cap.details)}</p>
          </article>`).join("")}
        </div>
      </div>
    </section>`;
  }

  return null;
}
