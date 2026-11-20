export const MARKETING_JS = `(function () {
  "use strict";

  var root = document.documentElement;
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function isMotionReduced() {
    return prefersReducedMotion.matches || root.getAttribute("data-motion") === "paused";
  }

  /* ========================================================================
     1. Accessible Toast Helper
     ======================================================================== */
  var toastRegion = document.querySelector("[data-toast-region]");
  function showToast(message) {
    if (!toastRegion) return;
    var toast = document.createElement("div");
    toast.className = "ef-toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;
    toastRegion.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add("is-visible");
    });
    setTimeout(function () {
      toast.classList.remove("is-visible");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 220);
    }, 2600);
  }

  /* ========================================================================
     2. Sticky Header Scroll Blur (> 8px)
     ======================================================================== */
  var header = document.querySelector("[data-site-header]");
  if (header) {
    var syncHeader = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    syncHeader();
    window.addEventListener("scroll", syncHeader, { passive: true });
  }

  /* ========================================================================
     3. Theme Toggle (Light Default + Optional Manual Dark Mode)
     ======================================================================== */
  var themeToggles = document.querySelectorAll("[data-theme-toggle]");
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  function getActiveTheme() {
    var saved = null;
    try { saved = localStorage.getItem("ef_theme"); } catch (_e) {}
    if (saved === "dark" || saved === "light") return saved;
    return "light";
  }

  function applyTheme(theme, persist) {
    root.setAttribute("data-theme", theme);
    if (themeMeta) {
      themeMeta.setAttribute("content", theme === "dark" ? "#0b0f17" : "#F8FAFC");
    }
    if (persist) {
      try { localStorage.setItem("ef_theme", theme); } catch (_e) {}
    }
    var isDark = theme === "dark";
    themeToggles.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(isDark));
      btn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
      var sun = btn.querySelector("[data-icon-sun]");
      var moon = btn.querySelector("[data-icon-moon]");
      if (sun) sun.hidden = !isDark;
      if (moon) moon.hidden = isDark;
    });
  }

  applyTheme(getActiveTheme(), false);

  themeToggles.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next, true);
      showToast(next === "light" ? "Light theme active" : "Dark theme active");
    });
  });

  /* ========================================================================
     4. Ambient Motion Pause Control
     ======================================================================== */
  var motionToggles = document.querySelectorAll("[data-motion-toggle]");
  function syncMotionState(paused) {
    if (paused) {
      root.setAttribute("data-motion", "paused");
    } else {
      root.removeAttribute("data-motion");
    }
    motionToggles.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(paused));
      var label = btn.querySelector("[data-motion-label]");
      if (label) label.textContent = paused ? "Resume motion" : "Pause motion";
    });
  }

  if (prefersReducedMotion.matches) {
    syncMotionState(true);
  }

  motionToggles.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var nextPaused = root.getAttribute("data-motion") !== "paused";
      syncMotionState(nextPaused);
      showToast(nextPaused ? "Ambient motion paused" : "Ambient motion resumed");
    });
  });

  /* ========================================================================
     5. Keyboard-Navigable Language Switcher + RTL Route Switch
     ======================================================================== */
  var locMatch = window.location.pathname.match(/^\\/(en|ar|fr|es|de|pt|zh|ja)(\\/.*)?$/);
  var currentLocale = locMatch ? locMatch[1] : "en";
  var currentPath = locMatch ? (locMatch[2] || "/") : window.location.pathname;

  function navigateLocale(nextLocale) {
    if (nextLocale === currentLocale) return;
    var target = nextLocale === "en"
      ? currentPath
      : "/" + nextLocale + (currentPath === "/" ? "" : currentPath);
    var main = document.getElementById("main-content");
    if (main && !isMotionReduced()) {
      main.style.opacity = "0";
      main.style.transition = "opacity 150ms ease";
      setTimeout(function () { window.location.assign(target); }, 140);
    } else {
      window.location.assign(target);
    }
  }

  document.querySelectorAll("[data-lang-switcher]").forEach(function (switcher) {
    var trigger = switcher.querySelector("[data-lang-trigger]");
    var menu = switcher.querySelector("[data-lang-menu]");
    var options = Array.prototype.slice.call(switcher.querySelectorAll("[data-lang-option]"));
    if (!trigger || !menu || !options.length) return;

    function setOpen(open, focusSelected) {
      switcher.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", String(open));
      menu.hidden = !open;
      if (open && focusSelected) {
        var selected = options.find(function (opt) {
          return opt.getAttribute("data-lang-option") === currentLocale;
        }) || options[0];
        selected.focus();
      }
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var isOpen = trigger.getAttribute("aria-expanded") === "true";
      setOpen(!isOpen, !isOpen);
    });

    trigger.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true, true);
      }
    });

    menu.addEventListener("keydown", function (e) {
      var idx = options.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        options[(idx + 1) % options.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        options[(idx - 1 + options.length) % options.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        options[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        options[options.length - 1].focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false, false);
        trigger.focus();
      } else if (e.key === "Tab") {
        setOpen(false, false);
      }
    });

    options.forEach(function (opt) {
      opt.addEventListener("click", function () {
        var code = opt.getAttribute("data-lang-option");
        setOpen(false, false);
        navigateLocale(code);
      });
    });

    document.addEventListener("click", function (e) {
      if (!switcher.contains(e.target)) {
        setOpen(false, false);
      }
    });
  });

  /* ========================================================================
     6. Mobile Navigation Drawer with Focus Trap
     ======================================================================== */
  var menuBtn = document.querySelector("[data-menu-toggle]");
  var drawer = document.querySelector("[data-mobile-drawer]");
  var drawerClose = document.querySelector("[data-drawer-close]");
  var backdrop = document.querySelector("[data-drawer-backdrop]");

  if (menuBtn && drawer) {
    var getFocusable = function () {
      return Array.prototype.slice.call(
        drawer.querySelectorAll('a[href], button:not([disabled]), select, [tabindex]:not([tabindex="-1"])')
      );
    };

    var setDrawerOpen = function (open) {
      menuBtn.setAttribute("aria-expanded", String(open));
      if (open) {
        drawer.hidden = false;
        if (backdrop) backdrop.classList.add("is-open");
        requestAnimationFrame(function () {
          drawer.classList.add("is-open");
          var items = getFocusable();
          if (items.length) items[0].focus();
        });
      } else {
        drawer.classList.remove("is-open");
        if (backdrop) backdrop.classList.remove("is-open");
        setTimeout(function () {
          if (!drawer.classList.contains("is-open")) drawer.hidden = true;
        }, 280);
      }
    };

    menuBtn.addEventListener("click", function () {
      setDrawerOpen(menuBtn.getAttribute("aria-expanded") !== "true");
    });

    if (drawerClose) {
      drawerClose.addEventListener("click", function () {
        setDrawerOpen(false);
        menuBtn.focus();
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", function () {
        setDrawerOpen(false);
        menuBtn.focus();
      });
    }

    drawer.addEventListener("click", function (e) {
      if (e.target.closest("a")) setDrawerOpen(false);
    });

    drawer.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawerOpen(false);
        menuBtn.focus();
        return;
      }
      if (e.key !== "Tab") return;
      var items = getFocusable();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* ========================================================================
     7. Hero Pointer Parallax (clamped 6px, disabled on touch / reduced)
     ======================================================================== */
  var parallaxTarget = document.querySelector("[data-parallax-target]");
  var heroSection = document.querySelector("[data-hero-section]");
  if (parallaxTarget && heroSection && window.matchMedia("(pointer: fine)").matches) {
    var pRaf = null;
    heroSection.addEventListener("pointermove", function (e) {
      if (isMotionReduced()) return;
      if (pRaf) cancelAnimationFrame(pRaf);
      pRaf = requestAnimationFrame(function () {
        var rect = heroSection.getBoundingClientRect();
        var nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        var ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        parallaxTarget.style.setProperty("--px", (nx * 6).toFixed(2) + "px");
        parallaxTarget.style.setProperty("--py", (ny * 6).toFixed(2) + "px");
      });
    });
    heroSection.addEventListener("pointerleave", function () {
      parallaxTarget.style.setProperty("--px", "0px");
      parallaxTarget.style.setProperty("--py", "0px");
    });
  }

  /* ========================================================================
     8. Execution Graph EF/01 Scenarios & Node Hover / Focus Inspection
     ======================================================================== */
  document.querySelectorAll("[data-exec-graph]").forEach(function (graph) {
    var metaEl = graph.querySelector("[data-graph-meta]");
    if (!metaEl) return;
    var parsed = {};
    try { parsed = JSON.parse(metaEl.textContent || "{}"); } catch (_e) {}
    var nodesMeta = parsed.nodes || {};
    var scenariosMeta = parsed.scenarios || {};

    var nodes = graph.querySelectorAll("[data-graph-node]");
    var paths = graph.querySelectorAll("[data-path-id]");
    var scenarioBtns = graph.querySelectorAll("[data-graph-scenario]");
    var titleEl = graph.querySelector("[data-gt-title]");
    var boundsEl = graph.querySelector("[data-gt-bounds]");
    var statusEl = graph.querySelector("[data-gt-status]");
    var detailEl = graph.querySelector("[data-gt-detail]");
    var currentScenario = "http";

    function applyDetails(info, activeKey) {
      if (!info) return;
      if (activeKey) {
        graph.setAttribute("data-active-node", activeKey);
      } else {
        graph.removeAttribute("data-active-node");
      }
      paths.forEach(function (p) {
        var pid = p.getAttribute("data-path-id");
        p.classList.toggle("is-highlighted", info.connects.indexOf(pid) !== -1);
      });
      if (titleEl) titleEl.textContent = info.title;
      if (boundsEl) boundsEl.textContent = info.bounds || "";
      if (statusEl) statusEl.textContent = info.status;
      if (detailEl) detailEl.textContent = info.detail;
    }

    function applyScenario(scenarioId) {
      currentScenario = scenarioId;
      graph.setAttribute("data-active-scenario", scenarioId);
      scenarioBtns.forEach(function (btn) {
        btn.setAttribute("aria-pressed", String(btn.getAttribute("data-graph-scenario") === scenarioId));
      });
      var info = scenariosMeta[scenarioId];
      applyDetails(info, scenarioId);
    }

    scenarioBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyScenario(btn.getAttribute("data-graph-scenario"));
      });
    });

    nodes.forEach(function (node) {
      var id = node.getAttribute("data-graph-node");
      node.addEventListener("pointerenter", function () { applyDetails(nodesMeta[id], id); });
      node.addEventListener("focus", function () { applyDetails(nodesMeta[id], id); });
      node.addEventListener("click", function () { applyDetails(nodesMeta[id], id); });
    });

    graph.addEventListener("pointerleave", function () {
      applyScenario(currentScenario);
    });
    graph.addEventListener("focusout", function (e) {
      if (!graph.contains(e.relatedTarget)) {
        applyScenario(currentScenario);
      }
    });

    applyScenario("http");
  });

  /* ========================================================================
     9. Scroll-Driven Reveals & Trust Checkmark Draw
     ======================================================================== */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !isMotionReduced()) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var delay = entry.target.getAttribute("data-reveal-delay");
          if (delay) entry.target.style.transitionDelay = delay + "ms";
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ========================================================================
     10. Platform Capabilities Maturity Filter
     ======================================================================== */
  var capFilterBtns = document.querySelectorAll("[data-cap-filter]");
  var capCards = document.querySelectorAll("[data-cap-card]");
  if (capFilterBtns.length && capCards.length) {
    capFilterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var filter = btn.getAttribute("data-cap-filter");
        capFilterBtns.forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        capCards.forEach(function (card) {
          var state = card.getAttribute("data-cap-state");
          var match = filter === "all" || state === filter;
          card.hidden = !match;
          if (match) card.classList.add("is-visible");
        });
      });
    });
  }

  /* ========================================================================
     11. Execution Model Vertical Timeline + Sticky Step Inspector
     ======================================================================== */
  var timeline = document.querySelector("[data-exec-timeline]");
  var inspector = document.querySelector("[data-step-inspector]");
  if (timeline) {
    var steps = Array.prototype.slice.call(timeline.querySelectorAll("[data-timeline-step]"));
    var stepTriggers = Array.prototype.slice.call(timeline.querySelectorAll("[data-step-trigger]"));
    var stepMetaEl = inspector ? inspector.querySelector("[data-step-meta]") : null;
    var stepSpecs = [];
    if (stepMetaEl) {
      try { stepSpecs = JSON.parse(stepMetaEl.textContent || "[]"); } catch (_e) {}
    }

    var inspIdx = inspector ? inspector.querySelector("[data-step-insp-idx]") : null;
    var inspTitle = inspector ? inspector.querySelector("[data-step-insp-title]") : null;
    var inspDesc = inspector ? inspector.querySelector("[data-step-insp-desc]") : null;
    var inspModule = inspector ? inspector.querySelector("[data-step-insp-module]") : null;
    var inspGuard = inspector ? inspector.querySelector("[data-step-insp-guard]") : null;
    var manualSelectedStep = null;

    function renderInspectorStep(index) {
      var spec = stepSpecs[index];
      if (!spec || !inspector) return;
      if (inspIdx) inspIdx.textContent = "STEP " + spec.index;
      if (inspTitle) inspTitle.textContent = spec.phase;
      if (inspDesc) inspDesc.textContent = spec.summary;
      if (inspModule) inspModule.textContent = spec.module;
      if (inspGuard) inspGuard.textContent = spec.guard;
      stepTriggers.forEach(function (t, idx) {
        t.setAttribute("aria-pressed", String(idx === index));
      });
    }

    var tRaf = null;
    var updateTimeline = function () {
      tRaf = null;
      if (isMotionReduced()) {
        timeline.style.setProperty("--timeline-progress", "1");
        steps.forEach(function (s) { s.classList.add("is-active"); });
        return;
      }
      var rect = timeline.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      var anchor = vh * 0.62;
      var progress = (anchor - rect.top) / Math.max(rect.height, 1);
      progress = Math.max(0.1, Math.min(1, progress));
      timeline.style.setProperty("--timeline-progress", progress.toFixed(3));

      var activeCount = Math.max(1, Math.ceil(progress * steps.length));
      steps.forEach(function (step, idx) {
        step.classList.toggle("is-active", idx < activeCount);
      });
      if (manualSelectedStep === null) {
        renderInspectorStep(Math.min(steps.length - 1, activeCount - 1));
      }
    };

    var onScrollTimeline = function () {
      if (!tRaf) tRaf = requestAnimationFrame(updateTimeline);
    };

    updateTimeline();
    window.addEventListener("scroll", onScrollTimeline, { passive: true });
    stepTriggers.forEach(function (trigger, idx) {
      trigger.addEventListener("click", function () {
        manualSelectedStep = idx;
        steps.forEach(function (s, i) { s.classList.toggle("is-active", i <= idx); });
        timeline.style.setProperty("--timeline-progress", ((idx + 1) / steps.length).toFixed(3));
        renderInspectorStep(idx);
      });
    });
  }

  /* ========================================================================
     12. Capability Cards Cursor-Following Border Highlight
     ======================================================================== */
  document.querySelectorAll("[data-glow-card]").forEach(function (card) {
    var cRaf = null;
    card.addEventListener("pointermove", function (e) {
      if (isMotionReduced()) return;
      if (cRaf) cancelAnimationFrame(cRaf);
      cRaf = requestAnimationFrame(function () {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", (e.clientX - rect.left).toFixed(1) + "px");
        card.style.setProperty("--my", (e.clientY - rect.top).toFixed(1) + "px");
      });
    });
  });

  /* ========================================================================
     13. Developer Contract Lab (Tabbed Payloads + Typewriter + Copy)
     ======================================================================== */
  var codeCard = document.querySelector("[data-typewriter-card]");
  if (codeCard) {
    var codeTarget = codeCard.querySelector("[data-typewriter-target]");
    var cursorEl = codeCard.querySelector("[data-type-cursor]");
    var resultPanel = codeCard.querySelector("[data-typewriter-result]");
    var statusEl = codeCard.querySelector("[data-code-status] span");
    var adapterEl = codeCard.querySelector("[data-code-adapter]");
    var replayBtn = codeCard.querySelector("[data-typewriter-replay]");
    var copyBtn = codeCard.querySelector("[data-copy-code]");
    var tabBtns = codeCard.querySelectorAll("[data-code-tab]");

    var PAYLOADS = {
      request: {
        statusText: "ILLUSTRATIVE · status: ok · 142ms · evidence attached",
        adapterText: "adapter: http.fetch.v1",
        isWarn: false,
        tokens: [
          { cls: "ef-tok-dim", text: "// Illustrative contract example\\n" },
          { cls: "ef-tok-punc", text: "{\\n  " },
          { cls: "ef-tok-key", text: '"goal"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-str", text: '"Retrieve public documentation"' },
          { cls: "ef-tok-punc", text: ",\\n  " },
          { cls: "ef-tok-key", text: '"url"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-str", text: '"https://example.com/docs"' },
          { cls: "ef-tok-punc", text: ",\\n  " },
          { cls: "ef-tok-key", text: '"operation"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-str", text: '"fetch"' },
          { cls: "ef-tok-punc", text: ",\\n  " },
          { cls: "ef-tok-key", text: '"limits"' },
          { cls: "ef-tok-punc", text: ": { " },
          { cls: "ef-tok-key", text: '"timeoutMs"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-num", text: "5000" },
          { cls: "ef-tok-punc", text: " }\\n}" }
        ],
        raw: JSON.stringify({
          goal: "Retrieve public documentation",
          url: "https://example.com/docs",
          operation: "fetch",
          limits: { timeoutMs: 5000 }
        }, null, 2)
      },
      response: {
        statusText: "ILLUSTRATIVE · state: succeeded · 1 redirect hop · SHA-verified auth",
        adapterText: "sources[0].evidence[0].http_response",
        isWarn: false,
        tokens: [
          { cls: "ef-tok-dim", text: "// Illustrative normalized result envelope\\n" },
          { cls: "ef-tok-punc", text: "{\\n  " },
          { cls: "ef-tok-key", text: '"state"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-str", text: '"succeeded"' },
          { cls: "ef-tok-punc", text: ",\\n  " },
          { cls: "ef-tok-key", text: '"execution"' },
          { cls: "ef-tok-punc", text: ": { " },
          { cls: "ef-tok-key", text: '"adapterId"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-str", text: '"http.fetch.v1"' },
          { cls: "ef-tok-punc", text: " },\\n  " },
          { cls: "ef-tok-key", text: '"usage"' },
          { cls: "ef-tok-punc", text: ": { " },
          { cls: "ef-tok-key", text: '"durationMs"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-num", text: "142" },
          { cls: "ef-tok-punc", text: ", " },
          { cls: "ef-tok-key", text: '"responseBytes"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-num", text: "1256" },
          { cls: "ef-tok-punc", text: " },\\n  " },
          { cls: "ef-tok-key", text: '"evidence"' },
          { cls: "ef-tok-punc", text: ": [{ " },
          { cls: "ef-tok-key", text: '"status"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-num", text: "200" },
          { cls: "ef-tok-punc", text: ", " },
          { cls: "ef-tok-key", text: '"redirectCount"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-num", text: "0" },
          { cls: "ef-tok-punc", text: " }]\\n}" }
        ],
        raw: JSON.stringify({
          state: "succeeded",
          execution: { adapterId: "http.fetch.v1" },
          usage: { durationMs: 142, responseBytes: 1256 },
          evidence: [{ status: 200, redirectCount: 0 }]
        }, null, 2)
      },
      guard: {
        statusText: "ILLUSTRATIVE · state: unsupported · HTTP 501 · 0 external calls",
        adapterText: "code: BROWSER_UNAVAILABLE",
        isWarn: true,
        tokens: [
          { cls: "ef-tok-dim", text: "// Honest boundary when binding is unconfigured\\n" },
          { cls: "ef-tok-punc", text: "{\\n  " },
          { cls: "ef-tok-key", text: '"state"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-str", text: '"unsupported"' },
          { cls: "ef-tok-punc", text: ",\\n  " },
          { cls: "ef-tok-key", text: '"execution"' },
          { cls: "ef-tok-punc", text: ": { " },
          { cls: "ef-tok-key", text: '"path"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-str", text: '"browser"' },
          { cls: "ef-tok-punc", text: ", " },
          { cls: "ef-tok-key", text: '"adapterId"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-num", text: "null" },
          { cls: "ef-tok-punc", text: " },\\n  " },
          { cls: "ef-tok-key", text: '"errors"' },
          { cls: "ef-tok-punc", text: ": [{ " },
          { cls: "ef-tok-key", text: '"code"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-str", text: '"BROWSER_UNAVAILABLE"' },
          { cls: "ef-tok-punc", text: " }]\\n}" }
        ],
        raw: JSON.stringify({
          state: "unsupported",
          execution: { path: "browser", adapterId: null },
          errors: [{ code: "BROWSER_UNAVAILABLE" }]
        }, null, 2)
      }
    };

    var activeTabKey = "request";
    var typingTimer = null;

    function syncResultBanner(payload) {
      if (statusEl) statusEl.textContent = payload.statusText;
      if (adapterEl) adapterEl.textContent = payload.adapterText;
      if (resultPanel) resultPanel.classList.toggle("is-warn", Boolean(payload.isWarn));
    }

    function renderFullCode() {
      var payload = PAYLOADS[activeTabKey] || PAYLOADS.request;
      if (typingTimer) clearTimeout(typingTimer);
      syncResultBanner(payload);
      codeTarget.innerHTML = "";
      payload.tokens.forEach(function (tok) {
        var span = document.createElement("span");
        span.className = tok.cls;
        span.textContent = tok.text;
        codeTarget.appendChild(span);
      });
      if (cursorEl) cursorEl.classList.add("is-done");
      if (resultPanel) resultPanel.classList.add("is-visible");
    }

    function runTypewriter() {
      var payload = PAYLOADS[activeTabKey] || PAYLOADS.request;
      syncResultBanner(payload);
      if (isMotionReduced()) {
        renderFullCode();
        return;
      }
      if (typingTimer) clearTimeout(typingTimer);
      codeTarget.innerHTML = "";
      if (cursorEl) cursorEl.classList.remove("is-done");
      if (resultPanel) resultPanel.classList.remove("is-visible");

      var tIdx = 0;
      var cIdx = 0;
      var activeSpan = null;

      function step() {
        if (tIdx >= payload.tokens.length) {
          if (cursorEl) cursorEl.classList.add("is-done");
          if (resultPanel) resultPanel.classList.add("is-visible");
          return;
        }
        var tok = payload.tokens[tIdx];
        if (!activeSpan) {
          activeSpan = document.createElement("span");
          activeSpan.className = tok.cls;
          codeTarget.appendChild(activeSpan);
        }
        var chunk = tok.text.slice(cIdx, cIdx + 4);
        activeSpan.textContent += chunk;
        cIdx += 4;
        if (cIdx >= tok.text.length) {
          tIdx += 1;
          cIdx = 0;
          activeSpan = null;
        }
        typingTimer = setTimeout(step, 20);
      }

      step();
    }

    tabBtns.forEach(function (tab) {
      tab.addEventListener("click", function () {
        activeTabKey = tab.getAttribute("data-code-tab") || "request";
        tabBtns.forEach(function (b) {
          b.setAttribute("aria-selected", String(b === tab));
        });
        runTypewriter();
      });
    });

    if ("IntersectionObserver" in window && !isMotionReduced()) {
      var codeObs = new IntersectionObserver(
        function (entries) {
          if (entries[0] && entries[0].isIntersecting) {
            runTypewriter();
            codeObs.disconnect();
          }
        },
        { threshold: 0.25 }
      );
      codeObs.observe(codeCard);
    } else {
      renderFullCode();
    }

    if (replayBtn) {
      replayBtn.addEventListener("click", runTypewriter);
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var payload = PAYLOADS[activeTabKey] || PAYLOADS.request;
        var finish = function () {
          copyBtn.classList.add("is-copied");
          var textEl = copyBtn.querySelector("[data-copy-label]");
          var iconCopy = copyBtn.querySelector("[data-icon-copy]");
          var iconCheck = copyBtn.querySelector("[data-icon-check]");
          if (textEl) textEl.textContent = "Copied";
          if (iconCopy) iconCopy.hidden = true;
          if (iconCheck) iconCheck.hidden = false;
          showToast("Copied example JSON to clipboard");
          setTimeout(function () {
            copyBtn.classList.remove("is-copied");
            if (textEl) textEl.textContent = "Copy";
            if (iconCopy) iconCopy.hidden = false;
            if (iconCheck) iconCheck.hidden = true;
          }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(payload.raw).then(finish).catch(finish);
        } else {
          finish();
        }
      });
    }
  }

  /* ========================================================================
     14. Contact Form Inline Validation & Preview State
     ======================================================================== */
  var contactForm = document.querySelector("[data-contact-form]");
  if (contactForm) {
    var statusBanner = contactForm.querySelector("[data-form-status]");

    function setFieldError(fieldName, message) {
      var input = contactForm.querySelector('[name="' + fieldName + '"]');
      var errorEl = contactForm.querySelector('[data-error-for="' + fieldName + '"]');
      if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
      if (errorEl) errorEl.textContent = message || "";
      return input;
    }

    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameVal = (contactForm.elements.name.value || "").trim();
      var emailVal = (contactForm.elements.email.value || "").trim();
      var subjectVal = (contactForm.elements.subject.value || "").trim();
      var messageVal = (contactForm.elements.message.value || "").trim();
      var consentEl = contactForm.querySelector('[name="consent"]');
      var firstInvalid = null;

      var nEl = setFieldError("name", nameVal.length < 2 ? "Please enter your name (at least 2 characters)." : "");
      if (nameVal.length < 2 && !firstInvalid) firstInvalid = nEl;

      var emailOk = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(emailVal);
      var eEl = setFieldError("email", emailOk ? "" : "Please enter a valid email address.");
      if (!emailOk && !firstInvalid) firstInvalid = eEl;

      var sEl = setFieldError("subject", subjectVal ? "" : "Please select an inquiry type.");
      if (!subjectVal && !firstInvalid) firstInvalid = sEl;

      var mEl = setFieldError("message", messageVal.length < 10 ? "Please include at least 10 characters in your message." : "");
      if (messageVal.length < 10 && !firstInvalid) firstInvalid = mEl;

      if (consentEl && !consentEl.checked) {
        setFieldError("consent", "Please confirm you understand how these details are used.");
        if (!firstInvalid) firstInvalid = consentEl;
      } else {
        setFieldError("consent", "");
      }

      if (firstInvalid) {
        statusBanner.dataset.state = "error";
        statusBanner.textContent = "Please review the highlighted fields above.";
        firstInvalid.focus();
        return;
      }

      statusBanner.dataset.state = "success";
      statusBanner.textContent = "Message validated and prepared locally for " + subjectVal + ". No external submission endpoint is connected yet.";
      showToast("Inquiry prepared locally");
    });
  }

  /* ========================================================================
     15. Accounts & Google Linking UI Blueprint (Ready for Real Backend)
     ======================================================================== */
  var AUTH_STORAGE_KEY = "ef_auth_preview";
  var DEFAULT_AUTH_STATE = {
    signedIn: false,
    name: "ExportFlow Developer",
    email: "developer@exportflow.me",
    org: "Local Execution Lab",
    googleLinked: false,
    googleEmail: "",
    twoFactorEnabled: false
  };

  function readAuthState() {
    try {
      var raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULT_AUTH_STATE);
      return Object.assign({}, DEFAULT_AUTH_STATE, JSON.parse(raw));
    } catch (_e) {
      return Object.assign({}, DEFAULT_AUTH_STATE);
    }
  }

  function writeAuthState(patch) {
    var next = Object.assign({}, readAuthState(), patch);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    } catch (_e) {}
    syncAuthHeaderLink();
    syncAccountWorkspace();
    return next;
  }

  function computeInitials(name, email) {
    var src = (name || email || "EF").trim();
    var parts = src.split(/\\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return src.slice(0, 2).toUpperCase();
  }

  function syncAuthHeaderLink() {
    var link = document.querySelector("[data-auth-header-link]");
    if (!link) return;
    var st = readAuthState();
    if (st.signedIn) {
      link.setAttribute("href", link.getAttribute("data-account-href") || "/account");
      link.textContent = st.name || "Account";
    } else {
      link.setAttribute("href", link.getAttribute("data-signin-href") || "/signin");
      link.textContent = link.getAttribute("data-signin-label") || "Sign in";
    }
  }

  function syncAccountWorkspace() {
    var workspace = document.querySelector("[data-account-workspace]");
    if (!workspace) return;
    var st = readAuthState();
    var avatarEl = workspace.querySelector("[data-acc-avatar]");
    var nameEl = workspace.querySelector("[data-acc-display-name]");
    var emailEl = workspace.querySelector("[data-acc-email]");
    var nameInput = workspace.querySelector("#acc-name");
    var orgInput = workspace.querySelector("#acc-org");

    if (avatarEl) avatarEl.textContent = computeInitials(st.name, st.email);
    if (nameEl) nameEl.textContent = st.name;
    if (emailEl) emailEl.textContent = st.email;
    if (nameInput && document.activeElement !== nameInput) nameInput.value = st.name;
    if (orgInput && document.activeElement !== orgInput) orgInput.value = st.org;

    var gCard = workspace.querySelector("[data-google-provider-card]");
    var gBadge = workspace.querySelector("[data-google-status-badge]");
    var gStatusText = workspace.querySelector("[data-google-status-text]");
    var gDetail = workspace.querySelector("[data-google-sub-detail]");
    var gScopes = workspace.querySelector("[data-google-scopes]");
    var gConnectBtn = gCard ? gCard.querySelector("[data-google-oauth-btn]") : null;
    var gUnlinkBtn = gCard ? gCard.querySelector("[data-google-unlink-btn]") : null;

    if (gCard) {
      gCard.setAttribute("data-linked", st.googleLinked ? "true" : "false");
    }
    if (gBadge) {
      gBadge.className = "ef-badge " + (st.googleLinked ? "ef-badge-available" : "ef-badge-planned");
    }
    if (gStatusText) {
      gStatusText.textContent = st.googleLinked ? "Linked" : "Not linked";
    }
    if (gDetail) {
      gDetail.textContent = st.googleLinked
        ? "Linked to " + (st.googleEmail || st.email) + " · OAuth 2.0 scopes granted."
        : "No Google identity linked yet. Connect to enable one-click OAuth sign-in.";
    }
    if (gScopes) gScopes.hidden = !st.googleLinked;
    if (gConnectBtn) gConnectBtn.hidden = Boolean(st.googleLinked);
    if (gUnlinkBtn) gUnlinkBtn.hidden = !st.googleLinked;

    var twoFaBadge = workspace.querySelector("[data-2fa-badge]");
    var twoFaBtn = workspace.querySelector("[data-2fa-toggle]");
    if (twoFaBadge) {
      twoFaBadge.className = "ef-badge " + (st.twoFactorEnabled ? "ef-badge-available" : "ef-badge-planned");
      var badgeSpan = twoFaBadge.querySelector("span");
      if (badgeSpan) badgeSpan.textContent = st.twoFactorEnabled ? "Enabled (Preview)" : "Off (Preview)";
    }
    if (twoFaBtn) {
      twoFaBtn.setAttribute("aria-pressed", String(Boolean(st.twoFactorEnabled)));
      twoFaBtn.textContent = st.twoFactorEnabled ? "Disable 2FA Preview" : "Enable 2FA Preview";
    }
  }

  /* Integration adapter hook for wiring a real backend later */
  window.ExportFlowAuth = {
    getState: readAuthState,
    signInWithEmail: function (payload) {
      return Promise.resolve(writeAuthState({
        signedIn: true,
        email: payload.email,
        name: payload.email.split("@")[0]
      }));
    },
    signUpWithEmail: function (payload) {
      return Promise.resolve(writeAuthState({
        signedIn: true,
        name: payload.name,
        email: payload.email,
        org: payload.org || "Personal Workspace"
      }));
    },
    requestPasswordReset: function (email) {
      return Promise.resolve({ ok: true, email: email });
    },
    linkGoogleAccount: function (googleProfile) {
      var current = readAuthState();
      return Promise.resolve(writeAuthState({
        signedIn: true,
        name: current.signedIn && current.name !== DEFAULT_AUTH_STATE.name ? current.name : (googleProfile.name || current.name),
        email: current.signedIn && current.email !== DEFAULT_AUTH_STATE.email ? current.email : googleProfile.email,
        googleLinked: true,
        googleEmail: googleProfile.email
      }));
    },
    unlinkGoogleAccount: function () {
      return Promise.resolve(writeAuthState({
        googleLinked: false,
        googleEmail: ""
      }));
    },
    updateProfile: function (patch) {
      return Promise.resolve(writeAuthState(patch));
    },
    toggle2fa: function (enabled) {
      return Promise.resolve(writeAuthState({ twoFactorEnabled: Boolean(enabled) }));
    },
    signOut: function () {
      return Promise.resolve(writeAuthState({ signedIn: false }));
    }
  };

  syncAuthHeaderLink();
  syncAccountWorkspace();

  /* Password Show/Hide Toggle */
  document.querySelectorAll("[data-toggle-password]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var targetId = btn.getAttribute("data-toggle-password");
      var input = targetId ? document.getElementById(targetId) : null;
      if (!input) return;
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", String(show));
    });
  });

  /* Password Strength Meter */
  var pwInput = document.querySelector("[data-password-input]");
  var strengthMeter = document.querySelector("[data-strength-meter]");
  var strengthLabel = document.querySelector("[data-strength-label]");
  if (pwInput && strengthMeter) {
    var labels = [
      "Password strength: waiting for input",
      "Password strength: weak (add length & variety)",
      "Password strength: fair",
      "Password strength: good",
      "Password strength: strong"
    ];
    pwInput.addEventListener("input", function () {
      var val = pwInput.value || "";
      var score = 0;
      if (val.length >= 8) score += 1;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score += 1;
      if (/[0-9]/.test(val)) score += 1;
      if (/[^A-Za-z0-9]/.test(val) || val.length >= 12) score += 1;
      if (!val.length) score = 0;
      strengthMeter.setAttribute("data-score", String(score));
      if (strengthLabel) strengthLabel.textContent = labels[score] || labels[0];
    });
  }

  /* Copy Backend Contract Snippet */
  document.querySelectorAll("[data-copy-contract]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var payload = btn.getAttribute("data-copy-contract") || "";
      var done = function () { showToast("Backend auth contract copied"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(payload).then(done).catch(done);
      } else {
        done();
      }
    });
  });

  /* Auth Forms Validation & Preview Flows (signin, signup, forgot) */
  document.querySelectorAll("[data-auth-form]").forEach(function (form) {
    var mode = form.getAttribute("data-auth-form");
    var banner = form.querySelector("[data-form-status]");
    var redirectUrl = form.getAttribute("data-redirect-account");

    function setErr(field, msg) {
      var inp = form.querySelector('[name="' + field + '"]');
      var err = form.querySelector('[data-error-for="' + field + '"]');
      if (inp) inp.setAttribute("aria-invalid", msg ? "true" : "false");
      if (err) err.textContent = msg || "";
      return inp;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var firstInvalid = null;

      var emailVal = form.elements.email ? (form.elements.email.value || "").trim() : "";
      var emailOk = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(emailVal);
      var eField = setErr("email", emailOk ? "" : "Please enter a valid email address.");
      if (!emailOk && !firstInvalid) firstInvalid = eField;

      if (mode === "signin" || mode === "signup") {
        var pwVal = form.elements.password ? form.elements.password.value || "" : "";
        var pwOk = pwVal.length >= 8;
        var pField = setErr("password", pwOk ? "" : "Password must be at least 8 characters.");
        if (!pwOk && !firstInvalid) firstInvalid = pField;
      }

      if (mode === "signup") {
        var nameVal = form.elements.name ? (form.elements.name.value || "").trim() : "";
        var nField = setErr("name", nameVal.length >= 2 ? "" : "Please enter your full name.");
        if (nameVal.length < 2 && !firstInvalid) firstInvalid = nField;

        var termsEl = form.querySelector('[name="terms"]');
        if (termsEl && !termsEl.checked) {
          setErr("terms", "Please accept the Terms and Privacy Policy.");
          if (!firstInvalid) firstInvalid = termsEl;
        } else {
          setErr("terms", "");
        }
      }

      if (firstInvalid) {
        if (banner) {
          banner.dataset.state = "error";
          banner.textContent = "Please fix the highlighted fields above.";
        }
        firstInvalid.focus();
        return;
      }

      if (mode === "forgot") {
        window.ExportFlowAuth.requestPasswordReset(emailVal).then(function () {
          if (banner) {
            banner.dataset.state = "success";
            banner.textContent = "Preview reset flow prepared for " + emailVal + ". Wire POST /api/auth/forgot-password to send real email.";
          }
          showToast("Password reset payload prepared");
        });
        return;
      }

      var actionPromise = mode === "signup"
        ? window.ExportFlowAuth.signUpWithEmail({
            name: (form.elements.name.value || "").trim(),
            email: emailVal,
            org: form.elements.org ? (form.elements.org.value || "").trim() : ""
          })
        : window.ExportFlowAuth.signInWithEmail({ email: emailVal });

      actionPromise.then(function () {
        if (banner) {
          banner.dataset.state = "success";
          banner.textContent = "Preview session active for " + emailVal + ". Opening account dashboard...";
        }
        showToast(mode === "signup" ? "Preview account created" : "Signed in (UI preview)");
        if (redirectUrl) {
          setTimeout(function () { window.location.assign(redirectUrl); }, 450);
        }
      });
    });
  });

  /* Google OAuth Consent Preview Modal */
  var modalBackdrop = document.querySelector("[data-google-modal-backdrop]");
  var modalEl = document.querySelector("[data-google-modal]");
  var googleEmailInput = document.querySelector("[data-google-email-input]");
  var googleConfirmBtn = document.querySelector("[data-google-confirm]");
  var activeGoogleTrigger = null;
  var pendingGoogleRedirect = null;
  var selectedGoogleName = "Samer Dev";

  function closeGoogleModal() {
    if (!modalBackdrop) return;
    modalBackdrop.hidden = true;
    if (activeGoogleTrigger) activeGoogleTrigger.focus();
  }

  if (modalBackdrop && modalEl) {
    document.querySelectorAll("[data-google-oauth-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeGoogleTrigger = btn;
        pendingGoogleRedirect = btn.getAttribute("data-redirect-account");
        modalBackdrop.hidden = false;
        if (googleEmailInput) googleEmailInput.focus();
      });
    });

    document.querySelectorAll("[data-google-preset]").forEach(function (row) {
      row.addEventListener("click", function () {
        document.querySelectorAll("[data-google-preset]").forEach(function (r) {
          r.classList.remove("is-selected");
          r.setAttribute("aria-checked", "false");
        });
        row.classList.add("is-selected");
        row.setAttribute("aria-checked", "true");
        var presetEmail = row.getAttribute("data-google-preset") || "";
        selectedGoogleName = row.getAttribute("data-google-name") || "Google User";
        if (googleEmailInput) googleEmailInput.value = presetEmail;
      });
    });

    document.querySelectorAll("[data-google-modal-close]").forEach(function (btn) {
      btn.addEventListener("click", closeGoogleModal);
    });

    modalBackdrop.addEventListener("click", function (e) {
      if (e.target === modalBackdrop) closeGoogleModal();
    });

    modalEl.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeGoogleModal();
      }
    });

    if (googleConfirmBtn) {
      googleConfirmBtn.addEventListener("click", function () {
        var gEmail = googleEmailInput ? (googleEmailInput.value || "").trim() : "samer.dev@gmail.com";
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(gEmail)) {
          if (googleEmailInput) googleEmailInput.focus();
          showToast("Enter a valid Google email address");
          return;
        }
        window.ExportFlowAuth.linkGoogleAccount({
          email: gEmail,
          name: selectedGoogleName
        }).then(function () {
          closeGoogleModal();
          showToast("Google account linked: " + gEmail);
          if (pendingGoogleRedirect) {
            setTimeout(function () { window.location.assign(pendingGoogleRedirect); }, 350);
          }
        });
      });
    }
  }

  /* Account Dashboard Controls */
  var profileForm = document.querySelector("[data-account-profile-form]");
  if (profileForm) {
    profileForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameVal = (profileForm.elements.name.value || "").trim();
      var orgVal = (profileForm.elements.org.value || "").trim();
      if (nameVal.length < 2) {
        showToast("Display name must be at least 2 characters");
        return;
      }
      window.ExportFlowAuth.updateProfile({ name: nameVal, org: orgVal }).then(function () {
        var note = profileForm.querySelector("[data-profile-status]");
        if (note) note.textContent = "Updated locally";
        showToast("Profile updated in preview state");
      });
    });
  }

  var unlinkBtn = document.querySelector("[data-google-unlink-btn]");
  if (unlinkBtn) {
    unlinkBtn.addEventListener("click", function () {
      window.ExportFlowAuth.unlinkGoogleAccount().then(function () {
        showToast("Google account disconnected");
      });
    });
  }

  document.querySelectorAll("[data-revoke-session]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var row = btn.closest("[data-session-row], .ef-session-row");
      if (row) row.remove();
      showToast("Session revoked in UI preview");
    });
  });

  var twoFaToggle = document.querySelector("[data-2fa-toggle]");
  if (twoFaToggle) {
    twoFaToggle.addEventListener("click", function () {
      var next = !readAuthState().twoFactorEnabled;
      window.ExportFlowAuth.toggle2fa(next).then(function () {
        showToast(next ? "2FA preview enabled" : "2FA preview disabled");
      });
    });
  }

  var signoutBtn = document.querySelector("[data-account-signout]");
  if (signoutBtn) {
    signoutBtn.addEventListener("click", function () {
      var dest = signoutBtn.getAttribute("data-redirect-signin") || "/signin";
      window.ExportFlowAuth.signOut().then(function () {
        showToast("Signed out of preview session");
        setTimeout(function () { window.location.assign(dest); }, 300);
      });
    });
  }
})();`;
