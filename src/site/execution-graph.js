/**
 * Standalone reusable Execution Graph EF/01 component.
 * Light-first Daylight Architectural precision styling with interactive
 * route simulation scenarios, node path highlighting, and mobile layout.
 */

const NODE_METADATA = Object.freeze({
  agent: {
    id: "agent",
    title: "AI agent",
    role: "INPUT / INTENT",
    status: "Contract emitter",
    bounds: "JSON <= 32 KiB",
    detail: "Submits bounded goal, public URL, and explicit resource limits.",
    connects: ["p-agent-core"],
  },
  core: {
    id: "core",
    title: "ExportFlow core",
    role: "COORDINATION LAYER",
    status: "Active locally",
    bounds: "Auth + Egress Guard",
    detail: "Validates JSON schema, enforces SSRF egress policy, and routes execution.",
    connects: ["p-agent-core", "p-core-http", "p-core-search", "p-core-browser"],
  },
  http: {
    id: "http",
    title: "HTTP fetch",
    role: "ENGINE · http.fetch.v1",
    status: "Available locally",
    bounds: "1 MiB · 8s · 3 hops",
    detail: "Direct bounded GET retrieval with per-hop redirect validation and provenance.",
    connects: ["p-core-http", "p-http-result"],
  },
  search: {
    id: "search",
    title: "Search",
    role: "ENGINE · web.search.v1",
    status: "In development",
    bounds: "Prototype adapter",
    detail: "Discovery factory with URL revalidation; not yet exposed on live endpoints.",
    connects: ["p-core-search", "p-search-result"],
  },
  browser: {
    id: "browser",
    title: "Browser",
    role: "ENGINE · web.browser.v1",
    status: "Planned",
    bounds: "501 unsupported",
    detail: "Isolated DOM rendering path; returns 501 unsupported until configured.",
    connects: ["p-core-browser", "p-browser-result"],
  },
  result: {
    id: "result",
    title: "Verified results",
    role: "OUTPUT / PROVENANCE",
    status: "Normalized envelope",
    bounds: "Sources + Usage",
    detail: "Returns structured payload, resolved URL, redirect hops, and timestamps.",
    connects: ["p-http-result", "p-search-result", "p-browser-result"],
  },
});

const SCENARIO_METADATA = Object.freeze({
  http: {
    id: "http",
    title: "HTTP fetch",
    status: "Available locally",
    bounds: "200 OK · 1 MiB cap · 8s",
    detail: "Active path: AI agent -> ExportFlow core -> http.fetch.v1 -> Verified results.",
    connects: ["p-agent-core", "p-core-http", "p-http-result"],
  },
  search: {
    id: "search",
    title: "Search",
    status: "In development",
    bounds: "Internal prototype · 501 on API",
    detail: "Development path: validates query-only tasks and filters unsafe URLs before return.",
    connects: ["p-agent-core", "p-core-search", "p-search-result"],
  },
  browser: {
    id: "browser",
    title: "Browser",
    status: "Planned",
    bounds: "Unconfigured · 501 BROWSER_UNAVAILABLE",
    detail: "Planned path: isolated rendering activates only when a Browser Run binding exists.",
    connects: ["p-agent-core", "p-core-browser", "p-browser-result"],
  },
});

