(() => {
  const translations = window.EXPORTFLOW_TRANSLATIONS || {};
  const supportedLocales = ["en", "ar", "es", "zh", "hi", "pt", "fr", "ru"];
  const html = document.documentElement;
  const languageToggle = document.getElementById("languageToggle");
  const languageBtnTrigger = document.getElementById("languageBtnTrigger");
  const languageMenu = document.getElementById("languageMenu");
  const trackingInput = document.getElementById("trackingNumber");
  const postcodeInput = document.getElementById("postcodeInput");
  const clearInput = document.getElementById("clearInput");
  const pasteBtn = document.getElementById("pasteBtn");
  const trackingForm = document.getElementById("trackingForm");
  const formError = document.getElementById("formError");
  const resultPanel = document.getElementById("resultPanel");
  const resultBackdrop = document.getElementById("resultBackdrop");
  const copyCodeBtn = document.getElementById("copyCodeBtn");
  const copyBtnLabel = document.getElementById("copyBtnLabel");
  const shareBtn = document.getElementById("shareBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const carrierLogoBadge = document.getElementById("carrierLogoBadge");

  function restoreInitialScrollPosition() {
    const navigation = performance.getEntriesByType("navigation")[0];
    const isHistoryTraversal = navigation && navigation.type === "back_forward";
    if (window.location.hash || isHistoryTraversal) return;

    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const resetToTop = () => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    resetToTop();
    requestAnimationFrame(resetToTop);
    window.addEventListener("pageshow", event => {
      if (!event.persisted && !window.location.hash) resetToTop();
    }, { once: true });
  }

  restoreInitialScrollPosition();

  let shipmentMapInstance = null;
  let shipmentMapLayer = null;
  let currentMapEvents = [];
  let currentTrackingNumber = "";
  let currentStatus = "";

  const localeOf = value => supportedLocales.includes(value) ? value : "en";
  const t = key => translations[html.lang]?.[key] || translations.en?.[key] || key;

  function setLanguage(value) {
    const locale = localeOf(value);
    html.lang = locale;
    html.dir = locale === "ar" ? "rtl" : "ltr";
    if (languageToggle) languageToggle.value = locale;

    // Update active class in custom dropdown
    if (languageMenu) {
      languageMenu.querySelectorAll(".language-option-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.locale === locale);
      });
    }

    // Update all translatable text
    document.querySelectorAll("[data-i18n]").forEach(element => {
      const translation = t(element.dataset.i18n);
      if (translation !== undefined) element.textContent = translation;
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach(element => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });

    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = t("metaDescription");

    document.querySelectorAll("[data-count-complete='true']").forEach(element => {
      const target = Number(element.dataset.countTarget);
      if (Number.isFinite(target)) element.textContent = target.toLocaleString(locale);
    });

    document.title = "ExportFlow — " + t("kicker");
    if (currentStatus) updateJourneyStepper(currentStatus);

    try { localStorage.setItem("exportflow-language", locale); } catch {}
  }

  // Language Dropdown Interactions
  if (languageBtnTrigger && languageMenu) {
    languageBtnTrigger.addEventListener("click", event => {
      event.stopPropagation();
      const isOpen = languageMenu.classList.toggle("open");
      languageBtnTrigger.setAttribute("aria-expanded", String(isOpen));
    });

    languageMenu.querySelectorAll(".language-option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const selected = btn.dataset.locale;
        setLanguage(selected);
        languageMenu.classList.remove("open");
        languageBtnTrigger.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", event => {
      if (!languageBtnTrigger.contains(event.target) && !languageMenu.contains(event.target)) {
        languageMenu.classList.remove("open");
        languageBtnTrigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (languageToggle) {
    languageToggle.addEventListener("change", event => setLanguage(event.target.value));
  }

  function clearTrackingInputs() {
    let hadValue = false;
    if (trackingInput && trackingInput.value) {
      trackingInput.value = "";
      hadValue = true;
    }
    if (postcodeInput && postcodeInput.value) {
      postcodeInput.value = "";
      hadValue = true;
    }
    if (clearInput) clearInput.hidden = true;
    if (formError) formError.hidden = true;
    if (trackingInput) trackingInput.focus();
    return hadValue;
  }

  function updateClearBtnVisibility() {
    if (clearInput) {
      const hasContent = Boolean(
        (trackingInput && trackingInput.value.length > 0) ||
        (postcodeInput && postcodeInput.value.length > 0)
      );
      clearInput.hidden = !hasContent;
    }
  }

  // Input actions (typing, clear, paste)
  if (trackingInput) {
    trackingInput.addEventListener("input", () => {
      updateClearBtnVisibility();
      if (formError) formError.hidden = true;
    });
  }

  if (postcodeInput) {
    postcodeInput.addEventListener("input", () => {
      updateClearBtnVisibility();
      if (formError) formError.hidden = true;
    });
  }

  if (clearInput) {
    clearInput.addEventListener("click", () => {
      clearTrackingInputs();
    });
  }

  if (pasteBtn && trackingInput) {
    pasteBtn.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            trackingInput.value = text.trim();
            updateClearBtnVisibility();
            if (formError) formError.hidden = true;
            trackingInput.focus();
          }
        } else {
          trackingInput.focus();
        }
      } catch {
        trackingInput.focus();
      }
    });
  }

  // Keyboard shortcuts for tracking form:
  // - 'Enter' to submit form from either input
  // - 'Esc' to clear inputs and focus tracking input
  function handleFormKeydown(event) {
    if (event.key === "Escape" || event.key === "Esc") {
      event.preventDefault();
      event.stopPropagation();
      clearTrackingInputs();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (trackingForm) {
        if (typeof trackingForm.requestSubmit === "function") {
          trackingForm.requestSubmit();
        } else {
          trackLive(trackingInput ? trackingInput.value : "");
        }
      }
    }
  }

  if (trackingInput) {
    trackingInput.addEventListener("keydown", handleFormKeydown);
  }

  if (postcodeInput) {
    postcodeInput.addEventListener("keydown", handleFormKeydown);
  }

  if (trackingForm) {
    trackingForm.addEventListener("keydown", event => {
      if (event.key === "Escape" || event.key === "Esc") {
        if (!resultPanel || resultPanel.hidden) {
          event.preventDefault();
          clearTrackingInputs();
        }
      }
    });
  }

  function setTrackingBusy(busy) {
    const button = trackingForm ? trackingForm.querySelector('button[type="submit"]') : null;
    if (button) {
      button.disabled = busy;
      button.setAttribute("aria-busy", String(busy));
    }
  }

  function humanize(value) {
    return String(value || "unknown").replace(/[_-]+/g, " ").replace(/\b\w/g, char => char.toUpperCase());
  }

  function getCarrierBadgeText(carrier) {
    const c = String(carrier || "EF").toLowerCase();
    if (c.includes("ups")) return "UPS";
    if (c.includes("dhl")) return "DHL";
    if (c.includes("fedex")) return "FDX";
    if (c.includes("aramex")) return "ARX";
    if (c.includes("usps")) return "USPS";
    return c.slice(0, 3).toUpperCase();
  }

  function stageLabel(stage) {
    const keys = {
      delivered: "stageDelivered",
      out_for_delivery: "stageOutForDelivery",
      in_transit: "stageInTransit",
      available_for_pickup: "stagePickup",
      exception: "stageException",
      failed_attempt: "stageFailed",
      returned: "stageReturned",
      information_received: "stageInfoReceived",
      pending: "stagePending",
      unknown: "stageUnknown"
    };
    return keys[stage] ? t(keys[stage]) : humanize(stage);
  }

  function openResultPanel() {
    resultPanel.hidden = false;
    resultBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    const closeBtn = document.getElementById("closeResult");
    if (closeBtn) closeBtn.focus();
    requestAnimationFrame(renderShipmentMap);
  }

  function setMapEvents(events) {
    currentMapEvents = Array.isArray(events) ? events : [];
  }

  function renderShipmentMap() {
    const container = document.getElementById("shipmentMap");
    const note = document.getElementById("mapNote");
    const count = document.getElementById("mapCount");
    if (!container || !note || !count) return;

    const points = currentMapEvents
      .map(event => ({ event, point: event?.point }))
      .filter(({ point }) => point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
        && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
        && !(point.latitude === 0 && point.longitude === 0));

    const unique = [];
    const seen = new Set();
    for (const entry of points) {
      const key = entry.point.latitude.toFixed(4) + "," + entry.point.longitude.toFixed(4);
      if (!seen.has(key)) { seen.add(key); unique.push(entry); }
    }

    count.textContent = unique.length.toLocaleString(html.lang);

    if (!window.L) {
      note.textContent = t("mapUnavailable");
      return;
    }

    if (!shipmentMapInstance) {
      shipmentMapInstance = L.map(container, { scrollWheelZoom: false, preferCanvas: true }).setView([22, 8], 2);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(shipmentMapInstance);
      shipmentMapLayer = L.layerGroup().addTo(shipmentMapInstance);
    } else {
      shipmentMapLayer.clearLayers();
    }

    if (unique.length) {
      const route = unique.slice().reverse();
      if (route.length > 1) {
        L.polyline(route.map(({ point }) => [point.latitude, point.longitude]), {
          color: "#FF5F57", weight: 3.5, opacity: 0.95, dashArray: "6 6", lineCap: "round"
        }).addTo(shipmentMapLayer);
      }
      for (const entry of unique) {
        const label = entry.event.location || entry.event.description || "Shipment scan";
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = label;
        const meta = document.createElement("small");
        meta.textContent = entry.event.time || "";
        meta.style.display = "block";
        meta.style.color = "#64748B";
        popup.append(title, meta);
        L.circleMarker([entry.point.latitude, entry.point.longitude], {
          radius: 7, color: "#FFFFFF", weight: 2.5, fillColor: "#FF5F57", fillOpacity: 1
        }).bindPopup(popup).addTo(shipmentMapLayer);
      }
      if (unique.length === 1) {
        shipmentMapInstance.setView([unique[0].point.latitude, unique[0].point.longitude], 5);
      } else {
        shipmentMapInstance.fitBounds(L.latLngBounds(route.map(({ point }) => [point.latitude, point.longitude])), {
          padding: [28, 28], maxZoom: 6
        });
      }
      note.textContent = t("mapWithCoordinates");
    } else {
      shipmentMapInstance.setView([22, 8], 2);
      note.textContent = t("mapNoCoordinates");
    }
    requestAnimationFrame(() => shipmentMapInstance?.invalidateSize());
  }

  function getTimelineEventIcon(title, stage, isLatest) {
    const text = String(title || "").toLowerCase();

    // 1. Delivered / Arrival at destination
    if (text.includes("deliver") || text.includes("وصل") || text.includes("توصيل") || stage === "delivered") {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m8 12 3 3 5-5" stroke-width="2.5"/></svg>`;
    }
    // 2. Out for delivery / Courier / Vehicle / Hand-off
    if (text.includes("out for delivery") || text.includes("مع المندوب") || text.includes("courier") || text.includes("driver") || stage === "out_for_delivery") {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="16" height="12" x="4" y="6" rx="2"/><circle cx="18" cy="18" r="3"/><path d="M4 10h16M10 14h4"/></svg>`;
    }
    // 3. Sorting facility / Hub / Distribution center / Warehouse
    if (text.includes("facility") || text.includes("hub") || text.includes("center") || text.includes("sort") || text.includes("مركز") || text.includes("فرز") || text.includes("station")) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 21h18M5 21V7l8-4v18M13 11l6-3v13"/><path d="M9 9h1M9 13h1M9 17h1"/></svg>`;
    }
    // 4. Customs / Clearance / International / Port / Inspection
    if (text.includes("custom") || text.includes("clearance") || text.includes("جمارك") || text.includes("border") || text.includes("import") || text.includes("export") || text.includes("tax")) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`;
    }
    // 5. Transit / En route / Transport / Flight / Departed
    if (text.includes("transit") || text.includes("depart") || text.includes("غادر") || text.includes("طريق") || text.includes("flight") || text.includes("arrive") || stage === "in_transit") {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5.5a1.5 1.5 0 0 0-.44-1.06L18 7h-4v11"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`;
    }
    // 6. Information received / Order confirmed / Label created
    if (text.includes("info") || text.includes("label") || text.includes("order") || text.includes("received") || text.includes("طلب") || text.includes("بيانات") || stage === "information_received" || stage === "pending") {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 12v10"/></svg>`;
    }
    // 7. Active latest event / Fallback
    if (isLatest) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6 9 17l-5-5"/></svg>`;
  }

  function updateJourneyStepper(stage) {
    const card = document.getElementById("journeyCard");
    const fill = document.getElementById("journeyTrackFill");
    const liveStage = document.getElementById("journeyLiveStage");
    const track = document.getElementById("journeyProgressTrack");
    const steps = [
      document.getElementById("stepInfo"),
      document.getElementById("stepTransit"),
      document.getElementById("stepDelivery"),
      document.getElementById("stepDelivered")
    ];
    if (!card || !fill || !liveStage) return;

    let activeIndex = 1; // 0 = info, 1 = transit, 2 = delivery, 3 = delivered
    let percent = 50;

    switch (stage) {
      case "information_received":
      case "pending":
        activeIndex = 0;
        percent = 15;
        break;
      case "in_transit":
        activeIndex = 1;
        percent = 50;
        break;
      case "out_for_delivery":
      case "available_for_pickup":
        activeIndex = 2;
        percent = 78;
        break;
      case "delivered":
        activeIndex = 3;
        percent = 100;
        break;
      default:
        activeIndex = 1;
        percent = 50;
        break;
    }

    fill.style.width = percent + "%";
    if (track) track.setAttribute("aria-valuenow", String(percent));
    liveStage.textContent = stageLabel(stage);

    steps.forEach((step, idx) => {
      if (!step) return;
      step.classList.remove("completed", "active", "upcoming");
      if (idx < activeIndex) {
        step.classList.add("completed");
      } else if (idx === activeIndex) {
        if (stage === "delivered") {
          step.classList.add("completed");
        } else {
          step.classList.add("active");
        }
      } else {
        step.classList.add("upcoming");
      }
    });
  }

  function renderTimeline(events) {
    const timeline = document.querySelector(".timeline");
    if (!timeline) return;
    timeline.replaceChildren();
    const eventCount = document.getElementById("eventCount");
    if (eventCount) eventCount.textContent = events.length.toLocaleString(html.lang);

    events.forEach((event, index) => {
      const item = document.createElement("div");
      item.className = "timeline-item " + (event.state || "upcoming");
      item.style.animationDelay = (index * 50) + "ms";

      const node = document.createElement("span");
      node.className = "timeline-node";
      node.setAttribute("aria-hidden", "true");
      node.innerHTML = getTimelineEventIcon(event.title, event.stage, index === 0);

      const body = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = event.title || t("resultSubtitle");
      const meta = document.createElement("small");
      meta.textContent = event.meta || "";
      body.append(title, meta);

      item.append(node, body);
      timeline.append(item);
    });
  }

  async function trackLive(value) {
    const number = (value || "").trim();
    if (!number) {
      if (formError) {
        formError.textContent = t("errorEmpty");
        formError.hidden = false;
      }
      if (trackingInput) trackingInput.focus();
      return;
    }

    currentTrackingNumber = number;
    if (formError) formError.hidden = true;
    setTrackingBusy(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28_000);

    try {
      const postcodeVal = postcodeInput ? postcodeInput.value.trim() : "";
      const response = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          number,
          language: html.lang,
          ...(postcodeVal ? { postcode: postcodeVal } : {})
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errors = {
          invalid_tracking_number: "errorInvalid",
          invalid_input: "errorInvalid",
          not_found: "errorNotFound",
          rate_limited: "errorRateLimited",
          input_required: "errorInputRequired",
          tracking_unavailable: "errorUnavailable",
          temporarily_busy: "errorBusy"
        };
        throw new Error(t(errors[payload.error] || "errorGeneric"));
      }

      document.getElementById("resultEyebrow").textContent = t("resultLiveEyebrow");
      document.getElementById("resultSourceNote").textContent = t("resultSourceNote");

      const carrierName = humanize(payload.carrier || "unknown");
      const service = payload.service ? " · " + payload.service : "";
      document.querySelector(".result-carrier").textContent = carrierName + service;

      if (carrierLogoBadge) {
        carrierLogoBadge.textContent = getCarrierBadgeText(payload.carrier);
      }

      document.getElementById("resultStatus").textContent = stageLabel(payload.status);
      document.getElementById("resultLiveLabel").textContent = t("liveLabel");
      document.getElementById("resultTrackingCode").textContent = number;

      const etaCard = document.getElementById("etaCard");
      const etaText = document.getElementById("etaText");
      if (payload.expectedDelivery) {
        etaText.textContent = payload.expectedDelivery;
        etaCard.hidden = false;
      } else {
        etaCard.hidden = true;
      }

      currentStatus = payload.status || "in_transit";
      updateJourneyStepper(currentStatus);

      const events = Array.isArray(payload.events) ? payload.events : [];
      setMapEvents(events);

      if (events.length) {
        renderTimeline(events.map((event, index) => ({
          title: event.description || t("resultSubtitle"),
          meta: [event.time, event.location].filter(Boolean).join(" · "),
          stage: event.stage || (index === 0 ? payload.status : "in_transit"),
          state: index === 0 ? "active" : "complete"
        })));
      } else {
        renderTimeline([{
          title: t("emptyResultTitle"),
          meta: t("emptyResultCopy"),
          stage: payload.status || "information_received",
          state: "active"
        }]);
      }

      openResultPanel();
    } catch (error) {
      if (formError) {
        formError.textContent = error?.name === "AbortError" ? t("errorTimedOut") : (error?.message || t("errorGeneric"));
        formError.hidden = false;
      }
    } finally {
      clearTimeout(timeout);
      setTrackingBusy(false);
    }
  }

  if (trackingForm) {
    trackingForm.addEventListener("submit", event => {
      event.preventDefault();
      trackLive(trackingInput ? trackingInput.value : "");
    });
  }

  // Copy Tracking Number button
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener("click", async () => {
      if (!currentTrackingNumber) return;
      try {
        await navigator.clipboard.writeText(currentTrackingNumber);
        if (copyBtnLabel) {
          const original = copyBtnLabel.textContent;
          copyBtnLabel.textContent = t("trackingCopied");
          setTimeout(() => {
            copyBtnLabel.textContent = t("copyTracking");
          }, 2000);
        }
      } catch {
        // Fallback
      }
    });
  }

  // Share tracking button
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const shareData = {
        title: "ExportFlow Tracking",
        text: `Track shipment ${currentTrackingNumber} on ExportFlow`,
        url: window.location.href
      };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch {}
      } else if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(window.location.href);
          alert(t("trackingCopied"));
        } catch {}
      }
    });
  }

  // Refresh tracking button
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (currentTrackingNumber) trackLive(currentTrackingNumber);
    });
  }

  function closeResult() {
    resultPanel.hidden = true;
    resultBackdrop.hidden = true;
    document.body.style.overflow = "";
    if (trackingInput) trackingInput.focus();
  }

  const closeResultBtn = document.getElementById("closeResult");
  if (closeResultBtn) closeResultBtn.addEventListener("click", closeResult);
  const doneResultBtn = document.getElementById("doneResult");
  if (doneResultBtn) doneResultBtn.addEventListener("click", closeResult);
  if (resultBackdrop) resultBackdrop.addEventListener("click", closeResult);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" || event.key === "Esc") {
      if (resultPanel && !resultPanel.hidden) {
        closeResult();
        return;
      }
      if (languageMenu && languageMenu.classList.contains("open")) {
        languageMenu.classList.remove("open");
        if (languageBtnTrigger) languageBtnTrigger.setAttribute("aria-expanded", "false");
        return;
      }
      const activeEl = document.activeElement;
      const isWithinForm = trackingForm && (
        trackingForm.contains(activeEl) ||
        activeEl === trackingInput ||
        activeEl === postcodeInput
      );
      if (isWithinForm) {
        event.preventDefault();
        clearTrackingInputs();
      }
    }
  });

  function animateCatalogMetric(element, rawValue) {
    if (!element) return;
    const target = Number(rawValue);
    if (!Number.isFinite(target) || target < 0) {
      element.textContent = "—";
      return;
    }

    const value = Math.round(target);
    element.dataset.countTarget = String(value);
    let started = false;

    const run = () => {
      if (started) return;
      started = true;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const format = number => Math.round(number).toLocaleString(html.lang || "en");

      if (reducedMotion) {
        element.textContent = format(value);
        element.dataset.countComplete = "true";
        return;
      }

      element.classList.add("is-counting");
      const duration = 760;
      const startTime = performance.now();
      const frame = now => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        element.textContent = format(value * eased);
        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          element.textContent = format(value);
          element.classList.remove("is-counting");
          element.classList.add("is-counted");
          element.dataset.countComplete = "true";
        }
      };
      requestAnimationFrame(frame);
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          run();
        }
      }, { threshold: 0.35 });
      observer.observe(element);
    } else {
      run();
    }
  }

  async function loadCatalogStats() {
    try {
      const response = await fetch("/api/coverage", { cache: "no-store", headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error("coverage_unavailable");
      const payload = await response.json();
      const summary = payload.summary || {};
      const catalogEl = document.getElementById("catalogEntryCount");
      const directEl = document.getElementById("directCountryCount");
      const isoEl = document.getElementById("isoCountryCount");
      animateCatalogMetric(catalogEl, summary.catalogEntries ?? 0);
      animateCatalogMetric(directEl, summary.directCountryCount ?? 0);
      animateCatalogMetric(isoEl, summary.allCountries ?? 249);
    } catch {
      const catalogEl = document.getElementById("catalogEntryCount");
      const directEl = document.getElementById("directCountryCount");
      const isoEl = document.getElementById("isoCountryCount");
      if (catalogEl) catalogEl.textContent = "—";
      if (directEl) directEl.textContent = "—";
      animateCatalogMetric(isoEl, 249);
    }
  }

  // Smooth scroll handler for all internal navigation links (#how, #faq, #track, #top, etc.)
  function initSmoothScrolling() {
    function smoothScrollTo(targetElement, hash) {
      if (!targetElement) return;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      targetElement.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
      });

      if (hash) {
        try {
          history.pushState(null, "", hash);
        } catch {
          window.location.hash = hash;
        }
      }

      // If targeting the tracking card, focus tracking input for seamless usability
      if (targetElement.id === "track" || targetElement.contains(trackingInput)) {
        if (trackingInput) {
          setTimeout(() => trackingInput.focus({ preventScroll: true }), 400);
        }
      } else {
        targetElement.setAttribute("tabindex", "-1");
        targetElement.focus({ preventScroll: true });
      }
    }

    document.addEventListener("click", event => {
      const anchor = event.target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Match internal hashes: "#something" or "/#something" or "index.html#something"
      let hash = "";
      if (href.startsWith("#") && href.length > 1) {
        hash = href;
      } else {
        try {
          const url = new URL(anchor.href, window.location.href);
          if (url.origin === window.location.origin &&
              (url.pathname === window.location.pathname || url.pathname === "/" || url.pathname === "/index.html") &&
              url.hash && url.hash.length > 1) {
            hash = url.hash;
          }
        } catch {}
      }

      if (!hash) return;

      const targetId = hash.slice(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        event.preventDefault();
        smoothScrollTo(targetElement, hash);
      }
    });

    // Handle initial hash on page load
    if (window.location.hash) {
      const initialId = window.location.hash.slice(1);
      const initialTarget = document.getElementById(initialId);
      if (initialTarget) {
        setTimeout(() => {
          smoothScrollTo(initialTarget, window.location.hash);
        }, 150);
      }
    }
  }

  let savedLanguage = "en";
  try { savedLanguage = localStorage.getItem("exportflow-language") || "en"; } catch {}
  setLanguage(savedLanguage);
  loadCatalogStats();
  initSmoothScrolling();
})();
