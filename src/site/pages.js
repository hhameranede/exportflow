import {
  CAPABILITIES,
  DEMO_PRESETS,
  DEVELOPER_ERROR_CODES,
  FAQ_ITEMS,
  PLATFORM_LAYERS,
  SITE_META,
  USE_CASES,
  VALUE_PILLARS,
} from "./data.js";
import { renderHeroArchitectureGraphic } from "./diagrams.js";
import { escapeHtml, renderDocument, safeJsonForScript } from "./layout.js";

function renderCodeBlock({ id, label, code }) {
  return `<div class="ef-code-wrap">
  <div class="ef-code-head">
    <span>${escapeHtml(label)}</span>
    <button type="button" class="ef-copy-btn" data-copy-target="${escapeHtml(id)}" data-copy-label="Copy">Copy</button>
  </div>
  <pre class="ef-pre"><code id="${escapeHtml(id)}">${escapeHtml(code)}</code></pre>
</div>`;
}

export function renderHomePage(requestUrl) {
  const pillarsHtml = VALUE_PILLARS.map(
    (p) => `<article class="ef-pillar">
      <div class="ef-pillar-num">${escapeHtml(p.number)}</div>
      <h3 class="ef-h3">${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(p.description)}</p>
    </article>`,
  ).join("");

  const capabilitiesHtml = CAPABILITIES.map((cap, idx) => {
    const detailsId = `cap-details-${cap.id}`;
    const limitsHtml = cap.limits.map((lim) => `<li>${escapeHtml(lim)}</li>`).join("");
    return `<article class="ef-cap-card" data-cap-card data-maturity-key="${escapeHtml(cap.maturityKey)}"${idx === 0 ? ' data-featured="true"' : ""}>
      <div class="ef-cap-meta">
        <span>${escapeHtml(cap.index)} · ${escapeHtml(cap.adapterId)}</span>
        <span class="ef-maturity-tag" data-maturity="${escapeHtml(cap.maturityKey)}">${escapeHtml(cap.maturity)}</span>
      </div>
      <h3 class="ef-h3">${escapeHtml(cap.name)}</h3>
      <p class="ef-cap-summary">${escapeHtml(cap.summary)}</p>
      <button type="button" class="ef-inline-toggle" aria-expanded="false" aria-controls="${escapeHtml(detailsId)}" data-cap-toggle>
        Inspect contract &amp; bounds
      </button>
      <div id="${escapeHtml(detailsId)}" class="ef-cap-details" hidden>
        <p>${escapeHtml(cap.details)}</p>
        <ul class="ef-cap-limits">${limitsHtml}</ul>
      </div>
    </article>`;
  }).join("");

  const bodyHtml = `
    <section class="ef-hero">
      <div class="ef-container ef-hero-grid">
        <div class="ef-hero-copy">
          <p class="ef-kicker">${escapeHtml(SITE_META.positioning)}</p>
          <h1 class="ef-h1">Give AI a way to execute.</h1>
          <p class="ef-subheadline">One execution layer. Multiple engines. Verifiable results.</p>
          <p class="ef-lead">
            AI models are designed for reasoning, planning, and decisions. ExportFlow provides bounded execution infrastructure underneath—routing tasks through interchangeable engines and returning structured results backed by source evidence.
          </p>
          <div class="ef-actions">
            <a class="ef-btn ef-btn-primary" href="/platform">Explore the Platform</a>
            <a class="ef-btn" href="/developers">Developer Documentation</a>
          </div>
          <div class="ef-meta-line">
            <span>Model-agnostic interface</span>
            <span aria-hidden="true">·</span>
            <span>Phase 1: Bounded HTTP Fetch verified locally</span>
            <span aria-hidden="true">·</span>
            <span>Production rollout pending</span>
          </div>
        </div>

        ${renderHeroArchitectureGraphic()}
      </div>
    </section>

    <section class="ef-section" id="why-exportflow">
      <div class="ef-container">
        <div class="ef-section-head ef-section-head-split">
          <div>
            <p class="ef-kicker">Why ExportFlow</p>
            <h2 class="ef-h2">Reasoning needs dependable execution underneath.</h2>
          </div>
          <p class="ef-section-note">
            If AI can plan it, ExportFlow helps it execute it. Separating model reasoning from runtime policies keeps integrations portable and verifiable.
          </p>
        </div>

        <div class="ef-pillars-grid">
          ${pillarsHtml}
        </div>

        <div class="ef-notice ef-notice-warn ef-mt-4" role="note">
          <p class="ef-notice-title">Honest foundation status</p>
          <p class="ef-notice-body">
            ExportFlow is actively progressing through Phase 1. Bounded HTTP Fetch (<code>http.fetch.v1</code>) is implemented and verified on local Node.js and Cloudflare Workerd runtimes, while multi-engine production endpoints, hosted MCP, durable queues, and live browser execution remain in development or prototype stages.
          </p>
        </div>
      </div>
    </section>

    <section class="ef-section" id="capabilities">
      <div class="ef-container">
        <div class="ef-section-head ef-section-head-split">
          <div>
            <p class="ef-kicker">Execution Capabilities</p>
            <h2 class="ef-h2">Every capability with explicit maturity status.</h2>
          </div>

          <div class="ef-filter-bar" role="group" aria-label="Filter capabilities by maturity">
            <button type="button" class="ef-filter-btn" data-cap-filter="all" aria-pressed="true">All (6)</button>
            <button type="button" class="ef-filter-btn" data-cap-filter="local-verified" aria-pressed="false">Local Verified</button>
            <button type="button" class="ef-filter-btn" data-cap-filter="prototype" aria-pressed="false">Prototype</button>
            <button type="button" class="ef-filter-btn" data-cap-filter="concept" aria-pressed="false">Concept</button>
          </div>
        </div>

        <div class="ef-capabilities-grid">
          ${capabilitiesHtml}
        </div>
      </div>
    </section>

    <section class="ef-section">
      <div class="ef-container">
        <div class="ef-notice ef-notice-split">
          <div>
            <h2 class="ef-h2">Inspect the architecture and execution flow.</h2>
            <p class="ef-notice-body ef-mt-2">
              Walk through all seven infrastructure layers, examine the JSON task contract, or explore an interactive execution preview in your browser.
            </p>
          </div>
          <div class="ef-actions">
            <a class="ef-btn ef-btn-primary" href="/demo">Launch Interactive Preview</a>
            <a class="ef-btn" href="/platform">Read Platform Architecture</a>
          </div>
        </div>
      </div>
    </section>
  `;

  return renderDocument({
    path: "/",
    requestUrl,
    title: "ExportFlow — Give AI a way to execute",
    description:
      "Agent execution infrastructure for AI. One execution layer coordinating multiple engines to deliver bounded, evidence-backed results.",
    bodyHtml,
    ogEyebrow: "AGENT EXECUTION INFRASTRUCTURE",
    includeAlternates: false,
  });
}

