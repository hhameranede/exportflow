export const SITE_CSS = `:root {
  color-scheme: light;
  --bg-canvas: #f8fafc;
  --bg-surface: #ffffff;
  --bg-surface-raised: #f1f5f9;
  --bg-code: #f6f8fc;
  --border-hairline: rgba(15, 23, 42, 0.09);
  --border-strong: rgba(15, 23, 42, 0.16);
  --text-primary: #0b1220;
  --text-secondary: #334155;
  --text-muted: #475569;
  --accent: #1d4ed8;
  --accent-hover: #1e40af;
  --accent-ink: #ffffff;
  --accent-tint: rgba(29, 78, 216, 0.08);
  --accent-border: rgba(29, 78, 216, 0.28);
  --warn-text: #b45309;
  --warn-bg: rgba(217, 119, 6, 0.08);
  --warn-border: rgba(217, 119, 6, 0.28);
  --danger-text: #dc2626;
  --danger-bg: rgba(220, 38, 38, 0.08);
  --danger-border: rgba(220, 38, 38, 0.28);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --max-width: 1180px;
  --header-height: 68px;
  --space-section: clamp(48px, 6vw, 84px);
  --shadow-subtle: 0 1px 3px rgba(15, 23, 42, 0.06), 0 10px 24px -10px rgba(15, 23, 42, 0.08);
  --font-sans: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  background: var(--bg-canvas);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.6;
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg-canvas);
  color: var(--text-primary);
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

img,
svg {
  display: block;
  max-width: 100%;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.ef-skip-link {
  position: absolute;
  left: -9999px;
  top: 8px;
  z-index: 200;
  padding: 10px 16px;
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 600;
  border-radius: var(--radius-sm);
}

.ef-skip-link:focus {
  left: 16px;
}

.ef-container {
  width: min(var(--max-width), calc(100% - 32px));
  margin-inline: auto;
}

@media (min-width: 768px) {
  .ef-container {
    width: min(var(--max-width), calc(100% - 48px));
  }
}

/* Header: 3-zone top bar contract */
.ef-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(248, 250, 252, 0.88);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-hairline);
}

.ef-header-inner {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
}

.ef-brand {
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

.ef-nav {
  display: none;
  align-items: center;
  gap: 28px;
}

.ef-nav-link {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
  padding: 6px 0;
  border-bottom: 1.5px solid transparent;
  transition: color 160ms ease, border-color 160ms ease;
}

.ef-nav-link:hover {
  color: var(--text-primary);
  border-bottom-color: var(--border-strong);
}

.ef-nav-link[aria-current="page"] {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.ef-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.ef-menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-primary);
}

.ef-mobile-drawer {
  display: none;
  border-top: 1px solid var(--border-hairline);
  background: var(--bg-surface);
  padding: 12px 16px 20px;
}

.ef-mobile-drawer.is-open {
  display: block;
}

.ef-mobile-nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ef-mobile-nav-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-weight: 500;
}

.ef-mobile-nav-link[aria-current="page"] {
  background: var(--accent-tint);
  color: var(--accent);
}

@media (min-width: 820px) {
  .ef-nav {
    display: flex;
  }
  .ef-menu-toggle {
    display: none;
  }
  .ef-mobile-drawer {
    display: none !important;
  }
}

/* Buttons */
.ef-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 9px 18px;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-primary);
  transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.ef-btn:hover {
  background: var(--bg-surface-raised);
  border-color: var(--text-muted);
}

.ef-btn-primary {
  background: var(--accent);
  color: var(--accent-ink);
  border-color: var(--accent);
}

.ef-btn-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.ef-btn-sm {
  min-height: 36px;
  padding: 6px 12px;
  font-size: 0.8125rem;
}

@media (max-width: 819px) {
  .ef-btn {
    min-height: 44px;
  }
}

/* Main & Sections */
.ef-main {
  flex: 1 0 auto;
}

.ef-section {
  padding-block: var(--space-section);
  border-top: 1px solid var(--border-hairline);
}

.ef-section-tight {
  padding-block: clamp(32px, 4vw, 52px);
}

.ef-hero {
  padding-block: clamp(44px, 6.5vw, 84px);
}

.ef-hero-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 36px;
  align-items: center;
}

@media (min-width: 980px) {
  .ef-hero-grid {
    grid-template-columns: minmax(0, 1.02fr) minmax(0, 1.12fr);
    gap: 44px;
  }
}

.ef-hero-copy {
  min-width: 0;
}

.ef-kicker {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  color: var(--accent);
  margin: 0 0 14px;
}

.ef-h1 {
  font-size: clamp(2.25rem, 4.2vw, 3.6rem);
  line-height: 1.08;
  letter-spacing: -0.035em;
  font-weight: 700;
  margin: 0 0 16px;
  text-wrap: balance;
}

.ef-subheadline {
  font-size: clamp(1.0625rem, 1.6vw, 1.25rem);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 14px;
  letter-spacing: -0.01em;
}

.ef-lead {
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.68;
  max-width: 58ch;
  margin: 0 0 26px;
}

.ef-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.ef-meta-line {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.ef-page-header {
  padding-block: clamp(36px, 5vw, 60px);
  border-bottom: 1px solid var(--border-hairline);
}

.ef-page-title {
  font-size: clamp(2rem, 3.6vw, 2.9rem);
  line-height: 1.12;
  letter-spacing: -0.03em;
  margin: 0 0 14px;
  text-wrap: balance;
}

.ef-section-head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}

@media (min-width: 820px) {
  .ef-section-head-split {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-end;
    gap: 32px;
  }
}

.ef-h2 {
  font-size: clamp(1.5rem, 2.8vw, 2.15rem);
  line-height: 1.18;
  letter-spacing: -0.025em;
  margin: 0;
  text-wrap: balance;
}

.ef-h3 {
  font-size: 1.125rem;
  line-height: 1.3;
  letter-spacing: -0.015em;
  margin: 0;
}

.ef-section-note {
  color: var(--text-secondary);
  max-width: 52ch;
  margin: 0;
  font-size: 0.95rem;
}

/* Execution Graphic Container */
.ef-exec-visual {
  min-width: 0;
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-lg);
  padding: 18px;
  box-shadow: var(--shadow-subtle);
}

.ef-exec-visual-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-hairline);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.ef-mono-label {
  color: var(--accent);
  font-weight: 600;
}

.ef-mono-subtle {
  color: var(--text-muted);
}

.ef-schematic-svg {
  width: 100%;
  height: auto;
}

.ef-exec-steps-compact {
  display: none;
  margin: 14px 0 0;
  padding: 14px 0 0;
  border-top: 1px solid var(--border-hairline);
  list-style: none;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.ef-exec-steps-compact li {
  display: flex;
  gap: 10px;
}

.ef-exec-steps-compact span {
  font-family: var(--font-mono);
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 520px) {
  .ef-exec-steps-compact {
    display: grid;
  }
}

/* Cards & Grids */
.ef-pillars-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1px;
  background: var(--border-hairline);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  overflow: hidden;
}

@media (min-width: 680px) {
  .ef-pillars-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1020px) {
  .ef-pillars-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.ef-pillar {
  background: var(--bg-surface);
  padding: 24px;
  min-width: 0;
}

.ef-pillar-num {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  margin-bottom: 10px;
}

.ef-pillar p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

/* Segmented Filter Controls */
.ef-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  width: fit-content;
  max-width: 100%;
}

.ef-filter-btn {
  min-height: 36px;
  padding: 6px 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 150ms ease, color 150ms ease;
}

.ef-filter-btn:hover {
  color: var(--text-primary);
}

.ef-filter-btn[aria-pressed="true"] {
  background: var(--bg-surface-raised);
  color: var(--accent);
  border-color: var(--accent-border);
}

.ef-capabilities-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 720px) {
  .ef-capabilities-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1060px) {
  .ef-capabilities-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.ef-cap-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.ef-cap-card[data-featured="true"] {
  border-color: var(--accent-border);
}

.ef-cap-card.is-hidden {
  display: none;
}

.ef-cap-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.74rem;
}

.ef-maturity-tag {
  padding: 2px 7px;
  border-radius: 3px;
  border: 1px solid var(--border-strong);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 0.74rem;
  white-space: nowrap;
}

.ef-maturity-tag[data-maturity="local-verified"] {
  border-color: var(--accent-border);
  background: var(--accent-tint);
  color: var(--accent);
}

.ef-maturity-tag[data-maturity="prototype"],
.ef-maturity-tag[data-maturity="in-development"] {
  border-color: var(--warn-border);
  background: var(--warn-bg);
  color: var(--warn-text);
}

.ef-maturity-tag[data-maturity="concept"] {
  border-color: var(--border-strong);
  color: var(--text-muted);
}

.ef-cap-summary {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
  flex: 1 0 auto;
}

.ef-cap-adapter {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-muted);
}

.ef-cap-details {
  padding-top: 12px;
  border-top: 1px solid var(--border-hairline);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.ef-cap-details[hidden] {
  display: none;
}

.ef-cap-limits {
  margin: 10px 0 0;
  padding-left: 18px;
  color: var(--text-muted);
}

.ef-cap-limits li + li {
  margin-top: 4px;
}

.ef-inline-toggle {
  align-self: flex-start;
  background: transparent;
  border: 1px solid var(--border-hairline);
  color: var(--text-secondary);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  min-height: 36px;
}

.ef-inline-toggle:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

/* Callout / Notice Box */
.ef-notice {
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (min-width: 760px) {
  .ef-notice-split {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }
}

.ef-notice-warn {
  background: var(--warn-bg);
  border-color: var(--warn-border);
}

.ef-notice-title {
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.ef-notice-body {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

/* Platform Architecture Interactive Stack */
.ef-arch-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
}

@media (min-width: 920px) {
  .ef-arch-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  }
}

.ef-layer-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ef-layer-btn {
  width: 100%;
  text-align: left;
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  cursor: pointer;
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.ef-layer-btn:hover {
  border-color: var(--border-strong);
  background: var(--bg-surface-raised);
}

.ef-layer-btn[aria-selected="true"] {
  border-color: var(--accent);
  background: var(--accent-tint);
}

.ef-layer-step {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.ef-layer-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.ef-layer-arrow {
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.ef-layer-inspector {
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: 24px;
  min-width: 0;
}

.ef-inspector-meta {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--accent);
  margin-bottom: 8px;
}

.ef-inspector-list {
  display: grid;
  gap: 16px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--border-hairline);
}

.ef-inspector-item dt {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.ef-inspector-item dd {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.ef-compare-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 760px) {
  .ef-compare-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ef-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  padding: 22px;
  min-width: 0;
}

.ef-panel h3 {
  margin: 0 0 10px;
}

.ef-panel p,
.ef-panel li {
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.ef-list {
  margin: 12px 0 0;
  padding-left: 18px;
}

.ef-list li + li {
  margin-top: 6px;
}

/* Use Cases */
.ef-usecase-list {
  display: grid;
  gap: 20px;
}

.ef-usecase-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  padding: 24px;
  min-width: 0;
}

.ef-usecase-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

/* Keep readiness labels from overflowing narrow use-case cards. */
.ef-usecase-head .ef-maturity-tag {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.45;
}


.ef-usecase-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--border-hairline);
}

@media (min-width: 820px) {
  .ef-usecase-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.ef-usecase-col h4 {
  margin: 0 0 6px;
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--accent);
}

.ef-usecase-col p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

/* Code Blocks & Copy Controls */
.ef-code-wrap {
  margin-top: 14px;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--bg-code);
  overflow: hidden;
  max-width: 100%;
}

.ef-code-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border-hairline);
  background: var(--bg-surface);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.ef-copy-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  cursor: pointer;
  min-height: 30px;
  white-space: nowrap;
}

.ef-copy-btn:hover {
  border-color: var(--accent-border);
  color: var(--text-primary);
}

.ef-pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--text-primary);
  tab-size: 2;
  max-width: 100%;
}

/* Developers Documentation Layout */
.ef-docs-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 32px;
  align-items: start;
}

@media (min-width: 960px) {
  .ef-docs-layout {
    grid-template-columns: 230px minmax(0, 1fr);
  }
}

.ef-docs-nav {
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  padding: 14px;
}

@media (min-width: 960px) {
  .ef-docs-nav {
    position: sticky;
    top: calc(var(--header-height) + 20px);
  }
}

.ef-docs-nav-title {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--text-muted);
  margin: 0 0 10px;
  padding-inline: 8px;
}

.ef-docs-nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

@media (min-width: 960px) {
  .ef-docs-nav ul {
    flex-direction: column;
  }
}

.ef-docs-nav a {
  display: block;
  padding: 6px 8px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
}

.ef-docs-nav a:hover {
  background: var(--bg-surface-raised);
  color: var(--text-primary);
}

.ef-docs-content {
  min-width: 0;
  display: grid;
  gap: 36px;
}

.ef-doc-block {
  min-width: 0;
  padding-bottom: 32px;
  border-bottom: 1px solid var(--border-hairline);
}

.ef-doc-block:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.ef-doc-block h2 {
  margin: 0 0 12px;
  font-size: 1.45rem;
  letter-spacing: -0.02em;
}

.ef-doc-block p {
  margin: 0 0 12px;
  color: var(--text-secondary);
  max-width: 72ch;
}

.ef-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  margin-top: 12px;
}

.ef-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
  text-align: left;
  min-width: 580px;
}

.ef-table th,
.ef-table td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border-hairline);
  vertical-align: top;
}

.ef-table th {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--bg-surface-raised);
}

.ef-table tr:last-child td {
  border-bottom: 0;
}

.ef-mono-cell {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

/* Interactive Demo Workbench */
.ef-demo-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
}

@media (min-width: 960px) {
  .ef-demo-grid {
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  }
}

.ef-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.ef-form-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 560px) {
  .ef-form-row {
    grid-template-columns: 1fr;
  }
}

.ef-label {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.ef-input,
.ef-select {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  background: var(--bg-code);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.ef-check-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 12px 0 18px;
}

.ef-check-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.ef-pipeline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 18px;
}

.ef-stage-node {
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 0.8rem;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.ef-stage-node .ef-stage-idx {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}

.ef-stage-node .ef-stage-name {
  font-weight: 600;
  margin-top: 2px;
}

.ef-stage-node[data-state="passed"] {
  border-color: var(--accent-border);
  background: var(--accent-tint);
}

.ef-stage-node[data-state="passed"] .ef-stage-idx {
  color: var(--accent);
}

.ef-stage-node[data-state="failed"] {
  border-color: var(--danger-border);
  background: var(--danger-bg);
}

.ef-stage-node[data-state="failed"] .ef-stage-idx {
  color: var(--danger-text);
}

.ef-stage-node[data-state="unsupported"] {
  border-color: var(--warn-border);
  background: var(--warn-bg);
}

.ef-stage-node[data-state="skipped"] {
  opacity: 0.52;
}

.ef-demo-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.ef-demo-panel[hidden] {
  display: none;
}

.ef-kv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.ef-kv-card {
  background: var(--bg-code);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.ef-kv-card dt {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}

.ef-kv-card dd {
  margin: 4px 0 0;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  word-break: break-word;
}

/* FAQ */
.ef-faq-list {
  display: grid;
  gap: 10px;
}

.ef-faq-item {
  background: var(--bg-surface);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-md);
}

.ef-faq-item[hidden] {
  display: none;
}

.ef-faq-summary {
  list-style: none;
  cursor: pointer;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-weight: 600;
  min-height: 56px;
}

.ef-faq-summary::-webkit-details-marker {
  display: none;
}

.ef-faq-meta {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--accent);
  white-space: nowrap;
}

.ef-faq-body {
  padding: 0 20px 18px;
  color: var(--text-secondary);
  font-size: 0.94rem;
  border-top: 1px solid var(--border-hairline);
  padding-top: 14px;
}

/* Footer */
.ef-footer {
  margin-top: auto;
  border-top: 1px solid var(--border-hairline);
  background: var(--bg-canvas);
  padding: 40px 0 32px;
}

.ef-footer-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--border-hairline);
}

@media (min-width: 780px) {
  .ef-footer-grid {
    grid-template-columns: 1.5fr 1fr 1fr;
  }
}

.ef-footer-desc {
  color: var(--text-muted);
  font-size: 0.875rem;
  max-width: 44ch;
  margin: 10px 0 0;
}

.ef-footer-heading {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0 0 12px;
}

.ef-footer-links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.ef-footer-links a:hover {
  color: var(--accent);
}

.ef-footer-bottom {
  padding-top: 20px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px 24px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

code {
  font-family: var(--font-mono);
  font-size: 0.88em;
  background: rgba(15, 23, 42, 0.06);
  padding: 2px 6px;
  border-radius: 3px;
}

.ef-m-0 { margin: 0; }
.ef-mt-0 { margin-top: 0; }
.ef-mt-2 { margin-top: 8px; }
.ef-mt-3 { margin-top: 14px; }
.ef-mt-4 { margin-top: 20px; }
.ef-mb-2 { margin-bottom: 8px; }
.ef-mb-3 { margin-bottom: 14px; }
.ef-mb-4 { margin-bottom: 20px; }
.ef-flex-between {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.ef-mono-xs {
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
`;
