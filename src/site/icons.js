/**
 * Bespoke architectural SVG iconography and the ExportFlow Cat & Mouse brand emblem.
 * Monochrome / single-accent Cupertino precision vector marks — zero external icon fonts or generic templates.
 */

export const BRAND_CAT_MARK_PATHS = `<path fill="currentColor" fill-rule="evenodd" d="M44.5 56.5H20.5C12.2 56.5 6.4 51 6.4 39.2C6.4 29.8 11.4 24.4 17.5 24.4C20.4 24.4 22 26.2 21.8 28C21.6 29.6 19.6 30.2 17.6 30.4C13.8 30.8 11.6 34.4 11.6 40.4C11.6 48 15.6 52.4 20.2 52.4C16.8 49 16.5 42.6 20.4 37.6C23.6 33.4 28.2 30.6 31.4 28.8C27.6 27.6 26.2 24 27.2 18.8C28.2 14 31.2 10.2 35.8 7.5C38.2 9.4 40.2 11.8 41.6 13.8C46.2 13.4 50.6 15.4 52.2 18.8L54 19.8C54.4 21.6 53 23.8 50.8 24.4C48.2 25.2 46.2 25 44.4 27C43.2 28.4 44 31.4 45.4 35.4C47.4 41 47.2 48.8 43.6 54.2L45.8 56.5ZM34.4 11.6L34.2 17.6L38 15Z M30.8 41.2C36.4 41.4 39.4 48.6 35 54.4C37.4 49 35.4 43.4 30.8 41.2Z"/>
<path d="M50.8 23.6C53.2 25.4 54 27.8 54.4 30.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
<path fill="currentColor" fill-rule="evenodd" d="M53.8 29.8C56.8 29.5 59.6 32 60 35.4C60.4 39 58.2 41.8 55.2 42.1C52.2 42.4 49.6 39.8 49.2 36.2C48.8 32.8 50.8 30.1 53.8 29.8ZM53.6 31.3L54.6 31.2L54.9 34L53.9 34.1Z"/>`;

export function renderBrandCatSvg(cls = "ef-brand-cat-svg", size = 24) {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true">${BRAND_CAT_MARK_PATHS}</svg>`;
}

