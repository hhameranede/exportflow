export const MARKETING_CSS = `/* ==========================================================================
   ExportFlow Design Tokens & Cupertino Editorial Stylesheet
   Gallery White Default + Obsidian Hardware Contrast + Optional Dark Theme
   ========================================================================== */

:root {
  color-scheme: light;

  /* Core Surfaces */
  --bg: #F3F6FA;
  --canvas: #FBFCFE;
  --bg-tinted: #EEF2F8;
  --surface-1: #FFFFFF;
  --surface-2: #F5F7FB;
  --surface-glass: rgba(251, 252, 254, 0.92);
  --border: #DCE3ED;
  --border-strong: #C5D0DF;

  /* Typography */
  --text: #172338;
  --text-muted: #43536A;
  --text-dim: #62738A;

  /* ExportFlow signal blue */
  --accent: #2458C6;
  --accent-hover: #1949AD;
  --accent-2: #2458C6;
  --accent-ink: #FFFFFF;
  --accent-tint: rgba(36, 88, 198, 0.09);
  --accent-border: rgba(36, 88, 198, 0.28);

  /* Semantic Status Tokens (WCAG AA >= 4.5:1 on White & #F5F5F7) */
  --status-available: #1D8F4E;
  --status-available-text: #117A37;
  --status-available-bg: rgba(17, 122, 55, 0.08);
  --status-available-border: rgba(17, 122, 55, 0.26);

  --status-dev: #B26A00;
  --status-dev-text: #9A5B00;
  --status-dev-bg: rgba(154, 91, 0, 0.09);
  --status-dev-border: rgba(154, 91, 0, 0.26);

  --status-planned: #6E6E73;
  --status-planned-text: #515154;
  --status-planned-bg: rgba(110, 110, 115, 0.08);
  --status-planned-border: rgba(110, 110, 115, 0.22);

  --danger: #D70015;
  --danger-bg: rgba(215, 0, 21, 0.07);
  --danger-border: rgba(215, 0, 21, 0.26);

  /* Code Document Tokens (Xcode Light Sheet) */
  --code-bg: #FFFFFF;
  --code-head: #F5F5F7;
  --code-key: #0066CC;
  --code-str: #117A37;
  --code-num: #9A5B00;
  --code-dim: #6E6E73;
  --code-punc: #515154;
  --code-result-bg: #F5F5F7;
  --code-result-border: rgba(0, 0, 0, 0.08);
  --code-result-text: #117A37;
  --code-warn-bg: #FFF9EB;
  --code-warn-border: rgba(154, 91, 0, 0.24);
  --code-warn-text: #9A5B00;

  /* Font Stacks */
  --font-sans: "Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SF Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-ar: "IBM Plex Sans Arabic", "Noto Sans Arabic", var(--font-sans);
  --font-zh: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", var(--font-sans);
  --font-ja: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", var(--font-sans);

  /* Fluid Type Scale */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.1875rem;
  --text-xl: clamp(1.375rem, 2vw, 1.75rem);
  --text-2xl: clamp(2rem, 3.8vw, 3rem);
  --text-hero: clamp(2.75rem, 6.2vw, 5rem);

  /* Spacing Scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 48px;
  --space-8: 64px;
  --space-12: 96px;

  /* Layout */
  --container-max: 1120px;
  --header-h: 64px;

  /* Radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-full: 980px;

  /* Quiet Ambient Depth */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 8px 24px -8px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 24px 60px -20px rgba(0, 0, 0, 0.14);

  /* Motion */
  --ease-out: cubic-bezier(0.25, 1, 0.5, 1);
  --dur-fast: 160ms;
  --dur-base: 320ms;
  --dur-slow: 640ms;
}

/* Manual Dark Theme Override */
html[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0B1322;
  --canvas: #0A101D;
  --bg-tinted: #111C2D;
  --surface-1: #121F32;
  --surface-2: #19283D;
  --surface-glass: rgba(18, 31, 50, 0.94);
  --border: rgba(174, 194, 220, 0.16);
  --border-strong: rgba(174, 194, 220, 0.28);

  --text: #F4F7FC;
  --text-muted: #C0CCDD;
  --text-dim: #9AABC2;

  --accent: #82B0FF;
  --accent-hover: #A4C5FF;
  --accent-2: #82B0FF;
  --accent-ink: #101A2B;
  --accent-tint: rgba(130, 176, 255, 0.14);
  --accent-border: rgba(130, 176, 255, 0.4);

  --status-available: #46D69A;
  --status-available-text: #69E5B0;
  --status-available-bg: rgba(70, 214, 154, 0.12);
  --status-available-border: rgba(70, 214, 154, 0.30);

  --status-dev: #FFC36B;
  --status-dev-text: #FFD08D;
  --status-dev-bg: rgba(255, 195, 107, 0.12);
  --status-dev-border: rgba(255, 195, 107, 0.32);

  --status-planned: #A9B7CB;
  --status-planned-text: #C0CCDD;
  --status-planned-bg: rgba(169, 183, 203, 0.12);
  --status-planned-border: rgba(169, 183, 203, 0.26);

  --danger: #FF7D79;
  --danger-bg: rgba(255, 125, 121, 0.12);
  --danger-border: rgba(255, 125, 121, 0.34);

  --code-bg: #161617;
  --code-head: #1D1D1F;
  --code-key: #66B2FF;
  --code-str: #30D158;
  --code-num: #FFB340;
  --code-dim: #98989D;
  --code-punc: #A1A1A6;
  --code-result-bg: #1D1D1F;
  --code-result-border: rgba(255, 255, 255, 0.10);
  --code-result-text: #30D158;
  --code-warn-bg: rgba(255, 159, 10, 0.10);
  --code-warn-border: rgba(255, 159, 10, 0.28);
  --code-warn-text: #FFB340;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.24);
  --shadow-md: 0 12px 28px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 24px 56px rgba(0, 0, 0, 0.38);
}

/* ==========================================================================
   Reset & Base
   ========================================================================== */

*, *::before, *::after {
  box-sizing: border-box;
}

html {
  background-color: var(--canvas);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.5;
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
  background-color: var(--canvas);
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
  padding: 10px 18px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius-full);
  transform: translateY(-220%);
  transition: transform var(--dur-fast) var(--ease-out);
}

.ef-skip-link:focus {
  transform: translateY(0);
}

.ef-container {
  width: min(var(--container-max), calc(100% - 36px));
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
  from { opacity: 0; }
  to { opacity: 1; }
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
   Cupertino Buttons, Inline Chevrons & Unboxed Status Labels
   ========================================================================== */

.ef-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 11px 22px;
  border-radius: var(--radius-full);
  font-size: 0.9375rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    transform var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.ef-btn:active {
  transform: scale(0.985);
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
  background: var(--accent);
  color: var(--accent-ink);
  border-color: transparent;
}

.ef-btn-primary:hover {
  background: var(--accent-hover);
}

.ef-btn-secondary {
  background: transparent;
  color: var(--accent);
  border-color: var(--accent-border);
}

.ef-btn-secondary:hover {
  background: var(--accent-tint);
  border-color: var(--accent);
}

.ef-btn-ghost {
  background: transparent;
  color: var(--text-muted);
  border-color: transparent;
  padding-inline: 12px;
}

.ef-btn-ghost:hover {
  color: var(--text);
  background: var(--surface-2);
}

.ef-btn-sm {
  min-height: 30px;
  padding: 5px 13px;
  font-size: 0.78rem;
}

.ef-text-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 1.0625rem;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: var(--accent);
  transition: color var(--dur-fast) var(--ease-out);
}

.ef-text-link:hover span {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.ef-text-link svg {
  transition: transform var(--dur-fast) var(--ease-out);
}

.ef-text-link:hover svg {
  transform: translateX(2px);
}

html[dir="rtl"] .ef-text-link:hover svg {
  transform: translateX(-2px) scaleX(-1);
}

.ef-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 34px;
  min-height: 34px;
  padding: 0 8px;
  border-radius: var(--radius-full);
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}

.ef-icon-btn:hover {
  color: var(--text);
  background: var(--surface-2);
}

.ef-icon-btn:active {
  transform: scale(0.96);
}

@media (max-width: 767px) {
  .ef-icon-btn, .ef-btn-sm {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Unboxed Semantic Status Labels (Clean Typography, Zero Pill Clutter) */
.ef-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
  white-space: nowrap;
}

.ef-badge-available { color: var(--status-available-text); }
.ef-badge-dev { color: var(--status-dev-text); }
.ef-badge-planned { color: var(--status-planned-text); }

/* ==========================================================================
   Sticky Header (52px Cupertino Frosted Bar)
   ========================================================================== */

.ef-header {
  position: sticky;
  top: 0;
  z-index: 200;
  height: var(--header-h);
  border-bottom: 1px solid var(--border);
  background: var(--surface-glass);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  transition:
    background-color var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out);
}

.ef-header.is-scrolled {
  border-bottom-color: var(--border-strong);
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
  gap: 8px;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  color: var(--text);
  white-space: nowrap;
  flex-shrink: 0;
}

.ef-brand-muted {
  color: var(--text-muted);
  font-weight: 400;
}

.ef-mark {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  color: var(--text);
}

.ef-mark.ef-mark-cat {
  width: 28px;
  height: 28px;
}

.ef-brand-cat-svg,
.ef-hero-cat-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.ef-nav {
  display: none;
  align-items: center;
  gap: 28px;
}

.ef-nav a {
  position: relative;
  padding-block: 6px;
  font-size: 0.8125rem;
  font-weight: 400;
  letter-spacing: -0.01em;
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
  height: 1.5px;
  background: var(--text);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--dur-base) var(--ease-out);
}

html[dir="rtl"] .ef-nav a::after {
  transform-origin: right;
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
  gap: 8px;
  flex-shrink: 0;
}

.ef-signin-link {
  display: none;
  font-size: 0.8125rem;
  font-weight: 400;
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
  gap: 5px;
  min-height: 34px;
  padding: 0 8px;
  border-radius: var(--radius-full);
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 400;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}

.ef-lang-trigger:hover {
  color: var(--text);
  background: var(--surface-2);
}

.ef-lang-menu {
  position: absolute;
  inset-block-start: calc(100% + 8px);
  inset-inline-end: 0;
  min-width: 196px;
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
  border-radius: 8px;
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
  opacity: 0.72;
}

/* Mobile Drawer */
.ef-menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--radius-full);
  border: 0;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.ef-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(6px);
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
  border-inline-start: 1px solid var(--border);
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
   Hero Section: Centered Cupertino Keynote + Wide Silicon Stage
   ========================================================================== */

.ef-hero {
  position: relative;
  background: var(--canvas);
  padding-block: clamp(56px, 8vw, 108px) clamp(64px, 8vw, 104px);
}

.ef-hero-editorial {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 780px;
}

.ef-hero-title {
  margin: 0 auto 18px;
  font-size: var(--text-hero);
  font-weight: 600;
  line-height: 1.04;
  letter-spacing: -0.04em;
  max-width: 14ch;
  color: var(--text);
  text-wrap: balance;
}

html[dir="rtl"] .ef-hero-title {
  letter-spacing: -0.015em;
  line-height: 1.18;
}

.ef-hero-lead {
  margin: 0 auto 28px;
  max-width: 54ch;
  font-size: clamp(1.0625rem, 1.6vw, 1.25rem);
  line-height: 1.5;
  font-weight: 400;
  letter-spacing: -0.015em;
  color: var(--text-muted);
}

.ef-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  align-items: center;
  justify-content: center;
}

.ef-hero-meta {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 10px;
  font-size: 0.8125rem;
  color: var(--text-dim);
}

.ef-motion-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  min-height: 28px;
  transition: color var(--dur-fast) var(--ease-out);
}

.ef-motion-toggle:hover {
  color: var(--text);
}

.ef-hero-stage {
  margin-top: clamp(40px, 5vw, 60px);
}

/* Staggered Hero Text Reveal */
.ef-hero-stagger {
  opacity: 0;
  transform: translateY(12px);
  animation: ef-hero-reveal var(--dur-slow) var(--ease-out) forwards;
}

.ef-stagger-1 { animation-delay: 40ms; }
.ef-stagger-2 { animation-delay: 100ms; }
.ef-stagger-3 { animation-delay: 160ms; }
.ef-stagger-4 { animation-delay: 220ms; }
.ef-stagger-5 { animation-delay: 280ms; }

@keyframes ef-hero-reveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==========================================================================
   Execution Graph: Obsidian Apple Silicon Hardware Stage
   ========================================================================== */

.ef-graph-card {
  position: relative;
  background: #111113;
  color: #F5F5F7;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  padding: clamp(20px, 3vw, 32px);
  box-shadow: 0 28px 70px -24px rgba(0, 0, 0, 0.24);
  transform: translate3d(var(--px, 0px), var(--py, 0px), 0);
  transition: transform 240ms var(--ease-out);
  will-change: transform;
}

.ef-graph-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.10);
}

.ef-graph-title-group {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
  color: #F5F5F7;
}

.ef-graph-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: #F5F5F7;
}

.ef-graph-scenarios {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.08);
}

.ef-graph-tab {
  border: 0;
  background: transparent;
  color: #A1A1A6;
  font-family: var(--font-sans);
  font-size: 0.78rem;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}

.ef-graph-tab:hover {
  color: #F5F5F7;
}

.ef-graph-tab[aria-pressed="true"] {
  background: #2C2C2E;
  color: #FFFFFF;
  font-weight: 600;
}

.ef-graph-svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.ef-graph-grid line {
  stroke: rgba(255, 255, 255, 0.06);
  stroke-width: 1;
}

.ef-g-path {
  stroke-width: 1.75;
  transition: opacity var(--dur-fast) var(--ease-out), stroke-width var(--dur-fast) var(--ease-out);
}

.ef-g-path-active {
  stroke: #2997FF;
}

.ef-g-path-available {
  stroke: #30D158;
}

.ef-g-path-dev {
  stroke: #FF9F0A;
  stroke-dasharray: 4 4;
  opacity: 0.82;
}

.ef-g-path-planned {
  stroke: #636366;
  stroke-dasharray: 2 4;
  opacity: 0.65;
}

.ef-graph-card[data-active-node] .ef-g-path {
  opacity: 0.22;
}

.ef-graph-card[data-active-node] .ef-g-path.is-highlighted {
  opacity: 1;
  stroke-width: 2.5;
}

/* Horizontal Signal Packets aligned with 840x310 SVG paths */
.ef-packet {
  fill: #2997FF;
  opacity: 0;
}

.ef-packet-1 {
  offset-path: path("M168 155 L218 155");
  animation: ef-packet-leg1 4.2s linear infinite;
}

.ef-packet-2 {
  fill: #30D158;
  offset-path: path("M394 134 C432 134, 424 62, 466 62");
  animation: ef-packet-leg2 4.2s linear infinite;
}

.ef-packet-3 {
  fill: #30D158;
  offset-path: path("M622 62 C654 62, 648 134, 678 134");
  animation: ef-packet-leg3 4.2s linear infinite;
}

@keyframes ef-packet-leg1 {
  0% { offset-distance: 0%; opacity: 0; }
  5% { opacity: 1; }
  22% { offset-distance: 100%; opacity: 1; }
  26%, 100% { offset-distance: 100%; opacity: 0; }
}

@keyframes ef-packet-leg2 {
  0%, 24% { offset-distance: 0%; opacity: 0; }
  28% { opacity: 1; }
  50% { offset-distance: 100%; opacity: 1; }
  54%, 100% { offset-distance: 100%; opacity: 0; }
}

@keyframes ef-packet-leg3 {
  0%, 52% { offset-distance: 0%; opacity: 0; }
  56% { opacity: 1; }
  78% { offset-distance: 100%; opacity: 1; }
  82%, 100% { offset-distance: 100%; opacity: 0; }
}

/* Silicon Schematic Blocks */
.ef-g-node {
  cursor: pointer;
  outline: none;
}

.ef-g-box {
  fill: #1C1C1E;
  stroke: rgba(255, 255, 255, 0.14);
  stroke-width: 1.25;
  transition: stroke var(--dur-fast) var(--ease-out), fill var(--dur-fast) var(--ease-out);
}

.ef-g-node:hover .ef-g-box,
.ef-g-node:focus-visible .ef-g-box {
  stroke: #2997FF;
  fill: #242428;
}

.ef-g-box-core {
  fill: #242428;
  stroke: #2997FF;
  stroke-width: 1.5;
}

.ef-g-box-available {
  fill: #15241C;
  stroke: #30D158;
  stroke-width: 1.5;
}

.ef-g-box-dev {
  fill: #262014;
  stroke: #FF9F0A;
  stroke-dasharray: 4 3;
}

.ef-g-box-planned {
  fill: #18181A;
  stroke: rgba(255, 255, 255, 0.18);
  stroke-dasharray: 2 3;
  opacity: 0.85;
}

.ef-g-box-result {
  fill: #1C1C1E;
  stroke: rgba(255, 255, 255, 0.18);
}

.ef-g-eyebrow {
  fill: #A1A1A6;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
}

.ef-g-eyebrow-accent {
  fill: #2997FF;
}

.ef-g-title {
  fill: #F5F5F7;
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 600;
}

.ef-g-title-sm {
  fill: #F5F5F7;
  font-family: var(--font-sans);
  font-size: 13.5px;
  font-weight: 600;
}

.ef-g-title-dim {
  fill: #A1A1A6;
}

.ef-g-meta {
  fill: #98989D;
  font-family: var(--font-mono);
  font-size: 10px;
}

.ef-g-status {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
}

.ef-g-status-available { fill: #30D158; }
.ef-g-status-dev { fill: #FFB340; }
.ef-g-status-planned { fill: #98989D; }

/* Mobile Hardware Graph Controls */
.ef-graph-stage-mobile {
  display: none;
}

@media (max-width: 560px) {
  .ef-graph-stage-desktop { display: none; }
  .ef-graph-stage-mobile {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

.ef-m-node {
  width: 100%;
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #1C1C1E;
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #F5F5F7;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.ef-m-node[aria-pressed="true"] {
  border-color: #2997FF;
}

.ef-m-node-core {
  background: #242428;
  border-color: #2997FF;
}

.ef-m-role {
  font-size: 0.72rem;
  font-weight: 500;
  color: #A1A1A6;
}

.ef-m-meta {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: #98989D;
}

.ef-m-connector {
  height: 16px;
  width: 2px;
  margin-inline: auto;
  background: rgba(41, 151, 255, 0.35);
  position: relative;
  overflow: hidden;
}

.ef-m-connector span {
  position: absolute;
  inset-inline: 0;
  top: -8px;
  height: 8px;
  background: #2997FF;
  animation: ef-m-flow 2s linear infinite;
}

@keyframes ef-m-flow {
  to { transform: translateY(24px); }
}

.ef-m-engines {
  display: grid;
  gap: 8px;
}

.ef-m-engine {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  min-height: 44px;
  border-radius: 12px;
  background: #1C1C1E;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #F5F5F7;
  font: inherit;
  font-size: var(--text-sm);
  text-align: start;
  cursor: pointer;
}

.ef-m-engine[aria-pressed="true"] {
  border-color: #2997FF;
}

.ef-m-engine-available { border-color: rgba(48, 209, 88, 0.45); }
.ef-m-engine-dev { border-color: rgba(255, 159, 10, 0.40); border-style: dashed; }
.ef-m-engine-planned { border-color: rgba(255, 255, 255, 0.18); border-style: dotted; opacity: 0.85; }

.ef-m-engine .ef-badge-available { color: #30D158; }
.ef-m-engine .ef-badge-dev { color: #FFB340; }
.ef-m-engine .ef-badge-planned { color: #98989D; }

/* Hardware Readout Strip */
.ef-graph-tooltip {
  margin-top: 18px;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ef-graph-tooltip-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  margin-bottom: 4px;
  font-size: var(--text-sm);
}

.ef-graph-tooltip-title-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.ef-graph-tooltip-title-row strong {
  color: #F5F5F7;
}

.ef-graph-tooltip-bounds {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: #A1A1A6;
}

.ef-graph-tooltip-status {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #2997FF;
}

.ef-graph-tooltip p {
  margin: 0;
  font-size: 0.875rem;
  color: #A1A1A6;
  line-height: 1.5;
}

/* ==========================================================================
   Alternating Cupertino Sections (White -> #F5F5F7 -> #000000 -> White)
   ========================================================================== */

.ef-section {
  padding-block: clamp(72px, 9vw, 124px);
  background: var(--canvas);
}

.ef-section-alt,
.ef-section-tinted {
  background: var(--bg-tinted);
}

.ef-section-obsidian {
  background: #000000;
  color: #F5F5F7;
  --text: #F5F5F7;
  --text-muted: #A1A1A6;
  --text-dim: #98989D;
  --border: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.22);
  --surface-1: #161617;
  --surface-2: #1D1D1F;
  --accent: #2997FF;
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

.ef-section-title-row {
  display: block;
  margin: 0 0 14px;
}

.ef-section-title-row .ef-section-title,
.ef-section-title-row h1 {
  margin: 0;
}

.ef-feature-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--bg-tinted);
  color: var(--text);
  display: grid;
  place-items: center;
}

.ef-feature-icon svg {
  width: 21px;
  height: 21px;
}

.ef-section-obsidian .ef-feature-icon {
  background: #242428;
  border-color: rgba(255, 255, 255, 0.14);
  color: #F5F5F7;
}

.ef-section-title {
  margin: 0 0 14px;
  font-size: var(--text-2xl);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.035em;
  color: var(--text);
  text-wrap: balance;
}

.ef-section-lead {
  margin: 0;
  max-width: 58ch;
  font-size: 1.0625rem;
  line-height: 1.55;
  color: var(--text-muted);
}

/* Scroll Reveal Primitive */
.ef-reveal {
  opacity: 0;
  transform: translateY(20px);
  transition:
    opacity var(--dur-slow) var(--ease-out),
    transform var(--dur-slow) var(--ease-out);
}

.ef-reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ==========================================================================
   01 Platform Capabilities: Featured Split Showcase + 2x2 Hairline Matrix
   ========================================================================== */

.ef-cap-filter-bar {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 4px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.05);
}

.ef-cap-filter-bar::-webkit-scrollbar {
  display: none;
}

@media (max-width: 767px) {
  .ef-cap-filter-bar {
    display: flex;
    width: 100%;
    gap: 6px;
    padding-inline: 6px;
    scroll-padding-inline: 6px;
  }
}

@media (min-width: 768px) {
  .ef-cap-filter-bar {
    flex-shrink: 0;
  }
}

html[data-theme="dark"] .ef-cap-filter-bar {
  background: rgba(255, 255, 255, 0.08);
}

.ef-filter-pill {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 6px 14px;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
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

.ef-cap-showcase {
  display: grid;
  gap: 20px;
}

.ef-cap-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  padding: clamp(24px, 3vw, 36px);
  background: var(--surface-1);
  color: var(--text);
  transition: background-color var(--dur-fast) var(--ease-out);
}

.ef-cap-card[hidden] {
  display: none;
}

/* Featured Hardware-Spec Slab (01 Web Intelligence) */
.ef-cap-card-featured {
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px 40px;
  align-items: center;
  padding: clamp(28px, 4vw, 48px);
  border-radius: 22px;
  border: 1px solid var(--border);
  background: var(--surface-1);
}

@media (min-width: 860px) {
  .ef-cap-card-featured {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  }
}

.ef-cap-card-featured:hover {
  border-color: var(--border-strong);
}

.ef-title-icon-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  min-width: 0;
  margin-block: 16px 12px;
}

.ef-title-icon-row h3 {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.ef-cap-featured-copy,
.ef-spec-strip,
.ef-cap-grid .ef-cap-card > p {
  min-width: 0;
  width: 100%;
}

.ef-cap-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.ef-cap-status-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-dim);
}

.ef-adapter-id {
  display: inline-block;
  margin-bottom: 8px;
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}


.ef-cap-featured-copy h3 {
  margin: 0 0 10px;
  font-size: clamp(1.5rem, 2.5vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.ef-cap-featured-copy p {
  margin: 0 0 22px;
  font-size: 1rem;
  color: var(--text-muted);
  line-height: 1.6;
  max-width: 48ch;
}

/* Monumental Tabular-Nums Spec Strip (Unified optical height across MiB / sec / hops / KiB) */
.ef-spec-strip {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px 28px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

@media (min-width: 860px) {
  .ef-spec-strip {
    padding-top: 0;
    padding-inline-start: 36px;
    border-top: 0;
    border-inline-start: 1px solid var(--border);
  }
}

@media (max-width: 359px) {
  .ef-spec-strip {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }
}

.ef-spec-strip div {
  display: flex;
  flex-direction: column-reverse;
  gap: 6px;
}

.ef-spec-strip dt {
  font-size: 0.8125rem;
  color: var(--text-dim);
  font-weight: 400;
}

.ef-spec-strip dd,
.ef-spec-value {
  margin: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 0.28ch;
  direction: ltr;
  justify-content: flex-start;
  font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  letter-spacing: -0.03em;
  line-height: 1;
  white-space: nowrap;
  color: var(--text);
}

html[dir="rtl"] .ef-spec-strip dd,
html[dir="rtl"] .ef-spec-value {
  justify-content: flex-end;
}

.ef-spec-num {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: clamp(2.1rem, 3.2vw, 2.85rem);
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--text);
}

.ef-spec-unit {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: clamp(0.95rem, 1.35vw, 1.18rem);
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1;
  color: var(--text-muted);
}

/* 2x2 Shared-Hairline Architectural Matrix */
.ef-cap-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: 22px;
  overflow: hidden;
}

@media (min-width: 720px) {
  .ef-cap-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ef-cap-grid .ef-cap-card:hover {
  background: var(--surface-2);
}

.ef-cap-card-planned {
  opacity: 0.88;
}

.ef-cap-card-planned:hover {
  opacity: 1;
}

.ef-cap-grid .ef-cap-card h3 {
  margin: 0 0 8px;
  font-size: 1.3125rem;
  font-weight: 600;
  letter-spacing: -0.025em;
}

/* Capability headings share one horizontal icon/title baseline. */
.ef-cap-featured-copy .ef-title-icon-row h3,
.ef-cap-grid .ef-cap-card .ef-title-icon-row h3 {
  flex: 1 1 auto;
  margin: 0;
}

.ef-cap-grid .ef-cap-card > p {
  margin: 0 0 14px;
  font-size: 0.9375rem;
  color: var(--text-muted);
  line-height: 1.6;
  max-width: 48ch;
}

.ef-cap-meta-inline {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-dim);
  margin: 0 0 18px !important;
}

.ef-cap-link {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--accent);
}

.ef-cap-card:hover .ef-cap-link span {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.ef-cap-link svg {
  transition: transform var(--dur-fast) var(--ease-out);
}

.ef-cap-card:hover .ef-cap-link svg {
  transform: translateX(2px);
}

html[dir="rtl"] .ef-cap-card:hover .ef-cap-link svg {
  transform: translateX(-2px) scaleX(-1);
}

/* Status Legend (Unboxed Footer Line) */
.ef-status-legend {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 28px;
}

.ef-legend-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-dim);
}

.ef-legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ef-legend-items li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

/* ==========================================================================
   02 Execution Model (Obsidian Keynote Timeline + Machined Hardware Card)
   ========================================================================== */

.ef-exec-model-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
  align-items: start;
}

@media (min-width: 960px) {
  .ef-exec-model-grid {
    grid-template-columns: minmax(0, 1.04fr) minmax(0, 0.96fr);
    gap: 56px;
  }
}

.ef-timeline {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--border);
}

.ef-timeline-track {
  display: none;
}

.ef-timeline-step {
  border-bottom: 1px solid var(--border);
  opacity: 0.62;
  transition: opacity var(--dur-fast) var(--ease-out);
}

.ef-timeline-step.is-active {
  opacity: 1;
}

.ef-timeline-trigger {
  width: 100%;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  padding: 20px 12px;
  border: 0;
  background: transparent;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-out);
}

.ef-timeline-trigger:hover {
  background: rgba(255, 255, 255, 0.04);
}

.ef-timeline-trigger[aria-pressed="true"] {
  background: rgba(255, 255, 255, 0.06);
}

.ef-timeline-dot {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
  padding-top: 2px;
}

.ef-timeline-trigger[aria-pressed="true"] .ef-timeline-dot {
  color: #2997FF;
}

.ef-timeline-card {
  display: grid;
  gap: 4px;
}

.ef-timeline-phase {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #2997FF;
}

.ef-timeline-text {
  font-size: clamp(1rem, 1.4vw, 1.125rem);
  font-weight: 600;
  letter-spacing: -0.015em;
  color: #F5F5F7;
}

/* Sticky Machined Phase Inspector */
.ef-step-inspector {
  padding: clamp(24px, 3vw, 34px);
  border-radius: 22px;
  background: #161617;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

@media (min-width: 960px) {
  .ef-step-inspector {
    position: sticky;
    top: calc(var(--header-h) + 28px);
  }
}

.ef-step-inspector-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.10);
  font-size: 0.8125rem;
}

.ef-step-insp-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.ef-step-insp-idx {
  font-weight: 600;
  color: #2997FF;
  font-variant-numeric: tabular-nums;
}

.ef-step-insp-badge {
  color: #98989D;
}

.ef-step-insp-title {
  margin: 0 0 10px;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  color: #F5F5F7;
}

.ef-step-insp-desc {
  margin: 0 0 22px;
  font-size: 0.9375rem;
  color: #A1A1A6;
  line-height: 1.6;
}

.ef-step-insp-dl {
  margin: 0 0 22px;
  display: grid;
  gap: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.10);
  padding-top: 16px;
}

.ef-step-insp-dl dt {
  margin: 0 0 4px;
  font-size: 0.78rem;
  font-weight: 500;
  color: #98989D;
}

.ef-step-insp-dl dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: #F5F5F7;
  line-height: 1.55;
  word-break: break-word;
}

.ef-step-insp-foot {
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.10);
}

/* ==========================================================================
   03 Developer First (Luminous Xcode Sheet)
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
  margin-top: 26px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  align-items: center;
}

.ef-code-card {
  border-radius: 18px;
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
  padding: 10px 16px;
  background: var(--code-head);
  border-bottom: 1px solid var(--border);
  font-size: 0.8125rem;
}

.ef-code-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.05);
}

html[data-theme="dark"] .ef-code-tabs {
  background: rgba(255, 255, 255, 0.08);
}

.ef-code-tab {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}

.ef-code-tab:hover {
  color: var(--text);
}

.ef-code-tab[aria-selected="true"] {
  background: var(--surface-1);
  color: var(--text);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.ef-code-tools {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.ef-code-caption {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-dim);
}

.ef-code-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-strong);
  background: var(--surface-1);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 0.76rem;
  font-weight: 500;
  cursor: pointer;
  min-height: 28px;
  transition: background-color var(--dur-fast) var(--ease-out);
}

.ef-code-btn:hover {
  background: var(--surface-2);
}

.ef-code-btn.is-copied {
  border-color: var(--status-available-border);
  color: var(--status-available-text);
}

.ef-code-pre {
  margin: 0;
  padding: 22px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.84rem;
  line-height: 1.72;
  min-height: 230px;
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
  width: 2px;
  height: 1.15em;
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

.ef-code-result {
  border-top: 1px solid var(--code-result-border);
  background: var(--code-result-bg);
  padding: 12px 22px;
  font-family: var(--font-mono);
  font-size: 0.76rem;
  direction: ltr;
  text-align: left;
  opacity: 0;
  transform: translateY(8px);
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
  color: var(--text-dim);
  font-size: 0.74rem;
}

.ef-code-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 22px;
  border-top: 1px solid var(--border);
  background: var(--code-head);
  color: var(--text-dim);
  font-size: 0.76rem;
}

/* ==========================================================================
   04 Guarantees (Pure Hairline Top-Ruled Editorial Matrix)
   ========================================================================== */

.ef-trust-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px 36px;
}

@media (min-width: 600px) {
  .ef-trust-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 960px) {
  .ef-trust-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.ef-trust-item {
  padding-top: 20px;
  border-top: 1px solid var(--border-strong);
}

.ef-trust-item-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.ef-trust-item strong {
  display: block;
  margin-bottom: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--text);
}

.ef-trust-item p {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.ef-pillar-head,
.ef-uc-title-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.ef-pillar-head {
  margin-bottom: 10px;
}

.ef-pillar-head h3,
.ef-uc-title-row h3 {
  margin: 0;
}

.ef-mt-12 { margin-top: 12px; }
.ef-mt-20 { margin-top: 20px; }
.ef-mt-28 { margin-top: 28px; }
.ef-text-sm { font-size: 0.875rem; }

/* ==========================================================================
   Final CTA & Cupertino Footer
   ========================================================================== */

.ef-final-cta {
  padding-block: clamp(80px, 10vw, 132px);
  background: var(--canvas);
  text-align: center;
  border-bottom: 1px solid var(--border);
}

.ef-final-cta h2 {
  margin: 0 auto 28px;
  max-width: 16ch;
  font-size: clamp(2.25rem, 4.8vw, 3.75rem);
  font-weight: 600;
  line-height: 1.06;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.ef-footer {
  margin-top: auto;
  padding-block: var(--space-8) var(--space-5);
  background: var(--bg-tinted);
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
  margin: 12px 0 18px;
  max-width: 30ch;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.ef-footer-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ef-footer-col h2 {
  margin: 0 0 12px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
}

.ef-footer-col ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.ef-footer-col a {
  font-size: 0.8125rem;
  color: var(--text-muted);
  transition: color var(--dur-fast) var(--ease-out);
}

.ef-footer-col a:hover {
  color: var(--text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ef-footer-bottom {
  padding-top: var(--space-4);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px 24px;
  font-size: 0.75rem;
  color: var(--text-dim);
}

/* ==========================================================================
   Subpages, Contact Form, Skeleton & 404
   ========================================================================== */

.ef-page-hero {
  padding-block: clamp(56px, 7vw, 96px) clamp(40px, 5vw, 60px);
  border-bottom: 1px solid var(--border);
  background: var(--canvas);
}

.ef-page-hero h1 {
  margin: 0 0 14px;
  font-size: clamp(2.2rem, 4.6vw, 3.6rem);
  font-weight: 600;
  line-height: 1.07;
  letter-spacing: -0.035em;
  max-width: 19ch;
  text-wrap: balance;
}

.ef-page-hero p.ef-page-lead {
  margin: 0;
  max-width: 58ch;
  font-size: clamp(1.0625rem, 1.5vw, 1.25rem);
  color: var(--text-muted);
  line-height: 1.55;
}

.ef-page-hero .ef-hero-actions,
.ef-page-hero .ef-hero-meta {
  justify-content: flex-start;
}

.ef-article {
  max-width: 74ch;
}

.ef-article h2 {
  margin: var(--space-6) 0 var(--space-2);
  font-size: 1.4rem;
  font-weight: 600;
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
  gap: 10px 14px;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  background: var(--bg-tinted);
  border: 1px solid var(--border);
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
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  margin-top: var(--space-4);
}

.ef-sub-grid > * {
  min-width: 0;
}

@media (min-width: 760px) {
  .ef-sub-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ef-info-card {
  padding: 24px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: 1px solid var(--border);
}

.ef-info-card h3 {
  margin: 0 0 8px;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.015em;
}

.ef-info-card p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
  line-height: 1.6;
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
  padding: 18px 20px;
  border-radius: var(--radius-md);
  background: var(--bg-tinted);
  border: 1px solid var(--border);
}

.ef-channel-item h3 {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
}

.ef-channel-item p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.ef-contact-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  gap: 18px;
  padding: 28px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
}

.ef-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  gap: 6px;
}

.ef-contact-form > * {
  min-width: 0;
}

.ef-field label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
}

.ef-field input,
.ef-field select,
.ef-field textarea {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--surface-1);
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
  background: var(--bg-tinted);
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
  padding: 12px 18px;
  border-radius: var(--radius-full);
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
  body:has(.ef-mobile-sticky-cta.is-visible) {
    padding-bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  }

  .ef-mobile-sticky-cta {
    position: fixed;
    inset-inline: 0;
    inset-block-end: 0;
    z-index: 150;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
    background: var(--surface-glass);
    backdrop-filter: saturate(180%) blur(16px);
    -webkit-backdrop-filter: saturate(180%) blur(16px);
    border-top: 1px solid var(--border);
    transform: translateY(100%);
    visibility: hidden;
    transition: transform var(--dur-base) var(--ease-out), visibility var(--dur-base);
  }
  .ef-mobile-sticky-cta.is-visible {
    transform: translateY(0);
    visibility: visible;
  }
  .ef-mobile-sticky-cta span {
    font-size: 0.78rem;
    color: var(--text-muted);
  }
}

/* ==========================================================================
   Accounts, Auth Forms & Connected Identity Pages
   ========================================================================== */

.ef-auth-section {
  padding-block: clamp(48px, 6vw, 88px);
  background: var(--bg-tinted);
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
  max-width: 460px;
}

.ef-auth-title {
  margin: 0 0 var(--space-3);
  font-size: clamp(2rem, 3.8vw, 3rem);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.ef-auth-lead {
  margin: 0 0 var(--space-4);
  max-width: 54ch;
  color: var(--text-muted);
  font-size: var(--text-base);
  line-height: 1.6;
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
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: clamp(24px, 3.5vw, 36px);
  box-shadow: var(--shadow-md);
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
  font-size: 1.625rem;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.ef-auth-card-lead {
  margin: 6px 0 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
  line-height: 1.55;
}

.ef-google-btn {
  width: 100%;
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 18px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-strong);
  background: var(--surface-1);
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}

.ef-google-btn:hover {
  background: var(--surface-2);
  border-color: var(--text-muted);
}

.ef-google-btn:active {
  transform: scale(0.99);
}

.ef-google-btn-sm {
  width: auto;
  min-height: 36px;
  padding: 6px 14px;
  font-size: 0.8125rem;
}

.ef-auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-block: var(--space-4);
  color: var(--text-dim);
  font-size: 0.78rem;
}

.ef-auth-divider::before,
.ef-auth-divider::after {
  content: "";
  flex: 1 1 0;
  height: 1px;
  background: var(--border);
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
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.ef-password-toggle:hover {
  color: var(--text);
  background: var(--surface-2);
}

.ef-password-toggle svg[hidden] {
  display: none !important;
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
  transition: background-color var(--dur-fast) var(--ease-out);
}

.ef-strength-meter[data-score="1"] .ef-strength-bars span:nth-child(1) { background: var(--danger); }
.ef-strength-meter[data-score="2"] .ef-strength-bars span:nth-child(-n+2) { background: var(--status-dev); }
.ef-strength-meter[data-score="3"] .ef-strength-bars span:nth-child(-n+3) { background: var(--accent); }
.ef-strength-meter[data-score="4"] .ef-strength-bars span { background: var(--status-available); }

.ef-strength-label {
  font-size: 0.75rem;
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
  font-size: 0.84rem;
  font-weight: 500;
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
  font-weight: 500;
}

.ef-auth-switch a:hover {
  text-decoration: underline;
}

/* Backend Integration Contract Box */
.ef-contract-box {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 18px;
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
  font-weight: 600;
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
  background: var(--bg-tinted);
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
  font-size: 0.78rem;
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
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 26px;
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
  font-weight: 600;
}

.ef-acc-card-desc {
  margin: 0;
  font-size: 0.84rem;
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
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 600;
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
  font-size: 0.8125rem;
  font-weight: 600;
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
  font-size: 0.78rem;
  color: var(--status-available-text);
}

/* Connected Provider Cards */
.ef-provider-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--bg-tinted);
  border: 1px solid var(--border);
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
  border-radius: 10px;
  background: var(--surface-1);
  border: 1px solid var(--border);
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
  font-family: var(--font-mono);
  font-size: 0.74rem;
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
  background: var(--bg-tinted);
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

/* Modal Backdrop */
.ef-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 800;
  background: rgba(0, 0, 0, 0.44);
  backdrop-filter: blur(8px);
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
  border: 1px solid var(--border);
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
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
}

.ef-modal-title {
  margin: 0 0 6px;
  font-size: 1.2rem;
  font-weight: 600;
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
  border: 1px solid var(--border);
  background: var(--bg-tinted);
  text-align: start;
  cursor: pointer;
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
  background: var(--bg-tinted);
  border: 1px solid var(--border);
}

.ef-scope-title {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
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

html[data-motion="paused"] .ef-hero-stagger,
html[data-motion="paused"] .ef-reveal,
html[data-motion="paused"] .ef-code-result,
html[data-motion="paused"] .ef-timeline-step {
  opacity: 1 !important;
  transform: none !important;
  animation: none !important;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  .ef-packet,
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
}

/* Keep mobile header controls & 44px touch targets within narrow viewports. */
@media (max-width: 767px), (pointer: coarse) {
  .ef-graph-tab,
  .ef-code-tab,
  .ef-code-btn,
  .ef-motion-toggle,
  .ef-filter-pill,
  .ef-preset-btn,
  .ef-inline-confirm button {
    min-height: 44px;
  }
}

@media (max-width: 480px) {
  .ef-hero-title {
    font-size: clamp(2.1rem, 9.5vw, 2.75rem);
  }
  .ef-code-tabs {
    width: 100%;
    overflow-x: auto;
    flex-wrap: nowrap;
  }
}

@media (max-width: 420px) {
  .ef-header .ef-lang-switcher .ef-lang-trigger > span { display: none; }
  .ef-header .ef-lang-switcher .ef-lang-trigger {
    min-width: 44px;
    justify-content: center;
    padding-inline: 8px;
  }
}

/* Accessible static FAQ disclosure list (logical properties for RTL/LTR). */
.ef-faq-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  max-width: 900px;
  margin-inline: auto;
}
.ef-faq-item { padding: 0; overflow: clip; }
.ef-faq-summary {
  position: relative;
  display: block;
  padding-block: 18px;
  padding-inline-start: 22px;
  padding-inline-end: 52px;
  color: var(--text);
  font-size: var(--text-base);
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}
.ef-faq-summary::-webkit-details-marker { display: none; }
.ef-faq-summary::after {
  content: "+";
  position: absolute;
  inset-inline-end: 22px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 500;
}
.ef-faq-item[open] .ef-faq-summary::after { content: "−"; }
.ef-faq-summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -4px;
  border-radius: var(--radius-md);
}
.ef-faq-answer {
  padding-block: 0 20px;
  padding-inline: 22px;
  border-top: 1px solid var(--border);
}
.ef-faq-answer p {
  margin: 14px 0 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
  line-height: 1.75;
}

/* ==========================================================================
   Unified Subpages: /platform, /use-cases, /developers, /demo, /product/*
   ========================================================================== */

.ef-ltr-input {
  direction: ltr;
  text-align: left;
}

.ef-card-link {
  display: flex;
  flex-direction: column;
  transition: border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}

.ef-card-link:hover {
  border-color: var(--border-strong);
  background: var(--bg-tinted);
}

.ef-card-title {
  margin: 0 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
}

/* Platform 7-Layer Interactive Explorer */
.ef-layer-explorer {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
  align-items: start;
}

@media (min-width: 900px) {
  .ef-layer-explorer {
    grid-template-columns: minmax(250px, 0.42fr) minmax(0, 0.58fr);
    gap: var(--space-5);
  }
}

.ef-layer-tabs {
  display: grid;
  gap: 8px;
}

.ef-layer-tab {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text-muted);
  text-align: start;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}

.ef-layer-tab:hover {
  border-color: var(--border-strong);
  color: var(--text);
}

.ef-layer-tab[aria-selected="true"] {
  border-color: var(--accent);
  background: var(--accent-tint);
  color: var(--text);
}

.ef-layer-tab-step {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  flex-shrink: 0;
}

.ef-layer-tab strong {
  font-size: 0.9375rem;
  font-weight: 600;
}

.ef-layer-panels {
  min-width: 0;
}

.ef-layer-panel {
  padding: clamp(24px, 3vw, 34px);
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--border);
}

.ef-layer-panel[hidden] {
  display: none;
}

.ef-layer-panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

.ef-layer-panel-head h3 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.ef-layer-panel-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
}

.ef-layer-step {
  color: var(--text-dim);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.ef-layer-dl {
  margin: 0;
  display: grid;
  gap: 16px;
}

.ef-layer-dl > div {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}

.ef-layer-dl > div:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.ef-layer-dl dt {
  margin: 0 0 4px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-dim);
}

.ef-layer-dl dd {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text);
  line-height: 1.6;
}

@media (min-width: 960px) {
  .ef-pillars-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

/* Use Cases Blueprints */
.ef-uc-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-5);
}

.ef-uc-stack > * {
  min-width: 0;
}

.ef-uc-card {
  padding: clamp(24px, 3.5vw, 34px);
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--border);
}

.ef-uc-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.ef-uc-head h3 {
  margin: 0 0 6px;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ef-uc-summary {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
  max-width: 66ch;
}

.ef-uc-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}

.ef-uc-grid > * {
  min-width: 0;
}

@media (min-width: 900px) {
  .ef-uc-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

.ef-uc-breakdown {
  display: grid;
  gap: 14px;
}

.ef-uc-block {
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.ef-uc-block:first-child {
  padding-top: 0;
  border-top: 0;
}

.ef-uc-label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent);
}

.ef-uc-block p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text);
  line-height: 1.55;
}

.ef-code-pre-compact {
  min-height: 0;
  padding: 18px;
  font-size: 0.8rem;
  line-height: 1.65;
}

/* Developer Center Layout & Spec Tables */
.ef-dev-doc-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
  align-items: start;
}

@media (min-width: 960px) {
  .ef-dev-doc-layout {
    grid-template-columns: 220px minmax(0, 1fr);
    gap: var(--space-6);
  }
}

.ef-doc-toc {
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--bg-tinted);
  border: 1px solid var(--border);
}

@media (min-width: 960px) {
  .ef-doc-toc {
    position: sticky;
    top: calc(var(--header-h) + 24px);
  }
}

.ef-doc-toc h2 {
  margin: 0 0 10px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text);
}

.ef-doc-toc nav {
  display: grid;
  gap: 4px;
}

.ef-doc-toc nav a {
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 0.82rem;
  color: var(--text-muted);
  transition: color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}

.ef-doc-toc nav a:hover {
  color: var(--text);
  background: var(--surface-1);
}

.ef-doc-body {
  min-width: 0;
}

.ef-doc-section {
  margin-bottom: var(--space-6);
  scroll-margin-top: calc(var(--header-h) + 24px);
}

.ef-doc-section h2 {
  margin: 0 0 12px;
  font-size: 1.4rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ef-doc-section p {
  margin: 0 0 14px;
  color: var(--text-muted);
  line-height: 1.7;
}

.ef-doc-section code {
  font-family: var(--font-mono);
  font-size: 0.86em;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--bg-tinted);
  color: var(--text);
}

.ef-spec-list {
  margin: 0 0 14px;
  padding-inline-start: 20px;
  display: grid;
  gap: 10px;
  color: var(--text-muted);
}

.ef-spec-list strong {
  color: var(--text);
}

.ef-table-wrap {
  width: 100%;
  overflow-x: auto;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-1);
}

.ef-spec-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
  text-align: start;
}

.ef-spec-table th,
.ef-spec-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.ef-spec-table thead th {
  background: var(--bg-tinted);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
}

.ef-spec-table tbody tr:last-child td {
  border-bottom: 0;
}

/* Interactive Bounded Execution Workbench (/demo) */
.ef-demo-preset-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--radius-full);
  background: var(--surface-1);
  border: 1px solid var(--border);
}

@media (max-width: 720px) {
  .ef-demo-preset-bar {
    border-radius: var(--radius-md);
  }
}

.ef-demo-preset-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-dim);
  padding-inline: 8px;
}

.ef-demo-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}

.ef-demo-grid > * {
  min-width: 0;
}

@media (min-width: 960px) {
  .ef-demo-grid {
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  }
}

.ef-demo-form-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ef-demo-form-head h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}

.ef-demo-flags {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: var(--bg-tinted);
  border: 1px solid var(--border);
}

.ef-demo-output-col {
  min-width: 0;
}

.ef-demo-stages {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

@media (min-width: 640px) {
  .ef-demo-stages {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

.ef-demo-stage {
  padding: 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  border: 1px solid var(--border);
  display: grid;
  gap: 4px;
}

.ef-demo-stage span {
  font-size: 0.72rem;
  color: var(--text-dim);
}

.ef-demo-stage strong {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--text);
  word-break: break-word;
}

.ef-demo-stage.is-pass {
  border-color: var(--status-available-border);
  background: var(--status-available-bg);
}

.ef-demo-stage.is-pass strong {
  color: var(--status-available-text);
}

.ef-demo-stage.is-warn {
  border-color: var(--status-dev-border);
  background: var(--status-dev-bg);
}

.ef-demo-stage.is-warn strong {
  color: var(--status-dev-text);
}

.ef-demo-stage.is-fail {
  border-color: var(--danger-border);
  background: var(--danger-bg);
}

.ef-demo-stage.is-fail strong {
  color: var(--danger);
}

.ef-demo-pre {
  min-height: 300px;
  max-height: 460px;
  overflow: auto;
}

/* Inline Confirmation UI */
.ef-inline-confirm {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--danger-border);
  background: var(--danger-bg);
  font-size: 0.8rem;
  color: var(--text);
}

.ef-inline-confirm-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ef-btn-danger-sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 12px;
  min-height: 30px;
  border-radius: var(--radius-full);
  border: 1px solid var(--danger);
  background: var(--danger);
  color: #FFFFFF;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.ef-btn-danger-sm:hover {
  filter: brightness(0.92);
}

/* ==========================================================================
   Account Dashboard, Execution Workspace & Mandatory Auth Gate
   ========================================================================== */

.ef-auth-wide-wrap {
  max-width: var(--container-max);
}

.ef-auth-page-head {
  margin-bottom: var(--space-5);
}

.ef-account-stack {
  display: grid;
  gap: 20px;
}

.ef-mb-20 {
  margin-bottom: 20px;
}

.ef-auth-divider[hidden],
.ef-dev-mailbox[hidden],
.ef-auth-resend[hidden],
[data-auth-gate][hidden],
[data-auth-workspace-link][hidden],
[data-auth-header-signout][hidden],
[data-auth-drawer-workspace][hidden],
[data-auth-drawer-signout][hidden],
[data-auth-drawer-signin][hidden],
[data-auth-drawer-account][hidden],
[data-ws-key-reveal][hidden],
[data-two-factor-enable-form][hidden],
[data-two-factor-enrollment][hidden] {
  display: none !important;
}

.ef-workspace-bar {
  padding: clamp(20px, 3vw, 28px);
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.ef-workspace-user-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ef-workspace-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}

@media (min-width: 820px) {
  .ef-workspace-stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.ef-stat-card {
  padding: 18px 20px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: 1px solid var(--border);
  display: grid;
  gap: 6px;
}

.ef-stat-card span {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-dim);
}

.ef-stat-card strong {
  font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--text);
}

/* Quick-Jump Command Palette */
.ef-cmd-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-strong);
  background: var(--surface-1);
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}

.ef-cmd-trigger:hover {
  border-color: var(--accent);
  color: var(--text);
}

.ef-cmd-trigger kbd {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 1px 5px;
  border-radius: 5px;
  background: var(--surface-2);
  color: var(--text-dim);
  border: 1px solid var(--border);
}

.ef-cmd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 600;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: grid;
  place-items: start center;
  padding-top: min(14vh, 120px);
  padding-inline: 16px;
}

.ef-cmd-backdrop[hidden] {
  display: none !important;
}

.ef-cmd-dialog {
  width: min(560px, 100%);
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.ef-cmd-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.ef-cmd-input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 0.95rem;
  outline: none;
}

.ef-cmd-list {
  margin: 0;
  padding: 8px;
  list-style: none;
  max-height: min(55vh, 360px);
  overflow-y: auto;
  display: grid;
  gap: 2px;
}

.ef-cmd-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-muted);
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}

.ef-cmd-item:hover,
.ef-cmd-item.is-selected {
  background: var(--surface-2);
  color: var(--text);
}

.ef-cmd-item code {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-dim);
}

.ef-dev-mailbox {
  margin-top: 16px;
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--status-available-bg);
  border: 1px solid var(--status-available-border);
  display: grid;
  gap: 8px;
}

.ef-dev-mailbox-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ef-dev-mailbox-head strong {
  font-size: 0.875rem;
  color: var(--text);
}

.ef-key-secret-code {
  display: block;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  word-break: break-all;
  direction: ltr;
  text-align: left;
  user-select: all;
}

.ef-auth-resend {
  margin-top: 14px;
  padding: 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-tinted);
  border: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ef-header-signout {
  white-space: nowrap;
}

@media (max-width: 720px) {
  .ef-workspace-nav-link,
  .ef-header-signout {
    display: none;
  }
}

/* Mandatory Auth Gate Overlay on Interactive Features */
.ef-auth-gate-shell {
  position: relative;
}

.ef-auth-gate-shell[data-auth-locked="true"] .ef-auth-gate-content {
  filter: blur(5px);
  opacity: 0.42;
  pointer-events: none;
  user-select: none;
  transition: filter var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out);
}

.ef-auth-gate-shell[data-auth-locked="false"] .ef-auth-gate-content {
  filter: none;
  opacity: 1;
  pointer-events: auto;
}

.ef-auth-gate {
  position: relative;
  z-index: 20;
  margin-bottom: var(--space-4);
}

@media (min-width: 720px) {
  .ef-auth-gate-shell[data-auth-locked="true"] .ef-auth-gate {
    position: sticky;
    top: calc(var(--header-h) + 28px);
    display: flex;
    justify-content: center;
  }
}

.ef-auth-gate-card {
  width: min(500px, 100%);
  margin-inline: auto;
  padding: clamp(24px, 4vw, 34px);
  border-radius: var(--radius-lg);
  background: var(--surface-glass);
  backdrop-filter: saturate(180%) blur(22px);
  -webkit-backdrop-filter: saturate(180%) blur(22px);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg);
  text-align: center;
  display: grid;
  justify-items: center;
  gap: 10px;
}

.ef-auth-gate-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: var(--accent-tint);
  color: var(--accent);
  display: grid;
  place-items: center;
}

.ef-auth-gate-card h3 {
  margin: 4px 0 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ef-auth-gate-card p {
  margin: 0 0 8px;
  font-size: var(--text-sm);
  color: var(--text-muted);
  max-width: 44ch;
  line-height: 1.55;
}

/* Shared product refinements */
html {
  scroll-padding-top: calc(var(--header-h) + 20px);
}

h1,
h2,
h3 {
  text-wrap: balance;
}

:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

button,
a {
  -webkit-tap-highlight-color: rgba(36, 88, 198, 0.12);
  touch-action: manipulation;
}

.ef-page-hero {
  padding-block: clamp(42px, 5vw, 68px) clamp(34px, 4vw, 50px);
  background: linear-gradient(180deg, var(--bg) 0%, var(--canvas) 100%);
}

.ef-page-hero h1 {
  max-width: 22ch;
  font-size: clamp(2.05rem, 4.2vw, 3.35rem);
  line-height: 1.08;
  letter-spacing: -0.045em;
}

.ef-page-hero p.ef-page-lead {
  max-width: 64ch;
  font-size: clamp(1rem, 1.25vw, 1.125rem);
  line-height: 1.7;
}

.ef-header {
  background: color-mix(in srgb, var(--canvas) 92%, transparent);
  border-bottom-color: var(--border);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
}

.ef-footer {
  border-top-color: var(--border-strong);
  background: var(--bg);
}

.ef-legal-section {
  padding-block: clamp(32px, 4vw, 56px);
}

.ef-legal-document {
  width: min(calc(100% - 40px), var(--container-max));
  max-width: var(--container-max);
  padding-inline: 0;
}

.ef-legal-progress {
  height: 3px;
  margin: 0 0 var(--space-5);
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--border);
}

.ef-legal-progress span {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left center;
}

html[dir="rtl"] .ef-legal-progress span {
  transform-origin: right center;
}

.ef-legal-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--space-5);
}

.ef-legal-toc {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
}

.ef-legal-toc h2 {
  margin: 0 0 10px;
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0;
}

.ef-legal-toc nav {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.ef-legal-toc a {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--text-sm);
  white-space: nowrap;
  transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease;
}

.ef-legal-toc a:hover,
.ef-legal-toc a[aria-current="location"] {
  background: var(--accent-tint);
  color: var(--accent);
}

.ef-legal-body {
  min-width: 0;
  max-width: 72ch;
}

.ef-legal-body h2 {
  scroll-margin-top: calc(var(--header-h) + 24px);
  padding-top: 8px;
  font-size: clamp(1.2rem, 2vw, 1.45rem);
  line-height: 1.35;
}

.ef-account-workspace[hidden] {
  display: none !important;
}

.ef-account-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.ef-account-settings-nav {
  display: flex;
  gap: 4px;
  min-width: 0;
  padding: 5px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  scrollbar-width: thin;
}

.ef-account-settings-nav a {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease;
}

.ef-account-settings-nav a:hover,
.ef-account-settings-nav a[aria-current="location"] {
  background: var(--accent-tint);
  color: var(--accent);
}

.ef-profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ef-profile-unsaved {
  margin: 0;
  color: var(--status-dev-text);
  font-size: var(--text-sm);
}

.ef-account-card .ef-btn-sm,
.ef-account-card button {
  min-height: 44px;
}

#account-profile,
#account-connected,
#account-security,
#account-sessions {
  scroll-margin-top: calc(var(--header-h) + 24px);
}

@media (min-width: 960px) {
  .ef-legal-layout {
    grid-template-columns: 210px minmax(0, 1fr);
    gap: clamp(36px, 6vw, 72px);
  }

  .ef-legal-toc {
    position: sticky;
    top: calc(var(--header-h) + 24px);
  }

  .ef-legal-toc nav {
    display: grid;
    overflow: visible;
  }

  .ef-account-workspace {
    grid-template-columns: 190px minmax(0, 1fr);
    column-gap: clamp(24px, 4vw, 52px);
    row-gap: 20px;
  }

  .ef-account-settings-nav {
    grid-column: 1;
    grid-row: 1 / span 2;
    position: sticky;
    top: calc(var(--header-h) + 20px);
    display: grid;
    align-content: start;
    padding: 8px;
  }

  .ef-account-settings-nav a {
    white-space: normal;
  }

  .ef-account-workspace > .ef-account-hero-row,
  .ef-account-workspace > .ef-account-grid {
    grid-column: 2;
    min-width: 0;
  }

  .ef-account-workspace > .ef-account-hero-row {
    grid-row: 1;
  }

  .ef-account-workspace > .ef-account-grid {
    grid-row: 2;
  }
}

@media (max-width: 600px) {
  .ef-legal-document {
    width: min(calc(100% - 32px), var(--container-max));
  }

  .ef-legal-toc {
    padding: 12px;
  }

  .ef-legal-toc nav {
    margin-inline: -4px;
    padding: 0 4px 4px;
  }

  .ef-account-card {
    padding: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  .ef-legal-toc a,
  .ef-account-settings-nav a {
    transition: none;
  }
}


@media (max-width: 480px) {
  .ef-badge {
    max-width: 100%;
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }
}

@media (max-width: 380px) {
  .ef-header-inner {
    gap: 8px;
  }

  .ef-header-actions {
    flex-shrink: 1;
    min-width: 0;
    gap: 4px;
  }

  .ef-lang-trigger {
    padding-inline: 4px;
  }

  .ef-lang-trigger > span:first-of-type {
    display: none;
  }
}
`;
