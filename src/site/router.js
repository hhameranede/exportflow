import { BRAND_MARK_SVG, OG_CARD_SVG } from "./diagrams.js";
import { SITE_JS } from "./client.js";
import { renderRobotsTxt, renderSitemapXml } from "./layout.js";
import {
  renderDemoPage,
  renderDevelopersPage,
  renderFaqPage,
  renderHomePage,
  renderPlatformPage,
  renderUseCasesPage,
} from "./pages.js";
import { SITE_CSS } from "./styles.js";
import { MARKETING_PATHS, renderMarketingPage, resolveMarketingRoute } from "./marketing.js";
import { MARKETING_CSS } from "./marketing-styles.js";
import { MARKETING_JS } from "./marketing-client.js";

const HTML_SECURITY_HEADERS = Object.freeze({
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=60",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=63072000",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy":
    "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
});

function assetResponse(body, contentType, method, maxAge = 300) {
  return new Response(method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": `public, max-age=${maxAge}`,
      "x-content-type-options": "nosniff",
    },
  });
}

function htmlResponse(html, method) {
  return new Response(method === "HEAD" ? null : html, {
    status: 200,
    headers: HTML_SECURITY_HEADERS,
  });
}

const PAGE_ROUTES = Object.freeze({
  "/": renderHomePage,
  "/index.html": renderHomePage,
  "/platform": renderPlatformPage,
  "/use-cases": renderUseCasesPage,
  "/developers": renderDevelopersPage,
  "/demo": renderDemoPage,
  "/faq": renderFaqPage,
});

export function handleWebsiteRequest(request, url) {
  const rawPath = url.pathname;
  const pathname = rawPath.length > 1 && rawPath.endsWith("/")
    ? rawPath.slice(0, -1)
    : rawPath;

  if (pathname === "/assets/site.css") {
    return assetResponse(SITE_CSS, "text/css; charset=utf-8", request.method);
  }
  if (pathname === "/assets/site.js") {
    return assetResponse(SITE_JS, "application/javascript; charset=utf-8", request.method);
  }
  if (pathname === "/assets/marketing.css") {
    return assetResponse(MARKETING_CSS, "text/css; charset=utf-8", request.method);
  }
  if (pathname === "/assets/marketing.js") {
    return assetResponse(MARKETING_JS, "application/javascript; charset=utf-8", request.method);
  }
  if (pathname === "/assets/mark.svg") {
    return assetResponse(BRAND_MARK_SVG, "image/svg+xml; charset=utf-8", request.method, 3600);
  }
  if (pathname === "/assets/og-card.svg") {
    return assetResponse(OG_CARD_SVG, "image/svg+xml; charset=utf-8", request.method, 3600);
  }
  if (pathname === "/robots.txt") {
    return assetResponse(renderRobotsTxt(request.url), "text/plain; charset=utf-8", request.method);
  }
  if (pathname === "/sitemap.xml") {
    return assetResponse(renderSitemapXml(request.url, MARKETING_PATHS), "application/xml; charset=utf-8", request.method);
  }

  const marketingRoute = resolveMarketingRoute(pathname);
  if (marketingRoute) {
    return htmlResponse(renderMarketingPage(request.url, marketingRoute.path, marketingRoute.locale), request.method);
  }

  const pageRenderer = PAGE_ROUTES[pathname];
  if (pageRenderer) {
    return htmlResponse(pageRenderer(request.url), request.method);
  }

  return null;
}
