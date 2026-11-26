import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MARKETING_PATHS } from "../src/site/marketing.js";
import { AUTH_ROUTES } from "../src/site/auth-pages.js";

const modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error("PLAYWRIGHT_MODULE must point to the runner-local Playwright module.");
const { chromium } = await import(pathToFileURL(modulePath).href);

const port = Number(process.env.PORT || 3187);
const baseUrl = "http://127.0.0.1:" + port;
const screenshotDir = resolve(process.env.SITE_SCREENSHOT_DIR || "artifacts/site-browser");
const locales = ["en", "ar", "fr", "es", "de", "pt", "zh", "ja"];
const specialRoutes = ["/platform", "/use-cases", "/demo", "/index.html"];
const screenshotRoutes = new Set([
  "/", "/platform", "/use-cases", "/demo", "/developers", "/docs", "/api-reference",
  "/integrations", "/pricing", "/solutions", "/about", "/contact", "/faq",
  "/legal/privacy", "/legal/terms", "/legal/security", "/signin", "/signup",
  "/forgot-password", "/account", "/workspace", "/oauth/consent",
  "/ar/", "/ar/platform", "/ar/account", "/ar/workspace"
]);
const routeSlug = (route) => route === "/" ? "home" : route.replace(/^\/+|\/+$/g, "").replaceAll("/", "-").replace(/[^a-z0-9-]/gi, "-");
let browserIpCounter = 1;
function nextBrowserIpHeaders() {
  const index = browserIpCounter++ - 1;
  const block = Math.floor(index / 254);
  const secondOctet = 18 + Math.floor(block / 256);
  if (secondOctet > 19) throw new Error("Browser QA exceeded reserved synthetic IP range.");
  const thirdOctet = block % 256;
  const fourthOctet = (index % 254) + 1;
  return { "cf-connecting-ip": "198." + secondOctet + "." + thirdOctet + "." + fourthOctet };
}

async function isolateLocalBrowserClient(context) {
  const headers = nextBrowserIpHeaders();
  await context.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === baseUrl) {
      await route.continue({ headers: { ...route.request().headers(), ...headers } });
      return;
    }
    await route.continue();
  });
}

function buildRouteInventory() {
  const routes = new Set(MARKETING_PATHS);
  for (const locale of locales.filter((value) => value !== "en")) routes.add("/" + locale + "/");
  for (const [path] of AUTH_ROUTES) {
    routes.add(path);
    for (const locale of locales) routes.add("/" + locale + path);
  }
  for (const path of specialRoutes) {
    routes.add(path);
    if (path !== "/index.html") {
      for (const locale of locales.filter((value) => value !== "en")) routes.add("/" + locale + path);
    }
  }
  return [...routes].sort((a, b) => a.localeCompare(b));
}

const routes = buildRouteInventory();
const mobileRegressionRoutes = [
  "/", "/platform", "/use-cases", "/demo", "/developers", "/pricing", "/solutions",
  "/about", "/contact", "/faq", "/legal/privacy", "/legal/terms", "/signin", "/signup",
  "/forgot-password", "/account", "/workspace", "/oauth/consent", "/oauth/select-tenant",
  "/ar/", "/ar/platform", "/ar/use-cases", "/ar/demo", "/ar/contact", "/ar/account", "/ar/workspace"
];

await mkdir(screenshotDir, { recursive: true });