export function renderPlatformPage(requestUrl) {
  const firstLayer = PLATFORM_LAYERS[0];
  const layerButtonsHtml = PLATFORM_LAYERS.map(
    (layer, idx) => `<button
      type="button"
      class="ef-layer-btn"
      role="tab"
      aria-selected="${idx === 0 ? "true" : "false"}"
      data-layer-id="${escapeHtml(layer.id)}"
    >
      <span class="ef-layer-step">${escapeHtml(layer.step)}</span>
      <span class="ef-layer-name">${escapeHtml(layer.name)}</span>
      <span class="ef-layer-arrow" aria-hidden="true">-&gt;</span>
    </button>`,
  ).join("");

  const bodyHtml = `
    <section class="ef-page-header">
      <div class="ef-container">
        <p class="ef-kicker">Platform Architecture</p>
        <h1 class="ef-page-title">Seven layers separating AI decisions from execution mechanics.</h1>
        <p class="ef-lead">
          AI decides what should happen. ExportFlow coordinates how permitted execution is carried out—validating contracts, enforcing egress policy, routing to engines, and returning normalized evidence.
        </p>
      </div>
    </section>

    <section class="ef-section">
      <div class="ef-container">
        <div class="ef-section-head">
          <p class="ef-kicker">Interactive Architecture Diagram</p>
          <h2 class="ef-h2">Select any infrastructure layer to inspect its contract.</h2>
        </div>

        <div class="ef-arch-layout">
          <div class="ef-layer-stack" role="tablist" aria-label="ExportFlow 7 infrastructure layers">
            ${layerButtonsHtml}
          </div>

          <div class="ef-layer-inspector" data-layer-inspector role="tabpanel">
            <div class="ef-inspector-meta" data-insp-step>${escapeHtml(firstLayer.step)} · ${escapeHtml(firstLayer.maturity)}</div>
            <h3 class="ef-h2" data-insp-name>${escapeHtml(firstLayer.name)}</h3>
            <dl class="ef-inspector-list">
              <div class="ef-inspector-item">
                <dt>Core Responsibility</dt>
                <dd data-insp-resp>${escapeHtml(firstLayer.responsibility)}</dd>
              </div>
              <div class="ef-inspector-item">
                <dt>Current Implementation &amp; Design</dt>
                <dd data-insp-how>${escapeHtml(firstLayer.howItWorks)}</dd>
              </div>
              <div class="ef-inspector-item">
                <dt>Enforced Controls &amp; Boundaries</dt>
                <dd data-insp-controls>${escapeHtml(firstLayer.controls)}</dd>
              </div>
            </dl>
          </div>
        </div>
        <script type="application/json" id="ef-platform-layers-json">${safeJsonForScript(PLATFORM_LAYERS)}</script>
      </div>
    </section>

    <section class="ef-section">
      <div class="ef-container">
        <div class="ef-section-head">
          <p class="ef-kicker">Architectural Principles</p>
          <h2 class="ef-h2">Why contract-driven routing and adapter isolation matter.</h2>
        </div>

        <div class="ef-compare-grid">
          <article class="ef-panel">
            <h3>Separation of responsibilities</h3>
            <p>
              Mixing reasoning prompts directly with raw network fetchers creates brittle agents that silently leak internal error traces, fail on redirects, or lack audit trails.
            </p>
            <ul class="ef-list">
              <li><strong>Reasoning Layer (AI Agent):</strong> Determines goals, candidate targets, and downstream interpretation.</li>
              <li><strong>Execution Layer (ExportFlow):</strong> Enforces JSON schemas, bearer authentication, URL egress rules, byte caps, and structured provenance.</li>
            </ul>
          </article>

          <article class="ef-panel">
            <h3>Why the unified task contract matters</h3>
            <p>
              Agents should not rewrite integration code whenever a retrieval provider or parsing strategy changes. Every engine executes behind an ExportFlow-owned adapter contract.
            </p>
            <ul class="ef-list">
              <li><strong>Consistent Input:</strong> Goal, public HTTP(S) URL, explicit operation, and bounded limits.</li>
              <li><strong>Swappable Engines:</strong> Replacing direct HTTP with extraction or future browser engines preserves the outer envelope.</li>
            </ul>
          </article>
        </div>

        <div class="ef-notice ef-notice-warn ef-mt-4" role="note">
          <p class="ef-notice-title">Deployment vs. Target Architecture</p>
          <p class="ef-notice-body">
            The diagram above combines components verified locally in Phase 1 (contract, auth, egress guard, router, and <code>http.fetch.v1</code>) with planned platform capabilities (public multi-tenant quotas, durable task persistence, MCP surface, and live Browser/Search bindings).
          </p>
        </div>
      </div>
    </section>
  `;

  return renderDocument({
    path: "/platform",
    requestUrl,
    title: "The Platform — ExportFlow Architecture",
    description:
      "Explore ExportFlow's seven infrastructure layers: Agent Interface, Task Contract, Auth and Policy, Router, Engine Adapters, Result Normalization, and Evidence.",
    bodyHtml,
    ogEyebrow: "EXPORTFLOW / PLATFORM",
    includeAlternates: false,
  });
}

