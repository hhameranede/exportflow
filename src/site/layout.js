import { NAV_ITEMS, SITE_META } from "./data.js";
import { SEOManager } from "./seo-manager.js";

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

export function renderDocument({
  path = "/",
  requestUrl = "https://exportflow.me/",
  title,
  description,
  bodyHtml,
  jsonLd = null,
  isMarketing = false,
  locale = "en",
  dir = null,
  extraHeadHtml = "",
  ogTitle = null,
  ogDescription = null,
  ogType = "website",
  ogEyebrow = "AGENT EXECUTION INFRASTRUCTURE",
  ogImage = null,
  includeAlternates = false,
  robots = null,
  themeColor = "#F8FAFC",
}) {
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

  const marketingDetected = isMarketing || bodyHtml.includes("ef-header-new");
  const marketingHeader = marketingDetected ? bodyHtml.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? "" : "";
  const marketingDrawer = marketingDetected ? bodyHtml.match(/<div class="ef-drawer-backdrop"[\s\S]*?<\/aside>/)?.[0] ?? "" : "";
  const marketingFooter = marketingDetected ? bodyHtml.match(/<footer\b[\s\S]*?<\/footer>/)?.[0] ?? "" : "";
  const marketingContent = marketingDetected
    ? bodyHtml
        .replace(marketingHeader, "")
        .replace(marketingDrawer, "")
        .replace(marketingFooter, "")
        .replace(/<script src="\/assets\/marketing\.js" defer><\/script>/, "")
    : bodyHtml;

  const headerHtml = marketingDetected ? marketingHeader : `<header class="ef-header">
    <div class="ef-container ef-header-inner">
      <a class="ef-brand" href="/">${escapeHtml(SITE_META.brandName)}</a>
      <nav class="ef-nav" aria-label="Primary navigation">${navLinksHtml}</nav>
      <div class="ef-header-actions">
        <a class="ef-btn ef-btn-primary ef-btn-sm" href="/demo"${path === "/demo" ? ' aria-current="page"' : ""}>Try Demo</a>
        <button type="button" class="ef-menu-toggle" aria-expanded="false" aria-controls="mobile-nav-drawer" aria-label="Toggle navigation menu" data-menu-toggle>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 5.5H17M3 10H17M3 14.5H17" stroke="currentColor" stroke-width="1.75" stroke-linecap="square"/></svg>
        </button>
      </div>
    </div>
    <div id="mobile-nav-drawer" class="ef-mobile-drawer" data-mobile-drawer><nav aria-label="Mobile navigation"><ul class="ef-mobile-nav-list">${mobileLinksHtml}</ul></nav></div>
  </header>`;

  const footerHtml = marketingDetected ? marketingFooter : `<footer class="ef-footer"><div class="ef-container"><div class="ef-footer-grid"><div><a class="ef-brand" href="/">${escapeHtml(SITE_META.brandName)}</a><p class="ef-footer-desc">${escapeHtml(SITE_META.positioning)} ${escapeHtml(SITE_META.tagline)}</p></div><div><h2 class="ef-footer-heading">Infrastructure</h2><ul class="ef-footer-links"><li><a href="/">Overview</a></li><li><a href="/platform">The Platform</a></li><li><a href="/use-cases">Use Cases</a></li></ul></div><div><h2 class="ef-footer-heading">Developers</h2><ul class="ef-footer-links"><li><a href="/developers">Developer Documentation</a></li><li><a href="/demo">Interactive Demo</a></li><li><a href="/faq">FAQ</a></li></ul></div></div><div class="ef-footer-bottom"><span>© 2026 ExportFlow</span><span>Phase 1 execution foundation · Public API access not yet open</span></div></div></footer>`;

  const htmlAttrs = dir ? `lang="${escapeHtml(locale)}" dir="${escapeHtml(dir)}"` : `lang="${escapeHtml(locale)}"`;
  const stylesheetsHtml = marketingDetected
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="/assets/marketing.css?v=2">`
    : `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="/assets/site.css">`;

  const scriptHtml = marketingDetected
    ? `<div class="ef-toast-region" data-toast-region aria-live="polite" aria-atomic="true"></div>
  <script src="/assets/marketing.js" defer></script>`
    : `<script src="/assets/site.js" defer></script>`;

  const seoHeadTags = SEOManager.renderHeadTags({
    path,
    requestUrl,
    title,
    description,
    ogTitle,
    ogDescription,
    ogType,
    ogEyebrow,
    ogImage,
    locale,
    includeAlternates,
    robots,
    jsonLd,
    themeColor,
  });

  return `<!doctype html>
<html ${htmlAttrs}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
${seoHeadTags}
  <link rel="icon" type="image/svg+xml" href="/assets/mark.svg">
  ${stylesheetsHtml}
  ${extraHeadHtml}
</head>
<body>
  <a class="ef-skip-link" href="#main-content">Skip to content</a>

  ${headerHtml}
  ${marketingDrawer}
  <main id="main-content" class="ef-main">
    ${marketingContent}
  </main>
  ${footerHtml}

  ${scriptHtml}
</body>
</html>`;
}

export function renderRobotsTxt(requestUrl) {
  const origin = SEOManager.resolveCanonicalBase(requestUrl);
  return `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`;
}

export function renderSitemapXml(requestUrl, paths = ["/", "/platform", "/use-cases", "/developers", "/demo", "/faq"]) {
  const origin = SEOManager.resolveCanonicalBase(requestUrl);
  const urls = paths
    .map(
      (p) => `  <url>\n    <loc>${escapeHtml(origin + p)}</loc>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
