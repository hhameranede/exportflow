import { validatePublicHttpUrl, fetchPublicResource } from "./http-fetch.js";

export const MAP_CRAWL_LIMITS = Object.freeze({
  maxPages: 5,
  maxDepth: 2,
  maxUrls: 50,
  maxSitemaps: 2,
  maxPageBytes: 262_144,
  maxRobotsBytes: 524_288,
  maxSitemapBytes: 262_144,
  maxTotalBytes: 1_048_576,
  timeoutMs: 5_000,
  maxRedirects: 3,
});

export const EXPORTFLOW_CRAWLER_USER_AGENT = "ExportFlowBot/0.1 (+https://exportflow.me)";

export class MapCrawlError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.name = "MapCrawlError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function decodeXmlEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    try {
      const codePoint = lower.startsWith("#x")
        ? Number.parseInt(lower.slice(2), 16)
        : Number.parseInt(lower.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    } catch {
      return match;
    }
  });
}

function normalizeRobotsOctets(value) {
  return value.replace(/%([0-9a-f]{2})/gi, (encoded, hex) => {
    const code = Number.parseInt(hex, 16);
    const char = String.fromCharCode(code);
    return /^[A-Za-z0-9._~-]$/.test(char) ? char : "%" + hex.toUpperCase();
  });
}

function patternToRegExp(pattern) {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  try {
    return new RegExp("^" + escaped + (anchored ? "$" : ""));
  } catch {
    return null;
  }
}

export function parseRobotsTxt(text, productToken = "ExportFlowBot") {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let hasRules = false;

  for (const rawLine of String(text || "").split(/\r\n|\n|\r/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }

    if (key === "user-agent") {
      if (!value) continue;
      if (!current || hasRules) {
        current = { agents: [], rules: [] };
        groups.push(current);
        hasRules = false;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if ((key === "allow" || key === "disallow") && current) {
      if (!value) continue;
      if (!value.startsWith("/")) continue;
      const regex = patternToRegExp(value);
      if (!regex) continue;
      current.rules.push({
        type: key,
        path: value,
        specificity: value.replace(/[\*$]/g, "").length,
        regex,
      });
      hasRules = true;
    }
  }

  const token = String(productToken).toLowerCase();
  const specific = groups.filter((group) =>
    group.agents.some((agent) => agent !== "*" && token.includes(agent))
  );
  const selected = specific.length
    ? specific
    : groups.filter((group) => group.agents.includes("*"));
  const rules = selected.flatMap((group) => group.rules);

  return {
    productToken,
    rules,
    sitemaps: [...new Set(sitemaps)],
  };
}

export function isAllowedByRobots(urlInput, policy) {
  let url;
  try {
    url = new URL(urlInput);
  } catch {
    return false;
  }
  if (url.pathname === "/robots.txt") return true;

  const target = normalizeRobotsOctets(url.pathname + url.search);
  const matches = (policy?.rules || []).filter((rule) => rule.regex.test(target));
  if (!matches.length) return true;

  const mostSpecific = Math.max(...matches.map((rule) => rule.specificity));
  const best = matches.filter((rule) => rule.specificity === mostSpecific);
  return best.some((rule) => rule.type === "allow");
}

function parseRobotsSitemaps(policy, origin) {
  const output = [];
  for (const sitemap of policy.sitemaps) {
    try {
      const url = validatePublicHttpUrl(new URL(sitemap, origin).href);
      if (url.origin === origin && !output.includes(url.href)) output.push(url.href);
    } catch {
      // External or otherwise disallowed sitemap origins are intentionally ignored.
    }
  }
  return output.slice(0, MAP_CRAWL_LIMITS.maxSitemaps);
}

export function extractSitemapLocations(xml, baseUrl, maxUrls = MAP_CRAWL_LIMITS.maxUrls) {
  const results = [];
  const regex = /<(?:[a-z0-9_-]+:)?loc\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9_-]+:)?loc\s*>/gi;
  let match;
  while ((match = regex.exec(String(xml || ""))) && results.length < maxUrls) {
    const raw = decodeXmlEntities(match[1].trim());
    if (!raw) continue;
    try {
      const url = validatePublicHttpUrl(new URL(raw, baseUrl).href);
      if (url.origin === new URL(baseUrl).origin && !results.includes(url.href)) {
        results.push(url.href);
      }
    } catch {
      // Invalid, off-origin, and otherwise disallowed locations are skipped.
    }
  }
  return results;
}

