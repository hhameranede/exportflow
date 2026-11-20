import { SITE_META } from "./data.js";

export const SUPPORTED_LOCALES = Object.freeze(["en", "ar", "fr", "es", "de", "pt", "zh", "ja"]);

const LOCALE_TO_OG = Object.freeze({
  en: "en_US",
  ar: "ar_AR",
  fr: "fr_FR",
  es: "es_ES",
  de: "de_DE",
  pt: "pt_PT",
  zh: "zh_CN",
  ja: "ja_JP",
});

function escapeHtmlAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return escapeHtmlAttr(value);
}

function safeJsonForScript(data) {
  return JSON.stringify(data).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e");
}

function normalizePath(path) {
  if (!path || path === "/index.html") return "/";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function stripLocalePrefix(path) {
  const normalized = normalizePath(path);
  const match = /^\/(en|ar|fr|es|de|pt|zh|ja)(\/.*)?$/.exec(normalized);
  if (!match) return { locale: "en", basePath: normalized };
  return { locale: match[1], basePath: match[2] || "/" };
}

function buildLocalizedPath(basePath, locale) {
  const cleanBase = normalizePath(basePath);
  if (locale === "en") return cleanBase;
  return cleanBase === "/" ? `/${locale}` : `/${locale}${cleanBase}`;
}

function clampText(text, maxLen) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

function formatSeoTitle(rawTitle, brandName = SITE_META.brandName) {
  const clean = String(rawTitle || "").trim();
  if (!clean) return `${brandName} — Give AI the Power to Execute`;
  if (clean.includes(brandName)) return clean;
  return `${clean} — ${brandName}`;
}

function formatSeoDescription(rawDescription) {
  const clean = String(rawDescription || "").replace(/\s+/g, " ").trim();
  if (!clean) {
    return "Agent execution infrastructure that helps AI turn plans into verifiable outcomes with bounded policies and structured source evidence.";
  }
  if (clean.length >= 90) return clampText(clean, 160);
  return clampText(
    `${clean} ExportFlow provides bounded execution, deterministic routing, and verifiable source evidence.`,
    160,
  );
}

export class SEOManager {
  static resolveCanonicalBase(requestUrl) {
    const envAppUrl = typeof process !== "undefined" && process.env?.APP_URL
      ? process.env.APP_URL.trim()
      : "";
    try {
      const parsed = new URL(requestUrl);
      if (parsed.hostname === "exportflow.me" || parsed.hostname === "www.exportflow.me") {
        return "https://exportflow.me";
      }
      const isLoopback = parsed.hostname === "127.0.0.1"
        || parsed.hostname === "localhost"
        || parsed.hostname === "0.0.0.0"
        || parsed.hostname === "::1"
        || parsed.hostname === "[::1]";
      if (!isLoopback) {
        return parsed.origin;
      }
      if (envAppUrl) {
        try {
          return new URL(envAppUrl).origin;
        } catch {
          // Ignore malformed APP_URL and fall back to request origin
        }
      }
      return parsed.origin;
    } catch {
      if (envAppUrl) {
        try {
          return new URL(envAppUrl).origin;
        } catch {
          // Ignore malformed APP_URL
        }
      }
      return SITE_META.defaultOrigin;
    }
  }

  static buildCanonicalUrl({ path = "/", requestUrl = "https://exportflow.me/" } = {}) {
    const base = SEOManager.resolveCanonicalBase(requestUrl);
    const { locale, basePath } = stripLocalePrefix(path);
    const localized = buildLocalizedPath(basePath, locale);
    return `${base}${localized}`;
  }

  static buildOgImageUrl({
    title,
    description,
    eyebrow = "AGENT EXECUTION INFRASTRUCTURE",
    locale = "en",
    path = "/",
    requestUrl = "https://exportflow.me/",
  } = {}) {
    const base = SEOManager.resolveCanonicalBase(requestUrl);
    const params = new URLSearchParams();
    params.set("title", clampText(title || "Give AI the Power to Execute.", 72));
    if (description) params.set("description", clampText(description, 120));
    if (eyebrow) params.set("eyebrow", clampText(eyebrow, 42));
    if (locale) params.set("locale", locale);
    if (path) params.set("path", normalizePath(path));
    return `${base}/assets/og-card.svg?${params.toString()}`;
  }

  static buildAlternates({ path = "/", requestUrl = "https://exportflow.me/", includeAlternates = true } = {}) {
    if (!includeAlternates) return [];
    const base = SEOManager.resolveCanonicalBase(requestUrl);
    const { basePath } = stripLocalePrefix(path);
    const alternates = SUPPORTED_LOCALES.map((loc) => ({
      hreflang: loc,
      href: `${base}${buildLocalizedPath(basePath, loc)}`,
    }));
    alternates.push({
      hreflang: "x-default",
      href: `${base}${buildLocalizedPath(basePath, "en")}`,
    });
    return alternates;
  }

  static buildStructuredData({
    path = "/",
    title,
    description,
    canonicalUrl,
    ogImageUrl,
    customJsonLd = null,
    isNotFound = false,
  } = {}) {
    if (isNotFound) return null;
    if (customJsonLd) return customJsonLd;

    const { basePath } = stripLocalePrefix(path);
    const origin = new URL(canonicalUrl).origin;

    if (basePath === "/") {
      return {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            name: SITE_META.brandName,
            url: origin,
            logo: `${origin}/assets/mark.svg`,
          },
          {
            "@type": "WebSite",
            name: SITE_META.brandName,
            url: origin,
            description,
          },
          {
            "@type": "SoftwareApplication",
            name: SITE_META.brandName,
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Cloudflare Workers, Node.js",
            url: canonicalUrl,
            image: ogImageUrl,
            description,
          },
        ],
      };
    }

    const segments = basePath.split("/").filter(Boolean);
    const breadcrumbItems = [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${origin}/`,
      },
      ...segments.map((seg, idx) => ({
        "@type": "ListItem",
        position: idx + 2,
        name: seg.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        item: `${origin}/${segments.slice(0, idx + 1).join("/")}`,
      })),
    ];

    const pageType = basePath === "/contact"
      ? "ContactPage"
      : basePath === "/about"
        ? "AboutPage"
        : basePath.startsWith("/docs") || basePath === "/developers" || basePath === "/api-reference"
          ? "TechArticle"
          : "WebPage";

    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": pageType,
          name: title,
          headline: title,
          description,
          url: canonicalUrl,
          image: ogImageUrl,
          isPartOf: {
            "@type": "WebSite",
            name: SITE_META.brandName,
            url: origin,
          },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbItems,
        },
      ],
    };
  }

  static renderHeadTags({
    path = "/",
    requestUrl = "https://exportflow.me/",
    title,
    description,
    ogTitle = null,
    ogDescription = null,
    ogType = "website",
    ogEyebrow = "AGENT EXECUTION INFRASTRUCTURE",
    ogImage = null,
    locale = "en",
    includeAlternates = true,
    robots = null,
    jsonLd = null,
    themeColor = "#F8FAFC",
  } = {}) {
    const isNotFound = normalizePath(path) === "/404";
    const resolvedTitle = formatSeoTitle(title);
    const resolvedDesc = formatSeoDescription(description);
    const resolvedOgTitle = formatSeoTitle(ogTitle || title);
    const resolvedOgDesc = formatSeoDescription(ogDescription || description);
    const canonicalUrl = SEOManager.buildCanonicalUrl({ path, requestUrl });
    const ogImageUrl = ogImage || SEOManager.buildOgImageUrl({
      title: title || SITE_META.brandName,
      description: resolvedOgDesc,
      eyebrow: ogEyebrow,
      locale,
      path,
      requestUrl,
    });
    const resolvedRobots = robots || (isNotFound
      ? "noindex, nofollow"
      : "index, follow, max-image-preview:large, max-snippet:-1");

    const alternates = SEOManager.buildAlternates({
      path,
      requestUrl,
      includeAlternates: includeAlternates && !isNotFound,
    });

    const ogLocale = LOCALE_TO_OG[locale] || "en_US";
    const alternateOgLocales = Object.entries(LOCALE_TO_OG)
      .filter(([code]) => code !== locale)
      .map(([, val]) => `<meta property="og:locale:alternate" content="${escapeHtmlAttr(val)}">`)
      .join("\n  ");

    const structuredData = SEOManager.buildStructuredData({
      path,
      title: resolvedTitle,
      description: resolvedDesc,
      canonicalUrl,
      ogImageUrl,
      customJsonLd: jsonLd,
      isNotFound,
    });

    const alternateLinksHtml = alternates
      .map((alt) => `<link rel="alternate" hreflang="${escapeHtmlAttr(alt.hreflang)}" href="${escapeHtmlAttr(alt.href)}">`)
      .join("\n  ");

    const canonicalTag = isNotFound
      ? ""
      : `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">`;

    const jsonLdTag = structuredData
      ? `<script type="application/ld+json">${safeJsonForScript(structuredData)}</script>`
      : "";

    return `  <meta name="theme-color" content="${escapeHtmlAttr(themeColor)}">
  <title>${escapeHtmlAttr(resolvedTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(resolvedDesc)}">
  <meta name="robots" content="${escapeHtmlAttr(resolvedRobots)}">
  ${canonicalTag}
  ${alternateLinksHtml}
  <meta property="og:type" content="${escapeHtmlAttr(ogType)}">
  <meta property="og:site_name" content="${escapeHtmlAttr(SITE_META.brandName)}">
  <meta property="og:locale" content="${escapeHtmlAttr(ogLocale)}">
  ${includeAlternates && !isNotFound ? alternateOgLocales : ""}
  <meta property="og:title" content="${escapeHtmlAttr(resolvedOgTitle)}">
  <meta property="og:description" content="${escapeHtmlAttr(resolvedOgDesc)}">
  <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtmlAttr(ogImageUrl)}">
  <meta property="og:image:type" content="image/svg+xml">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtmlAttr(`${resolvedOgTitle} — ExportFlow`)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtmlAttr(resolvedOgTitle)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(resolvedOgDesc)}">
  <meta name="twitter:image" content="${escapeHtmlAttr(ogImageUrl)}">
  <meta name="twitter:image:alt" content="${escapeHtmlAttr(`${resolvedOgTitle} — ExportFlow`)}">
  ${jsonLdTag}`;
  }

  static renderOgImageSvg(searchParams = new URLSearchParams()) {
    const rawTitle = searchParams.get("title") || "Give AI the Power to Execute.";
    const rawDesc = searchParams.get("description") || "One execution layer. Multiple engines. Verifiable results.";
    const rawEyebrow = searchParams.get("eyebrow") || "AGENT EXECUTION INFRASTRUCTURE";
    const rawPath = searchParams.get("path") || "/";

    const titleText = clampText(rawTitle.replace(/\s*—\s*ExportFlow$/, ""), 48);
    const descText = clampText(rawDesc, 84);
    const eyebrowText = clampText(rawEyebrow.toUpperCase(), 42);
    const pathText = clampText(rawPath, 38);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" fill="none">
  <defs>
    <linearGradient id="og-accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1D4ED8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <radialGradient id="og-glow" cx="82%" cy="18%" r="58%">
      <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#F8FAFC" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#F8FAFC"/>
  <rect width="1200" height="630" fill="url(#og-glow)"/>
  <g stroke="rgba(15,23,42,0.06)" stroke-width="1">
    <line x1="0" y1="100" x2="1200" y2="100"/>
    <line x1="0" y1="530" x2="1200" y2="530"/>
    <line x1="96" y1="0" x2="96" y2="630"/>
    <line x1="1104" y1="0" x2="1104" y2="630"/>
  </g>
  <rect x="96" y="128" width="44" height="44" rx="10" fill="#FFFFFF" stroke="url(#og-accent)" stroke-width="2"/>
  <path d="M108 150h10M122 142h8M122 158h8M118 150l4-8m-4 8 4 8" stroke="#1D4ED8" stroke-width="2.2" stroke-linecap="round"/>
  <text x="156" y="159" fill="#0B1220" font-family="Plus Jakarta Sans,system-ui,-apple-system,sans-serif" font-size="28" font-weight="700" letter-spacing="-0.6">ExportFlow</text>
  <text x="1104" y="158" text-anchor="end" fill="#475569" font-family="JetBrains Mono,ui-monospace,monospace" font-size="18">${escapeXml(pathText)}</text>

  <text x="96" y="232" fill="#1D4ED8" font-family="JetBrains Mono,ui-monospace,monospace" font-size="17" font-weight="600" letter-spacing="1.4">${escapeXml(eyebrowText)}</text>
  <text x="96" y="308" fill="#0B1220" font-family="Plus Jakarta Sans,system-ui,-apple-system,sans-serif" font-size="52" font-weight="700" letter-spacing="-1.6">${escapeXml(titleText)}</text>
  <text x="96" y="362" fill="#475569" font-family="Plus Jakarta Sans,system-ui,-apple-system,sans-serif" font-size="23" font-weight="400">${escapeXml(descText)}</text>

  <g transform="translate(96,434)">
    <rect width="210" height="58" rx="10" fill="#FFFFFF" stroke="rgba(15,23,42,0.14)"/>
    <text x="22" y="36" fill="#0B1220" font-family="JetBrains Mono,ui-monospace,monospace" font-size="18">AI agent</text>
    <path d="M224 29h44M260 22l8 7-8 7" stroke="#1D4ED8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="282" width="236" height="58" rx="10" fill="#EFF6FF" stroke="url(#og-accent)" stroke-width="1.8"/>
    <text x="304" y="36" fill="#1E3A8A" font-family="JetBrains Mono,ui-monospace,monospace" font-size="18" font-weight="600">ExportFlow</text>
    <path d="M532 29h44M568 22l8 7-8 7" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="590" width="204" height="58" rx="10" fill="#ECFDF5" stroke="#059669" stroke-width="1.6"/>
    <text x="612" y="36" fill="#047857" font-family="JetBrains Mono,ui-monospace,monospace" font-size="18" font-weight="600">HTTP Fetch</text>
    <path d="M808 29h44M844 22l8 7-8 7" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="866" width="142" height="58" rx="10" fill="#FFFFFF" stroke="rgba(15,23,42,0.16)"/>
    <text x="888" y="36" fill="#0B1220" font-family="JetBrains Mono,ui-monospace,monospace" font-size="18">Evidence</text>
  </g>
</svg>`;
  }
}
