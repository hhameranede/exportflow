export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect x="1.5" y="1.5" width="29" height="29" rx="6" fill="#0B0F17" stroke="#22D3A6" stroke-width="1.5"/>
  <path d="M8.5 10.5H19.5M8.5 16H23.5M8.5 21.5H17.5" stroke="#F4F7FB" stroke-width="2" stroke-linecap="square"/>
  <path d="M20.5 13L24 16L20.5 19" stroke="#22D3A6" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>
</svg>`;

export const OG_CARD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" fill="none">
  <rect width="1200" height="630" fill="#0B0F17"/>
  <g stroke="rgba(148,173,204,0.12)" stroke-width="1">
    <line x1="0" y1="120" x2="1200" y2="120"/>
    <line x1="0" y1="510" x2="1200" y2="510"/>
    <line x1="120" y1="0" x2="120" y2="630"/>
    <line x1="1080" y1="0" x2="1080" y2="630"/>
  </g>
  <rect x="120" y="156" width="52" height="52" rx="8" fill="#111824" stroke="#22D3A6" stroke-width="2"/>
  <path d="M132 174H150M132 182H158M132 190H146" stroke="#F4F7FB" stroke-width="3" stroke-linecap="square"/>
  <path d="M153 177L159 182L153 187" stroke="#22D3A6" stroke-width="3" stroke-linecap="square"/>
  <text x="192" y="191" fill="#F4F7FB" font-family="system-ui,-apple-system,sans-serif" font-size="30" font-weight="700" letter-spacing="-0.5">ExportFlow</text>
  <text x="120" y="290" fill="#F4F7FB" font-family="system-ui,-apple-system,sans-serif" font-size="60" font-weight="700" letter-spacing="-1.5">Give AI a way to execute.</text>
  <text x="120" y="348" fill="#9FB0C7" font-family="system-ui,-apple-system,sans-serif" font-size="28" font-weight="400">One execution layer. Multiple engines. Verifiable results.</text>
  <g transform="translate(120,410)">
    <rect width="208" height="58" rx="6" fill="#111824" stroke="rgba(148,173,204,0.3)"/>
    <text x="20" y="35" fill="#F4F7FB" font-family="monospace" font-size="18">AI Agent</text>
    <path d="M222 29H252M246 23L252 29L246 35" stroke="#22D3A6" stroke-width="2"/>
    <rect x="266" width="224" height="58" rx="6" fill="#111824" stroke="#22D3A6"/>
    <text x="286" y="35" fill="#22D3A6" font-family="monospace" font-size="18">ExportFlow</text>
    <path d="M504 29H534M528 23L534 29L528 35" stroke="#22D3A6" stroke-width="2"/>
    <rect x="548" width="218" height="58" rx="6" fill="#111824" stroke="rgba(148,173,204,0.3)"/>
    <text x="568" y="35" fill="#F4F7FB" font-family="monospace" font-size="18">Engines</text>
    <path d="M780 29H810M804 23L810 29L804 35" stroke="#22D3A6" stroke-width="2"/>
    <rect x="824" width="136" height="58" rx="6" fill="#111824" stroke="rgba(148,173,204,0.3)"/>
    <text x="844" y="35" fill="#F4F7FB" font-family="monospace" font-size="18">Evidence</text>
  </g>
</svg>`;