async function defaultParseHtmlLinks(html) {
  if (typeof HTMLRewriter !== "undefined") {
    const links = [];
    const response = new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    const transformed = new HTMLRewriter()
      .on("a[href]", {
        element(element) {
          const href = element.getAttribute("href");
          if (href) links.push(href);
        },
      })
      .transform(response);
    await transformed.text();
    return links;
  }

  // Deterministic fallback used by Node tests; Workers use HTMLRewriter above.
  const links = [];
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while ((match = anchorPattern.exec(String(html || "")))) {
    const href = match[1] ?? match[2] ?? match[3];
    if (href) links.push(decodeXmlEntities(href.trim()));
  }
  return links;
}

async function getRobotsPolicy(origin, fetchResource) {
  const robotsUrl = new URL("/robots.txt", origin).href;
  try {
    const response = await fetchResource(robotsUrl, {
      maxBytes: MAP_CRAWL_LIMITS.maxRobotsBytes,
      timeoutMs: MAP_CRAWL_LIMITS.timeoutMs,
      maxRedirects: MAP_CRAWL_LIMITS.maxRedirects,
      userAgent: EXPORTFLOW_CRAWLER_USER_AGENT,
      allowedOrigin: origin,
      // Robots policy is rechecked per task instead of trusting a stale edge entry.
      cacheMode: "bypass",
    });
    if ([401, 403, 429].includes(response.status) || response.status >= 500) {
      throw new MapCrawlError("ROBOTS_UNREACHABLE", "robots.txt denied access or returned a server error; crawling was stopped.", 503);
    }
    if (response.status >= 400 && response.status < 500) {
      return {
        policy: parseRobotsTxt(""),
        status: response.status,
        unavailable: true,
        warnings: ["robots.txt is unavailable (HTTP " + response.status + "); RFC 9309 permits access."],
      };
    }
    const robotsFinal = validatePublicHttpUrl(response.finalUrl || robotsUrl);
    if (robotsFinal.origin !== origin) {
      throw new MapCrawlError("ROBOTS_REDIRECT_OUT_OF_SCOPE", "robots.txt redirected outside the requested origin.", 403);
    }
    return {
      policy: parseRobotsTxt(response.body, "ExportFlowBot"),
      status: response.status,
      unavailable: false,
      warnings: [],
    };
  } catch (error) {
    if (error instanceof MapCrawlError) throw error;
    throw new MapCrawlError("ROBOTS_UNREACHABLE", "robots.txt could not be retrieved; crawling was stopped.", 503);
  }
}

function sameOriginUrl(value, baseUrl, expectedOrigin) {
  try {
    const url = validatePublicHttpUrl(new URL(value, baseUrl).href);
    if (url.origin !== expectedOrigin) return null;
    return url.href;
  } catch {
    return null;
  }
}

async function fetchSitemaps(policy, origin, fetchResource, warnings, maxUrls) {
  const sitemapUrls = parseRobotsSitemaps(policy, origin);
  if (!sitemapUrls.length) sitemapUrls.push(new URL("/sitemap.xml", origin).href);

  const urls = [];
  const fetched = [];
  for (const sitemapUrl of sitemapUrls.slice(0, MAP_CRAWL_LIMITS.maxSitemaps)) {
    if (urls.length >= maxUrls) break;
    try {
      const response = await fetchResource(sitemapUrl, {
        maxBytes: MAP_CRAWL_LIMITS.maxSitemapBytes,
        timeoutMs: MAP_CRAWL_LIMITS.timeoutMs,
        maxRedirects: MAP_CRAWL_LIMITS.maxRedirects,
        userAgent: EXPORTFLOW_CRAWLER_USER_AGENT,
      allowedOrigin: origin,
      });
      if (response.status < 200 || response.status >= 300) {
        warnings.push("Sitemap returned HTTP " + response.status + ".");
        continue;
      }
      const sitemapFinal = validatePublicHttpUrl(response.finalUrl || sitemapUrl);
      if (sitemapFinal.origin !== origin) {
        warnings.push("A sitemap redirected outside the requested origin and was ignored.");
        continue;
      }
      fetched.push({
        url: sitemapFinal.href,
        status: response.status,
        bytes: response.bytes,
        retrievedAt: response.retrievedAt,
      });
      for (const url of extractSitemapLocations(response.body, sitemapUrl, maxUrls - urls.length)) {
        if (isAllowedByRobots(url, policy) && !urls.includes(url)) urls.push(url);
      }
    } catch (error) {
      if (error?.code === "TASK_CANCELLED") throw error;
      warnings.push("A sitemap could not be retrieved.");
    }
  }
  return { urls, fetched };
}

function makeSource(url, response, evidenceType) {
  return {
    url: response.finalUrl || url,
    retrievedAt: response.retrievedAt,
    title: null,
    evidence: [{
      type: evidenceType,
      status: response.status,
      contentType: response.contentType,
      bytes: response.bytes,
      cacheStatus: response.cacheStatus ?? null,
    }],
  };
}

