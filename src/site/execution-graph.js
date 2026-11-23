/**
 * Apple Silicon-inspired Execution Graph component.
 * High-contrast dark hardware block schematic anchored on clean gallery surfaces,
 * with interactive route simulation, keyboard support, and mobile button controls.
 */

import { getLocaleData } from "./i18n.js";
import { escapeHtml } from "./layout.js";

export function renderExecutionGraph({
  availableLabel = "Available locally",
  developmentLabel = "In development",
  plannedLabel = "Planned",
  locale = "en",
} = {}) {
  const g = getLocaleData(locale).graph;
  const httpScenario = g.scenarios.http;

  return `<div class="ef-graph-card" data-exec-graph data-active-scenario="http" data-parallax-target>
  <div class="ef-graph-head">
    <div class="ef-graph-title-group">
      <h2 class="ef-graph-title">${escapeHtml(g.kicker)}</h2>
    </div>
    <div class="ef-graph-scenarios" role="group" aria-label="${escapeHtml(g.routeGroupAria)}">
      <button type="button" class="ef-graph-tab" data-graph-scenario="http" aria-pressed="true">${escapeHtml(g.httpTitle)}</button>
      <button type="button" class="ef-graph-tab" data-graph-scenario="search" aria-pressed="false">${escapeHtml(g.searchTitle)}</button>
      <button type="button" class="ef-graph-tab" data-graph-scenario="browser" aria-pressed="false">${escapeHtml(g.browserTitle)}</button>
    </div>
  </div>

  <!-- Desktop & Tablet Schematic -->
  <div class="ef-graph-stage ef-graph-stage-desktop" dir="ltr">
    <svg class="ef-graph-svg" viewBox="0 0 840 310" role="img" aria-labelledby="ef-graph-svg-title ef-graph-svg-desc">
      <title id="ef-graph-svg-title">${escapeHtml(g.svgTitle)}</title>
      <desc id="ef-graph-svg-desc">${escapeHtml(g.svgDesc)}</desc>

      <!-- Subtle baseline alignment guides -->
      <g class="ef-graph-grid" aria-hidden="true">
        <line x1="20" y1="155" x2="820" y2="155"/>
        <line x1="210" y1="24" x2="210" y2="286"/>
        <line x1="420" y1="24" x2="420" y2="286"/>
        <line x1="635" y1="24" x2="635" y2="286"/>
      </g>

      <!-- Clean Left-to-Right Hardware Bus Paths -->
      <g class="ef-graph-paths" fill="none">
        <path id="p-agent-core" class="ef-g-path ef-g-path-active" data-path-id="p-agent-core" d="M168 155 L218 155"/>
        <path id="p-core-http" class="ef-g-path ef-g-path-available" data-path-id="p-core-http" d="M394 134 C432 134, 424 62, 466 62"/>
        <path id="p-core-search" class="ef-g-path ef-g-path-dev" data-path-id="p-core-search" d="M394 155 L466 155"/>
        <path id="p-core-browser" class="ef-g-path ef-g-path-planned" data-path-id="p-core-browser" d="M394 176 C432 176, 424 248, 466 248"/>
        <path id="p-http-result" class="ef-g-path ef-g-path-available" data-path-id="p-http-result" d="M622 62 C654 62, 648 134, 678 134"/>
        <path id="p-search-result" class="ef-g-path ef-g-path-dev" data-path-id="p-search-result" d="M622 155 L678 155"/>
        <path id="p-browser-result" class="ef-g-path ef-g-path-planned" data-path-id="p-browser-result" d="M622 248 C654 248, 648 176, 678 176"/>
      </g>

      <!-- Quiet Single-Pulse Signal Packets -->
      <g class="ef-graph-packets" aria-hidden="true">
        <circle class="ef-packet ef-packet-1" r="3"/>
        <circle class="ef-packet ef-packet-2" r="3"/>
        <circle class="ef-packet ef-packet-3" r="3"/>
      </g>

      <!-- Column 1: AI Agent -->
      <g class="ef-g-node" tabindex="0" role="button" aria-pressed="false" data-graph-node="agent" aria-label="${escapeHtml(g.agentAria)}">
        <rect x="20" y="109" width="148" height="92" rx="14" class="ef-g-box"/>
        <text x="36" y="136" class="ef-g-eyebrow">${escapeHtml(g.inputRole)}</text>
        <text x="36" y="160" class="ef-g-title">${escapeHtml(g.agentTitle)}</text>
        <text x="36" y="182" class="ef-g-meta">${escapeHtml(g.agentMeta)}</text>
      </g>

      <!-- Column 2: ExportFlow Core -->
      <g class="ef-g-node ef-g-node-core" tabindex="0" role="button" aria-pressed="false" data-graph-node="core" aria-label="${escapeHtml(g.coreAria)}">
        <rect x="218" y="95" width="176" height="120" rx="16" class="ef-g-box ef-g-box-core"/>
        <text x="236" y="124" class="ef-g-eyebrow ef-g-eyebrow-accent">${escapeHtml(g.coordRole)}</text>
        <text x="236" y="150" class="ef-g-title">${escapeHtml(g.coreLayerLabel)}</text>
        <text x="236" y="169" class="ef-g-title-sm">${escapeHtml(g.coreSubLabel)}</text>
        <text x="236" y="195" class="ef-g-meta">${escapeHtml(g.coreMeta)}</text>
      </g>

      <!-- Column 3: Execution Engines -->
      <g class="ef-g-node ef-g-node-available" tabindex="0" role="button" aria-pressed="true" data-graph-node="http" aria-label="${escapeHtml(g.httpAria)}">
        <rect x="466" y="24" width="156" height="76" rx="12" class="ef-g-box ef-g-box-available"/>
        <text x="482" y="46" class="ef-g-status ef-g-status-available">${escapeHtml(availableLabel)}</text>
        <text x="482" y="68" class="ef-g-title-sm">${escapeHtml(g.httpTitle)}</text>
        <text x="482" y="86" class="ef-g-meta">http.fetch.v1</text>
      </g>

      <g class="ef-g-node ef-g-node-dev" tabindex="0" role="button" aria-pressed="false" data-graph-node="search" aria-label="${escapeHtml(g.searchAria)}">
        <rect x="466" y="117" width="156" height="76" rx="12" class="ef-g-box ef-g-box-dev"/>
        <text x="482" y="139" class="ef-g-status ef-g-status-dev">${escapeHtml(developmentLabel)}</text>
        <text x="482" y="161" class="ef-g-title-sm">${escapeHtml(g.searchTitle)}</text>
        <text x="482" y="179" class="ef-g-meta">web.search.v1</text>
      </g>

      <g class="ef-g-node ef-g-node-planned" tabindex="0" role="button" aria-pressed="false" data-graph-node="browser" aria-label="${escapeHtml(g.browserAria)}">
        <rect x="466" y="210" width="156" height="76" rx="12" class="ef-g-box ef-g-box-planned"/>
        <text x="482" y="232" class="ef-g-status ef-g-status-planned">${escapeHtml(plannedLabel)}</text>
        <text x="482" y="254" class="ef-g-title-sm ef-g-title-dim">${escapeHtml(g.browserTitle)}</text>
        <text x="482" y="272" class="ef-g-meta">web.browser.v1</text>
      </g>

      <!-- Column 4: Verified Results -->
      <g class="ef-g-node ef-g-node-result" tabindex="0" role="button" aria-pressed="false" data-graph-node="result" aria-label="${escapeHtml(g.resultsAria)}">
        <rect x="678" y="109" width="142" height="92" rx="14" class="ef-g-box ef-g-box-result"/>
        <text x="694" y="136" class="ef-g-eyebrow">${escapeHtml(g.outputRole)}</text>
        <text x="694" y="160" class="ef-g-title-sm">${escapeHtml(g.resultsTitle1)}</text>
        <text x="694" y="178" class="ef-g-title-sm">${escapeHtml(g.resultsTitle2)}</text>
      </g>
    </svg>
  </div>

  <!-- Mobile Vertical Interactive Layout -->
  <div class="ef-graph-stage-mobile" aria-label="${escapeHtml(g.mobileAria)}">
    <button type="button" class="ef-m-node" data-graph-node="agent" aria-pressed="false">
      <span class="ef-m-role">${escapeHtml(g.inputRole)}</span>
      <strong>${escapeHtml(g.agentTitle)}</strong>
      <span class="ef-m-meta">${escapeHtml(g.mobileInputMeta)}</span>
    </button>
    <div class="ef-m-connector" aria-hidden="true"><span></span></div>
    <button type="button" class="ef-m-node ef-m-node-core" data-graph-node="core" aria-pressed="false">
      <span class="ef-m-role">${escapeHtml(g.coordRole)}</span>
      <strong>${escapeHtml(g.nodes.core.title)}</strong>
      <span class="ef-m-meta">${escapeHtml(g.mobileCoordMeta)}</span>
    </button>
    <div class="ef-m-connector" aria-hidden="true"><span></span></div>
    <div class="ef-m-engines">
      <button type="button" class="ef-m-engine ef-m-engine-available" data-graph-node="http" aria-pressed="true">
        <span class="ef-badge ef-badge-available"><span>${escapeHtml(availableLabel)}</span></span>
        <strong>${escapeHtml(g.httpTitle)}</strong>
      </button>
      <button type="button" class="ef-m-engine ef-m-engine-dev" data-graph-node="search" aria-pressed="false">
        <span class="ef-badge ef-badge-dev"><span>${escapeHtml(developmentLabel)}</span></span>
        <strong>${escapeHtml(g.searchTitle)}</strong>
      </button>
      <button type="button" class="ef-m-engine ef-m-engine-planned" data-graph-node="browser" aria-pressed="false">
        <span class="ef-badge ef-badge-planned"><span>${escapeHtml(plannedLabel)}</span></span>
        <strong>${escapeHtml(g.browserTitle)}</strong>
      </button>
    </div>
    <div class="ef-m-connector" aria-hidden="true"><span></span></div>
    <button type="button" class="ef-m-node ef-m-node-result" data-graph-node="result" aria-pressed="false">
      <span class="ef-m-role">${escapeHtml(g.outputRole)}</span>
      <strong>${escapeHtml(g.resultsCombined)}</strong>
      <span class="ef-m-meta">${escapeHtml(g.mobileOutputMeta)}</span>
    </button>
  </div>

  <!-- Clean Hardware Readout Bar -->
  <div class="ef-graph-tooltip" data-graph-tooltip role="status" aria-live="polite">
    <div class="ef-graph-tooltip-head">
      <div class="ef-graph-tooltip-title-row">
        <strong data-gt-title>${escapeHtml(httpScenario.title)}</strong>
        <span class="ef-graph-tooltip-bounds" data-gt-bounds>${escapeHtml(httpScenario.bounds)}</span>
      </div>
      <span class="ef-graph-tooltip-status" data-gt-status>${escapeHtml(availableLabel)}</span>
    </div>
    <p data-gt-detail>${escapeHtml(httpScenario.detail)}</p>
  </div>
  <script type="application/json" data-graph-meta>${JSON.stringify({ nodes: g.nodes, scenarios: g.scenarios }).replaceAll("<", "\\u003c")}</script>
</div>`;
}