export function renderUseCasesPage(requestUrl) {
  const casesHtml = USE_CASES.map((uc) => {
    const jsonId = `uc-json-${uc.id}`;
    const codePanelId = `uc-panel-${uc.id}`;
    return `<article class="ef-usecase-card">
      <div class="ef-usecase-head">
        <div>
          <h2 class="ef-h2">${escapeHtml(uc.title)}</h2>
          <p class="ef-section-note ef-mt-2">${escapeHtml(uc.summary)}</p>
        </div>
        <span class="ef-maturity-tag" data-maturity="${escapeHtml(uc.maturityKey)}">${escapeHtml(uc.maturity)}</span>
      </div>

      <div class="ef-usecase-grid">
        <div class="ef-usecase-col">
          <h4>The Problem</h4>
          <p>${escapeHtml(uc.problem)}</p>
        </div>
        <div class="ef-usecase-col">
          <h4>What the AI Agent Does</h4>
          <p>${escapeHtml(uc.agentRole)}</p>
        </div>
        <div class="ef-usecase-col">
          <h4>What ExportFlow Contributes</h4>
          <p>${escapeHtml(uc.exportflowRole)}</p>
        </div>
      </div>

      <div class="ef-mt-3">
        <button type="button" class="ef-inline-toggle" aria-expanded="false" aria-controls="${escapeHtml(codePanelId)}" data-uc-toggle>
          View expected JSON shape
        </button>
      </div>

      <div id="${escapeHtml(codePanelId)}" hidden>
        ${renderCodeBlock({
          id: jsonId,
          label: `Expected normalized output (${uc.maturity})`,
          code: JSON.stringify(uc.sampleJson, null, 2),
        })}
      </div>
    </article>`;
  }).join("");

  const bodyHtml = `
    <section class="ef-page-header">
      <div class="ef-container">
        <p class="ef-kicker">Applied Patterns</p>
        <h1 class="ef-page-title">Real workflows, bounded guarantees, transparent readiness.</h1>
        <p class="ef-lead">
          Each pattern below explains how an AI agent coordinates with ExportFlow—and explicitly distinguishes prototype or planned capabilities from what runs locally today.
        </p>
      </div>
    </section>

    <section class="ef-section">
      <div class="ef-container">
        <div class="ef-usecase-list">
          ${casesHtml}
        </div>
      </div>
    </section>
  `;

  return renderDocument({
    path: "/use-cases",
    requestUrl,
    title: "Use Cases — ExportFlow",
    description:
      "Explore AI agent execution workflows for multi-source research, website intelligence, structured data collection, browser execution, and long-running tasks.",
    bodyHtml,
    ogEyebrow: "EXPORTFLOW / USE CASES",
    includeAlternates: false,
  });
}

