export const MARKETING_CSS = `/* ==========================================================================
   ExportFlow Design Tokens & Daylight Architectural Stylesheet
   Light-First Default + Optional Manual Dark Mode
   ========================================================================== */

:root {
  color-scheme: light;

  /* Core Surfaces (Daylight Architectural Default) */
  --bg: #F8FAFC;
  --surface-1: #FFFFFF;
  --surface-2: #F1F5F9;
  --surface-glass: rgba(248, 250, 252, 0.88);
  --border: rgba(15, 23, 42, 0.08);
  --border-strong: rgba(15, 23, 42, 0.16);

  /* Typography */
  --text: #0B1220;
  --text-muted: #475569;
  --text-dim: #64748B;

  /* Primary Accents (Architectural Cobalt -> Cerulean) */
  --accent: #1D4ED8;
  --accent-2: #0284C7;
  --accent-ink: #FFFFFF;
  --accent-tint: rgba(29, 78, 216, 0.08);
  --accent-border: rgba(29, 78, 216, 0.28);

  /* Semantic Status Tokens (Icon + Text always paired, WCAG AA >= 4.5:1) */
  --status-available: #059669;
  --status-available-text: #047857;
  --status-available-bg: rgba(5, 150, 105, 0.09);
  --status-available-border: rgba(5, 150, 105, 0.28);

  --status-dev: #D97706;
  --status-dev-text: #B45309;
  --status-dev-bg: rgba(217, 119, 6, 0.10);
  --status-dev-border: rgba(217, 119, 6, 0.28);

  --status-planned: #64748B;
  --status-planned-text: #475569;
  --status-planned-bg: rgba(100, 116, 139, 0.09);
  --status-planned-border: rgba(100, 116, 139, 0.24);

  --danger: #DC2626;
  --danger-bg: rgba(220, 38, 38, 0.08);
  --danger-border: rgba(220, 38, 38, 0.28);

  /* Execution Graph Tokens */
  --graph-core-a: #EFF6FF;
  --graph-core-b: #FFFFFF;
  --graph-grid: rgba(15, 23, 42, 0.05);
  --hero-grid: rgba(15, 23, 42, 0.045);
  --hero-glow-a: rgba(29, 78, 216, 0.08);
  --hero-glow-b: rgba(2, 132, 199, 0.06);

  /* Code Workbench Syntax Tokens (Luminous Light Surface) */
  --code-bg: #F6F8FC;
  --code-head: #FFFFFF;
  --code-key: #1D4ED8;
  --code-str: #047857;
  --code-num: #B45309;
  --code-dim: #64748B;
  --code-punc: #475569;
  --code-result-bg: #ECFDF5;
  --code-result-border: rgba(5, 150, 105, 0.24);
  --code-result-text: #047857;
  --code-warn-bg: #FFFBEB;
  --code-warn-border: rgba(217, 119, 6, 0.28);
  --code-warn-text: #B45309;

  /* Font Stacks */
  --font-sans: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-ar: "IBM Plex Sans Arabic", "Noto Sans Arabic", var(--font-sans);
  --font-zh: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", var(--font-sans);
  --font-ja: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", var(--font-sans);

  /* Fluid Type Scale */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: clamp(1.25rem, 1.8vw, 1.5rem);
  --text-2xl: clamp(1.75rem, 3.2vw, 2.5rem);
  --text-hero: clamp(2.35rem, 5vw, 4.1rem);

  /* 8px Spacing Scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 48px;
  --space-8: 64px;
  --space-12: 96px;
  --space-16: 128px;

  /* Layout */
  --container-max: 1200px;
  --header-h: 68px;

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* Crisp Architectural Shadows */
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
  --shadow-md: 0 6px 20px -4px rgba(15, 23, 42, 0.07), 0 1px 3px rgba(15, 23, 42, 0.04);
  --shadow-lg: 0 20px 44px -12px rgba(15, 23, 42, 0.11), 0 2px 6px rgba(15, 23, 42, 0.04);

  /* Motion */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 150ms;
  --dur-base: 300ms;
  --dur-slow: 600ms;
}

/* Optional Manual Dark Theme Override */
html[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0b0f17;
  --surface-1: #111826;
  --surface-2: #172033;
  --surface-glass: rgba(11, 15, 23, 0.82);
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.16);

  --text: #E6EAF2;
  --text-muted: #9AA6B8;
  --text-dim: #8391A7;

  --accent: #4F8CFF;
  --accent-2: #22D3EE;
  --accent-ink: #07101F;
  --accent-tint: rgba(79, 140, 255, 0.14);
  --accent-border: rgba(79, 140, 255, 0.38);

  --status-available: #34D399;
  --status-available-text: #34D399;
  --status-available-bg: rgba(52, 211, 153, 0.10);
  --status-available-border: rgba(52, 211, 153, 0.30);

  --status-dev: #FBBF24;
  --status-dev-text: #FBBF24;
  --status-dev-bg: rgba(251, 191, 36, 0.10);
  --status-dev-border: rgba(251, 191, 36, 0.30);

  --status-planned: #8B97AD;
  --status-planned-text: #9BA7BC;
  --status-planned-bg: rgba(139, 151, 173, 0.10);
  --status-planned-border: rgba(139, 151, 173, 0.24);

  --danger: #F87171;
  --danger-bg: rgba(248, 113, 113, 0.10);
  --danger-border: rgba(248, 113, 113, 0.34);

  --graph-core-a: #152136;
  --graph-core-b: #101726;
  --graph-grid: rgba(255, 255, 255, 0.05);
  --hero-grid: rgba(255, 255, 255, 0.035);
  --hero-glow-a: rgba(79, 140, 255, 0.14);
  --hero-glow-b: rgba(34, 211, 238, 0.08);

  --code-bg: #080C13;
  --code-head: #0E1420;
  --code-key: #7AB8FF;
  --code-str: #34D399;
  --code-num: #FBBF24;
  --code-dim: #8391A7;
  --code-punc: #94A3B8;
  --code-result-bg: rgba(52, 211, 153, 0.08);
  --code-result-border: rgba(52, 211, 153, 0.24);
  --code-result-text: #34D399;
  --code-warn-bg: rgba(251, 191, 36, 0.08);
  --code-warn-border: rgba(251, 191, 36, 0.26);
  --code-warn-text: #FBBF24;

  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.28);
  --shadow-md: 0 12px 32px rgba(0, 0, 0, 0.36);
  --shadow-lg: 0 24px 64px rgba(0, 0, 0, 0.48);
}

/* ==========================================================================
   Reset & Base
   ========================================================================== */

*, *::before, *::after {
  box-sizing: border-box;
}

html {
  background-color: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  scroll-behavior: smooth;
  overflow-x: clip;
}

html[lang="ar"] body { font-family: var(--font-ar); }
html[lang="zh"] body { font-family: var(--font-zh); }
html[lang="ja"] body { font-family: var(--font-ja); }

body {
  margin: 0;
  min-height: 100vh;
  background-color: var(--bg);
  color: var(--text);
  display: flex;
  flex-direction: column;
  overflow-x: clip;
  transition: background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out);
}

img, svg {
  display: block;
  max-width: 100%;
}

a {
  color: inherit;
  text-decoration: none;
}

button, input, select, textarea {
  font: inherit;
  color: inherit;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.ef-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.ef-skip-link {
  position: fixed;
  inset-block-start: var(--space-2);
  inset-inline-start: var(--space-3);
  z-index: 900;
  padding: 10px 16px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius-sm);
  transform: translateY(-220%);
  transition: transform var(--dur-fast) var(--ease-out);
}

.ef-skip-link:focus {
  transform: translateY(0);
}

.ef-container {
  width: min(var(--container-max), calc(100% - 32px));
  margin-inline: auto;
}

@media (min-width: 768px) {
  .ef-container {
    width: min(var(--container-max), calc(100% - 64px));
  }
}

.ef-main {
  flex: 1 0 auto;
  animation: ef-route-in var(--dur-base) var(--ease-out) both;
}

@keyframes ef-route-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.ef-icon {
  flex-shrink: 0;
}

.ef-icon-xs { width: 13px; height: 13px; }
.ef-icon-sm { width: 16px; height: 16px; }
.ef-icon-md { width: 20px; height: 20px; }

html[dir="rtl"] .ef-dir-arrow {
  transform: scaleX(-1);
}

/* ==========================================================================
   Buttons & Badges (Design System)
   ========================================================================== */

.ef-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    transform var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.ef-btn:active {
  transform: scale(0.98);
}

.ef-btn .ef-btn-arrow {
  transition: transform var(--dur-fast) var(--ease-out);
}

.ef-btn:hover .ef-btn-arrow {
  transform: translateX(2px);
}

html[dir="rtl"] .ef-btn:hover .ef-btn-arrow {
  transform: translateX(-2px);
}

.ef-btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--accent-ink);
  border-color: transparent;
  box-shadow: 0 2px 10px rgba(29, 78, 216, 0.22);
}

.ef-btn-primary:hover {
  filter: brightness(1.06);
  box-shadow: 0 6px 20px rgba(29, 78, 216, 0.28);
}

html[data-theme="dark"] .ef-btn-primary {
  color: #06101E;
  box-shadow: 0 2px 14px rgba(79, 140, 255, 0.25);
}

.ef-btn-secondary {
  background: var(--surface-1);
  color: var(--text);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

.ef-btn-secondary:hover {
  background: var(--surface-2);
  border-color: var(--text-muted);
}

.ef-btn-ghost {
  background: transparent;
  color: var(--text-muted);
  border-color: transparent;
  padding-inline: 12px;
}

.ef-btn-ghost:hover {
  color: var(--text);
  background: var(--surface-1);
}

.ef-btn-sm {
  min-height: 36px;
  padding: 6px 14px;
  font-size: 0.8125rem;
}

.ef-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 38px;
  min-height: 38px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text-muted);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}

.ef-icon-btn:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--surface-2);
}

.ef-icon-btn:active {
  transform: scale(0.97);
}

@media (max-width: 767px) {
  .ef-icon-btn, .ef-btn-sm {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Status Badges (Icon + Text always, never color alone) */
.ef-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  border: 1px solid var(--border);
}

.ef-badge-available {
  color: var(--status-available-text);
  background: var(--status-available-bg);
  border-color: var(--status-available-border);
}

.ef-badge-dev {
  color: var(--status-dev-text);
  background: var(--status-dev-bg);
  border-color: var(--status-dev-border);
}

.ef-badge-planned {
  color: var(--status-planned-text);
  background: var(--status-planned-bg);
  border-color: var(--status-planned-border);
}

/* ==========================================================================
   Sticky Header & Navigation
   ========================================================================== */

.ef-header {
  position: sticky;
  top: 0;
  z-index: 200;
  height: var(--header-h);
  border-bottom: 1px solid transparent;
  background: transparent;
  transition:
    background-color var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    backdrop-filter var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);
}

.ef-header.is-scrolled {
  background: var(--surface-glass);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom-color: var(--border);
  box-shadow: var(--shadow-sm);
}

.ef-header-inner {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.ef-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text);
  white-space: nowrap;
  flex-shrink: 0;
}

.ef-brand-muted {
  color: var(--text-muted);
  font-weight: 500;
}

.ef-mark {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-sm);
  color: var(--accent);
}

.ef-nav {
  display: none;
  align-items: center;
  gap: 28px;
}

.ef-nav a {
  position: relative;
  padding-block: 6px;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  transition: color var(--dur-fast) var(--ease-out);
}

.ef-nav a::after {
  content: "";
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  transform: scaleX(0);
  transform-origin: start;
  transition: transform var(--dur-base) var(--ease-out);
}

.ef-nav a:hover,
.ef-nav a[aria-current="page"] {
  color: var(--text);
}

.ef-nav a:hover::after,
.ef-nav a[aria-current="page"]::after {
  transform: scaleX(1);
}

.ef-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.ef-signin-link {
  display: none;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-muted);
  padding: 6px 10px;
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease-out);
}

.ef-signin-link:hover {
  color: var(--text);
}

.ef-header-cta {
  display: none;
}

@media (min-width: 960px) {
  .ef-nav { display: flex; }
  .ef-signin-link { display: inline-flex; }
  .ef-header-cta { display: inline-flex; }
  .ef-menu-toggle { display: none !important; }
}

/* Custom Accessible Language Switcher */
.ef-lang-switcher {
  position: relative;
}

.ef-lang-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text-muted);
  box-shadow: var(--shadow-sm);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}

.ef-lang-trigger:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--surface-2);
}

.ef-lang-menu {
  position: absolute;
  inset-block-start: calc(100% + 8px);
  inset-inline-end: 0;
  min-width: 192px;
  padding: 6px;
  margin: 0;
  list-style: none;
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 400;
  opacity: 0;
  transform: translateY(-6px);
  pointer-events: none;
  transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}

.ef-lang-switcher.is-open .ef-lang-menu {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.ef-lang-menu[hidden] {
  display: none;
}

.ef-lang-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  text-align: start;
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}

.ef-lang-option:hover,
.ef-lang-option:focus-visible {
  background: var(--surface-2);
  color: var(--text);
}

.ef-lang-option[aria-selected="true"] {
  background: var(--accent-tint);
  color: var(--accent);
  font-weight: 600;
}

.ef-lang-code {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-transform: uppercase;
  opacity: 0.75;
}

/* Mobile Drawer */
.ef-menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}

.ef-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(11, 18, 32, 0.36);
  backdrop-filter: blur(4px);
  z-index: 290;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur-base) var(--ease-out);
}

.ef-drawer-backdrop.is-open {
  opacity: 1;
  pointer-events: auto;
}

.ef-mobile-drawer {
  position: fixed;
  inset-block: 0;
  inset-inline-end: 0;
  width: min(340px, 88vw);
  z-index: 300;
  background: var(--surface-1);
  border-inline-start: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  transform: translateX(105%);
  transition: transform var(--dur-base) var(--ease-out);
  overflow-y: auto;
}

html[dir="rtl"] .ef-mobile-drawer {
  transform: translateX(-105%);
}

.ef-mobile-drawer.is-open {
  transform: translateX(0) !important;
}

.ef-mobile-drawer[hidden] {
  display: none;
}

.ef-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border);
}

.ef-drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ef-drawer-nav a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-weight: 500;
}

.ef-drawer-nav a:hover,
.ef-drawer-nav a[aria-current="page"] {
  background: var(--surface-2);
  color: var(--text);
}

.ef-drawer-actions {
  margin-top: auto;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
  display: grid;
  gap: 10px;
}

/* ==========================================================================
   Hero Section & Ambient Motion
   ========================================================================== */

.ef-hero {
  position: relative;
  overflow: hidden;
  padding-block: clamp(44px, 6.5vw, 96px) clamp(56px, 7.5vw, 108px);
  border-bottom: 1px solid var(--border);
}

.ef-hero-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.ef-hero-grid-bg {
  position: absolute;
  inset: -40px;
  background-image:
    linear-gradient(to right, var(--hero-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--hero-grid) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 100%);
  animation: ef-grid-drift 28s linear infinite;
}

.ef-hero-aurora {
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(ellipse 45% 40% at 75% 32%, var(--hero-glow-a), transparent 70%),
    radial-gradient(ellipse 40% 35% at 25% 70%, var(--hero-glow-b), transparent 70%);
  animation: ef-aurora-shift 24s ease-in-out infinite alternate;
}

@keyframes ef-grid-drift {
  0% { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(48px, 48px, 0); }
}

@keyframes ef-aurora-shift {
  0% { transform: translate3d(0, 0, 0) scale(1); }
  100% { transform: translate3d(-2%, 2%, 0) scale(1.04); }
}

.ef-hero-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
  align-items: center;
}

@media (min-width: 1024px) {
  .ef-hero-grid {
    grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
    gap: 52px;
  }
}

.ef-hero-copy {
  min-width: 0;
}

.ef-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--accent);
}

html[dir="rtl"] .ef-eyebrow {
  letter-spacing: 0;
}

.ef-hero-title {
  margin: 0 0 var(--space-4);
  font-size: var(--text-hero);
  font-weight: 700;
  line-height: 1.04;
  letter-spacing: -0.04em;
  max-width: 15ch;
  text-wrap: balance;
}

html[dir="rtl"] .ef-hero-title {
  letter-spacing: -0.015em;
  line-height: 1.18;
}

.ef-hero-lead {
  margin: 0 0 var(--space-3);
  max-width: 56ch;
  font-size: clamp(1rem, 1.3vw, 1.125rem);
  line-height: 1.65;
  color: var(--text-muted);
}

.ef-hero-tagline {
  margin: 0 0 var(--space-5);
  max-width: 56ch;
  font-size: var(--text-sm);
  color: var(--text);
  font-weight: 600;
}

.ef-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.ef-hero-meta {
  margin-top: var(--space-5);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.ef-motion-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text-muted);
  box-shadow: var(--shadow-sm);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  cursor: pointer;
  min-height: 32px;
  transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}

.ef-motion-toggle:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--surface-2);
}

/* Staggered Hero Text Reveal */
.ef-hero-stagger {
  opacity: 0;
  transform: translateY(14px);
  animation: ef-hero-reveal var(--dur-slow) var(--ease-out) forwards;
}

.ef-stagger-1 { animation-delay: 40ms; }
.ef-stagger-2 { animation-delay: 110ms; }
.ef-stagger-3 { animation-delay: 185ms; }
.ef-stagger-4 { animation-delay: 260ms; }
.ef-stagger-5 { animation-delay: 335ms; }

@keyframes ef-hero-reveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==========================================================================
   Execution Graph EF/01 (Hero Signature Visual + Scenario Simulation)
   ========================================================================== */

.ef-graph-card {
  position: relative;
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-lg);
  transform: translate3d(var(--px, 0px), var(--py, 0px), 0);
  transition: transform 220ms var(--ease-out), border-color var(--dur-base) var(--ease-out);
  will-change: transform;
}

.ef-graph-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 12px;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.ef-graph-title-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
}

.ef-graph-glyph {
  color: var(--accent);
}

.ef-graph-kicker {
  letter-spacing: 0.06em;
  font-weight: 600;
}

.ef-graph-id {
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.ef-graph-scenarios {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.ef-graph-tab {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 500;
  padding: 4px 9px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}

.ef-graph-tab:hover {
  color: var(--text);
}

.ef-graph-tab[aria-pressed="true"] {
  background: var(--surface-1);
  color: var(--text);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.ef-graph-svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.ef-graph-grid line {
  stroke: var(--graph-grid);
  stroke-width: 1;
}

.ef-g-path {
  stroke-width: 1.75;
  transition: opacity var(--dur-fast) var(--ease-out), stroke-width var(--dur-fast) var(--ease-out);
}

.ef-g-path-active {
  stroke: url(#ef-grad-accent);
}

.ef-g-path-available {
  stroke: var(--status-available);
}

.ef-g-path-dev {
  stroke: var(--status-dev);
  stroke-dasharray: 5 4;
  opacity: 0.78;
}

.ef-g-path-planned {
  stroke: var(--status-planned);
  stroke-dasharray: 2 4;
  opacity: 0.55;
}

/* Path Highlighting on Scenario Selection or Node Hover */
.ef-graph-card[data-active-node] .ef-g-path {
  opacity: 0.2;
}

.ef-graph-card[data-active-node] .ef-g-path.is-highlighted {
  opacity: 1;
  stroke-width: 2.5;
}

.ef-graph-card[data-active-scenario="browser"] .ef-g-stamp {
  opacity: 0.45;
}

/* Traveling Data Packets */
.ef-packet {
  fill: var(--accent-2);
  opacity: 0;
}

.ef-packet-1 {
  offset-path: path("M270 76 L270 120");
  animation: ef-packet-leg1 4.4s linear infinite;
}

.ef-packet-2 {
  fill: var(--status-available);
  offset-path: path("M210 184 C210 206, 98 202, 98 230");
  animation: ef-packet-leg2 4.4s linear infinite;
}

.ef-packet-3 {
  fill: var(--status-available);
  offset-path: path("M98 300 C98 326, 218 318, 218 342");
  animation: ef-packet-leg3 4.4s linear infinite;
}

.ef-packet-dev {
  fill: var(--status-dev);
  offset-path: path("M270 184 L270 230");
  animation: ef-packet-dev-leg 5.6s linear infinite;
}

@keyframes ef-packet-leg1 {
  0% { offset-distance: 0%; opacity: 0; }
  4% { opacity: 1; }
  22% { offset-distance: 100%; opacity: 1; }
  26%, 100% { offset-distance: 100%; opacity: 0; }
}

@keyframes ef-packet-leg2 {
  0%, 24% { offset-distance: 0%; opacity: 0; }
  28% { opacity: 1; }
  48% { offset-distance: 100%; opacity: 1; }
  52%, 100% { offset-distance: 100%; opacity: 0; }
}

@keyframes ef-packet-leg3 {
  0%, 50% { offset-distance: 0%; opacity: 0; }
  54% { opacity: 1; }
  74% { offset-distance: 100%; opacity: 1; }
  78%, 100% { offset-distance: 100%; opacity: 0; }
}

@keyframes ef-packet-dev-leg {
  0%, 40% { offset-distance: 0%; opacity: 0; }
  46% { opacity: 0.78; }
  66% { offset-distance: 100%; opacity: 0.78; }
  72%, 100% { offset-distance: 100%; opacity: 0; }
}

/* SVG Nodes */
.ef-g-node {
  cursor: pointer;
  outline: none;
}

.ef-g-box {
  fill: var(--surface-2);
  stroke: var(--border-strong);
  stroke-width: 1.25;
  transition: stroke var(--dur-fast) var(--ease-out), fill var(--dur-fast) var(--ease-out);
}

.ef-g-node:hover .ef-g-box,
.ef-g-node:focus-visible .ef-g-box {
  stroke: var(--accent);
}

.ef-g-box-glow {
  fill: none;
  stroke: url(#ef-grad-accent);
  stroke-width: 1.5;
  opacity: 0.28;
  animation: ef-core-breathe 4s ease-in-out infinite;
}

@keyframes ef-core-breathe {
  0%, 100% { opacity: 0.16; }
  50% { opacity: 0.55; }
}

.ef-g-box-core {
  stroke: var(--accent);
  stroke-width: 1.5;
}

.ef-g-core-badge {
  fill: var(--accent-tint);
  stroke: var(--accent-border);
  stroke-width: 1;
}

.ef-g-box-available {
  fill: var(--surface-1);
  stroke: var(--status-available);
  stroke-width: 1.5;
}

.ef-g-box-dev {
  fill: var(--surface-1);
  stroke: var(--status-dev);
  stroke-dasharray: 5 3;
}

.ef-g-box-planned {
  fill: var(--surface-2);
  stroke: var(--status-planned);
  stroke-dasharray: 2 3;
  opacity: 0.85;
}

.ef-g-box-result {
  fill: var(--surface-1);
  stroke: var(--border-strong);
}

.ef-g-eyebrow {
  fill: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
}

.ef-g-eyebrow-accent {
  fill: var(--accent);
}

.ef-g-title {
  fill: var(--text);
  font-family: var(--font-sans);
  font-size: 14.5px;
  font-weight: 600;
}

.ef-g-title-sm {
  fill: var(--text);
  font-family: var(--font-sans);
  font-size: 13.5px;
  font-weight: 600;
}

.ef-g-title-dim {
  fill: var(--text-muted);
}

.ef-g-meta {
  fill: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 10px;
}

.ef-g-status {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
}

.ef-g-status-available { fill: var(--status-available-text); }
.ef-g-status-dev { fill: var(--status-dev-text); }
.ef-g-status-planned { fill: var(--status-planned-text); }

.ef-g-dot-available {
  fill: var(--status-available);
}

.ef-g-pulse-ring {
  fill: none;
  stroke: var(--status-available);
  stroke-width: 1.4;
  transform-box: fill-box;
  transform-origin: center;
  animation: ef-node-pulse 2.4s var(--ease-out) infinite;
}

@keyframes ef-node-pulse {
  0% { transform: scale(0.8); opacity: 0.85; }
  100% { transform: scale(1.9); opacity: 0; }
}

/* Output Checkmark Stamp synced to packet arrival at 76% */
.ef-g-stamp {
  transform-box: fill-box;
  transform-origin: center;
  animation: ef-stamp-pop 4.4s var(--ease-out) infinite;
}

.ef-g-stamp-ring {
  fill: var(--status-available-bg);
  stroke: var(--status-available);
  stroke-width: 1.4;
}

.ef-g-stamp-check {
  fill: none;
  stroke: var(--status-available);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 24;
  stroke-dashoffset: 0;
  animation: ef-stamp-draw 4.4s var(--ease-out) infinite;
}

@keyframes ef-stamp-pop {
  0%, 72% { transform: scale(0.95); }
  78% { transform: scale(1.14); }
  86%, 100% { transform: scale(1); }
}

@keyframes ef-stamp-draw {
  0%, 72% { stroke-dashoffset: 0; opacity: 0.55; }
  73% { stroke-dashoffset: 24; opacity: 1; }
  82%, 100% { stroke-dashoffset: 0; opacity: 1; }
}

/* Mobile Vertical Graph */
.ef-graph-stage-mobile {
  display: none;
}

@media (max-width: 520px) {
  .ef-graph-stage-desktop { display: none; }
  .ef-graph-stage-mobile {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
}

.ef-m-node {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
}

.ef-m-node-core {
  background: var(--graph-core-a);
  border-color: var(--accent);
}

.ef-m-role {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}

.ef-m-meta {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-dim);
}

.ef-m-connector {
  height: 18px;
  width: 2px;
  margin-inline: auto;
  background: var(--accent-border);
  position: relative;
  overflow: hidden;
}

.ef-m-connector span {
  position: absolute;
  inset-inline: 0;
  top: -8px;
  height: 8px;
  background: var(--accent);
  animation: ef-m-flow 2s linear infinite;
}

@keyframes ef-m-flow {
  to { transform: translateY(26px); }
}

.ef-m-engines {
  display: grid;
  gap: 8px;
}

.ef-m-engine {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  border: 1px solid var(--border);
  font-size: var(--text-sm);
}

.ef-m-engine-available { border-color: var(--status-available-border); }
.ef-m-engine-dev { border-color: var(--status-dev-border); border-style: dashed; }
.ef-m-engine-planned { border-color: var(--status-planned-border); border-style: dotted; opacity: 0.85; }

/* Interactive Graph Inspector Footer */
.ef-graph-tooltip {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.ef-graph-tooltip-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  margin-bottom: 5px;
  font-size: var(--text-sm);
}

.ef-graph-tooltip-title-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ef-graph-tooltip-bounds {
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
}

.ef-graph-tooltip-status {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--accent);
}

.ef-graph-tooltip p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
}

/* ==========================================================================
   Sections & Scroll Reveals
   ========================================================================== */

.ef-section {
  padding-block: clamp(64px, 8vw, 112px);
  border-bottom: 1px solid var(--border);
}

.ef-section-alt {
  background: var(--surface-1);
}

.ef-section-head {
  max-width: 660px;
  margin-bottom: var(--space-6);
}

.ef-section-head-split {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px 32px;
  margin-bottom: var(--space-6);
}

.ef-section-head-split .ef-section-head {
  margin-bottom: 0;
}

.ef-section-title {
  margin: 0 0 var(--space-3);
  font-size: var(--text-2xl);
  font-weight: 700;
  line-height: 1.14;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

.ef-section-lead {
  margin: 0;
  max-width: 62ch;
  font-size: var(--text-base);
  line-height: 1.65;
  color: var(--text-muted);
}

/* Scroll Reveal Primitive */
.ef-reveal {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity var(--dur-slow) var(--ease-out),
    transform var(--dur-slow) var(--ease-out);
}

.ef-reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ==========================================================================
   01 Platform Capabilities (Maturity Filter + Bento Spotlight + Cursor Glow)
   ========================================================================== */

.ef-cap-filter-bar {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-md);
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.ef-filter-pill {
  min-height: 36px;
  padding: 6px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}

.ef-filter-pill:hover {
  color: var(--text);
}

.ef-filter-pill[aria-pressed="true"] {
  background: var(--surface-1);
  color: var(--text);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.ef-cap-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

@media (min-width: 720px) {
  .ef-cap-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .ef-cap-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }
}

.ef-cap-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  min-width: 0;
  transition:
    transform var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out),
    background-color var(--dur-base) var(--ease-out);
}

.ef-cap-card[hidden] {
  display: none;
}

/* Cursor-following radial border highlight */
.ef-cap-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.5px;
  background: radial-gradient(
    360px circle at var(--mx, 50%) var(--my, 50%),
    rgba(29, 78, 216, 0.45),
    transparent 60%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur-base) var(--ease-out);
}

.ef-cap-card:hover {
  transform: translateY(-4px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.ef-cap-card:hover::before {
  opacity: 1;
}

/* Visually Dominant "Available locally" Spotlight Card */
.ef-cap-card-featured {
  background: linear-gradient(135deg, #FFFFFF 0%, #F0FDF9 100%);
  border-color: var(--status-available-border);
  box-shadow: var(--shadow-md);
}

html[data-theme="dark"] .ef-cap-card-featured {
  background: linear-gradient(145deg, var(--surface-2), var(--surface-1));
}

@media (min-width: 720px) {
  .ef-cap-card-featured {
    grid-column: span 2;
  }
}

.ef-cap-card-planned {
  background: var(--surface-1);
  opacity: 0.92;
}

.ef-cap-card-planned:hover {
  opacity: 1;
}

.ef-cap-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: var(--space-4);
}

.ef-cap-num {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
}

.ef-cap-icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--accent);
  margin-bottom: var(--space-3);
}

.ef-cap-card-featured .ef-cap-icon {
  background: var(--status-available-bg);
  border-color: var(--status-available-border);
  color: var(--status-available-text);
}

.ef-cap-card h3 {
  margin: 0 0 8px;
  font-size: var(--text-lg);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.ef-cap-card-featured h3 {
  font-size: 1.32rem;
}

.ef-cap-card p {
  margin: 0 0 var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-muted);
  line-height: 1.65;
  max-width: 58ch;
}

.ef-cap-meta-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 var(--space-4);
  padding: 0;
  list-style: none;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}

.ef-cap-meta-list li {
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.ef-cap-link {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
}

.ef-cap-link svg {
  color: var(--accent);
  transition: transform var(--dur-fast) var(--ease-out);
}

.ef-cap-card:hover .ef-cap-link svg {
  transform: translate(2px, -2px);
}

html[dir="rtl"] .ef-cap-card:hover .ef-cap-link svg {
  transform: translate(-2px, -2px) scaleX(-1);
}

/* Status Legend */
.ef-status-legend {
  margin-top: var(--space-4);
  padding: 14px 18px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 28px;
}

.ef-legend-title {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.ef-legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ef-legend-items li {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

/* ==========================================================================
   02 Execution Model (Scroll Timeline + Interactive Phase Contract Inspector)
   ========================================================================== */

.ef-exec-model-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
  align-items: start;
}

@media (min-width: 960px) {
  .ef-exec-model-grid {
    grid-template-columns: minmax(0, 1.06fr) minmax(0, 0.94fr);
    gap: var(--space-6);
  }
}

.ef-timeline {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  --timeline-progress: 0.2;
}

.ef-timeline-track {
  position: absolute;
  inset-block: 24px;
  inset-inline-start: 19px;
  width: 2px;
  background: var(--border-strong);
  border-radius: 2px;
  overflow: hidden;
}

.ef-timeline-fill {
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
  transform-origin: top center;
  transform: scaleY(var(--timeline-progress));
  transition: transform 140ms linear;
}

.ef-timeline-step {
  position: relative;
  padding-block: 10px;
  transition: transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out);
  opacity: 0.65;
}

.ef-timeline-step.is-active {
  opacity: 1;
}

.ef-timeline-trigger {
  width: 100%;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: var(--space-3);
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: start;
  cursor: pointer;
}

.ef-timeline-dot {
  position: relative;
  z-index: 1;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--bg);
  border: 1.5px solid var(--border-strong);
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  transition:
    border-color var(--dur-base) var(--ease-out),
    color var(--dur-base) var(--ease-out),
    background-color var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);
}

.ef-timeline-step.is-active .ef-timeline-dot,
.ef-timeline-trigger[aria-pressed="true"] .ef-timeline-dot {
  border-color: var(--accent);
  background: var(--surface-1);
  color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-tint);
}

.ef-timeline-card {
  display: grid;
  gap: 4px;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  background: var(--bg);
  border: 1px solid var(--border);
  transition:
    border-color var(--dur-base) var(--ease-out),
    background-color var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);
}

.ef-timeline-trigger:hover .ef-timeline-card {
  border-color: var(--border-strong);
}

.ef-timeline-trigger[aria-pressed="true"] .ef-timeline-card {
  border-color: var(--accent-border);
  background: var(--surface-2);
  box-shadow: var(--shadow-sm);
}

.ef-timeline-phase {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent);
}

html[dir="rtl"] .ef-timeline-phase {
  letter-spacing: 0;
}

.ef-timeline-text {
  font-size: clamp(0.95rem, 1.3vw, 1.0625rem);
  font-weight: 600;
  color: var(--text);
}

/* Sticky Phase Contract Inspector */
.ef-step-inspector {
  padding: 24px;
  border-radius: var(--radius-lg);
  background: var(--bg);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-md);
}

@media (min-width: 960px) {
  .ef-step-inspector {
    position: sticky;
    top: calc(var(--header-h) + 24px);
  }
}

.ef-step-inspector-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.74rem;
}

.ef-step-insp-idx {
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.ef-step-insp-badge {
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
}

.ef-step-insp-title {
  margin: 0 0 8px;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.ef-step-insp-desc {
  margin: 0 0 20px;
  font-size: var(--text-sm);
  color: var(--text-muted);
  line-height: 1.65;
}

.ef-step-insp-dl {
  margin: 0 0 20px;
  display: grid;
  gap: 12px;
}

.ef-step-insp-dl > div {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  border: 1px solid var(--border);
}

.ef-step-insp-dl dt {
  margin: 0 0 4px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.ef-step-insp-dl dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text);
  line-height: 1.5;
  word-break: break-word;
}

.ef-step-insp-foot {
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

/* ==========================================================================
   03 Developer First (Luminous Light Tabbed Contract Lab + Result Banner)
   ========================================================================== */

.ef-dev-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
  align-items: center;
}

@media (min-width: 960px) {
  .ef-dev-grid {
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  }
}

.ef-dev-actions {
  margin-top: var(--space-4);
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.ef-code-card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-strong);
  background: var(--code-bg);
  color: var(--text);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.ef-code-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 12px;
  padding: 10px 14px;
  background: var(--code-head);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.74rem;
}

.ef-code-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.ef-code-tab {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 500;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}

.ef-code-tab:hover {
  color: var(--text);
}

.ef-code-tab[aria-selected="true"] {
  background: var(--surface-1);
  color: var(--accent);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.ef-code-tools {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ef-code-pill {
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--accent-tint);
  border: 1px solid var(--accent-border);
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.ef-code-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--surface-1);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  min-height: 30px;
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}

.ef-code-btn:hover {
  background: var(--surface-2);
  color: var(--text);
}

.ef-code-btn.is-copied {
  border-color: var(--status-available-border);
  color: var(--status-available-text);
  background: var(--status-available-bg);
}

.ef-code-pre {
  margin: 0;
  padding: 20px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.84rem;
  line-height: 1.75;
  min-height: 224px;
  direction: ltr;
  text-align: left;
}

.ef-tok-dim { color: var(--code-dim); }
.ef-tok-key { color: var(--code-key); font-weight: 500; }
.ef-tok-str { color: var(--code-str); }
.ef-tok-num { color: var(--code-num); }
.ef-tok-punc { color: var(--code-punc); }

.ef-type-cursor {
  display: inline-block;
  width: 7px;
  height: 1.1em;
  vertical-align: text-bottom;
  background: var(--accent);
  animation: ef-blink 1s step-end infinite;
}

.ef-type-cursor.is-done {
  display: none;
}

@keyframes ef-blink {
  50% { opacity: 0; }
}

/* Illustrative Slide-In Result Panel */
.ef-code-result {
  border-top: 1px solid var(--code-result-border);
  background: var(--code-result-bg);
  padding: 12px 20px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  direction: ltr;
  text-align: left;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out);
}

.ef-code-result.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.ef-code-result.is-warn {
  border-top-color: var(--code-warn-border);
  background: var(--code-warn-bg);
}

.ef-code-result-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--code-result-text);
  font-weight: 500;
}

.ef-code-result.is-warn .ef-code-result-bar {
  color: var(--code-warn-text);
}

.ef-code-result-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ef-code-result-note {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.ef-code-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--code-head);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

/* ==========================================================================
   04 Trust by Design (Animated Checkmarks + Concise Rationale)
   ========================================================================== */

.ef-trust-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
  align-items: start;
}

@media (min-width: 960px) {
  .ef-trust-grid {
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  }
}

.ef-trust-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

@media (min-width: 600px) {
  .ef-trust-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ef-trust-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px;
  border-radius: var(--radius-md);
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.ef-trust-item strong {
  display: block;
  margin-bottom: 4px;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text);
}

.ef-trust-item p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.55;
}

.ef-trust-check {
  width: 22px;
  height: 22px;
  margin-top: 1px;
  color: var(--status-available-text);
  flex-shrink: 0;
}

.ef-trust-check .ef-check-path {
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
  transition: stroke-dashoffset 520ms var(--ease-out);
}

.ef-trust-list.is-visible .ef-trust-check .ef-check-path {
  stroke-dashoffset: 0;
}

.ef-trust-item:nth-child(1) .ef-check-path { transition-delay: 0ms; }
.ef-trust-item:nth-child(2) .ef-check-path { transition-delay: 70ms; }
.ef-trust-item:nth-child(3) .ef-check-path { transition-delay: 140ms; }
.ef-trust-item:nth-child(4) .ef-check-path { transition-delay: 210ms; }
.ef-trust-item:nth-child(5) .ef-check-path { transition-delay: 280ms; }
.ef-trust-item:nth-child(6) .ef-check-path { transition-delay: 350ms; }

.ef-mt-12 { margin-top: 12px; }
.ef-mt-20 { margin-top: 20px; }
.ef-mt-28 { margin-top: 28px; }
.ef-text-sm { font-size: 0.85rem; }

/* ==========================================================================
   Final CTA & Footer
   ========================================================================== */

.ef-final-cta {
  position: relative;
  overflow: hidden;
  padding-block: clamp(72px, 9vw, 120px);
  border-bottom: 1px solid var(--border);
  text-align: center;
  background:
    radial-gradient(ellipse 60% 70% at 50% 110%, var(--hero-glow-a), transparent 70%),
    var(--bg);
}

.ef-final-cta h2 {
  margin: 0 auto var(--space-5);
  max-width: 18ch;
  font-size: clamp(2rem, 4.6vw, 3.4rem);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.ef-footer {
  margin-top: auto;
  padding-block: var(--space-8) var(--space-5);
  background: var(--bg);
}

.ef-footer-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--border);
}

@media (min-width: 640px) {
  .ef-footer-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .ef-footer-grid {
    grid-template-columns: 1.6fr repeat(4, minmax(0, 1fr));
  }
}

.ef-footer-brand-desc {
  margin: 14px 0 18px;
  max-width: 30ch;
  font-size: var(--text-sm);
  color: var(--text-muted);
  line-height: 1.6;
}

.ef-footer-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.ef-footer-col h2 {
  margin: 0 0 14px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.04em;
}

.ef-footer-col ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.ef-footer-col a {
  font-size: var(--text-sm);
  color: var(--text-muted);
  transition: color var(--dur-fast) var(--ease-out);
}

.ef-footer-col a:hover {
  color: var(--text);
}

.ef-footer-bottom {
  padding-top: var(--space-4);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px 24px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-dim);
}

/* ==========================================================================
   Subpages, Contact Form, Skeleton & 404
   ========================================================================== */

.ef-page-hero {
  padding-block: clamp(56px, 7vw, 96px) clamp(40px, 5vw, 64px);
  border-bottom: 1px solid var(--border);
  background: radial-gradient(ellipse 50% 60% at 85% 10%, var(--hero-glow-a), transparent 65%);
}

.ef-page-hero h1 {
  margin: 0 0 var(--space-3);
  font-size: clamp(2.1rem, 4.5vw, 3.5rem);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.035em;
  max-width: 20ch;
  text-wrap: balance;
}

.ef-page-hero p.ef-page-lead {
  margin: 0;
  max-width: 62ch;
  font-size: var(--text-lg);
  color: var(--text-muted);
  line-height: 1.65;
}

.ef-article {
  max-width: 74ch;
}

.ef-article h2 {
  margin: var(--space-6) 0 var(--space-2);
  font-size: 1.35rem;
  letter-spacing: -0.02em;
}

.ef-article p {
  margin: 0 0 var(--space-3);
  color: var(--text-muted);
  line-height: 1.75;
}

.ef-status-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.ef-legal-review {
  padding: 16px 20px;
  border-radius: var(--radius-md);
  background: var(--status-dev-bg);
  border: 1px solid var(--status-dev-border);
  color: var(--status-dev-text);
  font-size: var(--text-sm);
  margin-bottom: var(--space-5);
}

.ef-sub-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-top: var(--space-4);
}

@media (min-width: 760px) {
  .ef-sub-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ef-info-card {
  padding: 22px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.ef-info-card h3 {
  margin: 0 0 8px;
  font-size: var(--text-base);
}

.ef-info-card p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* Contact Page */
.ef-contact-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
  align-items: start;
}

@media (min-width: 900px) {
  .ef-contact-layout {
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  }
}

.ef-channel-list {
  display: grid;
  gap: 12px;
}

.ef-channel-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 18px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.ef-channel-item h3 {
  margin: 0 0 4px;
  font-size: var(--text-base);
}

.ef-channel-item p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.ef-contact-form {
  display: grid;
  gap: 18px;
  padding: 28px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-md);
}

.ef-field {
  display: grid;
  gap: 6px;
}

.ef-field label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
}

.ef-field input,
.ef-field select,
.ef-field textarea {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--bg);
  color: var(--text);
  transition: border-color var(--dur-fast) var(--ease-out);
}

.ef-field textarea {
  min-height: 120px;
  resize: vertical;
}

.ef-field input[aria-invalid="true"],
.ef-field select[aria-invalid="true"],
.ef-field textarea[aria-invalid="true"] {
  border-color: var(--danger);
}

.ef-field-error {
  min-height: 18px;
  font-size: 0.78rem;
  color: var(--danger);
}

.ef-consent {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.84rem;
  color: var(--text-muted);
  cursor: pointer;
}

.ef-consent input {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  accent-color: var(--accent);
}

.ef-form-banner {
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
}

.ef-form-banner[data-state="error"] {
  border-color: var(--danger-border);
  background: var(--danger-bg);
  color: var(--danger);
}

.ef-form-banner[data-state="success"] {
  border-color: var(--status-available-border);
  background: var(--status-available-bg);
  color: var(--status-available-text);
}

/* Toast Notification */
.ef-toast-region {
  position: fixed;
  inset-block-end: 24px;
  inset-inline-end: 24px;
  z-index: 950;
  display: grid;
  gap: 8px;
  pointer-events: none;
}

.ef-toast {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  opacity: 0;
  transform: translateY(10px);
  transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}

.ef-toast.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Skeleton Loader Utility */
.ef-skeleton {
  background: linear-gradient(90deg, var(--surface-1) 25%, var(--surface-2) 50%, var(--surface-1) 75%);
  background-size: 200% 100%;
  animation: ef-shimmer 1.6s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@keyframes ef-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Mobile Sticky Bottom-Safe CTA */
.ef-mobile-sticky-cta {
  display: none;
}

@media (max-width: 767px) {
  .ef-mobile-sticky-cta {
    position: sticky;
    bottom: 0;
    z-index: 150;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
    background: var(--surface-glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid var(--border);
  }
  .ef-mobile-sticky-cta span {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-muted);
  }
}

/* ==========================================================================
   Accounts, Auth Forms & Google Linking UI Blueprint
   ========================================================================== */

.ef-auth-section {
  padding-block: clamp(48px, 6vw, 88px);
  background: radial-gradient(ellipse 55% 45% at 85% 0%, var(--hero-glow-a), transparent 70%), var(--bg);
}

.ef-auth-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
  align-items: start;
}

@media (min-width: 960px) {
  .ef-auth-grid {
    grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
    gap: 56px;
  }
}

.ef-auth-single-wrap {
  max-width: 480px;
}

.ef-auth-title {
  margin: 0 0 var(--space-3);
  font-size: clamp(2rem, 3.8vw, 3rem);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.ef-auth-lead {
  margin: 0 0 var(--space-4);
  max-width: 54ch;
  color: var(--text-muted);
  font-size: var(--text-base);
  line-height: 1.65;
}

.ef-auth-highlights {
  margin: 0 0 var(--space-4);
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.ef-auth-highlights li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--text-sm);
  color: var(--text);
}

.ef-auth-highlights svg {
  color: var(--status-available-text);
}

.ef-auth-preview-link-wrap {
  margin-bottom: var(--space-4);
}

.ef-auth-card {
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: clamp(24px, 3vw, 34px);
  box-shadow: var(--shadow-lg);
}

.ef-auth-card-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: var(--space-4);
}

.ef-auth-card-head h2,
.ef-auth-card-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.ef-auth-card-lead {
  margin: 8px 0 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
  line-height: 1.6;
}

.ef-google-btn {
  width: 100%;
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 18px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--surface-1);
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}

.ef-google-btn:hover {
  background: var(--surface-2);
  border-color: var(--text-muted);
  box-shadow: var(--shadow-md);
}

.ef-google-btn:active {
  transform: scale(0.99);
}

.ef-google-btn-sm {
  width: auto;
  min-height: 38px;
  padding: 7px 14px;
  font-size: 0.8125rem;
}

.ef-auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-block: var(--space-4);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

.ef-auth-divider::before,
.ef-auth-divider::after {
  content: "";
  flex: 1 1 0;
  height: 1px;
  background: var(--border-strong);
}

.ef-auth-form {
  display: grid;
  gap: 16px;
}

.ef-password-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.ef-password-wrap input {
  padding-inline-end: 46px;
}

.ef-password-toggle {
  position: absolute;
  inset-inline-end: 6px;
  min-width: 34px;
  min-height: 34px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.ef-password-toggle:hover {
  color: var(--text);
  background: var(--surface-2);
}

.ef-strength-meter {
  display: grid;
  gap: 6px;
  margin-top: 6px;
}

.ef-strength-bars {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.ef-strength-bars span {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--surface-2);
  border: 1px solid var(--border);
  transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}

.ef-strength-meter[data-score="1"] .ef-strength-bars span:nth-child(1) {
  background: var(--danger);
  border-color: var(--danger);
}

.ef-strength-meter[data-score="2"] .ef-strength-bars span:nth-child(-n+2) {
  background: var(--status-dev);
  border-color: var(--status-dev);
}

.ef-strength-meter[data-score="3"] .ef-strength-bars span:nth-child(-n+3) {
  background: var(--accent);
  border-color: var(--accent);
}

.ef-strength-meter[data-score="4"] .ef-strength-bars span {
  background: var(--status-available);
  border-color: var(--status-available);
}

.ef-strength-label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-dim);
}

.ef-auth-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ef-auth-inline-link {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--accent);
}

.ef-auth-inline-link:hover {
  text-decoration: underline;
}

.ef-btn-full {
  width: 100%;
}

.ef-auth-switch {
  margin: var(--space-4) 0 0;
  padding-top: var(--space-3);
  border-top: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.ef-auth-switch a {
  color: var(--accent);
  font-weight: 600;
}

.ef-auth-switch a:hover {
  text-decoration: underline;
}

/* Backend Integration Contract Box */
.ef-contract-box {
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: 18px;
  box-shadow: var(--shadow-sm);
}

.ef-contract-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.ef-contract-head h2 {
  margin: 10px 0 4px;
  font-size: var(--text-base);
  font-weight: 700;
}

.ef-contract-head p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.ef-contract-pre {
  margin: 0;
  padding: 14px;
  border-radius: var(--radius-sm);
  background: var(--code-bg);
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.74rem;
  line-height: 1.6;
  color: var(--text);
  overflow-x: auto;
  direction: ltr;
  text-align: left;
}

.ef-contract-note {
  margin: 10px 0 0;
  font-size: 0.76rem;
  color: var(--text-dim);
}

.ef-contract-note code {
  font-family: var(--font-mono);
  color: var(--accent);
}

/* Account Dashboard Console */
.ef-account-hero-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.ef-account-hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.ef-account-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
  align-items: start;
}

@media (min-width: 960px) {
  .ef-account-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-5);
  }
}

.ef-account-col {
  display: grid;
  gap: var(--space-4);
}

.ef-account-card {
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-md);
}

.ef-account-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.ef-account-card-head h2 {
  margin: 0 0 4px;
  font-size: 1.15rem;
  font-weight: 700;
}

.ef-acc-card-desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.55;
}

.ef-account-identity {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ef-avatar-circle {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  display: grid;
  place-items: center;
  background: var(--accent-tint);
  border: 1px solid var(--accent-border);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  flex-shrink: 0;
}

.ef-avatar-lg {
  width: 52px;
  height: 52px;
  font-size: 1rem;
}

.ef-acc-email-line {
  margin: 4px 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 0.84rem;
  color: var(--text-muted);
}

.ef-account-subhead {
  margin: 0 0 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.ef-field-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

@media (min-width: 600px) {
  .ef-field-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ef-account-form-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ef-acc-save-note {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--status-available-text);
}

/* Connected Provider Cards (Google Linking) */
.ef-provider-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--bg);
  border: 1px solid var(--border);
  transition: border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}

.ef-provider-card[data-linked="true"] {
  border-color: var(--status-available-border);
  background: var(--status-available-bg);
}

.ef-provider-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  flex: 1 1 240px;
}

.ef-provider-logo {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.ef-provider-logo-mail {
  color: var(--accent);
}

.ef-provider-info {
  min-width: 0;
}

.ef-provider-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.ef-provider-info p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.ef-provider-scopes {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ef-provider-scopes[hidden] {
  display: none;
}

.ef-provider-scopes li {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}

.ef-provider-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ef-session-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.ef-session-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  border: 1px solid var(--border);
}

.ef-session-row strong {
  display: block;
  font-size: 0.875rem;
}

.ef-session-row p {
  margin: 2px 0 0;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--text-dim);
}

.ef-2fa-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* Google OAuth Consent Preview Modal */
.ef-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 800;
  background: rgba(11, 18, 32, 0.44);
  backdrop-filter: blur(5px);
  display: grid;
  place-items: center;
  padding: 16px;
}

.ef-modal-backdrop[hidden] {
  display: none;
}

.ef-modal {
  width: min(460px, 100%);
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-lg);
}

.ef-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.ef-modal-brand-bridge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.ef-bridge-dots {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--accent);
  letter-spacing: 2px;
}

.ef-google-badge-circle {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-full);
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  display: grid;
  place-items: center;
}

.ef-modal-title {
  margin: 0 0 6px;
  font-size: 1.2rem;
  font-weight: 700;
}

.ef-modal-sub {
  margin: 0 0 16px;
  font-size: 0.84rem;
  color: var(--text-muted);
  line-height: 1.55;
}

.ef-google-picker {
  display: grid;
  gap: 8px;
}

.ef-google-pick-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--bg);
  text-align: start;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}

.ef-google-pick-row:hover,
.ef-google-pick-row.is-selected {
  border-color: var(--accent);
  background: var(--accent-tint);
}

.ef-pick-meta {
  display: grid;
  margin-inline-end: auto;
  min-width: 0;
}

.ef-pick-meta strong {
  font-size: 0.875rem;
}

.ef-pick-meta span {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--text-muted);
}

.ef-scope-box {
  margin-top: 14px;
  padding: 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.ef-scope-title {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.ef-modal-actions {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

/* ==========================================================================
   Motion Accessibility: prefers-reduced-motion & Manual Pause Control
   ========================================================================== */

html[data-motion="paused"] *,
html[data-motion="paused"] *::before,
html[data-motion="paused"] *::after {
  animation-play-state: paused !important;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  .ef-hero-grid-bg,
  .ef-hero-aurora,
  .ef-packet,
  .ef-g-pulse-ring,
  .ef-g-box-glow,
  .ef-g-stamp,
  .ef-g-stamp-check,
  .ef-m-connector span,
  .ef-type-cursor,
  .ef-skeleton {
    animation: none !important;
  }
  .ef-hero-stagger,
  .ef-reveal,
  .ef-code-result {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
    transition: opacity 150ms linear !important;
  }
  .ef-graph-card {
    transform: none !important;
  }
  .ef-timeline-step {
    opacity: 1 !important;
    transform: none !important;
  }
  .ef-trust-check .ef-check-path {
    stroke-dashoffset: 0 !important;
  }
}
`;
