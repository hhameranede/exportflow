(() => {
  const translations = window.EXPORTFLOW_TRANSLATIONS || {};
  const supportedLocales = ["en", "ar", "es", "zh", "hi", "pt", "fr", "ru"];
  const html = document.documentElement;
  const languageToggle = document.getElementById("languageToggle");
  const trackingInput = document.getElementById("trackingNumber");
  const postcodeInput = document.getElementById("postcodeInput");
  const clearInput = document.getElementById("clearInput");
  const trackingForm = document.getElementById("trackingForm");
  const formError = document.getElementById("formError");
  const resultPanel = document.getElementById("resultPanel");
  const resultBackdrop = document.getElementById("resultBackdrop");
  let shipmentMapInstance = null;
  let shipmentMapLayer = null;
  let currentMapEvents = [];

  const localeOf = value => supportedLocales.includes(value) ? value : "en";
  const t = key => translations[html.lang]?.[key] || translations.en?.[key] || key;

  function setLanguage(value) {
    const locale = localeOf(value);
    html.lang = locale;
    html.dir = locale === "ar" ? "rtl" : "ltr";
    languageToggle.value = locale;
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

  languageToggle.addEventListener("change", event => setLanguage(event.target.value));
  trackingInput.addEventListener("input", () => {
    clearInput.hidden = trackingInput.value.length === 0;
    formError.hidden = true;
  });
  clearInput.addEventListener("click", () => {
    trackingInput.value = "";
    clearInput.hidden = true;
    trackingInput.focus();
  });

  function setTrackingBusy(busy) {
    const button = trackingForm.querySelector('button[type="submit"]');
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
  }

  function humanize(value) {
    return String(value || "unknown").replace(/[_-]+/g, " ").replace(/\b\w/g, char => char.toUpperCase());
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
    document.getElementById("closeResult").focus();
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
          color: "#f07845", weight: 3, opacity: .9, dashArray: "7 8", lineCap: "round"
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
        meta.style.color = "#87939e";
        popup.append(title, meta);
        L.circleMarker([entry.point.latitude, entry.point.longitude], {
          radius: 7, color: "#fff", weight: 3, fillColor: "#f07845", fillOpacity: 1
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
    timeline.replaceChildren();
    const eventCount = document.getElementById("eventCount");
    eventCount.textContent = events.length.toLocaleString(html.lang);
    for (const event of events) {
      const item = document.createElement("div");
      item.className = "timeline-item " + (event.state || "upcoming");
      const node = document.createElement("span");
      node.className = "timeline-node";
      node.textContent = event.state === "complete" ? "✓" : event.state === "active" ? "•" : "";
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
    const number = value.trim();
    if (!number) {
      formError.textContent = t("errorEmpty");
      formError.hidden = false;
      trackingInput.focus();
      return;
    }
    formError.hidden = true;
    setTrackingBusy(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28_000);
    try {
      const response = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          number,
          language: html.lang,
          ...(postcodeInput.value.trim() ? { postcode: postcodeInput.value.trim() } : {})
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
      document.querySelector(".result-carrier").textContent = humanize(payload.carrier || "unknown");
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
          title: t("resultLiveEyebrow"),
          meta: t("mapNoCoordinates"),
          state: "active"
        }]);
      }
      const service = payload.service ? " · " + payload.service : "";
      document.querySelector(".result-carrier").textContent = humanize(payload.carrier || "unknown") + service;
      openResultPanel();
    } catch (error) {
      formError.textContent = error?.name === "AbortError" ? t("errorTimedOut") : (error?.message || t("errorGeneric"));
      formError.hidden = false;
    } finally {
      clearTimeout(timeout);
      setTrackingBusy(false);
    }
  }

  trackingForm.addEventListener("submit", event => {
    event.preventDefault();
    trackLive(trackingInput.value);
  });

  function closeResult() {
    resultPanel.hidden = true;
    resultBackdrop.hidden = true;
    document.body.style.overflow = "";
    document.getElementById("trackingNumber").focus();
  }
  document.getElementById("closeResult").addEventListener("click", closeResult);
  document.getElementById("doneResult").addEventListener("click", closeResult);
  resultBackdrop.addEventListener("click", closeResult);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !resultPanel.hidden) closeResult();
  });

  async function loadCatalogStats() {
    try {
      const response = await fetch("/api/coverage", { cache: "no-store", headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error("coverage_unavailable");
      const payload = await response.json();
      const summary = payload.summary || {};
      document.getElementById("catalogEntryCount").textContent = Number(summary.catalogEntries || 0).toLocaleString(html.lang);
      document.getElementById("directCountryCount").textContent = Number(summary.directCountryCount || 0).toLocaleString(html.lang);
      document.getElementById("isoCountryCount").textContent = Number(summary.allCountries || 249).toLocaleString(html.lang);
    } catch {
      document.getElementById("catalogEntryCount").textContent = "—";
      document.getElementById("directCountryCount").textContent = "—";
      document.getElementById("isoCountryCount").textContent = "249";
    }
  }

  let savedLanguage = "en";
  try { savedLanguage = localStorage.getItem("exportflow-language") || "en"; } catch {}
  setLanguage(savedLanguage);
  loadCatalogStats();
})();
