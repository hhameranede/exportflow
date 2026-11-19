import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error("PLAYWRIGHT_MODULE must point to the runner-local Playwright module.");
const { chromium } = await import(pathToFileURL(modulePath).href);

const port = Number(process.env.PORT || 3187);
const baseUrl = "http://127.0.0.1:" + port;
const screenshotDir = resolve(process.env.SITE_SCREENSHOT_DIR || "artifacts/site-browser");
const routes = ["/", "/platform", "/use-cases", "/developers", "/demo", "/faq"];
const viewports = [360, 390, 768, 1440];

await mkdir(screenshotDir, { recursive: true });

const server = spawn(process.execPath, ["src/server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.setEncoding("utf8").on("data", (chunk) => { serverOutput += chunk; });
server.stderr.setEncoding("utf8").on("data", (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error("Local ExportFlow server exited before browser tests.\n" + serverOutput);
    }
    try {
      const response = await fetch(baseUrl + "/api/v1/health");
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("Timed out waiting for local ExportFlow server.\n" + serverOutput);
}

function routeSlug(route) {
  return route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
}

async function openPage(browser, width, route) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const externalRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    try {
      if (new URL(request.url()).origin !== baseUrl) externalRequests.push(request.url());
    } catch {
      externalRequests.push(request.url());
    }
  });

  const response = await page.goto(baseUrl + route, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  assert.ok(response, "missing navigation response for " + route);
  assert.equal(response.status(), 200, "unexpected HTTP status for " + route);
  assert.equal(await page.locator("main h1").count(), 1, "expected one main H1 for " + route);
  assert.ok(await page.title(), "missing document title for " + route);

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    mainWidth: document.querySelector("main")?.scrollWidth ?? 0,
    hasVisibleH1: Boolean(document.querySelector("main h1")?.getClientRects().length),
  }));
  assert.ok(layout.hasVisibleH1, "main H1 is not visible for " + route + " at " + width + "px");
  assert.ok(
    layout.documentWidth <= layout.viewportWidth + 1,
    "horizontal document overflow at " + width + "px on " + route + ": " + JSON.stringify(layout),
  );
  assert.ok(
    layout.bodyWidth <= layout.viewportWidth + 1,
    "horizontal body overflow at " + width + "px on " + route + ": " + JSON.stringify(layout),
  );
  assert.deepEqual(externalRequests, [], "unexpected third-party request(s) on " + route);
  assert.deepEqual(pageErrors, [], "uncaught browser exception(s) on " + route);
  assert.deepEqual(consoleErrors, [], "browser console error(s) on " + route);

  const screenshotPath = resolve(screenshotDir, routeSlug(route) + "-" + width + ".png");
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
  await context.close();

  return { route, width, ...layout, screenshot: screenshotPath };
}

async function checkHomeInteractions(browser) {
  const context = await browser.newContext({ viewport: { width: 360, height: 850 } });
  const page = await context.newPage();
  await page.goto(baseUrl + "/", { waitUntil: "networkidle" });

  const menuButton = page.locator("[data-menu-toggle]");
  assert.equal(await menuButton.count(), 1, "mobile navigation toggle missing");
  await menuButton.click();
  assert.equal(await menuButton.getAttribute("aria-expanded"), "true", "mobile drawer did not open");
  const platformLink = page.locator('[data-mobile-drawer] a[href="/platform"]');
  assert.ok(await platformLink.isVisible(), "mobile Platform link not visible after opening drawer");
  await platformLink.click();
  await page.waitForURL("**/platform");
  assert.equal(await menuButton.getAttribute("aria-expanded"), "false", "mobile drawer did not close after navigation");

  await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
  const prototypeFilter = page.locator('[data-cap-filter="prototype"]');
  assert.equal(await prototypeFilter.count(), 1, "homepage prototype filter missing");
  await prototypeFilter.click();
  const visibleCards = page.locator("[data-cap-card]:visible");
  assert.ok(await visibleCards.count() > 0, "prototype filter hid every capability card");
  const mismatchedCards = await visibleCards.evaluateAll((cards) =>
    cards.filter((card) => card.getAttribute("data-maturity-key") !== "prototype").length
  );
  assert.equal(mismatchedCards, 0, "homepage maturity filter left mismatched capability cards visible");

  const detailToggle = page.locator("[data-cap-toggle]").first();
  const detailId = await detailToggle.getAttribute("aria-controls");
  await detailToggle.click();
  assert.equal(await detailToggle.getAttribute("aria-expanded"), "true", "homepage details did not expand");
  assert.ok(await page.locator("#" + detailId).isVisible(), "homepage details panel stayed hidden");
  await context.close();
}

async function checkPlatformAndUseCases(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(baseUrl + "/platform", { waitUntil: "networkidle" });
  const layerButtons = page.locator("[data-layer-id]");
  assert.equal(await layerButtons.count(), 7, "platform architecture should expose seven layers");
  const selected = layerButtons.nth(1);
  const selectedId = await selected.getAttribute("data-layer-id");
  const layerData = await page.locator("#ef-platform-layers-json").evaluate((node) => JSON.parse(node.textContent || "[]"));
  const expectedLayer = layerData.find((item) => item.id === selectedId);
  assert.ok(expectedLayer, "selected platform layer missing from page data");
  await selected.click();
  assert.equal((await page.locator("[data-insp-name]").textContent()).trim(), expectedLayer.name);

  await page.goto(baseUrl + "/use-cases", { waitUntil: "networkidle" });
  const useCaseToggle = page.locator("[data-uc-toggle]").first();
  const panelId = await useCaseToggle.getAttribute("aria-controls");
  await useCaseToggle.click();
  assert.equal(await useCaseToggle.getAttribute("aria-expanded"), "true", "use-case JSON panel did not expand");
  assert.ok(await page.locator("#" + panelId).isVisible(), "use-case JSON content remained hidden");
  await context.close();
}