export function renderHeroArchitectureGraphic() {
  return `<div class="ef-exec-visual" aria-label="ExportFlow execution pipeline diagram">
  <div class="ef-exec-visual-head">
    <span class="ef-mono-label">Execution Path Schematic</span>
    <span class="ef-mono-subtle">Agent -&gt; Layer -&gt; Engine -&gt; Evidence</span>
  </div>
  <svg class="ef-schematic-svg" viewBox="0 0 640 370" role="img" aria-labelledby="hero-diagram-title">
    <title id="hero-diagram-title">Five-step execution flow from AI Agent through ExportFlow to verifiable evidence</title>
    <defs>
      <marker id="ef-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M1 1.5L8.5 5L1 8.5" fill="none" stroke="#22D3A6" stroke-width="1.6" stroke-linecap="square"/>
      </marker>
      <marker id="ef-arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M1 1.5L8.5 5L1 8.5" fill="none" stroke="#6E829E" stroke-width="1.5" stroke-linecap="square"/>
      </marker>
    </defs>

    <!-- Background precision grid lines -->
    <g stroke="rgba(148,173,204,0.08)" stroke-width="1">
      <line x1="20" y1="74" x2="620" y2="74"/>
      <line x1="20" y1="158" x2="620" y2="158"/>
      <line x1="20" y1="242" x2="620" y2="242"/>
      <line x1="20" y1="326" x2="620" y2="326"/>
    </g>

    <!-- Step 1: AI Agent -->
    <rect x="24" y="26" width="268" height="72" rx="6" fill="#131B28" stroke="rgba(148,173,204,0.28)"/>
    <text x="42" y="49" fill="#8FA3BE" font-family="ui-monospace, monospace" font-size="11">01 · REASONING PLANE</text>
    <text x="42" y="71" fill="#F4F7FB" font-family="system-ui, sans-serif" font-size="15" font-weight="600">AI Agent receives prompt</text>
    <text x="42" y="88" fill="#9FB0C7" font-family="system-ui, sans-serif" font-size="11.5">Decides intent, target URL &amp; limits</text>

    <!-- Step 2: ExportFlow Contract & Policy -->
    <rect x="348" y="26" width="268" height="72" rx="6" fill="#131B28" stroke="#22D3A6" stroke-width="1.4"/>
    <text x="366" y="49" fill="#22D3A6" font-family="ui-monospace, monospace" font-size="11">02 · CONTRACT GATEWAY</text>
    <text x="366" y="71" fill="#F4F7FB" font-family="system-ui, sans-serif" font-size="15" font-weight="600">Request reaches ExportFlow</text>
    <text x="366" y="88" fill="#9FB0C7" font-family="system-ui, sans-serif" font-size="11.5">Bearer auth · 32 KiB JSON · Rate limit</text>

    <line x1="292" y1="62" x2="342" y2="62" stroke="#22D3A6" stroke-width="1.6" marker-end="url(#ef-arrow)"/>

    <!-- Step 3: Validation & Router -->
    <rect x="24" y="142" width="592" height="76" rx="6" fill="#101723" stroke="rgba(148,173,204,0.28)"/>
    <text x="42" y="165" fill="#22D3A6" font-family="ui-monospace, monospace" font-size="11">03 · VALIDATION, EGRESS &amp; ROUTER</text>
    <text x="42" y="187" fill="#F4F7FB" font-family="system-ui, sans-serif" font-size="15" font-weight="600">Policy checks URL safety and routes to lightest path</text>
    <text x="42" y="205" fill="#9FB0C7" font-family="ui-monospace, monospace" font-size="11">egress-guard (no private/IP targets) -&gt; chooseExecutionPath() -&gt; http | browser</text>

    <path d="M482 98V120H320V136" fill="none" stroke="#22D3A6" stroke-width="1.6" marker-end="url(#ef-arrow)"/>

    <!-- Step 4: Execution Engines -->
    <rect x="24" y="258" width="184" height="84" rx="6" fill="#131B28" stroke="#22D3A6" stroke-width="1.2"/>
    <text x="38" y="280" fill="#22D3A6" font-family="ui-monospace, monospace" font-size="10.5">04 · ENGINE (ACTIVE LOCAL)</text>
    <text x="38" y="302" fill="#F4F7FB" font-family="system-ui, sans-serif" font-size="14" font-weight="600">http.fetch.v1</text>
    <text x="38" y="320" fill="#9FB0C7" font-family="system-ui, sans-serif" font-size="11">Bounded GET · 1 MiB cap</text>
    <text x="38" y="334" fill="#9FB0C7" font-family="system-ui, sans-serif" font-size="11">3 redirects max · 8s max</text>

    <rect x="224" y="258" width="184" height="84" rx="6" fill="#111722" stroke="rgba(148,173,204,0.2)" stroke-dasharray="4 3"/>
    <text x="238" y="280" fill="#8FA3BE" font-family="ui-monospace, monospace" font-size="10.5">PROTOTYPE ADAPTERS</text>
    <text x="238" y="302" fill="#CBD5E1" font-family="system-ui, sans-serif" font-size="14" font-weight="600">Extract / Crawl / Search</text>
    <text x="238" y="320" fill="#7D91AC" font-family="system-ui, sans-serif" font-size="11">Internal Core modules</text>
    <text x="238" y="334" fill="#7D91AC" font-family="system-ui, sans-serif" font-size="11">501 until phase enabled</text>

    <!-- Step 5: Evidence & Return -->
    <rect x="424" y="258" width="192" height="84" rx="6" fill="#131B28" stroke="rgba(148,173,204,0.34)"/>
    <text x="438" y="280" fill="#22D3A6" font-family="ui-monospace, monospace" font-size="10.5">05 · STRUCTURED RETURN</text>
    <text x="438" y="302" fill="#F4F7FB" font-family="system-ui, sans-serif" font-size="14" font-weight="600">Result &amp; Evidence</text>
    <text x="438" y="320" fill="#9FB0C7" font-family="system-ui, sans-serif" font-size="11">Normalized JSON envelope</text>
    <text x="438" y="334" fill="#9FB0C7" font-family="system-ui, sans-serif" font-size="11">Final URL, hops, timestamps</text>

    <line x1="116" y1="218" x2="116" y2="252" stroke="#22D3A6" stroke-width="1.6" marker-end="url(#ef-arrow)"/>
    <line x1="316" y1="218" x2="316" y2="252" stroke="#6E829E" stroke-width="1.3" stroke-dasharray="3 3" marker-end="url(#ef-arrow-muted)"/>
    <line x1="208" y1="300" x2="418" y2="300" stroke="#22D3A6" stroke-width="1.5" marker-end="url(#ef-arrow)"/>
  </svg>
  <ol class="ef-exec-steps-compact">
    <li><span>01</span> AI Agent emits task goal and URL</li>
    <li><span>02</span> ExportFlow authenticates and validates JSON contract</li>
    <li><span>03</span> Egress policy &amp; router select execution path</li>
    <li><span>04</span> Appropriate engine executes inside strict limits</li>
    <li><span>05</span> Normalized data + source evidence return to agent</li>
  </ol>
</div>`;
}
