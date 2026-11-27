export const MARKETING_JS = `(function () {
  "use strict";

  var root = document.documentElement;
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function isMotionReduced() {
    return prefersReducedMotion.matches || root.getAttribute("data-motion") === "paused";
  }

  var locMatch = window.location.pathname.match(/^\\/(en|ar|fr|es|de|pt|zh|ja)(\\/.*)?$/);
  var currentLocale = locMatch ? locMatch[1] : (root.getAttribute("lang") || "en");
  var currentPath = locMatch ? (locMatch[2] || "/") : window.location.pathname;
  var isArabicPage = currentLocale === "ar" || root.getAttribute("lang") === "ar";

  function tMap(dict) {
    if (!dict) return "";
    return dict[currentLocale] || dict[root.getAttribute("lang") || "en"] || dict.en || "";
  }

  function tx(en, ar, extra) {
    if (extra && extra[currentLocale]) return extra[currentLocale];
    return isArabicPage ? ar : en;
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

  var systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  function getActiveTheme() {
    var saved = null;
    try { saved = localStorage.getItem("ef_theme"); } catch (_e) {}
    if (saved === "dark" || saved === "light" || saved === "system") return saved;
    return "system";
  }

  function applyTheme(theme, persist) {
    var resolvedTheme = theme === "system" ? (systemTheme.matches ? "dark" : "light") : theme;
    root.setAttribute("data-theme", resolvedTheme);
    root.setAttribute("data-theme-preference", theme);
    if (themeMeta) {
      themeMeta.setAttribute("content", resolvedTheme === "dark" ? "#0A101D" : "#FBFCFE");
    }
    if (persist) {
      try { localStorage.setItem("ef_theme", theme); } catch (_e) {}
    }
    var isDark = resolvedTheme === "dark";
    themeToggles.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(isDark));
      var nextThemeLabel = theme === "light"
        ? tMap({ en: "Switch to dark theme", ar: "التبديل إلى المظهر الداكن", fr: "Passer au thème sombre", es: "Cambiar al tema oscuro", de: "Zum dunklen Design wechseln", pt: "Mudar para o tema escuro", zh: "切换到深色主题", ja: "ダークテーマに切り替え" })
        : theme === "dark"
          ? tMap({ en: "Use system theme", ar: "استخدام مظهر النظام", fr: "Utiliser le thème système", es: "Usar el tema del sistema", de: "Systemdesign verwenden", pt: "Usar o tema do sistema", zh: "使用系统主题", ja: "システムテーマを使用" })
          : tMap({ en: "Switch to light theme", ar: "التبديل إلى المظهر الفاتح", fr: "Passer au thème clair", es: "Cambiar al tema claro", de: "Zum hellen Design wechseln", pt: "Mudar para o tema claro", zh: "切换到浅色主题", ja: "ライトテーマに切り替え" });
      btn.setAttribute("aria-label", nextThemeLabel);
      btn.setAttribute("title", nextThemeLabel);
      var sun = btn.querySelector("[data-icon-sun]");
      var moon = btn.querySelector("[data-icon-moon]");
      if (sun) sun.hidden = !isDark;
      if (moon) moon.hidden = isDark;
    });
  }

  applyTheme(getActiveTheme(), false);

  systemTheme.addEventListener("change", function () {
    if (root.getAttribute("data-theme-preference") === "system") applyTheme("system", false);
  });

  themeToggles.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var currentPreference = root.getAttribute("data-theme-preference") || "system";
      var next = currentPreference === "light" ? "dark" : currentPreference === "dark" ? "system" : "light";
      applyTheme(next, true);
      showToast(next === "system"
        ? tMap({ en: "Following system appearance", ar: "اتباع مظهر النظام", fr: "Apparence système activée", es: "Se usa la apariencia del sistema", de: "Systemdarstellung aktiviert", pt: "Aparência do sistema ativada", zh: "已跟随系统外观", ja: "システムの外観に従います" })
        : next === "light"
          ? tMap({ en: "Light theme active", ar: "المظهر الفاتح مفعّل", fr: "Thème clair actif", es: "Tema claro activo", de: "Helles Design aktiv", pt: "Tema claro ativo", zh: "浅色主题已启用", ja: "ライトテーマ有効" })
          : tMap({ en: "Dark theme active", ar: "المظهر الداكن مفعّل", fr: "Thème sombre actif", es: "Tema oscuro activo", de: "Dunkles Design aktiv", pt: "Tema escuro ativo", zh: "深色主题已启用", ja: "ダークテーマ有効" }));
    });
  });

  /* ========================================================================
     4. Ambient Motion Pause Control
     ======================================================================== */
  var motionToggles = document.querySelectorAll("[data-motion-toggle]");
  function syncMotionState(paused) {
    if (paused) {
      root.setAttribute("data-motion", "paused");
      document.querySelectorAll("[data-reveal]").forEach(function (el) {
        el.classList.add("is-visible");
      });
      document.querySelectorAll("[data-timeline-step]").forEach(function (el) {
        el.classList.add("is-active");
      });
    } else {
      root.removeAttribute("data-motion");
    }
    motionToggles.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(paused));
      var label = btn.querySelector("[data-motion-label]");
      if (label) label.textContent = paused
        ? tMap({ en: "Resume motion", ar: "استئناف الحركة", fr: "Reprendre l'animation", es: "Reanudar movimiento", de: "Bewegung fortsetzen", pt: "Retomar movimento", zh: "恢复动效", ja: "モーションを再開" })
        : tMap({ en: "Pause motion", ar: "إيقاف الحركة", fr: "Mettre en pause", es: "Pausar movimiento", de: "Bewegung pausieren", pt: "Pausar movimento", zh: "暂停动效", ja: "モーションを停止" });
    });
  }

  if (prefersReducedMotion.matches) {
    syncMotionState(true);
  }

  motionToggles.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var nextPaused = root.getAttribute("data-motion") !== "paused";
      syncMotionState(nextPaused);
      showToast(nextPaused
        ? tMap({ en: "Ambient motion paused", ar: "تم إيقاف الحركة المحيطية", fr: "Animation mise en pause", es: "Movimiento ambiental pausado", de: "Bewegung pausiert", pt: "Movimento pausado", zh: "环境动效已暂停", ja: "モーションを一時停止しました" })
        : tMap({ en: "Ambient motion resumed", ar: "تم استئناف الحركة المحيطية", fr: "Animation reprise", es: "Movimiento ambiental reanudado", de: "Bewegung fortgesetzt", pt: "Movimento retomado", zh: "环境动效已恢复", ja: "モーションを再開しました" }));
    });
  });

  /* ========================================================================
     5. Keyboard-Navigable Language Switcher + RTL Route Switch
     ======================================================================== */
  function navigateLocale(nextLocale) {
    if (nextLocale === currentLocale) return;
    var suffix = (window.location.search || "") + (window.location.hash || "");
    var target = (nextLocale === "en"
      ? currentPath
      : "/" + nextLocale + (currentPath === "/" ? "" : currentPath)) + suffix;
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
          // Ignore a stale opening frame if Escape or another control closed the drawer.
          if (menuBtn.getAttribute("aria-expanded") !== "true") return;
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

    // Handle Escape at document level, including while the opening animation is pending.
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || menuBtn.getAttribute("aria-expanded") !== "true") return;
      e.preventDefault();
      setDrawerOpen(false);
      menuBtn.focus();
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
  var mobileStickyCta = document.querySelector(".ef-mobile-sticky-cta");
  if (mobileStickyCta && heroSection) {
    var mobileViewport = window.matchMedia("(max-width: 767px)");
    var syncMobileCta = function () {
      var isVisible = mobileViewport.matches && heroSection.getBoundingClientRect().bottom <= 0;
      mobileStickyCta.classList.toggle("is-visible", isVisible);
      mobileStickyCta.setAttribute("aria-hidden", String(!isVisible));
      mobileStickyCta.inert = !isVisible;
    };
    syncMobileCta();
    window.addEventListener("scroll", syncMobileCta, { passive: true });
    mobileViewport.addEventListener("change", syncMobileCta);
  }

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
      nodes.forEach(function (n) {
        var nid = n.getAttribute("data-graph-node");
        n.setAttribute("aria-pressed", String(Boolean(activeKey && nid === activeKey)));
      });
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
      node.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          applyDetails(nodesMeta[id], id);
        }
      });
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
    var inspIcons = inspector ? inspector.querySelectorAll("[data-step-insp-icon]") : [];
    var manualSelectedStep = null;

    function renderInspectorStep(index) {
      var spec = stepSpecs[index];
      if (!spec || !inspector) return;
      if (inspIdx) inspIdx.textContent = tMap({
        en: "STEP ", ar: "المرحلة ", fr: "ÉTAPE ", es: "PASO ", de: "SCHRITT ", pt: "ETAPA ", zh: "步骤 ", ja: "ステップ "
      }) + spec.index;
      if (inspTitle) inspTitle.textContent = spec.phase;
      if (inspDesc) inspDesc.textContent = spec.summary;
      if (inspModule) inspModule.textContent = spec.module;
      if (inspGuard) inspGuard.textContent = spec.guard;
      inspIcons.forEach(function (iconWrap) {
        iconWrap.hidden = Number(iconWrap.getAttribute("data-step-insp-icon")) !== index;
      });
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
        statusText: "ILLUSTRATIVE · state: rejected · HTTP 400 · 0 external calls",
        adapterText: "code: URL_NOT_ALLOWED",
        isWarn: true,
        tokens: [
          { cls: "ef-tok-dim", text: "// Private and reserved destinations are blocked before outbound HTTP\\n" },
          { cls: "ef-tok-punc", text: "{\\n  " },
          { cls: "ef-tok-key", text: '"state"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-str", text: '"failed"' },
          { cls: "ef-tok-punc", text: ",\\n  " },
          { cls: "ef-tok-key", text: '"errors"' },
          { cls: "ef-tok-punc", text: ": [{ " },
          { cls: "ef-tok-key", text: '"code"' },
          { cls: "ef-tok-punc", text: ": " },
          { cls: "ef-tok-str", text: '"URL_NOT_ALLOWED"' },
          { cls: "ef-tok-punc", text: " }]\\n}" }
        ],
        raw: JSON.stringify({
          state: "failed",
          execution: { path: null, adapterId: null },
          errors: [{ code: "URL_NOT_ALLOWED" }]
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

    var tabBtnList = Array.prototype.slice.call(tabBtns);
    function activateCodeTab(tab) {
      activeTabKey = tab.getAttribute("data-code-tab") || "request";
      tabBtnList.forEach(function (b) {
        var selected = b === tab;
        b.setAttribute("aria-selected", String(selected));
        b.setAttribute("tabindex", selected ? "0" : "-1");
      });
      runTypewriter();
    }

    tabBtnList.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        activateCodeTab(tab);
      });
      tab.addEventListener("keydown", function (e) {
        var isRtl = root.getAttribute("dir") === "rtl";
        var nextKey = isRtl ? "ArrowLeft" : "ArrowRight";
        var prevKey = isRtl ? "ArrowRight" : "ArrowLeft";
        var targetIndex = null;
        if (e.key === nextKey) targetIndex = (index + 1) % tabBtnList.length;
        else if (e.key === prevKey) targetIndex = (index - 1 + tabBtnList.length) % tabBtnList.length;
        else if (e.key === "Home") targetIndex = 0;
        else if (e.key === "End") targetIndex = tabBtnList.length - 1;
        if (targetIndex === null) return;
        e.preventDefault();
        tabBtnList[targetIndex].focus();
        activateCodeTab(tabBtnList[targetIndex]);
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
      var copyTextEl = copyBtn.querySelector("[data-copy-label]");
      var initialCopyLabel = copyTextEl ? copyTextEl.textContent : tMap({ en: "Copy", ar: "نسخ", fr: "Copier", es: "Copiar", de: "Kopieren", pt: "Copiar", zh: "复制", ja: "コピー" });
      copyBtn.addEventListener("click", function () {
        var payload = PAYLOADS[activeTabKey] || PAYLOADS.request;
        var finish = function () {
          copyBtn.classList.add("is-copied");
          var textEl = copyBtn.querySelector("[data-copy-label]");
          var iconCopy = copyBtn.querySelector("[data-icon-copy]");
          var iconCheck = copyBtn.querySelector("[data-icon-check]");
          if (textEl) textEl.textContent = tMap({ en: "Copied", ar: "تم النسخ", fr: "Copié", es: "Copiado", de: "Kopiert", pt: "Copiado", zh: "已复制", ja: "コピー済み" });
          if (iconCopy) iconCopy.hidden = true;
          if (iconCheck) iconCheck.hidden = false;
          showToast(tMap({ en: "Copied example JSON to clipboard", ar: "تم نسخ مثال JSON إلى الحافظة", fr: "Exemple JSON copié", es: "JSON de ejemplo copiado", de: "Beispiel-JSON kopiert", pt: "JSON de exemplo copiado", zh: "示例 JSON 已复制", ja: "サンプルJSONをコピーしました" }));
          setTimeout(function () {
            copyBtn.classList.remove("is-copied");
            if (textEl) textEl.textContent = initialCopyLabel;
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

      var nEl = setFieldError("name", nameVal.length < 2
        ? tMap({ en: "Please enter your name (at least 2 characters).", ar: "يرجى إدخال الاسم (حرفان على الأقل).", fr: "Veuillez saisir votre nom (au moins 2 caractères).", es: "Ingresa tu nombre (al menos 2 caracteres).", de: "Bitte gib deinen Namen ein (mindestens 2 Zeichen).", pt: "Digite seu nome (pelo menos 2 caracteres).", zh: "请输入您的姓名（至少 2 个字符）。", ja: "お名前を入力してください（2文字以上）。" })
        : "");
      if (nameVal.length < 2 && !firstInvalid) firstInvalid = nEl;

      var emailOk = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(emailVal);
      var eEl = setFieldError("email", emailOk ? ""
        : tMap({ en: "Please enter a valid email address.", ar: "يرجى إدخال عنوان بريد إلكتروني صالح.", fr: "Veuillez saisir une adresse e-mail valide.", es: "Ingresa una dirección de correo válida.", de: "Bitte gib eine gültige E-Mail-Adresse ein.", pt: "Digite um endereço de e-mail válido.", zh: "请输入有效的电子邮箱地址。", ja: "有効なメールアドレスを入力してください。" }));
      if (!emailOk && !firstInvalid) firstInvalid = eEl;

      var sEl = setFieldError("subject", subjectVal ? ""
        : tMap({ en: "Please select an inquiry type.", ar: "يرجى اختيار نوع الاستفسار.", fr: "Veuillez choisir un type de demande.", es: "Selecciona un tipo de consulta.", de: "Bitte wähle eine Anfrageart aus.", pt: "Selecione um tipo de solicitação.", zh: "请选择咨询类型。", ja: "お問い合わせ種別を選択してください。" }));
      if (!subjectVal && !firstInvalid) firstInvalid = sEl;

      var mEl = setFieldError("message", messageVal.length < 10
        ? tMap({ en: "Please include at least 10 characters in your message.", ar: "يرجى كتابة 10 أحرف على الأقل في رسالتك.", fr: "Veuillez saisir au moins 10 caractères dans votre message.", es: "Incluye al menos 10 caracteres en tu mensaje.", de: "Bitte gib mindestens 10 Zeichen in deiner Nachricht ein.", pt: "Inclua pelo menos 10 caracteres na sua mensagem.", zh: "请在消息中至少输入 10 个字符。", ja: "メッセージは10文字以上で入力してください。" })
        : "");
      if (messageVal.length < 10 && !firstInvalid) firstInvalid = mEl;

      if (consentEl && !consentEl.checked) {
        setFieldError("consent", tMap({ en: "Please confirm you understand how these details are used.", ar: "يرجى تأكيد فهمك لكيفية استخدام هذه البيانات.", fr: "Veuillez confirmer que vous comprenez l'utilisation de ces données.", es: "Confirma que entiendes cómo se usan estos datos.", de: "Bitte bestätige, wie diese Angaben verwendet werden.", pt: "Confirme que entende como esses dados serão usados.", zh: "请确认您了解这些信息的使用方式。", ja: "情報の取り扱いをご確認のうえ同意してください。" }));
        if (!firstInvalid) firstInvalid = consentEl;
      } else {
        setFieldError("consent", "");
      }

      if (firstInvalid) {
        statusBanner.dataset.state = "error";
        statusBanner.textContent = tMap({ en: "Please review the highlighted fields above.", ar: "يرجى مراجعة الحقول المظللة أعلاه.", fr: "Veuillez vérifier les champs en surbrillance.", es: "Revisa los campos resaltados arriba.", de: "Bitte prüfe die markierten Felder.", pt: "Revise os campos destacados acima.", zh: "请检查上方高亮显示的字段。", ja: "強調表示された項目を確認してください。" });
        firstInvalid.focus();
        return;
      }

      var mailtoBody = [
        "Name: " + nameVal,
        "Reply-to: " + emailVal,
        "Inquiry type: " + subjectVal,
        "",
        messageVal
      ].join("\\n");
      var mailtoUrl = "mailto:hhameranede@gmail.com?subject=" +
        encodeURIComponent("[ExportFlow] " + subjectVal) +
        "&body=" + encodeURIComponent(mailtoBody);

      statusBanner.dataset.state = "info";
      statusBanner.textContent = tMap({ en: "Review and send the email draft in your email app.", ar: "راجع مسودة البريد وأرسلها عبر تطبيق البريد لديك.", fr: "Vérifiez et envoyez le brouillon dans votre client e-mail.", es: "Revisa y envía el borrador en tu aplicación de correo.", de: "Prüfe und sende den Entwurf in deiner E-Mail-App.", pt: "Revise e envie o rascunho no seu app de e-mail.", zh: "请在您的邮件应用中检查并发送草稿。", ja: "メールアプリで下書きを確認して送信してください。" });
      window.location.href = mailtoUrl;
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
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\\"": "&quot;", "'": "&#39;" })[char];
    });
  }

  function signedOAuthQueryFromLocation() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      var names = params.getAll("ba_param");
      if (!params.has("sig") || !names.length) return null;
      var signed = new Set(["sig", "ba_param"].concat(names));
      var result = new URLSearchParams();
      params.forEach(function (value, key) {
        if (signed.has(key)) result.append(key, value);
      });
      return result.toString();
    } catch (_e) {
      return null;
    }
  }

  async function authRequest(path, method, payload) {
    var requestMethod = String(method || "GET").toUpperCase();
    var carriesOAuthFlow = /^(sign-in\\/|sign-up\\/|oauth2\\/)/.test(String(path || ""));
    if (carriesOAuthFlow && payload && typeof payload === "object" && !Array.isArray(payload) &&
        requestMethod !== "GET" && requestMethod !== "DELETE") {
      var oauthQuery = signedOAuthQueryFromLocation();
      if (oauthQuery && !payload.oauth_query) {
        payload = Object.assign({}, payload, { oauth_query: oauthQuery });
      }
    }
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
      var requestError = new Error(typeof message === "string" ? message : tx("The account service could not complete this request.", "تعذر على خدمة الحساب إتمام هذا الطلب."));
      requestError.status = response.status;
      requestError.code = data && (data.code || data.errorCode || data.error && typeof data.error === "object" && data.error.code) || null;
      throw requestError;
    }
    return data;
  }

  function matchesSignedOAuthCallback(destination) {
    var signedQuery = signedOAuthQueryFromLocation();
    if (!signedQuery) return false;
    var requestedRedirect = new URLSearchParams(signedQuery).get("redirect_uri");
    if (!requestedRedirect) return false;

    try {
      var callback = new URL(requestedRedirect);
      if (destination.protocol !== callback.protocol ||
          destination.host !== callback.host ||
          destination.pathname !== callback.pathname ||
          destination.hash !== callback.hash) return false;
      for (var pair of callback.searchParams.entries()) {
        if (!destination.searchParams.getAll(pair[0]).includes(pair[1])) return false;
      }
      return true;
    } catch (_e) {
      return false;
    }
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
        if (sameOrigin || googleOrigin || matchesSignedOAuthCallback(parsed)) {
          window.location.assign(parsed.href);
          return;
        }
      } catch (_e) {}
    }
    window.location.assign("/account");
  }

  function authGoToOAuth(url) {
    if (typeof url !== "string") throw new Error("The authorization server returned an invalid redirect.");
    var destination;
    try { destination = new URL(url, window.location.origin); }
    catch (_e) { throw new Error("The authorization server returned an invalid redirect."); }

    if (destination.origin === window.location.origin) {
      window.location.assign(destination.href);
      return;
    }

    if (!matchesSignedOAuthCallback(destination)) {
      throw new Error("The authorization server returned a redirect that does not match the registered callback.");
    }
    window.location.assign(destination.href);
  }

  var currentAuthUser = null;

  function localeHref(path) {
    var lang = root.getAttribute("lang") || "en";
    if (lang === "en") return path;
    return "/" + lang + (path === "/" ? "" : path);
  }

  function getSafeNextPath(fallbackPath) {
    var fallback = fallbackPath || localeHref("/account");
    try {
      var nextParam = new URLSearchParams(window.location.search || "").get("next");
      if (!nextParam || nextParam.charAt(0) !== "/" || nextParam.indexOf("//") === 0) return fallback;
      var parsed = new URL(nextParam, window.location.origin);
      if (parsed.origin !== window.location.origin) return fallback;
      return parsed.pathname + parsed.search + parsed.hash;
    } catch (_e) {
      return fallback;
    }
  }

  function preserveNextLinks() {
    var nextParam = new URLSearchParams(window.location.search || "").get("next");
    if (!nextParam) return;
    document.querySelectorAll("[data-auth-preserve-next]").forEach(function (link) {
      try {
        var url = new URL(link.getAttribute("href"), window.location.origin);
        url.searchParams.set("next", nextParam);
        link.setAttribute("href", url.pathname + url.search);
      } catch (_e) {}
    });
  }

  function applyAuthGateState(user) {
    var unlocked = Boolean(user && user.id);
    document.querySelectorAll('[data-requires-auth="true"]').forEach(function (shell) {
      shell.setAttribute("data-auth-locked", unlocked ? "false" : "true");
      var gate = shell.querySelector("[data-auth-gate]");
      var content = shell.querySelector("[data-auth-gate-content]");
      if (gate) gate.hidden = unlocked;
      if (content) {
        if (unlocked) {
          content.removeAttribute("aria-hidden");
          content.removeAttribute("inert");
        } else {
          content.setAttribute("aria-hidden", "true");
          content.setAttribute("inert", "");
        }
      }
    });
  }

  function populateAccountIdentity(container, user) {
    if (!container || !user) return;
    var avatar = container.querySelector("[data-account-avatar]");
    var displayName = container.querySelector("[data-account-display-name]");
    var emailText = container.querySelector("[data-account-email-text]");
    var emailBadge = container.querySelector("[data-account-email-badge]");
    var sourceName = String(user.name || user.email || "EF").trim();
    if (avatar) {
      var parts = sourceName.split(/\\s+/).filter(Boolean);
      var initials = parts.length >= 2
        ? (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
        : sourceName.slice(0, 2).toUpperCase();
      avatar.textContent = initials || "EF";
    }
    if (displayName) displayName.textContent = user.name || user.email || tx("Account", "الحساب");
    if (emailText) emailText.textContent = user.email || "";
    if (emailBadge) {
      var verified = user.emailVerified === true;
      emailBadge.className = "ef-badge " + (verified ? "ef-badge-available" : "ef-badge-dev");
      emailBadge.textContent = verified ? tx("Verified", "بريد مؤكد") : tx("Verification pending", "بانتظار التأكيد");
    }
  }

  function updateAuthHeader(user) {
    currentAuthUser = user || null;
    var link = document.querySelector("[data-auth-header-link]");
    var workspaceLink = document.querySelector("[data-auth-workspace-link]");
    var headerSignout = document.querySelector("[data-auth-header-signout]");
    var drawerWorkspace = document.querySelector("[data-auth-drawer-workspace]");
    var drawerSignin = document.querySelector("[data-auth-drawer-signin]");
    var drawerAccount = document.querySelector("[data-auth-drawer-account]");
    var drawerSignout = document.querySelector("[data-auth-drawer-signout]");

    if (link) {
      if (user) {
        link.setAttribute("href", link.getAttribute("data-account-href") || localeHref("/account"));
        link.textContent = user.name || user.email || tx("Account", "الحساب");
      } else {
        link.setAttribute("href", link.getAttribute("data-signin-href") || localeHref("/signin"));
        link.textContent = link.getAttribute("data-signin-label") || tx("Sign in", "تسجيل الدخول");
      }
    }
    if (workspaceLink) workspaceLink.hidden = !user;
    if (headerSignout) headerSignout.hidden = !user;
    if (drawerWorkspace) drawerWorkspace.hidden = !user;
    if (drawerSignin) drawerSignin.hidden = Boolean(user);
    if (drawerAccount) drawerAccount.hidden = !user;
    if (drawerSignout) drawerSignout.hidden = !user;

    applyAuthGateState(user);
  }

  async function refreshAuthHeader() {
    try {
      var response = await authRequest("get-session");
      updateAuthHeader(response && response.user ? response.user : null);
      return response && response.user ? response.user : null;
    } catch (_e) {
      updateAuthHeader(null);
      return null;
    }
  }

  function setAccountConfig(config) {
    var googleAllowed = Boolean(config && config.googleEnabled);
    document.querySelectorAll("[data-auth-google]").forEach(function (button) {
      var mode = button.getAttribute("data-auth-google-mode");
      button.disabled = !googleAllowed;
      button.hidden = !googleAllowed;
      if (mode === "link") button.hidden = !googleAllowed;
    });

    document.querySelectorAll("[data-auth-google-divider]").forEach(function (divider) {
      divider.hidden = !googleAllowed;
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
      authMessage(status, tx(
        "Account services are not connected yet. The sign-in page is ready, but no account can be created until the server database and secret are configured.",
        "خدمات الحساب غير متصلة بعد حتى يتم ربط قاعدة البيانات والمفتاح السري للخادم."
      ), "warning");
    } else if (!config.authReady) {
      authMessage(status, tx(
        "The account database is connected, but its authentication tables are not initialized yet. Sign-in stays disabled until setup is complete.",
        "قاعدة البيانات متصلة لكن جداول المصادقة لم تُهيأ بعد."
      ), "warning");
    } else if (!config.googleEnabled && !config.emailPasswordEnabled) {
      authMessage(status, tx(
        "Authentication is configured on the server, but no sign-in provider is enabled yet.",
        "المصادقة مهيأة على الخادم لكن لا يوجد مزود تسجيل دخول مفعّل بعد."
      ), "warning");
    } else if (!config.emailPasswordEnabled) {
      authMessage(status, tx(
        "Google sign-in is available. Email/password stays disabled until verified transactional email delivery is configured.",
        "تسجيل الدخول عبر Google متاح. الدخول بالبريد الإلكتروني معطل حالياً."
      ), "success");
    } else {
      authMessage(status, tx("Secure account services are available.", "خدمات الحساب الآمنة جاهزة ومتاحة."), "success");
    }

    var passwordForm = document.querySelector("[data-account-password-form]");
    if (passwordForm) passwordForm.hidden = !Boolean(config && config.emailPasswordEnabled);

    var linkGoogle = document.querySelector("[data-auth-link-google]");
    if (linkGoogle) {
      linkGoogle.disabled = !googleAllowed;
      linkGoogle.hidden = !googleAllowed;
    }
  }

  async function beginGoogleAuth(mode) {
    var nextDest = getSafeNextPath(localeHref("/account"));
    var data = await authRequest(mode === "link" ? "link-social" : "sign-in/social", "POST", {
      provider: "google",
      callbackURL: window.location.origin + nextDest,
      disableRedirect: true
    });
    if (data && data.url) {
      authGoTo(data.url);
      return;
    }
    if (mode === "link") {
      showToast(tx("Google account linked.", "تم ربط حساب Google."));
      await loadAccountWorkspace();
      return;
    }
    authGoTo(nextDest);
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
    var rememberMe = form.elements.rememberMe ? Boolean(form.elements.rememberMe.checked) : true;
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
      fail("email", tx("Enter a valid email address.", "أدخل بريداً إلكترونياً صالحاً."));
    }
    if (mode === "signin" || mode === "signup") {
      if (password.length < 8) fail("password", tx("Use at least 8 characters.", "استعمل 8 أحرف على الأقل."));
    }
    if (mode === "signup" && name.length < 2) {
      fail("name", tx("Enter your full name.", "أدخل اسمك الكامل."));
    }
    if (mode === "reset") {
      var newPassword = form.elements.password ? String(form.elements.password.value || "") : "";
      var confirmPassword = form.elements.confirmPassword ? String(form.elements.confirmPassword.value || "") : "";
      if (newPassword.length < 8) fail("password", tx("Use at least 8 characters.", "استعمل 8 أحرف على الأقل."));
      if (confirmPassword !== newPassword) fail("confirmPassword", tx("Passwords do not match.", "كلمتا المرور غير متطابقتين."));
      if (!new URLSearchParams(window.location.search).get("token")) {
        fail("password", tx("This reset link is incomplete or expired. Request a new one.", "رابط الاسترداد غير مكتمل أو منتهي الصلاحية. اطلب رابطاً جديداً."));
      }
    }
    if (firstInvalid) firstInvalid.focus();
    return {
      ok: !firstInvalid,
      email: email,
      password: password,
      name: name,
      rememberMe: rememberMe
    };
  }

  function bindPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-password-toggle");
        var input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;
        var nextType = input.type === "password" ? "text" : "password";
        input.type = nextType;
        var visible = nextType === "text";
        btn.setAttribute("aria-pressed", String(visible));
        btn.setAttribute("aria-label", visible ? tx("Hide password", "إخفاء كلمة المرور") : tx("Show password", "إظهار كلمة المرور"));
        var eyeOpen = btn.querySelector("[data-eye-open]");
        var eyeClosed = btn.querySelector("[data-eye-closed]");
        if (eyeOpen) eyeOpen.hidden = visible;
        if (eyeClosed) eyeClosed.hidden = !visible;
      });
    });
  }

  function scorePassword(value) {
    if (!value) return 0;
    var score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
    return Math.max(1, Math.min(4, score));
  }

  function bindStrengthMeters() {
    document.querySelectorAll("[data-strength-meter]").forEach(function (meter) {
      var targetId = meter.getAttribute("data-strength-meter");
      var input = targetId ? document.getElementById(targetId) : null;
      var label = meter.querySelector("[data-strength-label]");
      if (!input) return;
      var labels = [
        tx("Use 8+ characters with uppercase, numbers, or symbols", "استخدم 8+ أحرف مع أحرف كبيرة وأرقام أو رموز"),
        tx("Weak — add length and numbers", "ضعيفة — أضف طولاً وأرقاماً"),
        tx("Fair — add symbols or uppercase", "متوسطة — أضف رموزاً أو أحرفاً كبيرة"),
        tx("Good password strength", "قوة كلمة مرور جيدة"),
        tx("Strong password", "كلمة مرور قوية"),
      ];
      input.addEventListener("input", function () {
        var val = String(input.value || "");
        var score = val.length === 0 ? 0 : scorePassword(val);
        meter.setAttribute("data-score", String(score));
        if (label) label.textContent = labels[score] || labels[0];
      });
    });
  }

  async function checkDevMailbox(email, kind) {
    if (!authConfig || !authConfig.localMailboxEnabled || !email) return false;
    var box = document.querySelector("[data-dev-mailbox-box]");
    if (!box) return false;
    try {
      var res = await authRequest("dev-mailbox?email=" + encodeURIComponent(email) + "&kind=" + encodeURIComponent(kind || ""));
      if (!res || !res.hasMessage || !res.actionPath) {
        box.hidden = true;
        return false;
      }
      var subjectEl = box.querySelector("[data-dev-mailbox-subject]");
      var descEl = box.querySelector("[data-dev-mailbox-desc]");
      var linkEl = box.querySelector("[data-dev-mailbox-link]");
      if (subjectEl) subjectEl.textContent = res.subject || tx("Verification link ready", "الرابط الآمن جاهز");
      if (descEl) {
        descEl.textContent = res.kind === "reset"
          ? tx("Click below to set a new password for " + email + ".", "اضغط أدناه لتعيين كلمة مرور جديدة للحساب " + email + ".")
          : tx("Click below to verify " + email + " and sign in automatically.", "اضغط أدناه لتفعيل البريد " + email + " وتسجيل الدخول مباشرة.");
      }
      if (linkEl) {
        linkEl.setAttribute("href", res.actionPath);
        linkEl.textContent = res.kind === "reset"
          ? tx("Open password reset link", "فتح رابط إعادة تعيين كلمة المرور")
          : tx("Verify email & continue", "تفعيل البريد والمتابعة");
      }
      box.hidden = false;
      return true;
    } catch (_e) {
      return false;
    }
  }

  function promptTwoFactorInline(form, banner, nextDest) {
    var existing = document.querySelector("[data-signin-totp-form]");
    if (existing) existing.remove();
    var totpForm = document.createElement("form");
    totpForm.className = "ef-auth-form ef-mt-12";
    totpForm.setAttribute("data-signin-totp-form", "true");
    totpForm.innerHTML =
      '<div class="ef-field"><label for="signin-totp-code">' + escapeAuthText(tx("Authenticator 6-digit code", "رمز المصادقة السداسي")) + '</label>' +
      '<input id="signin-totp-code" class="ef-ltr-input" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></div>' +
      '<button type="submit" class="ef-btn ef-btn-primary ef-btn-full"><span>' + escapeAuthText(tx("Verify & sign in", "تحقق وسجّل الدخول")) + '</span></button>';
    form.hidden = true;
    form.parentNode.insertBefore(totpForm, form.nextSibling);
    totpForm.querySelector("input").focus();
    totpForm.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var code = String(totpForm.elements.code.value || "").trim();
      try {
        await authRequest("two-factor/verify-totp", "POST", { code: code, trustDevice: true });
        authGoTo(nextDest);
      } catch (err) {
        showToast(err && err.message ? err.message : tx("Invalid authenticator code.", "رمز التحقق غير صحيح."));
      }
    });
  }

  function bindAuthForms() {
    var lastUnverifiedEmail = "";
    var resendWrap = document.querySelector("[data-resend-verify-wrap]");
    var resendBtn = document.querySelector("[data-resend-verify-btn]");
    if (resendBtn) {
      resendBtn.addEventListener("click", async function () {
        if (!lastUnverifiedEmail) return;
        resendBtn.disabled = true;
        try {
          await authRequest("send-verification-email", "POST", {
            email: lastUnverifiedEmail,
            callbackURL: window.location.origin + getSafeNextPath(localeHref("/account"))
          });
          showToast(tx("Verification link sent.", "تم إرسال رابط التفعيل."));
          await checkDevMailbox(lastUnverifiedEmail, "verify");
        } catch (err) {
          showToast(err && err.message ? err.message : tx("Could not resend verification email.", "تعذر إعادة إرسال رابط التفعيل."));
        } finally {
          resendBtn.disabled = false;
        }
      });
    }

    document.querySelectorAll("[data-auth-form]").forEach(function (form) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        var mode = form.getAttribute("data-auth-form");
        var values = validateAuthForm(form, mode);
        if (!values.ok) return;
        var banner = form.querySelector("[data-auth-form-status]");
        var submit = form.querySelector('button[type="submit"]');
        var nextDest = getSafeNextPath(localeHref("/account"));
        if (submit) submit.disabled = true;
        authMessage(banner, tx("Processing securely…", "جارٍ المعالجة بأمان…"));
        try {
          var result;
          if (mode === "signin") {
            result = await authRequest("sign-in/email", "POST", {
              email: values.email,
              password: values.password,
              rememberMe: values.rememberMe,
              callbackURL: window.location.origin + nextDest
            });
            if (result && result.twoFactorRedirect) {
              authMessage(banner, tx("Enter your authenticator code to finish signing in.", "أدخل رمز التحقق الثنائي لإكمال تسجيل الدخول."), "warning");
              promptTwoFactorInline(form, banner, nextDest);
              return;
            }
            if (result && result.url) {
              authGoTo(result.url);
              return;
            }
            authGoTo(nextDest);
            return;
          }
          if (mode === "signup") {
            await authRequest("sign-up/email", "POST", {
              name: values.name,
              email: values.email,
              password: values.password,
              callbackURL: window.location.origin + nextDest
            });
            var delivered = await checkDevMailbox(values.email, "verify");
            authMessage(
              banner,
              delivered
                ? tx("Account created! Click the verification button below to activate your account.", "تم إنشاء الحساب! اضغط زر التفعيل أدناه لتأكيد بريدك والدخول مباشرة.")
                : tx("Account created. Check your email and verify the address before signing in.", "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب قبل تسجيل الدخول."),
              "success"
            );
            showToast(tx("Verification link ready.", "رابط التفعيل جاهز."));
            form.reset();
            return;
          }
          if (mode === "forgot") {
            await authRequest("request-password-reset", "POST", {
              email: values.email,
              redirectTo: window.location.origin + localeHref("/reset-password")
            });
            var resetDelivered = await checkDevMailbox(values.email, "reset");
            authMessage(
              banner,
              resetDelivered
                ? tx("Password reset link ready below.", "رابط استرداد كلمة المرور جاهز أدناه.")
                : tx("If that address is registered, a secure password reset email will be sent.", "إذا كان البريد مسجلاً، فقد تم إرسال رابط استعادة كلمة المرور."),
              "success"
            );
            form.reset();
            return;
          }
          if (mode === "reset") {
            var token = new URLSearchParams(window.location.search).get("token");
            await authRequest("reset-password", "POST", {
              newPassword: values.password,
              token: token
            });
            authMessage(banner, tx("Password updated. Redirecting to sign in…", "تم تحديث كلمة المرور. جارٍ التحويل لتسجيل الدخول…"), "success");
            form.reset();
            setTimeout(function () { window.location.assign(localeHref("/signin")); }, 900);
          }
        } catch (error) {
          if (mode === "signin" && error && (error.code === "EMAIL_NOT_VERIFIED" || error.status === 403)) {
            lastUnverifiedEmail = values.email;
            if (resendWrap) resendWrap.hidden = false;
            await checkDevMailbox(values.email, "verify");
          }
          showFormError(form, error && error.message ? error.message : tx("The request failed. Try again.", "تعذر تنفيذ الطلب. حاول مجدداً."));
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
    title.textContent = currentSession ? tx("Current session", "الجلسة الحالية") : (session.userAgent || tx("Signed-in session", "جلسة مسجلة"));
    detail.textContent = session.expiresAt
      ? tx("Expires ", "تنتهي في ") + new Date(session.expiresAt).toLocaleString()
      : tx("Active session", "جلسة نشطة");
    info.appendChild(title);
    info.appendChild(detail);
    if (currentSession) {
      action.className = "ef-badge ef-badge-available";
      action.textContent = tx("This device", "هذا الجهاز");
    } else {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ef-code-btn";
      button.textContent = tx("Revoke", "إلغاء");
      button.addEventListener("click", async function () {
        try {
          if (!session.token) throw new Error(tx("Session identifier is unavailable.", "معرّف الجلسة غير متاح."));
          await authRequest("revoke-session", "POST", { token: session.token });
          showToast(tx("Session revoked.", "تم إلغاء الجلسة."));
          await loadAccountWorkspace();
        } catch (error) {
          showToast(error.code === "SESSION_NOT_FRESH"
            ? tx("Sign in again before managing active sessions.", "أعد تسجيل الدخول قبل إدارة الجلسات النشطة.")
            : error.message || tx("Could not revoke session.", "تعذر إلغاء الجلسة."));
        }
      });
      action.appendChild(button);
    }
    item.appendChild(info);
    item.appendChild(action);
    return item;
  }

  function showInlineConfirm(options) {
    var hostEl = options.hostEl;
    var triggerBtn = options.triggerBtn;
    if (!hostEl || !triggerBtn) return;
    var existing = hostEl.querySelector(".ef-inline-confirm");
    if (existing) existing.remove();

    var box = document.createElement("div");
    box.className = "ef-inline-confirm";
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", options.label || tx("Confirm action", "تأكيد الإجراء"));

    var promptText = document.createElement("span");
    promptText.textContent = options.message;

    var actions = document.createElement("div");
    actions.className = "ef-inline-confirm-actions";

    var confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "ef-btn-danger-sm";
    confirmBtn.textContent = options.confirmLabel || tx("Confirm", "تأكيد");

    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ef-code-btn";
    cancelBtn.textContent = options.cancelLabel || tx("Cancel", "إلغاء");

    function dismiss() {
      if (box.parentNode) box.parentNode.removeChild(box);
      triggerBtn.hidden = false;
      triggerBtn.disabled = false;
      triggerBtn.focus();
    }

    cancelBtn.addEventListener("click", dismiss);
    box.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    });
    confirmBtn.addEventListener("click", async function () {
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      try {
        await options.onConfirm();
      } finally {
        if (box.parentNode) box.parentNode.removeChild(box);
        if (document.body.contains(triggerBtn)) {
          triggerBtn.hidden = false;
          triggerBtn.disabled = false;
        }
      }
    });

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);
    box.appendChild(promptText);
    box.appendChild(actions);

    triggerBtn.hidden = true;
    hostEl.appendChild(box);
    cancelBtn.focus();
  }

  function makeAccountRow(account, canUnlink) {
    var item = document.createElement("li");
    item.className = "ef-session-row";
    var info = document.createElement("div");
    var title = document.createElement("strong");
    var detail = document.createElement("p");
    var action = document.createElement("span");
    title.textContent = account.providerId === "google" ? "Google" : (account.providerId || tx("Connected provider", "مزود متصل"));
    detail.textContent = account.accountId ? tx("Connected account", "حساب متصل") : tx("Connected identity", "هوية متصلة");
    info.appendChild(title);
    info.appendChild(detail);
    if (account.providerId === "google" && account.accountId && canUnlink) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ef-code-btn";
      button.textContent = tx("Disconnect", "فصل");
      button.addEventListener("click", function () {
        showInlineConfirm({
          hostEl: action,
          triggerBtn: button,
          label: tx("Confirm disconnecting Google account", "تأكيد فصل حساب Google"),
          message: tx("Disconnect Google sign-in?", "فصل تسجيل الدخول عبر Google؟"),
          confirmLabel: tx("Disconnect", "فصل"),
          onConfirm: async function () {
            try {
              await authRequest("unlink-account", "POST", {
                providerId: "google",
                accountId: account.accountId
              });
              showToast(tx("Google account disconnected.", "تم فصل حساب Google."));
              await loadAccountWorkspace();
            } catch (error) {
              showToast(error.message || tx("Could not disconnect the account.", "تعذر فصل الحساب."));
            }
          }
        });
      });
      action.appendChild(button);
    }
    item.appendChild(info);
    item.appendChild(action);
    return item;
  }

  async function refreshTwoFactorStatus(workspace) {
    if (!workspace) return;
    var status = workspace.querySelector("[data-two-factor-status]");
    var enableForm = workspace.querySelector("[data-two-factor-enable-form]");
    var enrollment = workspace.querySelector("[data-two-factor-enrollment]");
    try {
      var state = await authRequest("two-factor/status");
      var enabled = state && state.twoFactorEnabled === true;
      var verified = state && state.twoFactorVerified === true;
      if (enabled && verified) {
        if (enableForm) enableForm.hidden = true;
        if (enrollment) enrollment.hidden = true;
        authMessage(status, tx("Authenticator protection is enabled and verified. Platform administration still requires a fresh one-time TOTP check.", "حماية تطبيق المصادقة مفعّلة وموثقة."), "success");
      } else if (enabled) {
        if (enableForm) enableForm.hidden = true;
        if (enrollment) enrollment.hidden = false;
        var secret = workspace.querySelector("[data-two-factor-secret]");
        var backups = workspace.querySelector("[data-two-factor-backup-codes]");
        if (secret && !secret.textContent) secret.textContent = tx("The setup key was shown only once. Use the key you saved during enrollment.", "تم عرض مفتاح الإعداد مرة واحدة فقط عند التفعيل.");
        if (backups && !backups.childElementCount) {
          var notice = document.createElement("li");
          notice.className = "ef-session-row";
          notice.textContent = tx("Backup codes were shown only during enrollment. Keep your saved offline copy.", "عُرضت رموز الاسترداد مرة واحدة فقط. احتفظ بنسختك المحفوظة.");
          backups.appendChild(notice);
        }
        authMessage(status, tx("Authenticator enrollment is waiting for verification. Enter a current six-digit code to finish setup.", "التفعيل بانتظار التحقق. أدخل الرمز السداسي الحالي لإتمام الإعداد."), "warning");
      } else {
        if (enableForm) enableForm.hidden = false;
        if (enrollment) enrollment.hidden = true;
        authMessage(status, tx("Authenticator protection is not enabled yet.", "حماية تطبيق المصادقة غير مفعّلة بعد."), "warning");
      }
    } catch (error) {
      if (enableForm) enableForm.hidden = true;
      authMessage(status, error.message || tx("Authenticator status is temporarily unavailable.", "حالة المصادقة الثنائية غير متوفرة مؤقتاً."), "error");
    }
  }

  function bindTwoFactorControls(workspace) {
    if (!workspace) return;
    var enableForm = workspace.querySelector("[data-two-factor-enable-form]");
    var enrollment = workspace.querySelector("[data-two-factor-enrollment]");
    var status = workspace.querySelector("[data-two-factor-status]");
    var secretNode = workspace.querySelector("[data-two-factor-secret]");
    var backupList = workspace.querySelector("[data-two-factor-backup-codes]");
    var verifyForm = workspace.querySelector("[data-two-factor-verify-form]");
    var copySecret = workspace.querySelector("[data-two-factor-copy-secret]");

    if (enableForm) {
      enableForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        var button = enableForm.querySelector('button[type="submit"]');
        var password = String(enableForm.elements.password.value || "");
        if (button) button.disabled = true;
        try {
          var payload = { method: "totp" };
          if (password) payload.password = password;
          var result = await authRequest("two-factor/enable", "POST", payload);
          if (!result || result.method !== "totp" || typeof result.totpURI !== "string" ||
              !Array.isArray(result.backupCodes)) {
            throw new Error(tx("The authenticator setup response was incomplete.", "استجابة إعداد تطبيق المصادقة غير مكتملة."));
          }
          var parsed = new URL(result.totpURI);
          var secret = parsed.searchParams.get("secret");
          if (!secret) throw new Error(tx("The authenticator setup key could not be read.", "تعذر قراءة مفتاح إعداد المصادقة."));
          if (secretNode) secretNode.textContent = secret;
          if (backupList) {
            backupList.textContent = "";
            result.backupCodes.forEach(function (code) {
              var item = document.createElement("li");
              item.className = "ef-session-row";
              item.textContent = String(code);
              backupList.appendChild(item);
            });
          }
          if (enrollment) enrollment.hidden = false;
          enableForm.hidden = true;
          authMessage(status, tx("Save the setup key and backup codes offline, then verify one current authenticator code.", "احفظ مفتاح الإعداد ورموز الاسترداد بأمان، ثم أدخل رمز المصادقة الحالي للتفعيل."), "warning");
          enableForm.reset();
        } catch (error) {
          authMessage(workspace.querySelector("[data-two-factor-enable-message]"), error.message || tx("Could not start authenticator setup.", "تعذر بدء إعداد المصادقة الثنائية."), "error");
        } finally {
          if (button) button.disabled = false;
        }
      });
    }

    if (verifyForm) {
      verifyForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        var code = String(verifyForm.elements.code.value || "").trim();
        var button = verifyForm.querySelector('button[type="submit"]');
        if (!/^[0-9]{6}$/.test(code)) {
          authMessage(workspace.querySelector("[data-two-factor-verify-message]"), tx("Enter the current six-digit code.", "أدخل الرمز السداسي الحالي."), "error");
          return;
        }
        if (button) button.disabled = true;
        try {
          await authRequest("two-factor/verify-totp", "POST", { code: code, trustDevice: false });
          verifyForm.reset();
          await refreshTwoFactorStatus(workspace);
          if (secretNode) secretNode.textContent = "";
          if (backupList) backupList.textContent = "";
        } catch (error) {
          authMessage(workspace.querySelector("[data-two-factor-verify-message]"), error.message || tx("Authenticator verification failed.", "فشل التحقق من الرمز."), "error");
        } finally {
          if (button) button.disabled = false;
        }
      });
    }

    if (copySecret) {
      copySecret.addEventListener("click", async function () {
        var secret = secretNode ? secretNode.textContent : "";
        if (!secret || !navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
          showToast(tx("The setup key could not be copied on this device.", "تعذر نسخ مفتاح الإعداد على هذا الجهاز."));
          return;
        }
        try {
          await navigator.clipboard.writeText(secret);
          showToast(tx("Authenticator setup key copied.", "تم نسخ مفتاح إعداد المصادقة."));
        } catch (_error) {
          showToast(tx("The setup key could not be copied.", "تعذر نسخ مفتاح الإعداد."));
        }
      });
    }
  }

  function syncProfileDirtyState(profileForm) {
    if (!profileForm) return false;
    var nameInput = profileForm.elements.name;
    var resetButton = profileForm.querySelector("[data-profile-reset]");
    var unsavedStatus = profileForm.querySelector("[data-profile-unsaved]");
    var dirty = Boolean(nameInput && nameInput.value !== nameInput.defaultValue);
    if (resetButton) resetButton.hidden = !dirty;
    if (unsavedStatus) {
      unsavedStatus.hidden = !dirty;
      unsavedStatus.textContent = dirty ? tx("Unsaved changes", "تغييرات غير محفوظة", {
        fr: "Modifications non enregistrées",
        es: "Cambios sin guardar",
        de: "Nicht gespeicherte Änderungen",
        pt: "Alterações não salvas",
        zh: "有未保存的更改",
        ja: "未保存の変更があります"
      }) : "";
    }
    return dirty;
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
        window.location.assign(localeHref("/signin") + "?next=" + encodeURIComponent(window.location.pathname));
        return;
      }
      var user = sessionResponse.user;
      var currentSession = sessionResponse.session;
      populateAccountIdentity(workspace, user);
      var nameInput = workspace.querySelector("#acc-name");
      var emailInput = workspace.querySelector("#acc-email");
      if (nameInput) {
        nameInput.value = user.name || "";
        nameInput.defaultValue = user.name || "";
        syncProfileDirtyState(workspace.querySelector("[data-account-profile-form]"));
      }
      if (emailInput) {
        emailInput.value = user.email || "";
        emailInput.defaultValue = user.email || "";
      }
      await refreshTwoFactorStatus(workspace);
      var accountResponse = await authRequest("list-accounts");
      var accounts = Array.isArray(accountResponse) ? accountResponse : (accountResponse && accountResponse.accounts) || [];
      var accountList = workspace.querySelector("[data-auth-account-list]");
      if (accountList) {
        accountList.textContent = "";
        if (!accounts.length) {
          var emptyAccount = document.createElement("li");
          emptyAccount.className = "ef-session-row";
          emptyAccount.textContent = tx("No linked social accounts.", "لا توجد حسابات خارجية مرتبطة.");
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
            emptySession.textContent = tx("No active sessions found.", "لم يتم العثور على جلسات نشطة.");
            sessionList.appendChild(emptySession);
          }
        }
      } catch (sessionError) {
        if (revokeAllButton) revokeAllButton.hidden = true;
        if (sessionStatus) {
          sessionStatus.hidden = false;
          var staleSession = sessionError && sessionError.code === "SESSION_NOT_FRESH";
          sessionStatus.textContent = sessionStatus.getAttribute(staleSession ? "data-session-stale-message" : "data-session-error-message") ||
            tx("Session details are temporarily unavailable.", "تفاصيل الجلسات غير متوفرة مؤقتاً.");
          if (staleSession) {
            var reauthLink = document.createElement("a");
            reauthLink.href = sessionStatus.getAttribute("data-session-reauth-href") || localeHref("/signin");
            reauthLink.textContent = sessionStatus.getAttribute("data-session-reauth-label") || tx("Sign in again", "أعد تسجيل الدخول");
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
      authMessage(status, error && error.message ? error.message : tx("Could not verify your account. Sign in again.", "تعذر التحقق من حسابك. أعد تسجيل الدخول."), "error");
    }
  }

  function bindAccountControls() {
    bindTwoFactorControls(document.querySelector("[data-account-workspace]"));
    var profileForm = document.querySelector("[data-account-profile-form]");
    if (profileForm) {
      var profileNameInput = profileForm.elements.name;
      var profileStatus = profileForm.querySelector("[data-profile-status]");
      if (profileNameInput) {
        profileNameInput.addEventListener("input", function () {
          syncProfileDirtyState(profileForm);
        });
      }
      profileForm.addEventListener("reset", function () {
        window.requestAnimationFrame(function () {
          syncProfileDirtyState(profileForm);
          authMessage(profileStatus, "");
        });
      });
      function guardUnsavedProfile(event) {
        if (!syncProfileDirtyState(profileForm)) return;
        event.preventDefault();
        event.returnValue = "";
      }
      window.addEventListener("beforeunload", guardUnsavedProfile);
      window.addEventListener("pagehide", function () {
        window.removeEventListener("beforeunload", guardUnsavedProfile);
      }, { once: true });
      profileForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        var name = String(profileForm.elements.name.value || "").trim();
        var status = profileForm.querySelector("[data-profile-status]");
        if (name.length < 2) {
          authMessage(status, tx("Enter a name with at least two characters.", "أدخل اسماً من حرفين على الأقل."), "error");
          return;
        }
        var button = profileForm.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        try {
          await authRequest("update-user", "POST", { name: name });
          profileNameInput.defaultValue = name;
          syncProfileDirtyState(profileForm);
          authMessage(status, tx("Profile updated.", "تم تحديث الملف الشخصي."), "success");
          await refreshAuthHeader();
        } catch (error) {
          authMessage(status, error.message || tx("Could not update your profile.", "تعذر تحديث الملف الشخصي."), "error");
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
          showToast(error.message || tx("Google linking failed.", "تعذر ربط حساب Google."));
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
          authMessage(status, tx("Use at least 8 characters for the new password.", "استخدم 8 أحرف على الأقل لكلمة المرور الجديدة."), "error");
          return;
        }
        if (newPassword !== confirmPassword) {
          authMessage(status, tx("The new passwords do not match.", "كلمتا المرور الجديدتان غير متطابقتين."), "error");
          return;
        }
        try {
          await authRequest("change-password", "POST", {
            currentPassword: currentPassword,
            newPassword: newPassword,
            revokeOtherSessions: true
          });
          passwordForm.reset();
          authMessage(status, tx("Password changed. Other active sessions were signed out.", "تم تغيير كلمة المرور وإنهاء الجلسات الأخرى."), "success");
        } catch (error) {
          authMessage(status, error.message || tx("Could not change your password.", "تعذر تغيير كلمة المرور."), "error");
        }
      });
    }

    document.querySelectorAll("[data-auth-signout], [data-auth-header-signout], [data-auth-drawer-signout]").forEach(function (signOut) {
      signOut.addEventListener("click", async function () {
        signOut.disabled = true;
        try {
          await authRequest("sign-out", "POST", {});
          updateAuthHeader(null);
          window.location.assign(localeHref("/signin"));
        } catch (error) {
          showToast(error.message || tx("Could not sign out.", "تعذر تسجيل الخروج."));
          signOut.disabled = false;
        }
      });
    });

    var revokeAll = document.querySelector("[data-auth-revoke-all]");
    if (revokeAll) {
      revokeAll.addEventListener("click", function () {
        var hostEl = revokeAll.parentElement || revokeAll.closest(".ef-account-card");
        showInlineConfirm({
          hostEl: hostEl,
          triggerBtn: revokeAll,
          label: tx("Confirm signing out other active sessions", "تأكيد إنهاء الجلسات الأخرى"),
          message: tx("Sign out all other sessions?", "إنهاء جميع الجلسات الأخرى؟"),
          confirmLabel: tx("Sign out others", "إنهاء الجلسات"),
          onConfirm: async function () {
            try {
              await authRequest("revoke-other-sessions", "POST", {});
              showToast(tx("Other sessions have been revoked.", "تم إنهاء جميع الجلسات الأخرى."));
              await loadAccountWorkspace();
            } catch (error) {
              showToast(error.code === "SESSION_NOT_FRESH"
                ? tx("Sign in again before managing active sessions.", "أعد تسجيل الدخول قبل إدارة الجلسات النشطة.")
                : error.message || tx("Could not revoke other sessions.", "تعذر إنهاء الجلسات الأخرى."));
            }
          }
        });
      });
    }
  }

  /* ========================================================================
     16. Generic Accessible Tablists ([data-tab-group])
     ======================================================================== */
  document.querySelectorAll("[data-tab-group]").forEach(function (group) {
    var triggers = Array.prototype.slice.call(group.querySelectorAll("[data-tab-trigger]"));
    var panels = Array.prototype.slice.call(group.querySelectorAll("[data-tab-panel]"));
    if (!triggers.length || !panels.length) return;

    function activateTab(targetId) {
      triggers.forEach(function (btn) {
        var active = btn.getAttribute("data-tab-trigger") === targetId;
        btn.setAttribute("aria-selected", String(active));
        btn.setAttribute("tabindex", active ? "0" : "-1");
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-tab-panel") !== targetId;
      });
    }

    triggers.forEach(function (btn, index) {
      btn.addEventListener("click", function () {
        activateTab(btn.getAttribute("data-tab-trigger"));
      });
      btn.addEventListener("keydown", function (e) {
        var isRtl = root.getAttribute("dir") === "rtl";
        var nextH = isRtl ? "ArrowLeft" : "ArrowRight";
        var prevH = isRtl ? "ArrowRight" : "ArrowLeft";
        var nextIdx = null;
        if (e.key === nextH || e.key === "ArrowDown") nextIdx = (index + 1) % triggers.length;
        else if (e.key === prevH || e.key === "ArrowUp") nextIdx = (index - 1 + triggers.length) % triggers.length;
        else if (e.key === "Home") nextIdx = 0;
        else if (e.key === "End") nextIdx = triggers.length - 1;
        if (nextIdx === null) return;
        e.preventDefault();
        triggers[nextIdx].focus();
        activateTab(triggers[nextIdx].getAttribute("data-tab-trigger"));
      });
    });
  });

  /* ========================================================================
     17. Generic Copy Source Buttons ([data-copy-source])
     ======================================================================== */
  document.querySelectorAll("[data-copy-source]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var sourceId = btn.getAttribute("data-copy-source");
      var text = "";
      if (sourceId === "demo-active-pre") {
        var card = btn.closest("[data-tab-group]");
        var activeCode = card ? card.querySelector("[data-tab-panel]:not([hidden]) code") : null;
        text = activeCode ? activeCode.textContent || "" : "";
      } else if (sourceId) {
        var targetEl = document.getElementById(sourceId);
        text = targetEl ? targetEl.textContent || "" : "";
      }
      if (!text) {
        showToast(tMap({ en: "Nothing available to copy.", ar: "لا يوجد نص متاح للنسخ.", fr: "Rien à copier.", es: "No hay nada para copiar.", de: "Nichts zum Kopieren.", pt: "Nada para copiar.", zh: "没有可复制的内容。", ja: "コピーできる内容がありません。" }));
        return;
      }
      var labelEl = btn.querySelector("[data-copy-label]");
      var origLabel = labelEl ? labelEl.textContent : tMap({ en: "Copy", ar: "نسخ", fr: "Copier", es: "Copiar", de: "Kopieren", pt: "Copiar", zh: "复制", ja: "コピー" });
      var finish = function () {
        btn.classList.add("is-copied");
        var iconCopy = btn.querySelector("[data-icon-copy]");
        var iconCheck = btn.querySelector("[data-icon-check]");
        if (labelEl) labelEl.textContent = tMap({ en: "Copied", ar: "تم النسخ", fr: "Copié", es: "Copiado", de: "Kopiert", pt: "Copiado", zh: "已复制", ja: "コピー済み" });
        if (iconCopy) iconCopy.hidden = true;
        if (iconCheck) iconCheck.hidden = false;
        showToast(tMap({ en: "Copied to clipboard", ar: "تم النسخ إلى الحافظة", fr: "Copié dans le presse-papiers", es: "Copiado al portapapeles", de: "In die Zwischenablage kopiert", pt: "Copiado para a área de transferência", zh: "已复制到剪贴板", ja: "クリップボードにコピーしました" }));
        setTimeout(function () {
          btn.classList.remove("is-copied");
          if (labelEl) labelEl.textContent = origLabel;
          if (iconCopy) iconCopy.hidden = false;
          if (iconCheck) iconCheck.hidden = true;
        }, 1800);
      };
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(text).then(finish).catch(finish);
      } else {
        finish();
      }
    });
  });

  /* ========================================================================
     18. Bounded Execution Workbench Simulator (/demo)
     ======================================================================== */
  var demoWorkbench = document.querySelector("[data-demo-workbench]");
  if (demoWorkbench) {
    var presetsScript = demoWorkbench.querySelector("[data-demo-presets-json]");
    var demoPresets = {};
    if (presetsScript) {
      try { demoPresets = JSON.parse(presetsScript.textContent || "{}"); } catch (_e) {}
    }
    var demoForm = demoWorkbench.querySelector("[data-demo-form]");
    var presetBtns = demoWorkbench.querySelectorAll("[data-demo-preset]");
    var resetBtn = demoWorkbench.querySelector("[data-demo-reset]");
    var statusEl = demoWorkbench.querySelector("[data-demo-status]");
    var httpBadge = demoWorkbench.querySelector("[data-demo-http-badge]");
    var outEnvelope = demoWorkbench.querySelector('[data-demo-out="envelope"]');
    var outPolicy = demoWorkbench.querySelector('[data-demo-out="policy"]');
    var outEvidence = demoWorkbench.querySelector('[data-demo-out="evidence"]');
    var outCurl = demoWorkbench.querySelector('[data-demo-out="curl"]');

    function setStage(stageKey, label, stateClass) {
      var stageEl = demoWorkbench.querySelector('[data-demo-stage="' + stageKey + '"]');
      if (!stageEl) return;
      stageEl.classList.remove("is-pass", "is-warn", "is-fail");
      if (stateClass) stageEl.classList.add(stateClass);
      var strong = stageEl.querySelector("[data-stage-state]");
      if (strong) strong.textContent = label;
    }

    function setDemoFieldError(name, msg) {
      if (!demoForm) return;
      var input = demoForm.elements[name];
      var err = demoForm.querySelector('[data-demo-error="' + name + '"]');
      if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (err) err.textContent = msg || "";
    }

    function validatePreviewUrl(rawUrl) {
      var trimmed = String(rawUrl || "").trim();
      if (!trimmed) return { allowed: false, code: "INVALID_REQUEST", reason: tx("A target URL is required.", "الرابط الهدف مطلوب.") };
      var parsed;
      try { parsed = new URL(trimmed); } catch (_e) {
        return { allowed: false, code: "INVALID_REQUEST", reason: tx("Provide a valid absolute URL including https://.", "أدخل رابطاً كاملاً صالحاً يبدأ بـ https://.") };
      }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { allowed: false, code: "URL_NOT_ALLOWED", reason: tx("Only http: and https: protocols are allowed.", "يُسمح فقط ببروتوكولي http: و https:.") };
      }
      if (parsed.username || parsed.password) {
        return { allowed: false, code: "URL_NOT_ALLOWED", reason: tx("Embedded credentials in URLs are rejected.", "يتم رفض بيانات الاعتماد المضمنة داخل الرابط.") };
      }
      if (parsed.port) {
        return { allowed: false, code: "URL_NOT_ALLOWED", reason: tx("Non-default URL ports are rejected by egress policy.", "المنافذ غير الافتراضية مرفوضة وفق سياسة الإخراج.") };
      }
      var host = parsed.hostname.toLowerCase();
      if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
          host.endsWith(".internal") || host.endsWith(".lan") ||
          host === "exportflow.me" || host.endsWith(".exportflow.me") ||
          host.endsWith(".exportflow.test") || host.endsWith(".workers.dev")) {
        return { allowed: false, code: "URL_NOT_ALLOWED", reason: tx("Blocked internal, local, or self-targeting hostname.", "تم حظر النطاق الداخلي أو المحلي أو الذاتي.") };
      }
      var isIpv4Like = /^\\d{1,3}(\\.\\d{1,3}){3}$/.test(host) || /^0x[0-9a-f]+$/i.test(host) || /^\\d+$/.test(host);
      var isIpv6Like = host.indexOf(":") !== -1 || (host.startsWith("[") && host.endsWith("]"));
      if (isIpv4Like || isIpv6Like) {
        return { allowed: false, code: "URL_NOT_ALLOWED", reason: tx("Direct IP literals (v4, v6, integer, or hex) are blocked to prevent SSRF.", "يتم حظر عناوين IP المباشرة لمنع هجمات SSRF.") };
      }
      return { allowed: true, normalizedUrl: parsed.href, hostname: host, protocol: parsed.protocol };
    }

    function runDemoSimulation() {
      if (!demoForm) return;
      var goal = String(demoForm.elements.goal.value || "").trim();
      var url = String(demoForm.elements.url.value || "").trim();
      var operation = String(demoForm.elements.operation.value || "fetch");
      var timeoutMs = Math.max(100, Math.min(8000, Number(demoForm.elements.timeoutMs.value) || 5000));
      var maxBytes = Math.max(64, Math.min(1048576, Number(demoForm.elements.maxBytes.value) || 262144));
      var maxRedirects = Math.max(0, Math.min(3, Number(demoForm.elements.maxRedirects.value) || 0));
      var forceOutcome = demoForm.dataset.forceOutcome || "";

      setDemoFieldError("goal", goal ? "" : tx("Provide a task goal description.", "أدخل وصفاً لهدف المهمة."));
      var urlCheck = validatePreviewUrl(url);
      setDemoFieldError("url", urlCheck.allowed ? "" : urlCheck.reason);

      var requestPayload = {
        goal: goal || "(missing)",
        url: url,
        operation: operation,
        limits: { timeoutMs: timeoutMs, maxBytes: maxBytes, maxRedirects: maxRedirects }
      };

      var httpStatus = 200;
      var envelope;
      var policyReport;
      var evidenceReport;

      if (!goal) {
        httpStatus = 400;
        setStage("contract", "400 INVALID", "is-fail");
        setStage("egress", "SKIPPED", "");
        setStage("router", "SKIPPED", "");
        setStage("engine", "NONE", "");
        setStage("evidence", "0 SOURCES", "is-fail");
        envelope = { error: { code: "INVALID_REQUEST", message: "goal must be a non-empty string (1–2,000 chars)." } };
      } else if (!urlCheck.allowed) {
        httpStatus = 400;
        setStage("contract", "PASS", "is-pass");
        setStage("egress", "400 BLOCKED", "is-fail");
        setStage("router", "HALTED", "is-fail");
        setStage("engine", "NONE", "");
        setStage("evidence", "0 SOURCES", "is-fail");
        envelope = {
          state: "failed",
          execution: { path: null, adapterId: null, reason: urlCheck.reason },
          errors: [{ code: urlCheck.code, message: urlCheck.reason }],
          result: { status: "failed", data: null, sources: [], warnings: [] }
        };
      } else if (forceOutcome === "NO_PUBLIC_HTTP_ENDPOINT") {
        httpStatus = 501;
        setStage("contract", "PASS", "is-pass");
        setStage("egress", "PASS", "is-pass");
        setStage("router", "HTTP ONLY", "is-warn");
        setStage("engine", "NO PUBLIC ENDPOINT", "is-warn");
        setStage("evidence", "UNSUPPORTED", "is-warn");
        envelope = {
          state: "unsupported",
          execution: {
            path: "http",
            operation: "fetch",
            adapterId: null,
            reason: "No usable public HTTP/API endpoint exposes the required content. Page JavaScript is never executed."
          },
          errors: [{
            code: "DYNAMIC_CONTENT_UNAVAILABLE",
            message: "The required content is not exposed through a usable public HTTP/API endpoint."
          }],
          result: { status: "unsupported", data: null, sources: [], warnings: [
            "No browser session was started and no page JavaScript was executed."
          ] }
        };
      } else if (operation !== "fetch") {
        httpStatus = 501;
        setStage("contract", "PASS", "is-pass");
        setStage("egress", "PASS", "is-pass");
        setStage("router", operation, "is-warn");
        setStage("engine", "501 DISABLED", "is-warn");
        setStage("evidence", "UNSUPPORTED", "is-warn");
        envelope = {
          state: "unsupported",
          execution: {
            path: operation,
            operation: operation,
            adapterId: null,
            reason: "Operation exists as an internal prototype adapter and returns HTTP 501 on Phase 1 REST until enabled."
          },
          errors: [{ code: "OPERATION_NOT_ENABLED", message: "Operation '" + operation + "' is not enabled in Phase 1." }],
          result: { status: "unsupported", data: null, sources: [], warnings: [] }
        };
      } else {
        httpStatus = 200;
        setStage("contract", "PASS", "is-pass");
        setStage("egress", "PASS", "is-pass");
        setStage("router", "http", "is-pass");
        setStage("engine", "http.fetch.v1", "is-pass");
        setStage("evidence", "ATTACHED", "is-pass");
        envelope = {
          id: "sim-" + (Math.abs(urlCheck.hostname.length * 997) + 1000),
          goal: goal,
          requestedUrl: urlCheck.normalizedUrl,
          state: "succeeded",
          execution: {
            path: "http",
            operation: "fetch",
            adapterId: "http.fetch.v1",
            reason: "Public HTTP request permitted by the request-only execution policy."
          },
          usage: { durationMs: 142, requestsAttempted: 1, responseBytes: Math.min(maxBytes, 1480), cost: null },
          errors: [],
          result: {
            status: "succeeded",
            data: {
              httpStatus: 200,
              contentType: "text/html; charset=utf-8",
              finalUrl: urlCheck.normalizedUrl,
              redirects: []
            },
            sources: [{
              url: urlCheck.normalizedUrl,
              retrievedAt: "simulated",
              evidence: [{ type: "http_response", status: 200, redirectCount: 0, maxBytesCap: maxBytes }]
            }],
            warnings: ["Simulation output — 0 external HTTP requests were sent."]
          }
        };
      }

      policyReport = {
        simulationMode: true,
        networkRequestsSent: 0,
        authGates: ["Pre-auth IP limiter", "D1 SHA-256 ef_live_* key or OAuth tasks:fetch", "Durable Object TenantBurstRateLimiter", "D1 tenant_request_usage quota"],
        contractChecks: {
          bodyCapBytes: 32768,
          timeoutMs: timeoutMs,
          maxBytes: maxBytes,
          maxRedirects: maxRedirects
        },
        egressGuard: urlCheck
      };

      evidenceReport = {
        httpStatus: httpStatus,
        routerPath: operation === "fetch" ? "http" : operation,
        adapterId: httpStatus === 200 ? "http.fetch.v1" : null,
        sources: envelope.result && envelope.result.sources ? envelope.result.sources : []
      };

      var curlCmd = [
        "# Execute against a configured ExportFlow instance:",
        "curl -s -X POST https://api.exportflow.me/api/v1/tasks \\\\",
        "  -H 'authorization: Bearer ef_live_<keyId>_<secret>' \\\\",
        "  -H 'content-type: application/json' \\\\",
        "  -d '" + JSON.stringify(requestPayload) + "'"
      ].join("\\n");

      if (httpBadge) httpBadge.textContent = tx("SIMULATED HTTP ", "محاكاة HTTP ") + httpStatus;
      if (outEnvelope) outEnvelope.textContent = JSON.stringify(envelope, null, 2);
      if (outPolicy) outPolicy.textContent = JSON.stringify(policyReport, null, 2);
      if (outEvidence) outEvidence.textContent = JSON.stringify(evidenceReport, null, 2);
      if (outCurl) outCurl.textContent = curlCmd;
      if (statusEl) {
        statusEl.dataset.state = httpStatus === 200 ? "success" : "error";
        statusEl.textContent = httpStatus === 200
          ? tx("Simulated HTTP 200 on http.fetch.v1. No external network request was sent.", "محاكاة HTTP 200 عبر http.fetch.v1 بدون إرسال أي طلب شبكي خارجي.")
          : tx("Simulation halted fail-closed with HTTP " + httpStatus + ". Inspect policy and envelope tabs.", "توقفت المحاكاة بأمان مع HTTP " + httpStatus + ". راجع تبويبات السياسة والغلاف.");
      }
    }

    function applyDemoPreset(presetId) {
      var preset = demoPresets[presetId];
      if (!preset || !demoForm) return;
      demoForm.elements.goal.value = preset.goal || "";
      demoForm.elements.url.value = preset.url || "";
      demoForm.elements.operation.value = preset.operation || "fetch";
      demoForm.elements.timeoutMs.value = preset.timeoutMs || 5000;
      demoForm.elements.maxBytes.value = preset.maxBytes || 262144;
      demoForm.elements.maxRedirects.value = preset.maxRedirects != null ? preset.maxRedirects : 2;
      demoForm.dataset.forceOutcome = preset.forceOutcome || "";
      presetBtns.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-demo-preset") === presetId));
      });
      runDemoSimulation();
    }

    var authGatePrompt = tMap({
      en: "Sign in required to run interactive features.",
      ar: "يجب تسجيل الدخول لتشغيل الميزات التفاعلية.",
      fr: "Connexion requise pour utiliser les fonctionnalités interactives.",
      es: "Inicia sesión para usar las funciones interactivas.",
      de: "Anmeldung erforderlich, um interaktive Funktionen zu nutzen.",
      pt: "É necessário entrar para usar os recursos interativos.",
      zh: "需要登录才能使用交互功能。",
      ja: "インタラクティブ機能を使用するにはサインインが必要です。"
    });

    presetBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!currentAuthUser) {
          showToast(authGatePrompt);
          return;
        }
        applyDemoPreset(btn.getAttribute("data-demo-preset"));
      });
    });

    if (demoForm) {
      demoForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!currentAuthUser) {
          showToast(authGatePrompt);
          return;
        }
        runDemoSimulation();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        applyDemoPreset("public-fetch");
        showToast(tMap({
          en: "Reset workbench to default public HTTP fetch preset.",
          ar: "تمت إعادة تعيين المختبر إلى الإعداد الافتراضي.",
          fr: "Simulateur réinitialisé sur le préréglage HTTP par défaut.",
          es: "Banco restablecido al ajuste HTTP predeterminado.",
          de: "Werkbank auf Standard-HTTP-Vorgabe zurückgesetzt.",
          pt: "Bancada redefinida para a predefinição HTTP padrão.",
          zh: "已将工作台重置为默认 HTTP 预设。",
          ja: "ワークベンチを既定の HTTP プリセットにリセットしました。"
        }));
      });
    }

    applyDemoPreset("public-fetch");
  }

  function bindGoogleButtons() {
    document.querySelectorAll("[data-auth-google]").forEach(function (button) {
      button.addEventListener("click", async function () {
        if (!authConfig || !authConfig.googleEnabled) return;
        button.disabled = true;
        try {
          await beginGoogleAuth(button.getAttribute("data-auth-google-mode") || "signin");
        } catch (error) {
          showToast(error.message || tx("Google sign-in could not start.", "تعذر بدء تسجيل الدخول عبر Google."));
          button.disabled = false;
        }
      });
    });
  }

  function bindOAuthConsentPage() {
    var accept = document.querySelector("[data-oauth-consent-accept]");
    var deny = document.querySelector("[data-oauth-consent-deny]");
    var status = document.querySelector("[data-oauth-flow-status]");
    async function respond(accepted, button) {
      if (button) button.disabled = true;
      authMessage(status, accepted ? tx("Saving your authorization…", "جارٍ حفظ التفويض…") : tx("Cancelling the connection…", "جارٍ إلغاء الربط…"));
      try {
        var result = await authRequest("oauth2/consent", "POST", { accept: accepted });
        if (!result || result.redirect !== true || typeof result.url !== "string") {
          throw new Error(tx("The authorization server returned an invalid continuation.", "أعاد خادم التفويض استجابة غير صالحة."));
        }
        authGoToOAuth(result.url);
      } catch (error) {
        authMessage(status, error && error.message ? error.message : tx("Could not complete authorization.", "تعذر إتمام التفويض."), "error");
        if (button) button.disabled = false;
      }
    }
    if (accept) accept.addEventListener("click", function () { respond(true, accept); });
    if (deny) deny.addEventListener("click", function () { respond(false, deny); });
  }

  async function bindOAuthTenantSelectionPage() {
    var form = document.querySelector("[data-oauth-tenant-form]");
    if (!form) return;
    var select = form.querySelector("#oauth-tenant-choice");
    var submit = form.querySelector("[data-oauth-tenant-submit]");
    var status = form.querySelector("[data-oauth-flow-status]");
    try {
      var data = await authRequest("tenant/list");
      var tenants = data && Array.isArray(data.tenants) ? data.tenants : [];
      select.textContent = "";
      if (!tenants.length) {
        var empty = document.createElement("option");
        empty.value = "";
        empty.textContent = tx("No active workspace membership was found.", "لم يتم العثور على عضوية نشطة في مساحة العمل.");
        select.appendChild(empty);
        authMessage(status, tx("Ask a workspace owner to add your account before connecting.", "اطلب من مالك مساحة العمل إضافة حسابك قبل الربط."), "error");
        return;
      }
      tenants.forEach(function (tenant) {
        if (!tenant || typeof tenant.tenantId !== "string") return;
        var option = document.createElement("option");
        option.value = tenant.tenantId;
        option.textContent = tenant.tenantId + " · " + (tenant.role || "member") + " · " + (tenant.planCode || "plan");
        select.appendChild(option);
      });
      submit.disabled = select.options.length === 0;
    } catch (error) {
      authMessage(status, error && error.message ? error.message : tx("Could not load your workspaces.", "تعذر تحميل مساحات العمل الخاصة بك."), "error");
      return;
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var tenantId = String(select.value || "");
      if (!tenantId) {
        authMessage(status, tx("Choose a workspace to continue.", "اختر مساحة عمل للمتابعة."), "error");
        return;
      }
      if (submit) submit.disabled = true;
      authMessage(status, tx("Saving your workspace selection…", "جارٍ حفظ اختيار مساحة العمل…"));
      try {
        await authRequest("tenant/select", "POST", { tenantId: tenantId });
        var continued = await authRequest("oauth2/continue", "POST", { postLogin: true });
        if (!continued || continued.redirect !== true || typeof continued.url !== "string") {
          throw new Error(tx("The authorization server returned an invalid continuation.", "أعاد خادم التفويض استجابة غير صالحة."));
        }
        authGoToOAuth(continued.url);
      } catch (error) {
        authMessage(status, error && error.message ? error.message : tx("Could not continue authorization.", "تعذر متابعة التفويض."), "error");
        if (submit) submit.disabled = false;
      }
    });
  }

  async function workspaceRequest(path, method, payload) {
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
    var response = await fetch("/api/v1/workspace/" + path, options);
    var data = null;
    try { data = await response.json(); } catch (_e) {}
    if (!response.ok && !(data && data.execution)) {
      var msg = data && data.error && data.error.message ? data.error.message : tx("Workspace request failed.", "تعذر تنفيذ طلب مساحة العمل.");
      var err = new Error(msg);
      err.status = response.status;
      throw err;
    }
    return data;
  }

  function renderWorkspaceKeys(listEl, keys, onRefresh) {
    if (!listEl) return;
    listEl.textContent = "";
    if (!keys || !keys.length) {
      var empty = document.createElement("li");
      empty.className = "ef-session-row";
      empty.textContent = tx("No workspace API keys created yet.", "لم يتم إنشاء مفاتيح API بعد.");
      listEl.appendChild(empty);
      return;
    }
    keys.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "ef-session-row";
      var info = document.createElement("div");
      var title = document.createElement("strong");
      title.textContent = item.name + (item.revokedAt ? " (" + tx("Revoked", "ملغى") + ")" : "");
      var meta = document.createElement("p");
      meta.textContent = item.keyPrefix + " · " + new Date(item.createdAt).toLocaleDateString();
      info.appendChild(title);
      info.appendChild(meta);
      li.appendChild(info);

      var action = document.createElement("span");
      if (item.revokedAt) {
        action.className = "ef-badge ef-badge-planned";
        action.textContent = tx("Revoked", "ملغى");
      } else {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ef-code-btn";
        btn.textContent = tx("Revoke", "إلغاء");
        btn.addEventListener("click", function () {
          showInlineConfirm({
            hostEl: action,
            triggerBtn: btn,
            label: tx("Confirm revoking API key", "تأكيد إلغاء المفتاح"),
            message: tx("Revoke key?", "إلغاء المفتاح؟"),
            confirmLabel: tx("Revoke", "إلغاء"),
            onConfirm: async function () {
              await workspaceRequest("keys?id=" + encodeURIComponent(item.id), "DELETE");
              showToast(tx("API key revoked.", "تم إلغاء المفتاح."));
              await onRefresh();
            }
          });
        });
        action.appendChild(btn);
      }
      li.appendChild(action);
      listEl.appendChild(li);
    });
  }

  function renderWorkspaceHistory(listEl, rows) {
    if (!listEl) return;
    listEl.textContent = "";
    if (!rows || !rows.length) {
      var empty = document.createElement("li");
      empty.className = "ef-session-row";
      empty.textContent = tx("No task executions recorded yet.", "لا توجد عمليات تنفيذ مسجلة بعد.");
      listEl.appendChild(empty);
      return;
    }
    rows.forEach(function (row) {
      var li = document.createElement("li");
      li.className = "ef-session-row";
      var info = document.createElement("div");
      var title = document.createElement("strong");
      title.textContent = row.requested_url || row.goal;
      var detail = document.createElement("p");
      detail.textContent = [row.mode, row.adapter_id || row.operation, (row.duration_ms || 0) + "ms", (row.response_bytes || 0) + "B"].join(" · ");
      info.appendChild(title);
      info.appendChild(detail);
      var badge = document.createElement("span");
      badge.className = "ef-badge " + (row.state === "succeeded" ? "ef-badge-available" : row.state === "unsupported" ? "ef-badge-dev" : "ef-badge-planned");
      badge.textContent = String(row.http_status || row.state);
      li.appendChild(info);
      li.appendChild(badge);
      listEl.appendChild(li);
    });
  }

  async function loadWorkspaceConsole() {
    var shell = document.querySelector("[data-workspace-shell]");
    if (!shell) return;
    var loading = document.querySelector("[data-workspace-loading]");
    if (loading) loading.hidden = false;
    shell.hidden = true;
    try {
      var sessionResponse = await authRequest("get-session");
      if (!sessionResponse || !sessionResponse.user) {
        window.location.assign(localeHref("/signin") + "?next=" + encodeURIComponent(window.location.pathname));
        return;
      }
      populateAccountIdentity(shell, sessionResponse.user);
      updateAuthHeader(sessionResponse.user);

      async function refreshData() {
        var [overview, keysRes, historyRes] = await Promise.all([
          workspaceRequest("overview"),
          workspaceRequest("keys"),
          workspaceRequest("history"),
        ]);
        var statKeys = shell.querySelector("[data-ws-stat-keys]");
        var statRuns = shell.querySelector("[data-ws-stat-runs]");
        if (statKeys && overview && overview.stats) statKeys.textContent = String(overview.stats.activeKeys || 0);
        if (statRuns && overview && overview.stats) statRuns.textContent = String(overview.stats.totalExecutions || 0);
        renderWorkspaceKeys(shell.querySelector("[data-ws-key-list]"), keysRes && keysRes.keys, refreshData);
        renderWorkspaceHistory(shell.querySelector("[data-ws-history-list]"), historyRes && historyRes.executions);
      }

      await refreshData();
      if (loading) loading.hidden = true;
      shell.hidden = false;

      var execForm = shell.querySelector("[data-ws-exec-form]");
      if (execForm && !execForm.dataset.bound) {
        execForm.dataset.bound = "true";
        execForm.addEventListener("submit", async function (e) {
          e.preventDefault();
          var btn = execForm.querySelector('button[type="submit"]');
          var statusEl = execForm.querySelector("[data-ws-exec-status]");
          var outputEl = shell.querySelector("[data-ws-exec-output]");
          var badgeEl = shell.querySelector("[data-ws-http-badge]");
          if (btn) btn.disabled = true;
          authMessage(statusEl, tx("Executing bounded request…", "جارٍ تنفيذ الطلب المنضبط…"));
          try {
            var res = await workspaceRequest("execute", "POST", {
              goal: String(execForm.elements.goal.value || "").trim(),
              url: String(execForm.elements.url.value || "").trim(),
              mode: String(execForm.elements.mode.value || "live"),
              operation: "fetch",
              limits: {
                timeoutMs: Number(execForm.elements.timeoutMs.value) || 5000,
                maxBytes: Number(execForm.elements.maxBytes.value) || 131072,
                maxRedirects: Number(execForm.elements.maxRedirects.value) || 2
              }
            });
            if (badgeEl) badgeEl.textContent = "HTTP " + (res.httpStatus || 200) + " · " + (res.mode || "live");
            if (outputEl) outputEl.textContent = JSON.stringify(res.execution || res, null, 2);
            var ok = res && res.execution && res.execution.state === "succeeded";
            authMessage(statusEl, ok
              ? tx("Execution succeeded and provenance saved.", "نجح التنفيذ وتم حفظ سجل الأدلة.")
              : tx("Execution returned status " + (res.httpStatus || "error") + ".", "انتهى التنفيذ بالحالة " + (res.httpStatus || "خطأ") + "."), ok ? "success" : "warning");
            await refreshData();
          } catch (err) {
            authMessage(statusEl, err && err.message ? err.message : tx("Execution failed.", "فشل التنفيذ."), "error");
          } finally {
            if (btn) btn.disabled = false;
          }
        });
      }

      var keyForm = shell.querySelector("[data-ws-key-form]");
      if (keyForm && !keyForm.dataset.bound) {
        keyForm.dataset.bound = "true";
        var revealBox = shell.querySelector("[data-ws-key-reveal]");
        var secretCode = shell.querySelector("[data-ws-key-secret]");
        var copyKeyBtn = shell.querySelector("[data-ws-key-copy]");
        if (copyKeyBtn) {
          copyKeyBtn.addEventListener("click", function () {
            var val = secretCode ? secretCode.textContent : "";
            if (val && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(val).then(function () {
                showToast(tx("API key copied.", "تم نسخ مفتاح API."));
              }).catch(function () {});
            }
          });
        }
        keyForm.addEventListener("submit", async function (e) {
          e.preventDefault();
          var btn = keyForm.querySelector('button[type="submit"]');
          var statusEl = keyForm.querySelector("[data-ws-key-status]");
          if (btn) btn.disabled = true;
          try {
            var created = await workspaceRequest("keys", "POST", {
              name: String(keyForm.elements.name.value || "").trim(),
              scopes: ["tasks:fetch", "workspace:read"]
            });
            if (secretCode) secretCode.textContent = created.rawKey || "";
            if (revealBox) revealBox.hidden = !Boolean(created.rawKey);
            keyForm.reset();
            authMessage(statusEl, tx("API key created. Save it now.", "تم إنشاء مفتاح API. احفظه الآن."), "success");
            await refreshData();
          } catch (err) {
            authMessage(statusEl, err && err.message ? err.message : tx("Could not create API key.", "تعذر إنشاء مفتاح API."), "error");
          } finally {
            if (btn) btn.disabled = false;
          }
        });
      }

      var clearBtn = shell.querySelector("[data-ws-history-clear]");
      if (clearBtn && !clearBtn.dataset.bound) {
        clearBtn.dataset.bound = "true";
        clearBtn.addEventListener("click", function () {
          showInlineConfirm({
            hostEl: clearBtn.parentElement,
            triggerBtn: clearBtn,
            label: tx("Clear execution history", "مسح سجل التنفيذ"),
            message: tx("Clear all recorded runs?", "مسح جميع السجلات؟"),
            confirmLabel: tx("Clear", "مسح"),
            onConfirm: async function () {
              await workspaceRequest("history", "DELETE");
              showToast(tx("History cleared.", "تم مسح السجل."));
              await refreshData();
            }
          });
        });
      }
    } catch (_err) {
      if (loading) loading.textContent = tx("Sign in to access your Execution Workspace.", "سجّل الدخول للوصول إلى مساحة التنفيذ.");
    }
  }

  function bindCommandPalette() {
    var backdrop = document.querySelector("[data-cmd-backdrop]");
    if (!backdrop || backdrop.dataset.bound) return;
    backdrop.dataset.bound = "true";
    var input = backdrop.querySelector("[data-cmd-input]");
    var closeBtn = backdrop.querySelector("[data-cmd-close]");
    var items = Array.prototype.slice.call(backdrop.querySelectorAll("[data-cmd-item]"));
    var activeIdx = 0;

    function visibleItems() {
      return items.filter(function (el) {
        return !el.parentElement.hidden;
      });
    }

    function syncSelected() {
      var vis = visibleItems();
      if (!vis.length) return;
      if (activeIdx < 0) activeIdx = vis.length - 1;
      if (activeIdx >= vis.length) activeIdx = 0;
      items.forEach(function (el) { el.classList.remove("is-selected"); });
      vis[activeIdx].classList.add("is-selected");
    }

    function openPalette() {
      backdrop.hidden = false;
      if (input) {
        input.value = "";
        items.forEach(function (el) { el.parentElement.hidden = false; });
        activeIdx = 0;
        syncSelected();
        setTimeout(function () { input.focus(); }, 10);
      }
    }

    function closePalette() {
      backdrop.hidden = true;
    }

    document.querySelectorAll("[data-cmd-open]").forEach(function (btn) {
      btn.addEventListener("click", openPalette);
    });
    if (closeBtn) closeBtn.addEventListener("click", closePalette);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closePalette();
    });

    if (input) {
      input.addEventListener("input", function () {
        var q = String(input.value || "").trim().toLowerCase();
        items.forEach(function (el) {
          var hay = String(el.textContent || "").toLowerCase();
          el.parentElement.hidden = Boolean(q && hay.indexOf(q) === -1);
        });
        activeIdx = 0;
        syncSelected();
      });
      input.addEventListener("keydown", function (e) {
        var vis = visibleItems();
        if (e.key === "ArrowDown") {
          e.preventDefault();
          activeIdx += 1;
          syncSelected();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          activeIdx -= 1;
          syncSelected();
        } else if (e.key === "Enter" && vis[activeIdx]) {
          e.preventDefault();
          vis[activeIdx].click();
        } else if (e.key === "Escape") {
          e.preventDefault();
          closePalette();
        }
      });
    }

    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (backdrop.hidden) openPalette();
        else closePalette();
        return;
      }
      if (e.key === "/" && backdrop.hidden) {
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (document.activeElement && document.activeElement.isContentEditable)) return;
        e.preventDefault();
        openPalette();
        return;
      }
      if (e.key === "Escape" && !backdrop.hidden) {
        closePalette();
      }
    });
  }

  function bindLegalReadingProgress() {
    var documentShell = document.querySelector("[data-legal-document]");
    if (!documentShell) return;

    var progress = documentShell.querySelector("[data-reading-progress]");
    var fill = documentShell.querySelector("[data-reading-progress-fill]");
    var tocLinks = Array.prototype.slice.call(documentShell.querySelectorAll("[data-legal-toc-link]"));
    var headings = tocLinks.map(function (link) {
      return document.getElementById(decodeURIComponent(link.hash.slice(1)));
    }).filter(Boolean);
    var frame = 0;
    var observer = null;

    function updateProgress() {
      frame = 0;
      if (!progress || !fill) return;
      var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var value = Math.max(0, Math.min(100, Math.round((window.scrollY / maxScroll) * 100)));
      progress.setAttribute("aria-valuenow", String(value));
      fill.style.transform = "scaleX(" + (value / 100) + ")";
    }

    function queueProgressUpdate() {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    }

    if ("IntersectionObserver" in window && headings.length) {
      observer = new IntersectionObserver(function (entries) {
        var visible = entries.filter(function (entry) { return entry.isIntersecting; })
          .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; })[0];
        if (!visible) return;
        tocLinks.forEach(function (link) {
          if (link.hash === "#" + visible.target.id) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }, { rootMargin: "-18% 0px -68% 0px", threshold: 0 });
      headings.forEach(function (heading) { observer.observe(heading); });
    }

    tocLinks.forEach(function (selectedLink) {
      selectedLink.addEventListener("click", function () {
        tocLinks.forEach(function (link) {
          if (link === selectedLink) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      });
    });

    updateProgress();
    window.addEventListener("scroll", queueProgressUpdate, { passive: true });
    window.addEventListener("resize", queueProgressUpdate, { passive: true });
    window.addEventListener("pagehide", function () {
      if (observer) observer.disconnect();
      window.removeEventListener("scroll", queueProgressUpdate);
      window.removeEventListener("resize", queueProgressUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    }, { once: true });
  }

  function bindAccountSectionNavigation() {
    var nav = document.querySelector("[data-account-settings-nav]");
    if (!nav || !("IntersectionObserver" in window)) return;

    var links = Array.prototype.slice.call(nav.querySelectorAll("[data-account-section-link]"));
    var sections = links.map(function (link) {
      return document.getElementById(decodeURIComponent(link.hash.slice(1)));
    }).filter(Boolean);
    if (!sections.length) return;

    var observer = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (entry) { return entry.isIntersecting; })
        .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; })[0];
      if (!visible) return;
      links.forEach(function (link) {
        if (link.hash === "#" + visible.target.id) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-22% 0px -66% 0px", threshold: 0 });

    sections.forEach(function (section) { observer.observe(section); });
    window.addEventListener("pagehide", function () { observer.disconnect(); }, { once: true });
  }

  async function initializeAccountSystem() {
    preserveNextLinks();
    bindPasswordToggles();
    bindStrengthMeters();
    bindAuthForms();
    bindOAuthConsentPage();
    await bindOAuthTenantSelectionPage();
    bindGoogleButtons();
    bindAccountControls();
    bindCommandPalette();
    await refreshAuthHeader();
    try {
      authConfig = await authRequest("config");
      setAccountConfig(authConfig);
    } catch (_e) {
      authConfig = null;
      setAccountConfig(null);
    }
    bindLegalReadingProgress();
    if (document.querySelector("[data-account-workspace]")) {
      await loadAccountWorkspace();
      bindAccountSectionNavigation();
    }
    if (document.querySelector("[data-workspace-shell]")) {
      await loadWorkspaceConsole();
    }
  }

  initializeAccountSystem();
})();
`;