export function renderDevelopersPage(requestUrl) {
  const sampleRequestJson = JSON.stringify(
    {
      goal: "Fetch public documentation page title and headers",
      url: "https://example.com/docs",
      operation: "fetch",
      requiresJavascript: false,
      requiresInteraction: false,
      limits: {
        timeoutMs: 5000,
        maxBytes: 262144,
        maxRedirects: 2,
      },
    },
    null,
    2,
  );

  const sampleResponseJson = JSON.stringify(
    {
      id: "4b6d8f2e-1a90-4c77-9e3d-72a90c11b401",
      goal: "Fetch public documentation page title and headers",
      requestedUrl: "https://example.com/docs",
      state: "succeeded",
      execution: {
        path: "http",
        operation: "fetch",
        adapterId: "http.fetch.v1",
        reason: "Direct HTTP is the lightest suitable first attempt.",
      },
      timestamps: {
        createdAt: "2026-11-19T12:00:00.000Z",
        startedAt: "2026-11-19T12:00:00.008Z",
        completedAt: "2026-11-19T12:00:00.092Z",
      },
      usage: {
        durationMs: 84,
        requestsAttempted: 1,
        responseBytes: 1256,
        cost: null,
      },
      events: [
        { type: "task.accepted", at: "2026-11-19T12:00:00.000Z" },
        { type: "task.started", at: "2026-11-19T12:00:00.008Z", executionPath: "http" },
        { type: "task.succeeded", at: "2026-11-19T12:00:00.092Z" },
      ],
      errors: [],
      result: {
        status: "succeeded",
        data: {
          status: 200,
          httpStatus: 200,
          contentType: "text/html; charset=utf-8",
          body: "<!doctype html><html>...</html>",
          bytes: 1256,
          originalUrl: "https://example.com/docs",
          requestedUrl: "https://example.com/docs",
          finalUrl: "https://example.com/docs",
          redirects: [],
        },
        sources: [
          {
            url: "https://example.com/docs",
            retrievedAt: "2026-11-19T12:00:00.092Z",
            title: null,
            evidence: [
              {
                type: "http_response",
                status: 200,
                contentType: "text/html; charset=utf-8",
                bytes: 1256,
                redirectCount: 0,
              },
            ],
          },
        ],
        warnings: [],
        generatedAt: "2026-11-19T12:00:00.092Z",
      },
    },
    null,
    2,
  );

  const sampleErrorJson = JSON.stringify(
    {
      id: "91c4a01e-2240-41df-a8f4-091e2347d112",
      goal: "Render client-side SPA dashboard",
      requestedUrl: "https://example.com/app",
      state: "unsupported",
      execution: {
        path: "browser",
        operation: "fetch",
        adapterId: null,
        reason: "The task requires page rendering or user-directed interaction.",
      },
      usage: {
        durationMs: 1,
        requestsAttempted: 0,
        responseBytes: 0,
        cost: null,
      },
      events: [
        { type: "task.accepted", at: "2026-11-19T12:01:00.000Z" },
        { type: "task.started", at: "2026-11-19T12:01:00.001Z", executionPath: "browser" },
        { type: "task.unsupported", at: "2026-11-19T12:01:00.002Z", reason: "browser_adapter_unavailable" },
      ],
      errors: [
        {
          code: "BROWSER_UNAVAILABLE",
          message: "Browser Run binding is not configured.",
        },
      ],
      result: {
        status: "failed",
        data: null,
        sources: [],
        warnings: ["Browser Run binding is not configured; no browser navigation was performed."],
        generatedAt: "2026-11-19T12:01:00.002Z",
      },
    },
    null,
    2,
  );

  const localCommands = `# Run unit and API verification suite (Node 22+ / 24)
npm test
npm run check

# Run local Node HTTP bridge on http://127.0.0.1:3000 with a synthetic local token
EXPORTFLOW_API_TOKEN=local-dev-token npm run dev

# Or run directly inside Cloudflare Workerd runtime
npx wrangler dev --local --var EXPORTFLOW_API_TOKEN:local-dev-token

# Local inspection call (requires running local server)
curl -sS -X POST http://127.0.0.1:3000/api/v1/tasks \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer local-dev-token" \\
  -d '{"goal":"Fetch example homepage","url":"https://example.com/"}'`;

  const errorRowsHtml = DEVELOPER_ERROR_CODES.map(
    (err) => `<tr>
      <td class="ef-mono-cell">${escapeHtml(err.code)}</td>
      <td class="ef-mono-cell">${escapeHtml(String(err.status))}</td>
      <td>${escapeHtml(err.cause)}</td>
      <td>${escapeHtml(err.recovery)}</td>
    </tr>`,
  ).join("");

  const bodyHtml = `
    <section class="ef-page-header">
      <div class="ef-container">
        <p class="ef-kicker">Developer Documentation</p>
        <h1 class="ef-page-title">Build with the ExportFlow task contract.</h1>
        <p class="ef-lead">
          Phase 1 exposes bounded HTTP fetch (<code>POST /api/v1/tasks</code>) in local Node.js and Cloudflare Workerd runtimes when authenticated. No public production API, public token issuance, SDK package, or live MCP server is open yet.
        </p>
      </div>
    </section>

    <section class="ef-section">
      <div class="ef-container ef-docs-layout">
        <aside class="ef-docs-nav" aria-label="Documentation sections">
          <h2 class="ef-docs-nav-title">On this page</h2>
          <ul>
            <li><a href="#doc-intro">1. Introduction &amp; Status</a></li>
            <li><a href="#doc-terms">2. Core Terminology</a></li>
            <li><a href="#doc-contract">3. Task Contract</a></li>
            <li><a href="#doc-flow">4. Execution Flow</a></li>
            <li><a href="#doc-adapters">5. Adapter Concept</a></li>
            <li><a href="#doc-auth">6. Authentication &amp; Policy</a></li>
            <li><a href="#doc-response">7. Response &amp; Evidence</a></li>
            <li><a href="#doc-errors">8. Error Handling</a></li>
            <li><a href="#doc-local">9. Local Development</a></li>
          </ul>
        </aside>

        <div class="ef-docs-content">
          <article class="ef-doc-block" id="doc-intro">
            <h2>1. Introduction &amp; Current Scope</h2>
            <p>
              ExportFlow provides deterministic execution infrastructure for AI agents. Instead of handing models raw sockets or unmanaged browser instances, callers submit a bounded task payload and receive a normalized result object containing status, data, source evidence, lifecycle events, and measured usage.
            </p>
            <div class="ef-notice ef-notice-warn">
              <p class="ef-notice-title">Local execution only in Phase 1</p>
              <p class="ef-notice-body">
                Read-only discovery endpoints (<code>GET /api/v1/health</code>, <code>GET /api/v1/platform</code>, <code>GET /api/v1/router-preview</code>) run directly in the Worker. Task execution (<code>POST /api/v1/tasks</code>) requires <code>EXPORTFLOW_API_TOKEN</code> configured in your environment and currently supports <code>operation: "fetch"</code> only.
              </p>
            </div>
          </article>

          <article class="ef-doc-block" id="doc-terms">
            <h2>2. Core Terminology</h2>
            <div class="ef-table-wrap">
              <table class="ef-table">
                <thead>
                  <tr><th>Term</th><th>Definition in ExportFlow</th></tr>
                </thead>
                <tbody>
                  <tr><td class="ef-mono-cell">Task</td><td>A single bounded execution unit carrying a natural-language <code>goal</code>, target <code>url</code>, and resource limits. Ephemeral in Phase 1.</td></tr>
                  <tr><td class="ef-mono-cell">Operation</td><td>Declared intent (<code>fetch</code>, <code>map</code>, <code>crawl</code>, <code>extract</code>, <code>search</code>, <code>research</code>). Only <code>fetch</code> is enabled on the task API right now.</td></tr>
                  <tr><td class="ef-mono-cell">Execution Path</td><td>Router decision selecting <code>http</code> (lightweight direct retrieval) or <code>browser</code> (JS rendering / interaction, currently unsupported).</td></tr>
                  <tr><td class="ef-mono-cell">Adapter</td><td>Versioned contract wrapper such as <code>http.fetch.v1</code> declaring capabilities, bounds, and egress rules.</td></tr>
                  <tr><td class="ef-mono-cell">Evidence</td><td>Per-source provenance metadata recording resolved URL, ISO timestamp, HTTP status, content type, bytes, and redirect count.</td></tr>
                </tbody>
              </table>
            </div>
          </article>

          <article class="ef-doc-block" id="doc-contract">
            <h2>3. Task Contract Concept</h2>
            <p>
              <code>readBoundedJsonBody</code> and <code>validateTaskRequest</code> enforce fail-closed request validation before any execution engine runs:
            </p>
            <ul class="ef-list">
              <li>Content-Type must be <code>application/json</code> (otherwise <code>415</code>) and body size must not exceed <code>32,768</code> bytes (<code>413</code>).</li>
              <li>Allowed top-level keys only: <code>goal</code> (1–2000 chars), <code>url</code> (public HTTP/HTTPS DNS domain), optional <code>operation</code> (defaults to <code>"fetch"</code>), optional <code>requiresJavascript</code> / <code>requiresInteraction</code> booleans, and optional <code>limits</code>.</li>
              <li>Limit bounds: <code>timeoutMs</code> integer <code>1..8000</code>, <code>maxBytes</code> integer <code>1..1048576</code>, <code>maxRedirects</code> integer <code>0..3</code>.</li>
            </ul>
            ${renderCodeBlock({
              id: "doc-req-json",
              label: "Task contract payload example (POST /api/v1/tasks in local dev)",
              code: sampleRequestJson,
            })}
          </article>

          <article class="ef-doc-block" id="doc-flow">
            <h2>4. Execution Flow</h2>
            <p>
              Each accepted request progresses through an explicit, inspectable event sequence inside <code>executeWebTask()</code>:
            </p>
            <ul class="ef-list">
              <li><code>task.accepted</code>: Task ID assigned via Web Crypto <code>randomUUID()</code> and goal/URL validated.</li>
              <li><code>task.started</code>: Router selects <code>http</code> or <code>browser</code> path and attaches adapter identity.</li>
              <li><code>task.succeeded</code> / <code>task.partial</code> / <code>task.failed</code> / <code>task.unsupported</code>: Terminal state emitted with duration, byte usage, and normalized output.</li>
            </ul>
          </article>

          <article class="ef-doc-block" id="doc-adapters">
            <h2>5. Adapter Concept</h2>
            <p>
              ExportFlow isolates provider details behind adapter contracts registered in <code>src/core/adapters.js</code>. You can inspect the active catalog metadata locally via <code>GET /api/v1/platform</code> (which omits executable handlers and reports <code>liveCapabilities</code> truthfully based on runtime configuration).
            </p>
            <p>
              Currently, <code>http.fetch.v1</code> is the sole active adapter for task execution. Prototype modules (<code>web.map.v1</code>, <code>web.crawl.v1</code>, <code>web.extract.v1</code>, and search/browser factories) remain disabled behind <code>501</code> until security and quota gates for Phase 2 are complete.
            </p>
          </article>

          <article class="ef-doc-block" id="doc-auth">
            <h2>6. Authentication &amp; Outbound Policy</h2>
            <p>
              Task execution fails closed: if <code>EXPORTFLOW_API_TOKEN</code> is absent or blank, every request to <code>POST /api/v1/tasks</code> returns <code>503 AUTH_NOT_CONFIGURED</code>. When configured, requests require <code>Authorization: Bearer &lt;token&gt;</code> verified via fixed-length SHA-256 constant-time digest comparison and bounded by an isolate-local rate limiter (60 requests per 60 seconds default).
            </p>
            <p>
              Application-layer <code>egress-guard.js</code> validates both the initial target and every manual redirect hop against IP literals, local/reserved domain suffixes, non-default ports, embedded credentials, HTTPS downgrades, and ExportFlow-owned origins.
            </p>
          </article>

          <article class="ef-doc-block" id="doc-response">
            <h2>7. Response, Evidence &amp; Usage Format</h2>
            <p>
              All task responses normalize into one consistent structure regardless of upstream outcome. Notice that <code>usage.cost</code> remains <code>null</code> because no billing meter is attached in Phase 1.
            </p>
            ${renderCodeBlock({
              id: "doc-res-json",
              label: "Normalized task response example (succeeded)",
              code: sampleResponseJson,
            })}
            ${renderCodeBlock({
              id: "doc-err-json",
              label: "Unsupported browser task response example (HTTP 501)",
              code: sampleErrorJson,
            })}
          </article>

          <article class="ef-doc-block" id="doc-errors">
            <h2>8. Error Handling Reference</h2>
            <p>
              Errors map to deterministic codes and sanitized descriptions so raw upstream exceptions or cookies never reach the caller.
            </p>
            <div class="ef-table-wrap">
              <table class="ef-table">
                <thead>
                  <tr><th>Error Code</th><th>HTTP</th><th>Cause</th><th>Caller Guidance</th></tr>
                </thead>
                <tbody>
                  ${errorRowsHtml}
                </tbody>
              </table>
            </div>
          </article>

          <article class="ef-doc-block" id="doc-local">
            <h2>9. Local Development Setup</h2>
            <p>
              The repository runs cleanly on Node.js 22+ and Cloudflare Wrangler without external npm dependencies. Note that local <code>workerd</code> egress relies on host OS DNS rather than Cloudflare Production's outbound proxy.
            </p>
            ${renderCodeBlock({
              id: "doc-local-cmds",
              label: "Local development & testing commands (run in workspace root)",
              code: localCommands,
            })}
          </article>
        </div>
      </div>
    </section>
  `;

  return renderDocument({
    path: "/developers",
    requestUrl,
    title: "Developers — ExportFlow Documentation",
    description:
      "Technical documentation for ExportFlow's task contract, execution flow, adapters, authentication, evidence envelopes, error codes, and local runtime setup.",
    bodyHtml,
    ogEyebrow: "EXPORTFLOW / DEVELOPERS",
    includeAlternates: false,
  });
}