const server = spawn(process.execPath, ["src/server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});
let serverOutput = "";
server.stdout.setEncoding("utf8").on("data", (chunk) => { serverOutput += chunk; });
server.stderr.setEncoding("utf8").on("data", (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Local ExportFlow server exited.\n" + serverOutput);
    try {
      const response = await fetch(baseUrl + "/api/v1/health");
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("Timed out waiting for local ExportFlow server.\n" + serverOutput);
}

function expectedLocale(path) {
  const match = /^\/(en|ar|fr|es|de|pt|zh|ja)(?:\/|$)/.exec(path);
  return match?.[1] || "en";
}

async function evaluateStablePage(page, evaluator) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(evaluator);
    } catch (error) {
      const message = error?.message || String(error);
      const navigationRace = /execution context was destroyed|cannot find context with specified id|most likely because of a navigation/i.test(message);
      if (!navigationRace || attempt === 2) throw error;
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(100);
    }
  }
  throw new Error("Page navigation did not settle before browser diagnostics.");
}

async function inspectRoute(browser, width, route, sharedLinkSet, screenshot = false) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 390 ? 844 : 960 },
    permissions: ["clipboard-read", "clipboard-write"]
  });
  await isolateLocalBrowserClient(context);
  const page = await context.newPage();
  try {
  const pageErrors = [];
  const consoleErrors = [];
  const failedAssets = [];
  const unlocalizedRoute = route.replace(/^\/(?:en|ar|fr|es|de|pt|zh|ja)(?=\/)/, "");
  const oauthBrowserRoute = unlocalizedRoute === "/oauth/consent" || unlocalizedRoute === "/oauth/select-tenant";
  page.on("pageerror", (error) => pageErrors.push(error.message || String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    const expectedOAuthUnavailable = oauthBrowserRoute &&
      text.includes("status of 503 (Service Unavailable)");
    if (!expectedOAuthUnavailable) consoleErrors.push(text);
  });
  page.on("response", (response) => {
    try {
      const url = new URL(response.url());
      if (url.origin === baseUrl && url.pathname.startsWith("/assets/") && response.status() >= 400) {
        failedAssets.push({ path: url.pathname, status: response.status() });
      }
    } catch {}
  });

  const response = await page.goto(baseUrl + route, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert.ok(response, "No navigation response for " + route);
  const expectedStatus = oauthBrowserRoute ? 503 : 200;
  assert.equal(response.status(), expectedStatus, "Unexpected page status for " + route + " at " + width + "px");
  await page.waitForFunction(() => document.readyState === "complete", null, { timeout: 10000 });
  await page.waitForTimeout(50);

  const diagnostics = await evaluateStablePage(page, () => {
    const visible = (element) => Boolean(element.getClientRects().length) &&
      getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none";
    const main = document.querySelector("main");
    const h1s = [...(main?.querySelectorAll("h1") || [])].filter(visible);
    const svgIssues = [...document.querySelectorAll("svg")].filter(visible).map((svg) => {
      const rect = svg.getBoundingClientRect();
      const viewBox = svg.getAttribute("viewBox");
      const hasDrawing = svg.querySelector("path,circle,rect,line,polyline,polygon,ellipse,use,text");
      if (!viewBox || rect.width <= 0 || rect.height <= 0 || !hasDrawing) {
        return { className: typeof svg.className === "string" ? svg.className : "", viewBox, width: Math.round(rect.width), height: Math.round(rect.height), hasDrawing: Boolean(hasDrawing) };
      }
      return null;
    }).filter(Boolean);
    const brokenImages = [...document.images].filter((img) => img.getAttribute("src") && (!img.complete || img.naturalWidth <= 0))
      .map((img) => img.currentSrc || img.src);
    const unnamedControls = [...document.querySelectorAll("button,a[href],input,select,textarea")].filter(visible).map((node) => {
      const aria = node.getAttribute("aria-label");
      const labelledBy = node.getAttribute("aria-labelledby");
      const labelledText = labelledBy ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim() : "";
      const text = (node.innerText || node.value || "").trim();
      const title = node.getAttribute("title") || "";
      const nativeLabelText = node.labels ? [...node.labels].map((label) => label.textContent || "").join(" ").trim() : "";
      const wrappingLabelText = node.closest("label")?.textContent?.trim() || "";
      const name = aria || labelledText || nativeLabelText || wrappingLabelText || text || title;
      return name ? null : { tag: node.tagName.toLowerCase(), type: node.getAttribute("type"), id: node.id || "", className: typeof node.className === "string" ? node.className.slice(0, 80) : "" };
    }).filter(Boolean);
    const overflowElements = [...document.body.querySelectorAll("*")].filter(visible).map((node) => {
      const rect = node.getBoundingClientRect();
      const ancestors = [];
      for (let current = node, depth = 0; current && depth < 5; current = current.parentElement, depth += 1) {
        const box = current.getBoundingClientRect();
        const style = getComputedStyle(current);
        ancestors.push({
          tag: current.tagName.toLowerCase(),
          id: current.id || "",
          className: typeof current.className === "string" ? current.className.slice(0, 100) : "",
          left: Math.round(box.left * 10) / 10,
          right: Math.round(box.right * 10) / 10,
          width: Math.round(box.width * 10) / 10,
          cssWidth: style.width,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          boxSizing: style.boxSizing,
          marginInlineStart: style.marginInlineStart,
          marginInlineEnd: style.marginInlineEnd,
          paddingInlineStart: style.paddingInlineStart,
          paddingInlineEnd: style.paddingInlineEnd,
          direction: style.direction,
          display: style.display,
          gridTemplateColumns: style.gridTemplateColumns,
          transform: style.transform
        });
      }
      return {
        tag: node.tagName.toLowerCase(),
        id: node.id || "",
        className: typeof node.className === "string" ? node.className.slice(0, 120) : "",
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        text: (node.innerText || "").trim().slice(0, 100),
        ancestors
      };
    }).filter((item) => item.width > 0 && (item.left < -1 || item.right > window.innerWidth + 1))
      .sort((a, b) => (b.right - window.innerWidth) - (a.right - window.innerWidth))
      .slice(0, 12);
    const links = [...document.querySelectorAll("a[href]")].map((anchor) => anchor.href);
    return {
      title: document.title,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      overflowElements,
      mainH1Count: h1s.length,
      visibleSvgCount: [...document.querySelectorAll("svg")].filter(visible).length,
      svgIssues,
      brokenImages,
      unnamedControls,
      links
    };
  });

  if (oauthBrowserRoute) {
    assert.equal(await page.locator("main h1").innerText(), "Authorization unavailable",
      route + " must fail closed when the OAuth or tenant storage is not initialized");
    assert.match(await page.locator("main").innerText(), /not initialized yet|endpoints are invalid/i,
      route + " must show a safe initialization or configuration error");
  }

  assert.ok(diagnostics.title.trim(), "Missing document title on " + route);
  assert.equal(diagnostics.mainH1Count, 1, "Expected one visible main H1 on " + route);
  assert.ok(diagnostics.documentWidth <= diagnostics.viewportWidth + 1,
    "Horizontal document overflow on " + route + " at " + width + "px: " + diagnostics.documentWidth);
  assert.ok(diagnostics.bodyWidth <= diagnostics.viewportWidth + 1,
    "Horizontal body overflow on " + route + " at " + width + "px: " + diagnostics.bodyWidth +
    "; overflowing elements: " + JSON.stringify(diagnostics.overflowElements));
  assert.deepEqual(diagnostics.svgIssues, [], "Broken or dimensionless SVG icon(s) on " + route + ": " + JSON.stringify(diagnostics.svgIssues));
  assert.deepEqual(diagnostics.brokenImages, [], "Broken image asset(s) on " + route + ": " + JSON.stringify(diagnostics.brokenImages));
  assert.deepEqual(diagnostics.unnamedControls, [], "Visible controls without accessible names on " + route + ": " + JSON.stringify(diagnostics.unnamedControls));
  assert.deepEqual(failedAssets, [], "Static asset request failures on " + route + ": " + JSON.stringify(failedAssets));
  assert.deepEqual(pageErrors, [], "Uncaught browser errors on " + route + ": " + JSON.stringify(pageErrors));
  assert.deepEqual(consoleErrors, [], "Browser console errors on " + route + ": " + JSON.stringify(consoleErrors));

  const locale = expectedLocale(route);
  const language = await page.locator("html").getAttribute("lang");
  assert.equal(language, locale, "Incorrect HTML lang on " + route);
  const direction = await page.locator("html").getAttribute("dir");
  if (locale === "ar") assert.equal(direction, "rtl", "Arabic route must use RTL direction: " + route);

  for (const href of diagnostics.links) {
    try {
      const url = new URL(href);
      if (url.origin === baseUrl && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/assets/")) {
        sharedLinkSet.add(url.pathname + url.search);
      }
    } catch {}
  }

  if (screenshot) {
    await page.screenshot({ path: resolve(screenshotDir, routeSlug(route) + "-" + width + ".png"), fullPage: true, animations: "disabled" });
  }

  return {
    route, width, title: diagnostics.title, svgCount: diagnostics.visibleSvgCount,
    documentWidth: diagnostics.documentWidth, viewportWidth: diagnostics.viewportWidth
  };
  } finally {
    await context.close();
  }
}