const FEATURE_SVGS = {
  "web-intelligence": `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="15" cy="15" r="9.5"/>
    <path d="M5.5 15h19M15 5.5c2.8 2.6 4.2 5.8 4.2 9.5s-1.4 6.9-4.2 9.5c-2.8-2.6-4.2-5.8-4.2-9.5s1.4-6.9 4.2-9.5Z"/>
    <path d="M22.5 22.5l4.8 4.8" stroke="var(--accent)" stroke-width="2"/>
  </svg>`,
  "execution-orchestration": `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="12" width="7" height="8" rx="2"/>
    <rect x="21" y="5.5" width="7" height="7" rx="2"/>
    <rect x="21" y="19.5" width="7" height="7" rx="2"/>
    <path d="M11 16h5.5M16.5 16l4.5-6.5M16.5 16l4.5 6.5"/>
    <circle cx="16.5" cy="16" r="2.2" fill="var(--accent)" stroke="none"/>
  </svg>`,
  "developer-platform": `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="5.5" width="24" height="21" rx="4"/>
    <path d="M4 11h24"/>
    <path d="M11 16.5l-3 2.8 3 2.8M21 16.5l3 2.8-3 2.8M17.2 15.5l-2.4 7.6" stroke="var(--accent)"/>
  </svg>`,
  "browser-automation": `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="5.5" width="24" height="21" rx="4"/>
    <path d="M4 11h24"/>
    <path d="M13.5 15.5l8 3.2-3.4 1.5-1.5 3.4-3.1-8.1Z" fill="var(--accent)" fill-opacity="0.18" stroke="var(--accent)"/>
  </svg>`,
  "persistent-intelligence": `<svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="16" cy="9" rx="9" ry="3.5"/>
    <path d="M7 9v6.8c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5V9"/>
    <path d="M7 15.8v6.8c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5v-6.8"/>
    <circle cx="22.5" cy="22.5" r="2.2" fill="var(--accent)" stroke="none"/>
  </svg>`,
  "controlled": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="14" cy="15" r="9"/>
    <path d="M14 10.5V15l3.2 2M11 4.2h6M14 4.2V6"/>
  </svg>`,
  "transparent": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="5.5" width="20" height="17" rx="3.5"/>
    <path d="M9 12.2l2.4 2.3L16 10M9 18h10"/>
  </svg>`,
  "provenance": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 17l-2.5 2.5a3.5 3.5 0 0 1-5-5L6 12a3.5 3.5 0 0 1 5 0"/>
    <path d="M17 11l2.5-2.5a3.5 3.5 0 0 1 5 5L22 16a3.5 3.5 0 0 1-5 0"/>
    <path d="M10.5 17.5l7-7" stroke="var(--accent)"/>
  </svg>`,
  "resource-limits": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5.5 19.5a10 10 0 1 1 17 0"/>
    <path d="M14 16l4.5-4.5" stroke="var(--accent)"/>
    <circle cx="14" cy="16" r="1.8" fill="currentColor" stroke="none"/>
    <path d="M7 22h14"/>
  </svg>`,
  "security-egress": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 3.5l8 3v6.2c0 5.3-3.4 9.6-8 11.6-4.6-2-8-6.3-8-11.6V6.5l8-3Z"/>
    <rect x="10.8" y="13" width="6.4" height="5" rx="1.2"/>
    <path d="M12.2 13v-1.8a1.8 1.8 0 0 1 3.6 0V13"/>
  </svg>`,
  "provider-neutral": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="14" cy="14" r="3"/>
    <circle cx="5.5" cy="7.5" r="2"/>
    <circle cx="22.5" cy="7.5" r="2"/>
    <circle cx="5.5" cy="20.5" r="2"/>
    <circle cx="22.5" cy="20.5" r="2"/>
    <path d="M7.2 8.8l4.5 3.4M20.8 8.8l-4.5 3.4M7.2 19.2l4.5-3.4M20.8 19.2l-4.5-3.4"/>
  </svg>`,
  "step-ingress": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="5" width="20" height="18" rx="3.5"/>
    <path d="M8.5 14h11M15.5 10l4 4-4 4"/>
  </svg>`,
  "step-policy": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 3.5l8 3v6.2c0 5.3-3.4 9.6-8 11.6-4.6-2-8-6.3-8-11.6V6.5l8-3Z"/>
    <path d="M10.5 14l2.4 2.4 4.8-4.8" stroke="var(--accent)"/>
  </svg>`,
  "step-router": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6.5" cy="14" r="2.2"/>
    <circle cx="21.5" cy="8" r="2.2"/>
    <circle cx="21.5" cy="20" r="2.2"/>
    <path d="M8.7 14h4.8l5.8-5M13.5 14l5.8 5"/>
  </svg>`,
  "step-engine": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="5" width="18" height="18" rx="4"/>
    <rect x="9.5" y="9.5" width="9" height="9" rx="1.8"/>
    <path d="M14 2v3M14 23v3M2 14h3M23 14h3"/>
  </svg>`,
  "step-evidence": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 4h10l4 4v16H7V4Z"/>
    <path d="M17 4v4h4M10.5 13.5l2.2 2.2 4.8-4.8M10.5 19.5h7"/>
  </svg>`,
  "uc-search": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12.5" cy="12.5" r="7"/>
    <path d="M17.8 17.8L24 24" stroke="var(--accent)" stroke-width="2"/>
  </svg>`,
  "uc-extract": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="4.5" width="20" height="19" rx="3"/>
    <path d="M4 10.5h20M11.5 10.5v13"/>
  </svg>`,
  "uc-map": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <rect x="11" y="4" width="6" height="5" rx="1.2"/>
    <rect x="4" y="19" width="6" height="5" rx="1.2"/>
    <rect x="18" y="19" width="6" height="5" rx="1.2"/>
    <path d="M14 9v5M7 19v-5h14v5"/>
  </svg>`,
  "uc-research": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 6.5h18M5 12h12M5 17.5h8"/>
    <circle cx="19.5" cy="18.5" r="4.5"/>
    <path d="M22.8 21.8L25 24" stroke="var(--accent)"/>
  </svg>`,
  "uc-browser": `<svg width="16" height="16" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3.5" y="4.5" width="21" height="19" rx="3.5"/>
    <path d="M3.5 9.5h21"/>
    <path d="M12 13.5l7 2.8-3 1.3-1.3 3-2.7-7.1Z" stroke="var(--accent)"/>
  </svg>`,
};

export function renderFeatureIcon(name) {
  const svg = FEATURE_SVGS[name] || FEATURE_SVGS["web-intelligence"];
  return `<span class="ef-feature-icon" aria-hidden="true">${svg}</span>`;
}