async function checkFaqInteractions(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(baseUrl + "/faq", { waitUntil: "networkidle" });

  const items = page.locator("[data-faq-item]");
  const filters = page.locator("[data-faq-filter]");
  assert.ok(await items.count() > 0, "FAQ items are missing");
  assert.ok(await filters.count() > 1, "FAQ categories are missing");

  const categoryButton = filters.nth(1);
  const category = await categoryButton.getAttribute("data-faq-filter");
  await categoryButton.click();
  const visibleItems = page.locator("[data-faq-item]:visible");
  assert.ok(await visibleItems.count() > 0, "FAQ category filter returned no questions");
  const mismatchedItems = await visibleItems.evaluateAll((nodes, expected) =>
    nodes.filter((node) => node.getAttribute("data-faq-category") !== expected).length,
    category,
  );
  assert.equal(mismatchedItems, 0, "FAQ filter left questions from other categories visible");

  await page.locator('[data-faq-filter="all"]').click();
  await page.locator("[data-faq-expand-all]").click();
  const closedAfterExpand = await items.evaluateAll((nodes) => nodes.filter((node) => !node.open).length);
  assert.equal(closedAfterExpand, 0, "Expand all did not open every FAQ item");

  await page.locator("[data-faq-collapse-all]").click();
  const openAfterCollapse = await items.evaluateAll((nodes) => nodes.filter((node) => node.open).length);
  assert.equal(openAfterCollapse, 0, "Collapse all left FAQ items open");
  await context.close();
}

async function checkDemoInteractions(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await page.goto(baseUrl + "/demo", { waitUntil: "networkidle" });

  const state = page.locator("#demo-task-state");
  const output = page.locator("#demo-json-output");
  const run = page.locator("#demo-run-btn");

  await page.locator("#demo-url").fill("http://localhost./admin");
  await run.click();
  assert.equal((await state.textContent()).trim(), "rejected", "trailing-dot localhost was not rejected in Demo");

  await page.locator("#demo-url").fill("https://example.com/");
  await page.locator("#demo-timeout").fill("50");
  await run.click();
  assert.ok((await output.textContent()).includes("UPSTREAM_TIMEOUT"), "timeout input did not affect Demo outcome");

  await page.locator("#demo-timeout").fill("8000");
  await page.locator("#demo-max-bytes").fill("1");
  await run.click();
  assert.ok((await output.textContent()).includes("RESPONSE_TOO_LARGE"), "byte limit did not affect Demo outcome");

  await page.locator('[data-demo-preset="redirect-trace"]').click();
  await page.locator("#demo-max-redirects").fill("0");
  await run.click();
  assert.ok((await output.textContent()).includes("TOO_MANY_REDIRECTS"), "redirect limit did not affect Demo outcome");

  await page.locator('[data-demo-preset="browser-unsupported"]').click();
  assert.equal((await state.textContent()).trim(), "unsupported", "browser preset implied an available browser runtime");

  await page.locator('[data-demo-tab="evidence"]').click();
  assert.equal(await page.locator('[data-demo-panel="evidence"]').isVisible(), true, "Evidence tab did not switch panels");
  await page.locator('[data-demo-tab="json"]').click();
  assert.equal(await page.locator('[data-demo-panel="json"]').isVisible(), true, "JSON tab did not switch panels");

  await context.close();
}

async function checkDeveloperCopy(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await page.goto(baseUrl + "/developers", { waitUntil: "networkidle" });
  const copyButton = page.locator("[data-copy-target]").first();
  assert.equal(await copyButton.count(), 1, "developer documentation copy button missing");
  await copyButton.click();
  await page.waitForFunction(() => {
    const button = document.querySelector("[data-copy-target]");
    return button && button.textContent.trim() === "Copied";
  }, null, { timeout: 3000 });
  const copiedText = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(copiedText.length > 0, "copy button did not write text to the clipboard");
  await context.close();
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  const results = [];
  for (const width of viewports) {
    for (const route of routes) {
      results.push(await openPage(browser, width, route));
    }
  }

  await checkHomeInteractions(browser);
  await checkPlatformAndUseCases(browser);
  await checkFaqInteractions(browser);
  await checkDemoInteractions(browser);
  await checkDeveloperCopy(browser);

  process.stdout.write("Real Chromium site checks passed: " + results.length + " page/viewport combinations.\n");
  for (const result of results) {
    process.stdout.write(
      "BROWSER " + result.route + " @ " + result.width + "px" +
      " docWidth=" + result.documentWidth +
      " bodyWidth=" + result.bodyWidth +
      " mainWidth=" + result.mainWidth + "\n",
    );
  }
  process.stdout.write("Screenshots saved to " + screenshotDir + "\n");
} catch (error) {
  process.stderr.write("Chromium site verification failed: " + (error?.stack || String(error)) + "\n");
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