export function renderExecutionGraph({
  availableLabel = "Available locally",
  developmentLabel = "In development",
  plannedLabel = "Planned",
} = {}) {
  return `<div class="ef-graph-card" data-exec-graph data-active-scenario="http" data-parallax-target>
  <div class="ef-graph-head">
    <div class="ef-graph-title-group">
      <svg class="ef-icon ef-icon-sm ef-graph-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="5" cy="12" r="2.5"/>
        <circle cx="12" cy="12" r="2.5"/>
        <circle cx="19" cy="6" r="2.5"/>
        <circle cx="19" cy="18" r="2.5"/>
        <path d="M7.5 12h2M14.2 10.7l2.6-3.1M14.2 13.3l2.6 3.1"/>
      </svg>
      <span class="ef-graph-kicker">Execution Graph</span>
      <span class="ef-graph-id">EF/01</span>
    </div>
    <div class="ef-graph-scenarios" role="group" aria-label="Simulate execution route">
      <button type="button" class="ef-graph-tab" data-graph-scenario="http" aria-pressed="true">HTTP Fetch</button>
      <button type="button" class="ef-graph-tab" data-graph-scenario="search" aria-pressed="false">Search</button>
      <button type="button" class="ef-graph-tab" data-graph-scenario="browser" aria-pressed="false">Browser</button>
    </div>
  </div>

  <!-- Desktop & Tablet SVG Graph -->
  <div class="ef-graph-stage ef-graph-stage-desktop" dir="ltr">
    <svg class="ef-graph-svg" viewBox="0 0 540 416" role="img" aria-labelledby="ef-graph-svg-title ef-graph-svg-desc">
      <title id="ef-graph-svg-title">ExportFlow Execution Graph EF/01</title>
      <desc id="ef-graph-svg-desc">Live data flow from AI agent through ExportFlow core to HTTP fetch (available locally), Search (in development), and Browser (planned), returning verified results with attached provenance.</desc>
      <defs>
        <linearGradient id="ef-grad-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--accent)"/>
          <stop offset="100%" stop-color="var(--accent-2)"/>
        </linearGradient>
        <linearGradient id="ef-grad-core-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--graph-core-a)"/>
          <stop offset="100%" stop-color="var(--graph-core-b)"/>
        </linearGradient>
        <filter id="ef-packet-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Subtle architectural grid -->
      <g class="ef-graph-grid" aria-hidden="true">
        <line x1="24" y1="68" x2="516" y2="68"/>
        <line x1="24" y1="168" x2="516" y2="168"/>
        <line x1="24" y1="268" x2="516" y2="268"/>
        <line x1="24" y1="368" x2="516" y2="368"/>
      </g>

      <!-- Connection Paths -->
      <g class="ef-graph-paths" fill="none">
        <path id="p-agent-core" class="ef-g-path ef-g-path-active" data-path-id="p-agent-core" d="M270 76 L270 120"/>
        <path id="p-core-http" class="ef-g-path ef-g-path-available" data-path-id="p-core-http" d="M210 184 C210 206, 98 202, 98 230"/>
        <path id="p-core-search" class="ef-g-path ef-g-path-dev" data-path-id="p-core-search" d="M270 184 L270 230"/>
        <path id="p-core-browser" class="ef-g-path ef-g-path-planned" data-path-id="p-core-browser" d="M330 184 C330 206, 442 202, 442 230"/>
        <path id="p-http-result" class="ef-g-path ef-g-path-available" data-path-id="p-http-result" d="M98 300 C98 326, 218 318, 218 342"/>
        <path id="p-search-result" class="ef-g-path ef-g-path-dev" data-path-id="p-search-result" d="M270 300 L270 342"/>
        <path id="p-browser-result" class="ef-g-path ef-g-path-planned" data-path-id="p-browser-result" d="M442 300 C442 326, 322 318, 322 342"/>
      </g>

      <!-- Traveling Data Packets (CSS offset-path 60fps loop) -->
      <g class="ef-graph-packets" aria-hidden="true">
        <circle class="ef-packet ef-packet-1" r="4.2" filter="url(#ef-packet-glow)"/>
        <circle class="ef-packet ef-packet-2" r="4.2" filter="url(#ef-packet-glow)"/>
        <circle class="ef-packet ef-packet-3" r="4.2" filter="url(#ef-packet-glow)"/>
        <circle class="ef-packet ef-packet-dev" r="3.2"/>
      </g>

      <!-- Node 1: AI agent -->
      <g class="ef-g-node" tabindex="0" role="button" data-graph-node="agent" aria-label="AI agent: Input intent and task constraints">
        <rect x="145" y="16" width="250" height="60" rx="10" class="ef-g-box"/>
        <text x="163" y="36" class="ef-g-eyebrow">INPUT / REASONING</text>
        <text x="163" y="58" class="ef-g-title">AI agent</text>
        <text x="377" y="58" text-anchor="end" class="ef-g-meta">task.intent</text>
      </g>

      <!-- Node 2: ExportFlow core -->
      <g class="ef-g-node ef-g-node-core" tabindex="0" role="button" data-graph-node="core" aria-label="ExportFlow core: Validate, enforce egress policy, and route">
        <rect x="125" y="114" width="290" height="76" rx="12" class="ef-g-box-glow"/>
        <rect x="130" y="120" width="280" height="64" rx="10" fill="url(#ef-grad-core-fill)" class="ef-g-box ef-g-box-core"/>
        <rect x="148" y="136" width="28" height="28" rx="7" class="ef-g-core-badge"/>
        <path d="M156 146h12M156 150h10M156 154h12" stroke="url(#ef-grad-accent)" stroke-width="1.8" stroke-linecap="round"/>
        <text x="188" y="141" class="ef-g-eyebrow ef-g-eyebrow-accent">COORDINATION LAYER</text>
        <text x="188" y="162" class="ef-g-title">ExportFlow core</text>
        <text x="394" y="162" text-anchor="end" class="ef-g-meta">validate · route</text>
      </g>

      <!-- Node 3a: HTTP Fetch (Available locally) -->
      <g class="ef-g-node ef-g-node-available" tabindex="0" role="button" data-graph-node="http" aria-label="HTTP fetch: Available locally">
        <rect x="22" y="230" width="152" height="70" rx="10" class="ef-g-box ef-g-box-available"/>
        <circle cx="40" cy="250" r="6" class="ef-g-pulse-ring"/>
        <circle cx="40" cy="250" r="4" class="ef-g-dot-available"/>
        <text x="52" y="254" class="ef-g-status ef-g-status-available">${availableLabel}</text>
        <text x="34" y="278" class="ef-g-title-sm">HTTP fetch</text>
        <text x="34" y="292" class="ef-g-meta">http.fetch.v1</text>
      </g>

      <!-- Node 3b: Search (In development) -->
      <g class="ef-g-node ef-g-node-dev" tabindex="0" role="button" data-graph-node="search" aria-label="Search: In development">
        <rect x="194" y="230" width="152" height="70" rx="10" class="ef-g-box ef-g-box-dev"/>
        <path d="M208 246v4l2.5 1.5" stroke="var(--status-dev)" stroke-width="1.6" stroke-linecap="round" fill="none"/>
        <circle cx="208" cy="250" r="6" stroke="var(--status-dev)" stroke-width="1.4" stroke-dasharray="2.5 2" fill="none"/>
        <text x="220" y="254" class="ef-g-status ef-g-status-dev">${developmentLabel}</text>
        <text x="206" y="278" class="ef-g-title-sm">Search</text>
        <text x="206" y="292" class="ef-g-meta">web.search.v1</text>
      </g>

      <!-- Node 3c: Browser (Planned) -->
      <g class="ef-g-node ef-g-node-planned" tabindex="0" role="button" data-graph-node="browser" aria-label="Browser: Planned">
        <rect x="366" y="230" width="152" height="70" rx="10" class="ef-g-box ef-g-box-planned"/>
        <circle cx="381" cy="250" r="5" stroke="var(--status-planned)" stroke-width="1.4" stroke-dasharray="1.5 2.5" fill="none"/>
        <text x="392" y="254" class="ef-g-status ef-g-status-planned">${plannedLabel}</text>
        <text x="378" y="278" class="ef-g-title-sm ef-g-title-dim">Browser</text>
        <text x="378" y="292" class="ef-g-meta">web.browser.v1</text>
      </g>

      <!-- Node 4: Verified results -->
      <g class="ef-g-node ef-g-node-result" tabindex="0" role="button" data-graph-node="result" aria-label="Verified results: Structured output and provenance">
        <rect x="125" y="342" width="290" height="60" rx="10" class="ef-g-box ef-g-box-result"/>
        <text x="145" y="363" class="ef-g-eyebrow">OUTPUT / EVIDENCE</text>
        <text x="145" y="385" class="ef-g-title">Verified results</text>
        <g class="ef-g-stamp" transform="translate(370, 358)">
          <circle cx="14" cy="14" r="13" class="ef-g-stamp-ring"/>
          <path d="M8.5 14.5 L12.2 18.2 L19.8 10.4" class="ef-g-stamp-check"/>
        </g>
      </g>
    </svg>
  </div>

  <!-- Mobile Simplified Vertical Graph -->
  <div class="ef-graph-stage-mobile" aria-label="Execution flow summary">
    <div class="ef-m-node" data-graph-node="agent">
      <span class="ef-m-role">INPUT</span>
      <strong>AI agent</strong>
      <span class="ef-m-meta">task.intent · constraints</span>
    </div>
    <div class="ef-m-connector" aria-hidden="true"><span></span></div>
    <div class="ef-m-node ef-m-node-core" data-graph-node="core">
      <span class="ef-m-role">COORDINATION</span>
      <strong>ExportFlow core</strong>
      <span class="ef-m-meta">validate · egress-guard · route</span>
    </div>
    <div class="ef-m-connector" aria-hidden="true"><span></span></div>
    <div class="ef-m-engines">
      <div class="ef-m-engine ef-m-engine-available">
        <span class="ef-badge ef-badge-available">
          <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${availableLabel}</span>
        </span>
        <strong>HTTP fetch</strong>
      </div>
      <div class="ef-m-engine ef-m-engine-dev">
        <span class="ef-badge ef-badge-dev">
          <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
          <span>${developmentLabel}</span>
        </span>
        <strong>Search</strong>
      </div>
      <div class="ef-m-engine ef-m-engine-planned">
        <span class="ef-badge ef-badge-planned">
          <svg class="ef-icon ef-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/></svg>
          <span>${plannedLabel}</span>
        </span>
        <strong>Browser</strong>
      </div>
    </div>
    <div class="ef-m-connector" aria-hidden="true"><span></span></div>
    <div class="ef-m-node ef-m-node-result" data-graph-node="result">
      <span class="ef-m-role">OUTPUT / PROVENANCE</span>
      <strong>Verified results</strong>
      <span class="ef-m-meta">structured payload · evidence</span>
    </div>
  </div>

  <!-- Interactive Tooltip / Inspector Footer -->
  <div class="ef-graph-tooltip" data-graph-tooltip aria-live="polite">
    <div class="ef-graph-tooltip-head">
      <div class="ef-graph-tooltip-title-row">
        <strong data-gt-title>HTTP fetch</strong>
        <span class="ef-graph-tooltip-bounds" data-gt-bounds>200 OK · 1 MiB cap · 8s</span>
      </div>
      <span class="ef-graph-tooltip-status" data-gt-status>${availableLabel}</span>
    </div>
    <p data-gt-detail>Active path: AI agent -&gt; ExportFlow core -&gt; http.fetch.v1 -&gt; Verified results.</p>
  </div>
  <script type="application/json" data-graph-meta>${JSON.stringify({ nodes: NODE_METADATA, scenarios: SCENARIO_METADATA }).replaceAll("<", "\\u003c")}</script>
</div>`;
}