async function checkHomeInteractions(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["clipboard-read", "clipboard-write"],
    extraHTTPHeaders: nextBrowserIpHeaders()
  });
  await isolateLocalBrowserClient(context);
  const page = await context.newPage();
  await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });

  const languageButtons = page.locator("[data-lang-trigger]");
  assert.ok(await languageButtons.count() >= 1, "Language switcher is missing");
  const languageButton = languageButtons.first();
  await languageButton.click();
  assert.equal(await languageButton.getAttribute("aria-expanded"), "true", "Language menu did not open");
  await page.keyboard.press("Escape");
  assert.equal(await languageButton.getAttribute("aria-expanded"), "false", "Escape did not close language menu");

  const themeButton = page.locator("[data-theme-toggle]").first();
  const previousTheme = await page.locator("html").getAttribute("data-theme-preference");
  await themeButton.click();
  assert.notEqual(await page.locator("html").getAttribute("data-theme-preference"), previousTheme, "Theme toggle did not change preference");

  const motionToggle = page.locator("[data-motion-toggle]").first();
  if (await motionToggle.count()) {
    await motionToggle.click();
    assert.equal(await page.locator("html").getAttribute("data-motion"), "paused", "Motion control did not pause motion");
    await motionToggle.click();
    assert.notEqual(await page.locator("html").getAttribute("data-motion"), "paused", "Motion control did not resume motion");
  }

  const menuButton = page.locator("[data-menu-toggle]");
  assert.equal(await menuButton.count(), 1, "Mobile navigation toggle is missing");
  await menuButton.click();
  assert.equal(await menuButton.getAttribute("aria-expanded"), "true", "Mobile navigation did not open");
  await page.keyboard.press("Escape");
  assert.equal(await menuButton.getAttribute("aria-expanded"), "false", "Escape did not close mobile navigation");

  const devFilter = page.locator('[data-cap-filter="development"]');
  assert.equal(await devFilter.count(), 1, "Capability maturity filter is missing");
  await devFilter.click();
  const visibleCards = page.locator("[data-cap-card]:visible");
  assert.ok(await visibleCards.count() > 0, "Development filter hid every capability card");
  assert.equal(await visibleCards.evaluateAll((cards) => cards.filter((card) => card.getAttribute("data-cap-state") !== "development").length), 0,
    "Capability filter left cards from another maturity state visible");

  const graph = page.locator("[data-exec-graph]");
  const searchScenario = graph.locator('[data-graph-scenario="search"]');
  assert.equal(await searchScenario.count(), 1, "Execution graph Search scenario is missing");
  await searchScenario.click();
  assert.equal(await graph.getAttribute("data-active-scenario"), "search", "Execution graph did not switch scenario");

  const secondStep = page.locator('[data-step-trigger="1"]');
  assert.equal(await secondStep.count(), 1, "Second execution timeline step is missing");
  await secondStep.click();
  assert.equal(await secondStep.getAttribute("aria-pressed"), "true", "Execution timeline did not select the second step");

  const copyButton = page.locator("[data-copy-source]").first();
  if (await copyButton.count()) {
    await copyButton.click();
    await page.waitForFunction(() => {
      const node = document.querySelector("[data-copy-source] [data-copy-label]");
      return node && /copied|تم النسخ/i.test(node.textContent.trim());
    }, null, { timeout: 3000 });
  }

  await context.close();
}