async function pageLinks(html, baseUrl, origin, policy, parser) {
  const rawLinks = await parser(html);
  const urls = [];
  for (const href of rawLinks) {
    const url = sameOriginUrl(href, baseUrl, origin);
    if (!url || !isAllowedByRobots(url, policy) || urls.includes(url)) continue;
    urls.push(url);
    if (urls.length >= MAP_CRAWL_LIMITS.maxUrls) break;
  }
  return urls;
}

function throwIfTaskCancelled(signal) {
  if (signal?.aborted) {
    throw new MapCrawlError("TASK_CANCELLED", "Task was cancelled.", 499);
  }
}

function validateOptions(input, maximum, fallback, name) {
  const value = input === undefined ? fallback : input;
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new MapCrawlError("INVALID_LIMIT", name + " is outside the supported range.", 400);
  }
  return value;
}

async function createSiteContext(input, options) {
  const requestedUrl = validatePublicHttpUrl(input.url);
  const origin = requestedUrl.origin;
  const baseFetchResource = options.fetchResource || fetchPublicResource;
  const signal = options.signal;
  const fetchResource = async (url, fetchOptions = {}) => {
    if (signal?.aborted) {
      throw new MapCrawlError("TASK_CANCELLED", "Task was cancelled.", 499);
    }
    try {
      return await baseFetchResource(url, {
        cacheMode: options.cacheMode ?? "default",
        ...fetchOptions,
        ...(signal ? { signal } : {}),
        ...(typeof options.onUsageReceipt === "function" ? { onUsageReceipt: options.onUsageReceipt } : {}),
      });
    } catch (error) {
      if (signal?.aborted) {
        throw new MapCrawlError("TASK_CANCELLED", "Task was cancelled.", 499);
      }
      throw error;
    }
  };
  const parser = options.parseHtmlLinks || defaultParseHtmlLinks;
  const robots = await getRobotsPolicy(origin, fetchResource);

  if (!isAllowedByRobots(requestedUrl.href, robots.policy)) {
    throw new MapCrawlError("ROBOTS_DISALLOWED_TARGET", "The requested page is disallowed by robots.txt.", 403);
  }

  const sitemap = await fetchSitemaps(
    robots.policy,
    origin,
    fetchResource,
    robots.warnings,
    options.maxUrls || MAP_CRAWL_LIMITS.maxUrls,
  );

  const homepage = await fetchResource(requestedUrl.href, {
    maxBytes: MAP_CRAWL_LIMITS.maxPageBytes,
    timeoutMs: MAP_CRAWL_LIMITS.timeoutMs,
    maxRedirects: MAP_CRAWL_LIMITS.maxRedirects,
    userAgent: EXPORTFLOW_CRAWLER_USER_AGENT,
    allowedOrigin: origin,
  });
  const warnings = [...robots.warnings];
  const homepageFinal = validatePublicHttpUrl(homepage.finalUrl || requestedUrl.href);
  if (homepageFinal.origin !== origin) {
    throw new MapCrawlError("PAGE_REDIRECT_OUT_OF_SCOPE", "The starting page redirected outside the requested origin.", 403);
  }
  if (homepage.status < 200 || homepage.status >= 300) {
    warnings.push("Starting page returned HTTP " + homepage.status + ".");
  }

  const links = homepage.status >= 200 && homepage.status < 300 &&
    String(homepage.contentType || "").toLowerCase().includes("text/html")
    ? await pageLinks(homepage.body, homepageFinal.href, origin, robots.policy, parser)
    : [];

  return {
    requestedUrl: requestedUrl.href,
    origin,
    robots,
    sitemap,
    homepage: { ...homepage, finalUrl: homepageFinal.href },
    links,
    warnings,
    fetchResource,
    parser,
  };
}

export async function mapWebsite(input, options = {}) {
  const maxUrls = validateOptions(options.maxUrls, MAP_CRAWL_LIMITS.maxUrls, 20, "maxUrls");
  const context = await createSiteContext(input, { ...options, maxUrls });
  throwIfTaskCancelled(options.signal);
  const seen = new Set([context.homepage.finalUrl || context.requestedUrl]);
  const urls = [];

  for (const url of [...context.sitemap.urls, ...context.links]) {
    if (url === context.requestedUrl || seen.has(url)) continue;
    seen.add(url);
    urls.push({
      url,
      discoveredBy: context.sitemap.urls.includes(url) ? "sitemap" : "link",
    });
    if (urls.length >= maxUrls) break;
  }

  return {
    requestedUrl: context.requestedUrl,
    origin: context.origin,
    robots: {
      status: context.robots.status,
      unavailable: context.robots.unavailable,
      allowedRules: context.robots.policy.rules.length,
    },
    homepage: {
      url: context.homepage.finalUrl || context.requestedUrl,
      status: context.homepage.status,
      bytes: context.homepage.bytes,
      contentType: context.homepage.contentType,
      cacheStatus: context.homepage.cacheStatus ?? null,
    },
    sitemaps: context.sitemap.fetched,
    urls,
    sources: [
      makeSource(context.requestedUrl, context.homepage, "map_start_page"),
      ...context.sitemap.fetched.map((item) => ({
        url: item.url,
        retrievedAt: item.retrievedAt,
        title: null,
        evidence: [{ type: "sitemap", status: item.status, bytes: item.bytes }],
      })),
    ],
    warnings: context.warnings,
  };
}

