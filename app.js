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

  let shipmentMapInstance = null;
  let shipmentMapLayer = null;
  let currentMapEvents = [];
  let currentTrackingNumber = "";

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

    document.title = "ExportFlow — " + t("kicker");

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

  // Input actions (typing, clear, paste)
  if (trackingInput) {
    trackingInput.addEventListener("input", () => {
      if (clearInput) clearInput.hidden = trackingInput.value.length === 0;
      if (formError) formError.hidden = true;
    });
  }

  if (clearInput && trackingInput) {
    clearInput.addEventListener("click", () => {
      trackingInput.value = "";
      clearInput.hidden = true;
      if (formError) formError.hidden = true;
      trackingInput.focus();
    });
  }

  if (pasteBtn && trackingInput) {
    pasteBtn.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            trackingInput.value = text.trim();
            if (clearInput) clearInput.hidden = false;
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

  function renderTimeline(events) {
    const timeline = document.querySelector(".timeline");
    if (!timeline) return;
    timeline.replaceChildren();
    const eventCount = document.getElementById("eventCount");
    if (eventCount) eventCount.textContent = events.length.toLocaleString(html.lang);

    for (const event of events) {
      const item = document.createElement("div");
      item.className = "timeline-item " + (event.state || "upcoming");

      const node = document.createElement("span");
      node.className = "timeline-node";
      node.setAttribute("aria-hidden", "true");

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      if (event.state === "complete") {
        path.setAttribute("d", "M20 6 9 17l-5-5");
      } else if (event.state === "active") {
        path.setAttribute("d", "M12 2v20M2 12h20");
      } else {
        path.setAttribute("d", "M12 6v6l4 2");
      }
      svg.appendChild(path);
      node.appendChild(svg);

      const body = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = event.title || t("resultSubtitle");
      const meta = document.createElement("small");
      meta.textContent = event.meta || "";
      body.append(title, meta);

      item.append(node, body);
      timeline.append(item);
    }
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

      const events = Array.isArray(payload.events) ? payload.events : [];
      setMapEvents(events);

      if (events.length) {
        renderTimeline(events.map((event, index) => ({
          title: event.description || t("resultSubtitle"),
          meta: [event.time, event.location].filter(Boolean).join(" · "),
          state: index === 0 ? "active" : "complete"
        })));
      } else {
        renderTimeline([{
          title: t("emptyResultTitle"),
          meta: t("emptyResultCopy"),
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
    if (event.key === "Escape" && resultPanel && !resultPanel.hidden) closeResult();
  });

  async function loadCatalogStats() {
    try {
      const response = await fetch("/api/coverage", { cache: "no-store", headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error("coverage_unavailable");
      const payload = await response.json();
      const summary = payload.summary || {};
      const catalogEl = document.getElementById("catalogEntryCount");
      const directEl = document.getElementById("directCountryCount");
      const isoEl = document.getElementById("isoCountryCount");
      if (catalogEl) catalogEl.textContent = Number(summary.catalogEntries || 0).toLocaleString(html.lang);
      if (directEl) directEl.textContent = Number(summary.directCountryCount || 0).toLocaleString(html.lang);
      if (isoEl) isoEl.textContent = Number(summary.allCountries || 249).toLocaleString(html.lang);
    } catch {
      const catalogEl = document.getElementById("catalogEntryCount");
      const directEl = document.getElementById("directCountryCount");
      const isoEl = document.getElementById("isoCountryCount");
      if (catalogEl) catalogEl.textContent = "—";
      if (directEl) directEl.textContent = "—";
      if (isoEl) isoEl.textContent = "249";
    }
  }

  let savedLanguage = "en";
  try { savedLanguage = localStorage.getItem("exportflow-language") || "en"; } catch {}
  setLanguage(savedLanguage);
  loadCatalogStats();
})();