async function checkFeaturePages(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  await isolateLocalBrowserClient(context);
  const page = await context.newPage();

  await page.goto(baseUrl + "/platform", { waitUntil: "domcontentloaded" });
  const layerTabs = page.locator('[data-tab-group="platform-layers"] [data-tab-trigger]');
  assert.equal(await layerTabs.count(), 7, "Platform must expose seven architecture layers");
  assert.equal(await layerTabs.nth(0).getAttribute("aria-selected"), "true",
    "Platform must expose its default layer in the signed-out view");
  assert.equal(await layerTabs.nth(1).evaluate((element) => Boolean(element.closest("[inert]"))), true,
    "Unauthenticated visitors must not interact with gated platform-layer controls");
  const activePanels = page.locator('[data-tab-group="platform-layers"] [data-tab-panel]:not([hidden])');
  assert.equal(await activePanels.count(), 1, "Platform must display exactly one active layer panel while signed out");

  await page.goto(baseUrl + "/use-cases", { waitUntil: "domcontentloaded" });
  assert.equal(await page.locator(".ef-uc-card").count(), 5, "Use Cases should render five workflow cards");
  const useCaseCopyButtons = page.locator('[data-copy-source^="uc-json-"]');
  assert.equal(await useCaseCopyButtons.count(), 5, "Each Use Case should expose its JSON copy action");

  await page.goto(baseUrl + "/faq", { waitUntil: "domcontentloaded" });
  const faqItems = page.locator("details[data-faq-item]");
  assert.equal(await faqItems.count(), 7, "FAQ must expose seven disclosure items");
  await faqItems.nth(1).locator("summary").click();
  assert.equal(await faqItems.nth(1).evaluate((node) => node.open), true, "FAQ disclosure did not open");

  await page.goto(baseUrl + "/demo", { waitUntil: "domcontentloaded" });
  const presets = page.locator("[data-demo-workbench] [data-demo-preset]");
  assert.equal(await presets.count(), 5, "Demo should expose five illustrative scenario presets");
  const publicFetch = page.locator('[data-demo-preset="public-fetch"]');
  assert.equal(await publicFetch.count(), 1, "Demo public-fetch preset is missing");
  const demoIsLocked = await publicFetch.evaluate((element) => Boolean(element.closest("[inert]")));
  if (demoIsLocked) {
    const authGate = page.locator("[data-auth-gate]").first();
    assert.ok(await authGate.isVisible(), "Demo's auth gate must be visible while its workbench is inert");
    assert.ok(await authGate.locator('a[href*="/signin"]').count(), "Demo sign-in action is missing");
  } else {
    await publicFetch.click();
    assert.equal(await publicFetch.getAttribute("aria-pressed"), "true", "Demo preset did not become selected");
  }

  await context.close();
}