export async function crawlWebsite(input, options = {}) {
  const maxPages = validateOptions(options.maxPages, MAP_CRAWL_LIMITS.maxPages, 5, "maxPages");
  const maxDepth = options.maxDepth === undefined ? 1 : options.maxDepth;
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > MAP_CRAWL_LIMITS.maxDepth) {
    throw new MapCrawlError("INVALID_LIMIT", "maxDepth is outside the supported range.", 400);
  }

  const context = await createSiteContext(input, {
    ...options,
    maxUrls: Math.max(maxPages * 5, 10),
  });
  throwIfTaskCancelled(options.signal);
  const pages = [];
  const sources = [];
  const warnings = [...context.warnings];
  const visited = new Set();
  const queue = [{ url: context.requestedUrl, depth: 0, discoveredFrom: null }];
  for (const sitemapUrl of context.sitemap.urls) {
    if (maxDepth >= 1 && sitemapUrl !== context.requestedUrl && queue.length < MAP_CRAWL_LIMITS.maxUrls) {
      queue.push({ url: sitemapUrl, depth: 1, discoveredFrom: "sitemap" });
    }
  }
  let totalBytes = 0;

  while (queue.length && pages.length < maxPages) {
    throwIfTaskCancelled(options.signal);
    const item = queue.shift();
    if (item.depth > maxDepth) continue;
    if (visited.has(item.url)) continue;
    visited.add(item.url);
    if (!isAllowedByRobots(item.url, context.robots.policy)) continue;

    let response;
    if (item.depth === 0) {
      response = context.homepage;
    } else {
      try {
        const remainingBytes = MAP_CRAWL_LIMITS.maxTotalBytes - totalBytes;
        if (remainingBytes < 1) {
          warnings.push("Crawl stopped at the total response byte limit.");
          break;
        }
        response = await context.fetchResource(item.url, {
          maxBytes: Math.min(MAP_CRAWL_LIMITS.maxPageBytes, remainingBytes),
          timeoutMs: MAP_CRAWL_LIMITS.timeoutMs,
          maxRedirects: MAP_CRAWL_LIMITS.maxRedirects,
          userAgent: EXPORTFLOW_CRAWLER_USER_AGENT,
          allowedOrigin: context.origin,
        });
      } catch (error) {
        if (error?.code === "TASK_CANCELLED") throw error;
        warnings.push("A discovered page could not be retrieved.");
        continue;
      }
    }

    if (response.status < 200 || response.status >= 300) {
      warnings.push("A page returned HTTP " + response.status + ".");
      continue;
    }
    const pageFinal = validatePublicHttpUrl(response.finalUrl || item.url);
    if (pageFinal.origin !== context.origin) {
      warnings.push("A page redirected outside the requested origin and was ignored.");
      continue;
    }
    totalBytes += response.bytes || 0;
    if (totalBytes > MAP_CRAWL_LIMITS.maxTotalBytes) {
      warnings.push("Crawl stopped at the total response byte limit.");
      break;
    }

    const page = {
      url: pageFinal.href,
      status: response.status,
      contentType: response.contentType,
      bytes: response.bytes,
      cacheStatus: response.cacheStatus ?? null,
      depth: item.depth,
      discoveredFrom: item.discoveredFrom,
      body: response.body,
    };
    pages.push(page);
    sources.push(makeSource(item.url, response, "crawl_page"));

    if (item.depth >= maxDepth || !String(response.contentType || "").toLowerCase().includes("text/html")) {
      continue;
    }

    const links = await pageLinks(page.body, page.url, context.origin, context.robots.policy, context.parser);
    for (const link of links) {
      if (!visited.has(link) && !queue.some((entry) => entry.url === link)) {
        queue.push({ url: link, depth: item.depth + 1, discoveredFrom: page.url });
      }
    }
  }

  return {
    requestedUrl: context.requestedUrl,
    origin: context.origin,
    robots: {
      status: context.robots.status,
      unavailable: context.robots.unavailable,
      allowedRules: context.robots.policy.rules.length,
    },
    pages,
    pageCount: pages.length,
    totalBytes,
    warnings,
    sources,
  };
}