export function renderDemoPage(requestUrl) {
  const presetButtonsHtml = Object.values(DEMO_PRESETS)
    .map(
      (p, idx) => `<button type="button" class="ef-filter-btn" data-demo-preset="${escapeHtml(p.id)}" aria-pressed="${idx === 0 ? "true" : "false"}">${escapeHtml(p.label)}</button>`,
    )
    .join("");

  const stageNames = [
    "Request",
    "Validation",
    "Execution Routing",
    "HTTP Fetch",
    "Result Normalization",
    "Evidence",
  ];

  const stagesHtml = stageNames
    .map(
      (name, idx) => `<div class="ef-stage-node" data-stage-index="${idx}" data-state="passed">
        <div class="ef-stage-idx">0${idx + 1}</div>
        <div class="ef-stage-name">${escapeHtml(name)}</div>
      </div>`,
    )
    .join("");

  const bodyHtml = `
    <section class="ef-page-header">
      <div class="ef-container">
        <p class="ef-kicker">Interactive Product Preview</p>
        <h1 class="ef-page-title">Explore how an ExportFlow task executes.</h1>
        <p class="ef-lead">
          Edit sample task inputs, switch between scenarios, inspect validation and policy boundaries, and examine the exact normalized JSON structure.
        </p>
        <div class="ef-notice ef-notice-warn" role="status">
          <p class="ef-notice-title">Interactive product preview — illustrative data, no live external request.</p>
          <p class="ef-notice-body">
            This demonstration runs deterministically inside your browser. No API token is requested, and no network call is made to third-party targets.
          </p>
        </div>
      </div>
    </section>

    <section class="ef-section">
      <div class="ef-container" data-demo-workbench>
        <div class="ef-mb-4">
          <p class="ef-label ef-mb-2">Sample Scenarios</p>
          <div class="ef-filter-bar" role="group" aria-label="Choose interactive preview scenario">
            ${presetButtonsHtml}
          </div>
        </div>

        <div class="ef-demo-grid">
          <div class="ef-panel">
            <h2 class="ef-h3 ef-mb-3">Sample Task Input</h2>

            <div class="ef-form-group">
              <label class="ef-label" for="demo-goal">goal</label>
              <input id="demo-goal" class="ef-input" type="text" maxlength="2000" value="${escapeHtml(DEMO_PRESETS["public-fetch"].goal)}">
            </div>

            <div class="ef-form-group">
              <label class="ef-label" for="demo-url">url (try http://127.0.0.1/admin or ftp://test.com)</label>
              <input id="demo-url" class="ef-input" type="url" value="${escapeHtml(DEMO_PRESETS["public-fetch"].url)}">
            </div>

            <div class="ef-form-group">
              <label class="ef-label" for="demo-operation">operation</label>
              <select id="demo-operation" class="ef-select">
                <option value="fetch">fetch (Phase 1 active local path)</option>
                <option value="extract">extract (Internal prototype — returns 501)</option>
                <option value="crawl">crawl (Internal prototype — returns 501)</option>
                <option value="map">map (Internal prototype — returns 501)</option>
                <option value="search">search (Internal prototype — returns 501)</option>
              </select>
            </div>

            <div class="ef-form-row">
              <div class="ef-form-group">
                <label class="ef-label" for="demo-timeout">limits.timeoutMs</label>
                <input id="demo-timeout" class="ef-input" type="number" min="1" max="8000" value="8000">
              </div>
              <div class="ef-form-group">
                <label class="ef-label" for="demo-max-bytes">limits.maxBytes</label>
                <input id="demo-max-bytes" class="ef-input" type="number" min="1" max="1048576" value="1048576">
              </div>
              <div class="ef-form-group">
                <label class="ef-label" for="demo-max-redirects">limits.maxRedirects</label>
                <input id="demo-max-redirects" class="ef-input" type="number" min="0" max="3" value="3">
              </div>
            </div>

            <div class="ef-check-row">
              <label class="ef-check-label">
                <input id="demo-requires-js" type="checkbox">
                <span>requiresJavascript</span>
              </label>
              <label class="ef-check-label">
                <input id="demo-requires-interaction" type="checkbox">
                <span>requiresInteraction</span>
              </label>
            </div>

            <div class="ef-actions">
              <button type="button" id="demo-run-btn" class="ef-btn ef-btn-primary">Run Preview Simulation</button>
              <button type="button" id="demo-reset-btn" class="ef-btn">Reset Example</button>
            </div>
          </div>

          <div class="ef-panel">
            <div class="ef-flex-between ef-mb-3">
              <h2 class="ef-h3">Conceptual Execution Stages</h2>
              <span class="ef-mono-subtle ef-mono-xs">Interactive product preview · illustrative data</span>
            </div>

            <div class="ef-pipeline" aria-label="Execution stages">
              ${stagesHtml}
            </div>

            <dl class="ef-kv-grid">
              <div class="ef-kv-card">
                <dt>Task State</dt>
                <dd id="demo-task-state">succeeded</dd>
              </div>
              <div class="ef-kv-card">
                <dt>Adapter Identity</dt>
                <dd id="demo-adapter-id">http.fetch.v1</dd>
              </div>
              <div class="ef-kv-card">
                <dt>Simulated HTTP</dt>
                <dd id="demo-http-status">200</dd>
              </div>
              <div class="ef-kv-card">
                <dt>Latency</dt>
                <dd id="demo-duration">76 ms (sample)</dd>
              </div>
            </dl>

            <div class="ef-demo-tabs" role="tablist" aria-label="Inspect simulated response details">
              <button type="button" class="ef-filter-btn" data-demo-tab="json" aria-selected="true" aria-pressed="true">Formatted JSON Output</button>
              <button type="button" class="ef-filter-btn" data-demo-tab="evidence" aria-selected="false" aria-pressed="false">Evidence &amp; Lifecycle Details</button>
            </div>

            <div class="ef-demo-panel" data-demo-panel="json">
              <div class="ef-code-wrap ef-mt-0">
                <div class="ef-code-head">
                  <span>Illustrative JSON Response (no live external request)</span>
                  <button type="button" class="ef-copy-btn" data-copy-target="demo-json-output" data-copy-label="Copy JSON">Copy JSON</button>
                </div>
                <pre class="ef-pre"><code id="demo-json-output"></code></pre>
              </div>
            </div>

            <div class="ef-demo-panel" data-demo-panel="evidence" hidden>
              <div class="ef-notice ef-mb-3">
                <p class="ef-notice-title">Source Provenance Summary</p>
                <p class="ef-notice-body" id="demo-evidence-summary"></p>
              </div>
              <div class="ef-notice">
                <p class="ef-notice-title">Lifecycle Events</p>
                <ul class="ef-list" id="demo-events-list"></ul>
              </div>
            </div>
          </div>
        </div>

        <script type="application/json" id="ef-demo-presets-json">${safeJsonForScript(DEMO_PRESETS)}</script>
      </div>
    </section>
  `;

  return renderDocument({
    path: "/demo",
    requestUrl,
    title: "Interactive Product Preview — ExportFlow",
    description:
      "Explore ExportFlow's bounded execution stages, policy validation, routing, and normalized evidence JSON in an illustrative browser preview.",
    bodyHtml,
    ogEyebrow: "EXPORTFLOW / INTERACTIVE PREVIEW",
    includeAlternates: false,
  });
}