async function checkAuthAndContactPages(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });
  await isolateLocalBrowserClient(context);
  const page = await context.newPage();

  for (const path of ["/signin", "/signup", "/forgot-password", "/reset-password", "/account", "/workspace", "/oauth/consent", "/oauth/select-tenant"]) {
    try {
      await page.goto(baseUrl + path, { waitUntil: "domcontentloaded" });
    } catch (error) {
      const abortedNavigation = /ERR_ABORTED/.test(error?.message || String(error));
      const expectedSignedOutRedirect = abortedNavigation &&
        (path === "/workspace" || path.startsWith("/oauth/"));
      if (!expectedSignedOutRedirect) throw error;
      const redirectDeadline = Date.now() + 8000;
      while (Date.now() < redirectDeadline && !new URL(page.url()).pathname.endsWith("/signin")) {
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        await page.waitForTimeout(100);
      }
      assert.ok(new URL(page.url()).pathname.endsWith("/signin"),
        "Unauthenticated " + path + " navigation must finish at /signin.");
    }
    await page.locator("main h1").waitFor({ state: "visible", timeout: 8000 });
    assert.equal(await page.locator("main h1").count(), 1, "Auth route heading missing: " + path);
    if (["/signin", "/signup", "/reset-password"].includes(path)) {
      const passwordIds = await page.locator('input[type="password"]').evaluateAll((nodes) =>
        nodes.filter((node) => node.id && !node.disabled && node.getClientRects().length).map((node) => node.id)
      );
      for (const id of passwordIds) {
        const password = page.locator("#" + id);
        const toggle = page.locator('[data-password-toggle="' + id + '"]').first();
        if (await toggle.count()) {
          await toggle.click();
          assert.equal(await password.getAttribute("type"), "text", "Password visibility toggle failed on " + path);
          await toggle.click();
          assert.equal(await password.getAttribute("type"), "password", "Password visibility toggle did not restore masking on " + path);
        }
      }
    }
    if (path === "/account") {
      // Account settings are private. The local auth client redirects signed-out visitors
      // after its session check; wait for that client-side navigation before asserting.
      await page.waitForURL((url) => url.pathname.endsWith("/signin"), { timeout: 12000 });
      const redirect = new URL(page.url());
      assert.equal(redirect.searchParams.get("next"), "/account",
        "Signed-out account access must preserve /account as the post-sign-in destination");
      assert.equal(await page.locator('[data-auth-form="signin"]').count(), 1,
        "Signed-out account access must finish on the sign-in form");
    }
    if (path === "/workspace") {
      assert.ok(await page.locator("[data-workspace-root], [data-workspace-shell], main").count(), "Workspace shell is missing");
    }
  }

  await page.goto(baseUrl + "/contact", { waitUntil: "domcontentloaded" });
  const contactForm = page.locator("form[data-contact-form], form#contact-form, form").first();
  assert.ok(await contactForm.count(), "Contact form is missing");
  const requiredFields = await contactForm.locator("[required]").count();
  assert.ok(requiredFields >= 3, "Contact form should validate its required fields before preparing an email draft");
  await context.close();
}

function decodeTotpBase32(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of String(secret).toUpperCase().replace(/=+$/g, "")) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error("Invalid Base32 TOTP secret.");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateLocalTotp(secret, timestamp = Date.now()) {
  const counter = BigInt(Math.floor(timestamp / 30000));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeTotpBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, "0");
}

