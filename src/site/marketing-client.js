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
     15. Server-backed Accounts & Google OAuth
     ======================================================================== */
  var sessionTokenByIndex = new Map();
  var accountIdByKey = new Map();
  var authConfig = null;

  function authMessage(element, message, state) {
    if (!element) return;
    element.textContent = message || "";
    if (state) element.dataset.state = state;
    else delete element.dataset.state;
  }

  function escapeAuthText(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;", "'": "&#39;" })[char];
    });
  }

  async function authRequest(path, method, payload) {
    var options = {
      method: method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "accept": "application/json" }
    };
    if (payload !== undefined) {
      options.headers["content-type"] = "application/json";
      options.body = JSON.stringify(payload);
    }
    var response = await fetch("/api/auth/" + path, options);
    var data = null;
    try { data = await response.json(); } catch (_e) {}
    if (!response.ok) {
      var message = data && (data.message || data.error && data.error.message || data.error);
      var requestError = new Error(typeof message === "string" ? message : "The account service could not complete this request.");
      requestError.status = response.status;
      requestError.code = data && (data.code || data.errorCode || data.error && typeof data.error === "object" && data.error.code) || null;
      throw requestError;
    }
    return data;
  }

  function authGoTo(url) {
    if (typeof url === "string") {
      try {
        var parsed = new URL(url, window.location.origin);
        var sameOrigin = parsed.origin === window.location.origin;
        var googleOrigin = parsed.protocol === "https:" &&
          parsed.hostname === "accounts.google.com" &&
          !parsed.port &&
          !parsed.username &&
          !parsed.password;
        if (sameOrigin || googleOrigin) {
          window.location.assign(parsed.href);
          return;
        }
      } catch (_e) {}
    }
    window.location.assign("/account");
  }

  function updateAuthHeader(user) {
    var link = document.querySelector("[data-auth-header-link]");
    if (!link) return;
    if (user) {
      link.setAttribute("href", link.getAttribute("data-account-href") || "/account");
      link.textContent = user.name || user.email || "Account";
    } else {
      link.setAttribute("href", link.getAttribute("data-signin-href") || "/signin");
      link.textContent = link.getAttribute("data-signin-label") || "Sign in";
    }
  }

  async function refreshAuthHeader() {
    try {
      var response = await authRequest("get-session");
      updateAuthHeader(response && response.user ? response.user : null);
    } catch (_e) {
      updateAuthHeader(null);
    }
  }

  function setAccountConfig(config) {
    document.querySelectorAll("[data-auth-google]").forEach(function (button) {
      var mode = button.getAttribute("data-auth-google-mode");
      var allowed = Boolean(config && config.googleEnabled);
      button.disabled = !allowed;
      button.hidden = !allowed;
      if (mode === "link") button.hidden = !allowed;
    });

    document.querySelectorAll('[data-auth-form="signin"], [data-auth-form="signup"]').forEach(function (form) {
      form.hidden = !Boolean(config && config.emailPasswordEnabled);
    });

    document.querySelectorAll('[data-auth-form="forgot"], [data-auth-form="reset"]').forEach(function (form) {
      form.hidden = !Boolean(config && config.emailPasswordEnabled);
    });

    var disabledEmail = document.querySelector("[data-auth-email-disabled]");
    if (disabledEmail) disabledEmail.hidden = Boolean(config && config.emailPasswordEnabled);
    var disabledReset = document.querySelector("[data-auth-reset-disabled]");
    if (disabledReset) disabledReset.hidden = Boolean(config && config.emailPasswordEnabled);

    var status = document.querySelector("[data-auth-config-status]");
    if (!config || !config.authConfigured) {
      authMessage(status, "Account services are not connected yet. The sign-in page is ready, but no account can be created until the server database and secret are configured.", "warning");
    } else if (!config.authReady) {
      authMessage(status, "The account database is connected, but its authentication tables are not initialized yet. Sign-in stays disabled until setup is complete.", "warning");
    } else if (!config.googleEnabled && !config.emailPasswordEnabled) {
      authMessage(status, "Authentication is configured on the server, but no sign-in provider is enabled yet.", "warning");
    } else if (!config.emailPasswordEnabled) {
      authMessage(status, "Google sign-in is available. Email/password stays disabled until verified transactional email delivery is configured.", "success");
    } else {
      authMessage(status, "Secure account services are available.", "success");
    }

    var passwordForm = document.querySelector("[data-account-password-form]");
    if (passwordForm) passwordForm.hidden = !Boolean(config && config.emailPasswordEnabled);

    var linkGoogle = document.querySelector("[data-auth-link-google]");
    if (linkGoogle) {
      linkGoogle.disabled = !Boolean(config && config.googleEnabled);
      linkGoogle.hidden = !Boolean(config && config.googleEnabled);
    }
  }

  async function beginGoogleAuth(mode) {
    var data = await authRequest(mode === "link" ? "link-social" : "sign-in/social", "POST", {
      provider: "google",
      callbackURL: window.location.origin + "/account",
      disableRedirect: true
    });
    if (data && data.url) {
      authGoTo(data.url);
      return;
    }
    if (mode === "link") {
      showToast("Google account linked.");
      await loadAccountWorkspace();
      return;
    }
    authGoTo("/account");
  }

  function clearFieldErrors(form) {
    if (!form) return;
    form.querySelectorAll("[data-auth-field-error]").forEach(function (node) {
      node.textContent = "";
    });
  }

  function showFormError(form, message) {
    var banner = form ? form.querySelector("[data-auth-form-status]") : null;
    authMessage(banner, message, "error");
    if (form) {
      form.querySelectorAll("input").forEach(function (input) {
        input.setAttribute("aria-invalid", "false");
      });
    }
  }

  function validateAuthForm(form, mode) {
    clearFieldErrors(form);
    var email = form.elements.email ? String(form.elements.email.value || "").trim() : "";
    var password = form.elements.password ? String(form.elements.password.value || "") : "";
    var name = form.elements.name ? String(form.elements.name.value || "").trim() : "";
    var firstInvalid = null;
    function fail(field, message) {
      var input = form.elements[field];
      var error = form.querySelector('[data-auth-field-error="' + field + '"]');
      if (input) {
        input.setAttribute("aria-invalid", "true");
        if (!firstInvalid) firstInvalid = input;
      }
      if (error) error.textContent = message;
    }
    if (["signin", "signup", "forgot"].indexOf(mode) >= 0 &&
        !(email.indexOf("@") > 0 && email.lastIndexOf(".") > email.indexOf("@") + 1 && email.lastIndexOf(".") < email.length - 1)) {
      fail("email", "Enter a valid email address.");
    }
    if (mode === "signin" || mode === "signup") {
      if (password.length < 8) fail("password", "Use at least 8 characters.");
    }
    if (mode === "signup" && name.length < 2) {
      fail("name", "Enter your full name.");
    }
    if (mode === "reset") {
      var newPassword = form.elements.password ? String(form.elements.password.value || "") : "";
      var confirmPassword = form.elements.confirmPassword ? String(form.elements.confirmPassword.value || "") : "";
      if (newPassword.length < 8) fail("password", "Use at least 8 characters.");
      if (confirmPassword !== newPassword) fail("confirmPassword", "Passwords do not match.");
      if (!new URLSearchParams(window.location.search).get("token")) {
        fail("password", "This reset link is incomplete or expired. Request a new one.");
      }
    }
    if (firstInvalid) firstInvalid.focus();
    return {
      ok: !firstInvalid,
      email: email,
      password: password,
      name: name
    };
  }

  function bindAuthForms() {
    document.querySelectorAll("[data-auth-form]").forEach(function (form) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        var mode = form.getAttribute("data-auth-form");
        var values = validateAuthForm(form, mode);
        if (!values.ok) return;
        var banner = form.querySelector("[data-auth-form-status]");
        var submit = form.querySelector('button[type="submit"]');
        if (submit) submit.disabled = true;
        authMessage(banner, "Processing securely…");
        try {
          var result;
          if (mode === "signin") {
            result = await authRequest("sign-in/email", "POST", {
              email: values.email,
              password: values.password,
              callbackURL: window.location.origin + "/account"
            });
            if (result && result.url) {
              authGoTo(result.url);
              return;
            }
            authGoTo("/account");
            return;
          }
          if (mode === "signup") {
            await authRequest("sign-up/email", "POST", {
              name: values.name,
              email: values.email,
              password: values.password,
              callbackURL: window.location.origin + "/account"
            });
            authMessage(banner, "Account created. Check your email and verify the address before signing in.", "success");
            showToast("Verification email requested.");
            form.reset();
            return;
          }
          if (mode === "forgot") {
            await authRequest("request-password-reset", "POST", {
              email: values.email,
              redirectTo: window.location.origin + "/reset-password"
            });
            authMessage(banner, "If that address is registered, a secure password reset email will be sent.", "success");
            form.reset();
            return;
          }
          if (mode === "reset") {
            var token = new URLSearchParams(window.location.search).get("token");
            await authRequest("reset-password", "POST", {
              newPassword: values.password,
              token: token
            });
            authMessage(banner, "Password updated. You can now sign in.", "success");
            form.reset();
            setTimeout(function () { window.location.assign("/signin"); }, 900);
          }
        } catch (error) {
          showFormError(form, error && error.message ? error.message : "The request failed. Try again.");
        } finally {
          if (submit) submit.disabled = false;
        }
      });
    });
  }

  function makeSessionRow(session, index, currentSession) {
    var item = document.createElement("li");
    item.className = "ef-session-row";
    var info = document.createElement("div");
    var title = document.createElement("strong");
    var detail = document.createElement("p");
    var action = document.createElement("span");
    title.textContent = currentSession ? "Current session" : (session.userAgent || "Signed-in session");
    detail.textContent = session.expiresAt
      ? "Expires " + new Date(session.expiresAt).toLocaleString()
      : "Active session";
    info.appendChild(title);
    info.appendChild(detail);
    if (currentSession) {
      action.className = "ef-badge ef-badge-available";
      action.textContent = "This device";
    } else {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ef-code-btn";
      button.textContent = "Revoke";
      button.addEventListener("click", async function () {
        try {
          if (!session.token) throw new Error("Session identifier is unavailable.");
          await authRequest("revoke-session", "POST", { token: session.token });
          showToast("Session revoked.");
          await loadAccountWorkspace();
        } catch (error) {
          showToast(error.code === "SESSION_NOT_FRESH"
            ? "Sign in again before managing active sessions."
            : error.message || "Could not revoke session.");
        }
      });
      action.appendChild(button);
    }
    item.appendChild(info);
    item.appendChild(action);
    return item;
  }

  function makeAccountRow(account, canUnlink) {
    var item = document.createElement("li");
    item.className = "ef-session-row";
    var info = document.createElement("div");
    var title = document.createElement("strong");
    var detail = document.createElement("p");
    var action = document.createElement("span");
    title.textContent = account.providerId === "google" ? "Google" : (account.providerId || "Connected provider");
    detail.textContent = account.accountId ? "Connected account" : "Connected identity";
    info.appendChild(title);
    info.appendChild(detail);
    if (account.providerId === "google" && account.accountId && canUnlink) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ef-code-btn";
      button.textContent = "Disconnect";
      button.addEventListener("click", async function () {
        if (!window.confirm("Disconnect this Google account from ExportFlow? Make sure another sign-in method is available first.")) return;
        try {
          await authRequest("unlink-account", "POST", {
            providerId: "google",
            accountId: account.accountId
          });
          showToast("Google account disconnected.");
          await loadAccountWorkspace();
        } catch (error) {
          showToast(error.message || "Could not disconnect the account.");
        }
      });
      action.appendChild(button);
    }
    item.appendChild(info);
    item.appendChild(action);
    return item;
  }

  async function loadAccountWorkspace() {
    var workspace = document.querySelector("[data-account-workspace]");
    if (!workspace) return;
    var loading = document.querySelector("[data-account-loading]");
    var status = document.querySelector("[data-auth-account-status]");
    if (loading) loading.hidden = false;
    workspace.hidden = true;
    try {
      var sessionResponse = await authRequest("get-session");
      if (!sessionResponse || !sessionResponse.user || !sessionResponse.session) {
        window.location.assign("/signin");
        return;
      }
      var user = sessionResponse.user;
      var currentSession = sessionResponse.session;
      var nameInput = workspace.querySelector("#acc-name");
      var emailInput = workspace.querySelector("#acc-email");
      if (nameInput) nameInput.value = user.name || "";
      if (emailInput) emailInput.value = user.email || "";
      var accountResponse = await authRequest("list-accounts");
      var accounts = Array.isArray(accountResponse) ? accountResponse : (accountResponse && accountResponse.accounts) || [];
      var accountList = workspace.querySelector("[data-auth-account-list]");
      if (accountList) {
        accountList.textContent = "";
        if (!accounts.length) {
          var emptyAccount = document.createElement("li");
          emptyAccount.className = "ef-session-row";
          emptyAccount.textContent = "No linked social accounts.";
          accountList.appendChild(emptyAccount);
        } else {
          accounts.forEach(function (account) {
            accountList.appendChild(makeAccountRow(account, accounts.length > 1));
          });
        }
      }
      var linkButton = workspace.querySelector("[data-auth-link-google]");
      var hasGoogle = accounts.some(function (account) { return account.providerId === "google"; });
      if (linkButton) linkButton.hidden = !Boolean(authConfig && authConfig.googleEnabled && !hasGoogle);
      var sessionList = workspace.querySelector("[data-auth-session-list]");
      var sessionStatus = workspace.querySelector("[data-auth-session-status]");
      var revokeAllButton = workspace.querySelector("[data-auth-revoke-all]");
      if (sessionList) sessionList.textContent = "";
      if (sessionStatus) {
        sessionStatus.hidden = true;
        sessionStatus.textContent = "";
      }
      if (revokeAllButton) revokeAllButton.hidden = false;

      try {
        var sessionsResponse = await authRequest("list-sessions");
        var sessions = Array.isArray(sessionsResponse) ? sessionsResponse : (sessionsResponse && sessionsResponse.sessions) || [];
        if (sessionList) {
          sessions.forEach(function (session, index) {
            sessionList.appendChild(makeSessionRow(session, index, session.id === currentSession.id));
          });
          if (!sessions.length) {
            var emptySession = document.createElement("li");
            emptySession.className = "ef-session-row";
            emptySession.textContent = "No active sessions found.";
            sessionList.appendChild(emptySession);
          }
        }
      } catch (sessionError) {
        if (revokeAllButton) revokeAllButton.hidden = true;
        if (sessionStatus) {
          sessionStatus.hidden = false;
          var staleSession = sessionError && sessionError.code === "SESSION_NOT_FRESH";
          sessionStatus.textContent = sessionStatus.getAttribute(staleSession ? "data-session-stale-message" : "data-session-error-message") ||
            "Session details are temporarily unavailable.";
          if (staleSession) {
            var reauthLink = document.createElement("a");
            reauthLink.href = sessionStatus.getAttribute("data-session-reauth-href") || "/signin";
            reauthLink.textContent = sessionStatus.getAttribute("data-session-reauth-label") || "Sign in again";
            sessionStatus.appendChild(document.createTextNode(" "));
            sessionStatus.appendChild(reauthLink);
          }
        }
      }
      if (loading) loading.hidden = true;
      workspace.hidden = false;
      authMessage(status, "");
      updateAuthHeader(user);
    } catch (error) {
      if (loading) loading.hidden = true;
      workspace.hidden = true;
      authMessage(status, error && error.message ? error.message : "Could not verify your account. Sign in again.", "error");
    }
  }

  function bindAccountControls() {
    var profileForm = document.querySelector("[data-account-profile-form]");
    if (profileForm) {
      profileForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        var name = String(profileForm.elements.name.value || "").trim();
        var status = profileForm.querySelector("[data-profile-status]");
        if (name.length < 2) {
          authMessage(status, "Enter a name with at least two characters.", "error");
          return;
        }
        var button = profileForm.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        try {
          await authRequest("update-user", "POST", { name: name });
          authMessage(status, "Profile updated.", "success");
          await refreshAuthHeader();
        } catch (error) {
          authMessage(status, error.message || "Could not update your profile.", "error");
        } finally {
          if (button) button.disabled = false;
        }
      });
    }

    var linkGoogle = document.querySelector("[data-auth-link-google]");
    if (linkGoogle) {
      linkGoogle.addEventListener("click", async function () {
        try {
          await beginGoogleAuth("link");
        } catch (error) {
          showToast(error.message || "Google linking failed.");
        }
      });
    }

    var passwordForm = document.querySelector("[data-account-password-form]");
    if (passwordForm) {
      passwordForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        var currentPassword = String(passwordForm.elements.currentPassword.value || "");
        var newPassword = String(passwordForm.elements.newPassword.value || "");
        var confirmPassword = String(passwordForm.elements.confirmPassword.value || "");
        var status = passwordForm.querySelector("[data-password-change-status]");
        if (newPassword.length < 8) {
          authMessage(status, "Use at least 8 characters for the new password.", "error");
          return;
        }
        if (newPassword !== confirmPassword) {
          authMessage(status, "The new passwords do not match.", "error");
          return;
        }
        try {
          await authRequest("change-password", "POST", {
            currentPassword: currentPassword,
            newPassword: newPassword,
            revokeOtherSessions: true
          });
          passwordForm.reset();
          authMessage(status, "Password changed. Other active sessions were signed out.", "success");
        } catch (error) {
          authMessage(status, error.message || "Could not change your password.", "error");
        }
      });
    }

    var signOut = document.querySelector("[data-auth-signout]");
    if (signOut) {
      signOut.addEventListener("click", async function () {
        signOut.disabled = true;
        try {
          await authRequest("sign-out", "POST", {});
          updateAuthHeader(null);
          window.location.assign("/signin");
        } catch (error) {
          showToast(error.message || "Could not sign out.");
          signOut.disabled = false;
        }
      });
    }

    var revokeAll = document.querySelector("[data-auth-revoke-all]");
    if (revokeAll) {
      revokeAll.addEventListener("click", async function () {
        if (!window.confirm("Sign out all other active sessions?")) return;
        revokeAll.disabled = true;
        try {
          await authRequest("revoke-other-sessions", "POST", {});
          showToast("Other sessions have been revoked.");
          await loadAccountWorkspace();
        } catch (error) {
          showToast(error.code === "SESSION_NOT_FRESH"
            ? "Sign in again before managing active sessions."
            : error.message || "Could not revoke other sessions.");
        } finally {
          revokeAll.disabled = false;
        }
      });
    }
  }

  function bindGoogleButtons() {
    document.querySelectorAll("[data-auth-google]").forEach(function (button) {
      button.addEventListener("click", async function () {
        if (!authConfig || !authConfig.googleEnabled) return;
        button.disabled = true;
        try {
          await beginGoogleAuth(button.getAttribute("data-auth-google-mode") || "signin");
        } catch (error) {
          showToast(error.message || "Google sign-in could not start.");
          button.disabled = false;
        }
      });
    });
  }

  async function initializeAccountSystem() {
    bindAuthForms();
    bindGoogleButtons();
    bindAccountControls();
    await refreshAuthHeader();
    try {
      authConfig = await authRequest("config");
      setAccountConfig(authConfig);
    } catch (_e) {
      authConfig = null;
      setAccountConfig(null);
    }
    if (document.querySelector("[data-account-workspace]")) {
      await loadAccountWorkspace();
    }
  }

  initializeAccountSystem();
})();
`;