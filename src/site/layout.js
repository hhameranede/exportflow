import { NAV_ITEMS, SITE_META } from "./data.js";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeJsonForScript(data) {
  return JSON.stringify(data).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e");
}

function resolveCanonicalBase(requestUrl) {
  try {
    const parsed = new URL(requestUrl);
    if (parsed.hostname === "exportflow.me" || parsed.hostname === "www.exportflow.me") {
      return "https://exportflow.me";
    }
    return parsed.origin;
  } catch {
    return SITE_META.defaultOrigin;
  }
}

export function renderDocument({
  path = "/",
  requestUrl = "https://exportflow.me/",
  title,
  description,
  bodyHtml,
  jsonLd = null,
}) {
  const canonicalOrigin = resolveCanonicalBase(requestUrl);
  const canonicalUrl = `${canonicalOrigin}${path === "/" ? "/" : path}`;
  const ogImageUrl = `${canonicalOrigin}/assets/og-card.svg`;

  const navLinksHtml = NAV_ITEMS.map((item) => {
    const current = path === item.href ? ' aria-current="page"' : "";
    return `<a class="ef-nav-link" href="${item.href}"${current}>${escapeHtml(item.label)}</a>`;
  }).join("");

  const mobileLinksHtml = [
    { href: "/", label: "Home" },
    ...NAV_ITEMS,
    { href: "/demo", label: "Interactive Demo" },
  ]
    .map((item) => {
      const current = path === item.href ? ' aria-current="page"' : "";
      return `<li><a class="ef-mobile-nav-link" href="${item.href}"${current}><span>${escapeHtml(item.label)}</span><span aria-hidden="true">-&gt;</span></a></li>`;
    })
    .join("");

  const jsonLdTag = jsonLd
    ? `<script type="application/ld+json">${safeJsonForScript(jsonLd)}</script>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b0f17">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="icon" type="image/svg+xml" href="/assets/mark.svg">
  <link rel="stylesheet" href="/assets/site.css">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(SITE_META.brandName)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">
  ${jsonLdTag}
</head>
<body>
  <a class="ef-skip-link" href="#main-content">Skip to content</a>

  <header class="ef-header">
    <div class="ef-container ef-header-inner">
      <a class="ef-brand" href="/">${escapeHtml(SITE_META.brandName)}</a>

      <nav class="ef-nav" aria-label="Primary navigation">
        ${navLinksHtml}
      </nav>

      <div class="ef-header-actions">
        <a class="ef-btn ef-btn-primary ef-btn-sm" href="/demo"${path === "/demo" ? ' aria-current="page"' : ""}>Try Demo</a>
        <button
          type="button"
          class="ef-menu-toggle"
          aria-expanded="false"
          aria-controls="mobile-nav-drawer"
          aria-label="Toggle navigation menu"
          data-menu-toggle
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5.5H17M3 10H17M3 14.5H17" stroke="currentColor" stroke-width="1.75" stroke-linecap="square"/>
          </svg>
        </button>
      </div>
    </div>

    <div id="mobile-nav-drawer" class="ef-mobile-drawer" data-mobile-drawer>
      <nav aria-label="Mobile navigation">
        <ul class="ef-mobile-nav-list">
          ${mobileLinksHtml}
        </ul>
      </nav>
    </div>
  </header>

  <main id="main-content" class="ef-main">
    ${bodyHtml}
  </main>

  <footer class="ef-footer">
    <div class="ef-container">
      <div class="ef-footer-grid">
        <div>
          <a class="ef-brand" href="/">${escapeHtml(SITE_META.brandName)}</a>
          <p class="ef-footer-desc">${escapeHtml(SITE_META.positioning)} ${escapeHtml(SITE_META.tagline)}</p>
        </div>

        <div>
          <h2 class="ef-footer-heading">Infrastructure</h2>
          <ul class="ef-footer-links">
            <li><a href="/">Overview</a></li>
            <li><a href="/platform">The Platform</a></li>
            <li><a href="/use-cases">Use Cases</a></li>
          </ul>
        </div>

        <div>
          <h2 class="ef-footer-heading">Developers</h2>
          <ul class="ef-footer-links">
            <li><a href="/developers">Developer Documentation</a></li>
            <li><a href="/demo">Interactive Demo</a></li>
            <li><a href="/faq">FAQ</a></li>
          </ul>
        </div>
      </div>

      <div class="ef-footer-bottom">
        <span>© 2026 ExportFlow</span>
        <span>Phase 1 execution foundation · Public API access not yet open</span>
      </div>
    </div>
  </footer>

  <script src="/assets/site.js" defer></script>
</body>
</html>`;
}

export function renderRobotsTxt(requestUrl) {
  const origin = resolveCanonicalBase(requestUrl);
  return `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`;
}

export function renderSitemapXml(requestUrl) {
  const origin = resolveCanonicalBase(requestUrl);
  const paths = ["/", "/platform", "/use-cases", "/developers", "/demo", "/faq"];
  const urls = paths
    .map(
      (p) => `  <url>\n    <loc>${escapeHtml(origin + p)}</loc>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