async function checkLocalAccountLifecycle(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["clipboard-read", "clipboard-write"],
    extraHTTPHeaders: nextBrowserIpHeaders()
  });
  await isolateLocalBrowserClient(context);
  const page = await context.newPage();
  const timestamp = Date.now();
  const email = "exportflow-browser-qa-" + timestamp + "@example.test";
  const initialPassword = "EfBrowserQA!" + timestamp + "Aa1";
  const resetPassword = "EfBrowserQA-Reset!" + timestamp + "Bb2";

  async function signIn(password) {
    await page.goto(baseUrl + "/signin", { waitUntil: "domcontentloaded" });
    const form = page.locator('[data-auth-form="signin"]');
    await form.waitFor({ state: "visible", timeout: 10000 });
    await form.locator("#auth-email").fill(email);
    await form.locator("#auth-password").fill(password);
    await form.locator('button[type="submit"]').click();
    await page.waitForFunction(() => Boolean(document.querySelector("[data-signin-totp-form]")), null, { timeout: 12000 }).catch(() => null);
  }

  await page.goto(baseUrl + "/signup", { waitUntil: "domcontentloaded" });
  const signup = page.locator('[data-auth-form="signup"]');
  await signup.waitFor({ state: "visible", timeout: 10000 });
  await signup.locator("#signup-name").fill("ExportFlow Browser QA");
  await signup.locator("#signup-email").fill(email);
  await signup.locator("#signup-password").fill(initialPassword);
  await signup.locator('button[type="submit"]').click();
  await page.locator("[data-dev-mailbox-box]").waitFor({ state: "visible", timeout: 10000 });
  const verificationPath = await page.locator("[data-dev-mailbox-link]").getAttribute("href");
  assert.ok(verificationPath && verificationPath.startsWith("/"), "Local verification mailbox did not return a same-origin action path");
  const verificationUrl = new URL(verificationPath, baseUrl);
  assert.equal(verificationUrl.origin, baseUrl, "Synthetic account verification must stay inside Local runtime");
  await page.goto(verificationUrl.href, { waitUntil: "domcontentloaded" });
  await signIn(initialPassword);
  async function waitForAccountWorkspace(stage) {
    try {
      await page.waitForFunction(() => {
        const workspace = document.querySelector("[data-account-workspace]");
        return Boolean(workspace && !workspace.hidden);
      }, null, { timeout: 15000 });
    } catch (error) {
      const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 900);
      throw new Error(stage + " did not unlock the account workspace; current URL: " + page.url() +
        "; visible page text: " + body + "; original error: " + (error?.message || String(error)));
    }
  }
  await waitForAccountWorkspace("Post-verification sign-in");

  const profile = page.locator("[data-account-profile-form]");
  await profile.locator("#acc-name").fill("ExportFlow QA Verified");
  await profile.locator('button[type="submit"]').click();
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-profile-status]");
    return Boolean(status && status.textContent.trim());
  }, null, { timeout: 8000 });
  assert.ok((await profile.locator("#acc-name").inputValue()).includes("QA"), "Profile name did not remain in the account form");

  // Password recovery is exercised entirely through Local Dev Mailbox, not an external email provider.
  await page.goto(baseUrl + "/forgot-password", { waitUntil: "domcontentloaded" });
  const forgot = page.locator('[data-auth-form="forgot"]');
  await forgot.waitFor({ state: "visible", timeout: 10000 });
  await forgot.locator("#forgot-email").fill(email);
  await forgot.locator('button[type="submit"]').click();
  await page.locator("[data-dev-mailbox-box]").waitFor({ state: "visible", timeout: 10000 });
  const resetPath = await page.locator("[data-dev-mailbox-link]").getAttribute("href");
  assert.ok(resetPath && resetPath.startsWith("/"), "Local reset mailbox did not return a same-origin action path");
  const resetUrl = new URL(resetPath, baseUrl);
  assert.equal(resetUrl.origin, baseUrl, "Synthetic password reset must stay inside Local runtime");
  await page.goto(resetUrl.href, { waitUntil: "domcontentloaded" });
  const reset = page.locator('[data-auth-form="reset"]');
  await reset.waitFor({ state: "visible", timeout: 10000 });
  await reset.locator("#reset-password").fill(resetPassword);
  await reset.locator("#reset-password-confirm").fill(resetPassword);
  await reset.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname.endsWith("/signin"), { timeout: 12000 });
  await signIn(resetPassword);

  await page.waitForFunction(() => Boolean(document.querySelector("[data-signin-totp-form]")) ||
    window.location.pathname.endsWith("/account"), null, { timeout: 12000 });
  await waitForAccountWorkspace("Password-reset sign-in");

  // TOTP enrollment and verification use a synthetic secret generated by Local Auth runtime.
  const enableTotp = page.locator("[data-two-factor-enable-form]");
  await enableTotp.waitFor({ state: "visible", timeout: 10000 });
  await enableTotp.locator("#acc-totp-password").fill(resetPassword);
  await enableTotp.locator('button[type="submit"]').click();
  await page.locator("[data-two-factor-enrollment]").waitFor({ state: "visible", timeout: 10000 });
  const secret = (await page.locator("[data-two-factor-secret]").textContent()).trim();
  assert.ok(secret.length >= 16, "Local TOTP setup did not expose a usable Base32 secret");
  assert.ok(await page.locator("[data-two-factor-backup-codes] li").count() > 0, "TOTP enrollment did not issue backup codes");
  await page.locator("#acc-totp-code").fill(generateLocalTotp(secret));
  await page.locator('[data-two-factor-verify-form] button[type="submit"]').click();
  await page.waitForFunction(() => (document.querySelector("[data-two-factor-status]")?.textContent || "").toLowerCase().includes("enabled and verified"),
    null, { timeout: 12000 });

  // Verify a second authenticated session and exercise the workspace UI without external network access.
  await page.locator("[data-auth-signout]").first().click();
  await page.waitForURL((url) => url.pathname.endsWith("/signin"), { timeout: 12000 });
  await page.goto(baseUrl + "/signin", { waitUntil: "domcontentloaded" });
  const signin = page.locator('[data-auth-form="signin"]');
  await signin.waitFor({ state: "visible", timeout: 10000 });
  await signin.locator("#auth-email").fill(email);
  await signin.locator("#auth-password").fill(resetPassword);
  await signin.locator('button[type="submit"]').click();
  const totpPrompt = page.locator("[data-signin-totp-form]");
  await totpPrompt.waitFor({ state: "visible", timeout: 10000 });
  await totpPrompt.locator("#signin-totp-code").fill(generateLocalTotp(secret));
  await totpPrompt.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname.endsWith("/account"), { timeout: 12000 });

  await page.goto(baseUrl + "/workspace", { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(() => {
      const shell = document.querySelector("[data-workspace-shell]");
      return Boolean(shell && !shell.hidden);
    }, null, { timeout: 15000 });
  } catch (error) {
    const state = await page.evaluate(async () => {
      async function readJson(path) {
        try {
          const response = await fetch(path, { credentials: "include", cache: "no-store" });
          const body = await response.json().catch(() => null);
          return { status: response.status, body };
        } catch (cause) {
          return { error: String(cause) };
        }
      }
      const shell = document.querySelector("[data-workspace-shell]");
      const loading = document.querySelector("[data-workspace-loading]");
      const [session, overview, keys, history] = await Promise.all([
        readJson("/api/auth/get-session"),
        readJson("/api/v1/workspace/overview"),
        readJson("/api/v1/workspace/keys"),
        readJson("/api/v1/workspace/history")
      ]);
      return {
        url: window.location.href,
        workspaceShellFound: Boolean(shell),
        workspaceShellHidden: shell?.hidden ?? null,
        loadingText: loading?.textContent?.trim() || "",
        session,
        overview,
        keys,
        history
      };
    });
    throw new Error("Authenticated Workspace did not become visible. Runtime diagnostics: " +
      JSON.stringify(state) + "; original wait error: " + (error?.message || String(error)));
  }
  const keyForm = page.locator("[data-ws-key-form]");
  const keyName = "browser-qa-" + timestamp;
  await keyForm.locator('input[name="name"]').fill(keyName);
  await keyForm.locator('button[type="submit"]').click();
  await page.waitForFunction(() => {
    const reveal = document.querySelector("[data-ws-key-reveal]");
    const key = document.querySelector("[data-ws-key-secret]");
    return Boolean(reveal && !reveal.hidden && key && key.textContent.startsWith("ef_ws_"));
  }, null, { timeout: 12000 });

  const executor = page.locator("[data-ws-exec-form]");
  await executor.locator('input[name="goal"]').fill("Browser QA policy simulation");
  await executor.locator('input[name="url"]').fill("https://example.com/");
  await executor.locator('select[name="mode"]').selectOption("simulate");
  await executor.locator('button[type="submit"]').click();
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-ws-exec-status]");
    return Boolean(status && status.textContent.toLowerCase().includes("succeeded"));
  }, null, { timeout: 15000 });
  assert.ok(await page.locator("[data-ws-history-list] li").count() > 0, "Workspace execution was not recorded in local history");

  // Prove authentication unlocks controls that were inert in the signed-out route sweep.
  await page.goto(baseUrl + "/platform", { waitUntil: "domcontentloaded" });
  const authenticatedLayerTabs = page.locator('[data-tab-group="platform-layers"] [data-tab-trigger]');
  try {
    await page.waitForFunction(() => {
      const shell = document.querySelector('[data-requires-auth="true"]');
      return Boolean(shell && shell.getAttribute("data-auth-locked") === "false");
    }, null, { timeout: 15000 });
  } catch (error) {
    const state = await page.evaluate(async () => {
      const shell = document.querySelector('[data-requires-auth="true"]');
      const content = shell?.querySelector("[data-auth-gate-content]");
      let session = { status: null, hasUser: false };
      try {
        const response = await fetch("/api/auth/get-session", { credentials: "include", cache: "no-store" });
        const body = await response.json().catch(() => null);
        session = { status: response.status, hasUser: Boolean(body?.user?.id) };
      } catch (cause) {
        session = { error: String(cause) };
      }
      return {
        authLocked: shell?.getAttribute("data-auth-locked") ?? null,
        contentInert: Boolean(content?.hasAttribute("inert")),
        session
      };
    });
    throw new Error("Authenticated platform gate did not unlock after Workspace simulation: " +
      JSON.stringify(state) + "; " + (error?.message || String(error)));
  }
  await authenticatedLayerTabs.nth(1).scrollIntoViewIfNeeded();
  await authenticatedLayerTabs.nth(1).click();
  assert.equal(await authenticatedLayerTabs.nth(1).getAttribute("aria-selected"), "true",
    "Verified account should be able to activate platform architecture layers");

  await page.goto(baseUrl + "/demo", { waitUntil: "domcontentloaded" });
  const authenticatedDemoPreset = page.locator('[data-demo-preset="public-fetch"]');
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-demo-preset="public-fetch"]');
    return Boolean(button && !button.closest("[inert]"));
  }, null, { timeout: 15000 });
  await authenticatedDemoPreset.click();
  assert.equal(await authenticatedDemoPreset.getAttribute("aria-pressed"), "true",
    "Verified account should be able to activate an interactive Demo preset");

  await context.close();
}