export function renderFaqPage(requestUrl) {
  const categories = ["All", ...new Set(FAQ_ITEMS.map((item) => item.category))];
  const filterBtnsHtml = categories
    .map((cat, idx) => {
      const key = cat === "All" ? "all" : cat;
      return `<button type="button" class="ef-filter-btn" data-faq-filter="${escapeHtml(key)}" aria-pressed="${idx === 0 ? "true" : "false"}">${escapeHtml(cat)}</button>`;
    })
    .join("");

  const faqListHtml = FAQ_ITEMS.map(
    (item, idx) => `<details class="ef-faq-item" data-faq-item data-faq-category="${escapeHtml(item.category)}"${idx < 2 ? " open" : ""}>
      <summary class="ef-faq-summary">
        <span>${escapeHtml(item.question)}</span>
        <span class="ef-faq-meta">${escapeHtml(item.category)}</span>
      </summary>
      <div class="ef-faq-body">
        <p class="ef-m-0">${escapeHtml(item.answer)}</p>
      </div>
    </details>`,
  ).join("");

  const bodyHtml = `
    <section class="ef-page-header">
      <div class="ef-container">
        <p class="ef-kicker">Frequently Asked Questions</p>
        <h1 class="ef-page-title">Clarity on architecture, capabilities, and project status.</h1>
        <p class="ef-lead">
          Direct answers grounded in what ExportFlow is built to do and what has actually been verified in Phase 1.
        </p>
      </div>
    </section>

    <section class="ef-section">
      <div class="ef-container">
        <div class="ef-section-head ef-section-head-split">
          <div class="ef-filter-bar" role="group" aria-label="Filter FAQ by topic">
            ${filterBtnsHtml}
          </div>
          <div class="ef-actions">
            <button type="button" class="ef-btn ef-btn-sm" data-faq-expand-all>Expand all</button>
            <button type="button" class="ef-btn ef-btn-sm" data-faq-collapse-all>Collapse all</button>
          </div>
        </div>

        <div class="ef-faq-list">
          ${faqListHtml}
        </div>
      </div>
    </section>
  `;

  return renderDocument({
    path: "/faq",
    requestUrl,
    title: "FAQ — ExportFlow",
    description:
      "Answers about ExportFlow's agent execution infrastructure, adapters, source evidence, AI provider neutrality, MCP plans, and current availability.",
    bodyHtml,
    ogEyebrow: "EXPORTFLOW / FAQ",
    includeAlternates: false,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  });
}