async function checkApiAndPublicAssets() {
  const endpoints = [
    ["/api/v1/health", 200],
    ["/api/v1/platform", 200],
    ["/api/v1/router-preview", 200],
    ["/robots.txt", 200],
    ["/sitemap.xml", 200],
    ["/api/auth/config", 200]
  ];
  for (const [path, expected] of endpoints) {
    const response = await fetch(baseUrl + path, { headers: { accept: path.endsWith(".xml") || path.endsWith(".txt") ? "*/*" : "application/json" } });
    assert.equal(response.status, expected, "Unexpected status for " + path);
    if (path.startsWith("/api/")) {
      const body = await response.json();
      assert.ok(body && typeof body === "object", path + " should return a JSON object");
    }
  }

  for (const path of ["/api/v1/workspace/overview", "/api/v1/workspace/keys", "/api/v1/workspace/history"]) {
    const response = await fetch(baseUrl + path, { headers: { accept: "application/json" } });
    assert.ok([401, 503].includes(response.status), "Unauthenticated workspace endpoint must fail closed: " + path + " returned " + response.status);
  }
}

async function verifyInternalLinks(links) {
  const hrefs = [...links].sort();
  const failures = [];
  const concurrency = Math.min(12, hrefs.length);
  let cursor = 0;
  let completed = 0;

  async function verifyNext() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= hrefs.length) return;

      const href = hrefs[index];
      try {
        const response = await fetch(baseUrl + href, {
          redirect: "manual",
          signal: AbortSignal.timeout(8_000),
        });
        if (response.status >= 400) failures.push({ href, status: response.status });
        if (response.body) await response.body.cancel().catch(() => {});
      } catch (error) {
        failures.push({ href, error: error.message || String(error) });
      } finally {
        completed += 1;
        if (completed % 50 === 0 || completed === hrefs.length) {
          process.stdout.write("Verified same-origin links: " + completed + "/" + hrefs.length + "\n");
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => verifyNext()));
  assert.deepEqual(failures, [], "Broken same-origin navigation targets: " + JSON.stringify(failures));
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const combinations = [];
  const links = new Set();
  const failures = [];

  async function attempt(label, check) {
    try {
      await check();
      process.stdout.write("PASS " + label + "\\n");
    } catch (error) {
      const failure = { label, message: error?.message || String(error), stack: error?.stack || "" };
      failures.push(failure);
      process.stderr.write("FAIL " + label + ": " + failure.message + "\\n");
    }
  }

  async function routeAttempt(width, route, capture) {
    try {
      combinations.push(await inspectRoute(browser, width, route, links, capture));
    } catch (error) {
      failures.push({
        label: "route " + route + " @ " + width + "px",
        message: error?.message || String(error),
        stack: error?.stack || ""
      });
      process.stderr.write("FAIL route " + route + " @ " + width + "px: " + (error?.message || String(error)) + "\\n");
    }
  }

  // Visit every declared public, localized, legacy, and account route on mobile and desktop.
  for (const width of [390, 1440]) {
    for (const route of routes) {
      await routeAttempt(width, route, screenshotRoutes.has(route));
    }
  }

  // Smaller phone widths target all high-traffic, interactive, account and legal surfaces.
  for (const width of [320, 360]) {
    for (const route of mobileRegressionRoutes) {
      await routeAttempt(width, route, false);
    }
  }

  await attempt("home navigation, language switcher and mobile menu", () => checkHomeInteractions(browser));
  await attempt("feature tabs, use-case actions, FAQ and demo interactions", () => checkFeaturePages(browser));
  await attempt("auth and contact form controls", () => checkAuthAndContactPages(browser));
  await attempt("synthetic local account lifecycle (verification, reset, TOTP, workspace)", () => checkLocalAccountLifecycle(browser));
  await attempt("public API endpoints and unauthenticated workspace fail-closed behavior", () => checkApiAndPublicAssets());
  await attempt("same-origin navigation targets", () => verifyInternalLinks(links));

  const report = {
    generatedAt: new Date().toISOString(),
    routes: routes.length,
    pageViewportCombinations: combinations.length,
    attemptedPageViewportCombinations: routes.length * 2 + mobileRegressionRoutes.length * 2,
    uniqueInternalLinks: links.size,
    viewportCoverage: [320, 360, 390, 1440],
    locales: locales,
    testedRoutes: routes,
    results: combinations,
    failures
  };
  await writeFile(resolve(screenshotDir, "qa-report.json"), JSON.stringify(report, null, 2), "utf8");
  process.stdout.write("ExportFlow Chromium QA completed. Routes: " + routes.length +
    "; passed page/viewport combinations: " + combinations.length +
    "; attempted combinations: " + report.attemptedPageViewportCombinations +
    "; same-origin links verified: " + links.size +
    "; failures: " + failures.length + ".\\n");
  process.stdout.write("Screenshots and qa-report.json: " + screenshotDir + "\\n");
  if (failures.length) {
    throw new Error("Browser QA recorded " + failures.length + " failure(s); see qa-report.json and logs.");
  }
  process.stdout.write("All visible SVGs, image assets, accessible control names, Arabic RTL and horizontal overflow checks passed.\\n");
} catch (error) {
  process.stderr.write("ExportFlow full-site Chromium QA failed: " + (error?.stack || String(error)) + "\\n");
  process.stderr.write(serverOutput);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolvePromise) => {
      if (server.exitCode !== null || server.signalCode !== null) return resolvePromise();
      server.once("exit", resolvePromise);
      setTimeout(() => {
        if (server.exitCode === null && server.signalCode === null) server.kill("SIGKILL");
      }, 5000).unref();
    });
  }
}
