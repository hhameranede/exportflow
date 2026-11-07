(() => {
  const supported = ["en", "ar", "es", "zh", "hi", "pt", "fr", "bn"];
  const html = document.documentElement;
  const translations = window.EXPORTFLOW_TRANSLATIONS || {};
  const languageToggle = document.getElementById("languageToggle");
  const languageBtnTrigger = document.getElementById("languageBtnTrigger");
  const languageMenu = document.getElementById("languageMenu");
  const searchInput = document.getElementById("coverageSearch");
  const filterSelect = document.getElementById("coverageFilter");
  const list = document.getElementById("coverageCountryList");
  const rows = [...list.querySelectorAll("[data-country-code]")];
  const resultCount = document.getElementById("coverageResultCount");
  const evidenceSearch = document.getElementById("carrierEvidenceSearch");
  const evidenceFilter = document.getElementById("carrierEvidenceFilter");
  const adapterFilter = document.getElementById("carrierEvidenceAdapterFilter");
  const evidenceList = document.getElementById("carrierEvidenceList");
  const evidenceMessage = document.getElementById("carrierEvidenceMessage");
  const evidencePrevious = document.getElementById("carrierEvidencePrevious");
  const evidenceNext = document.getElementById("carrierEvidenceNext");
  const evidencePageInfo = document.getElementById("carrierEvidencePageInfo");
  let directoryPayload = null;
  let directoryPage = 1;
  let directoryRequestId = 0;
  let directoryDebounce = null;
  let locale = "en";

  const t = key => translations[locale]?.[key] || translations.en?.[key] || key;
  const safeLocale = value => supported.includes(value) ? value : "en";

  function localeFromPath() {
    const match = window.location.pathname.match(/^\/(ar|es|zh|hi|pt|fr|bn)(?=\/|$)/);
    return match ? match[1] : null;
  }

  function persistLocale(value) {
    try { localStorage.setItem("exportflow-language", value); } catch {}
    try {
      document.cookie = "ef-locale=" + encodeURIComponent(value) +
        "; Max-Age=31536000; Path=/; SameSite=Lax" +
        (window.location.protocol === "https:" ? "; Secure" : "");
    } catch {}
  }

  function syncLocalePath(value) {
    const currentPath = window.location.pathname;
    const match = currentPath.match(/^\/(ar|es|zh|hi|pt|fr|bn)(?=\/|$)/);
    let pagePath = match ? currentPath.slice(match[0].length) || "/" : currentPath;
    if (!pagePath.startsWith("/")) pagePath = "/" + pagePath;
    const nextPath = value === "en"
      ? pagePath
      : "/" + value + (pagePath === "/" ? "/" : pagePath);

    if (nextPath !== currentPath) {
      window.history.replaceState(window.history.state, "", nextPath + window.location.search + window.location.hash);
    }
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = window.location.origin + nextPath;
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = window.location.origin + nextPath;

    document.querySelectorAll('a[href="/"]').forEach(link => {
      link.setAttribute("href", value === "en" ? "/" : "/" + value + "/");
    });
    document.querySelectorAll('a[href="/coverage/"]').forEach(link => {
      link.setAttribute("href", value === "en" ? "/coverage/" : "/" + value + "/coverage/");
    });
  }

  function countryName(code) {
    try {
      return new Intl.DisplayNames([locale], { type: "region" }).of(code) || code;
    } catch {
      return rows.find(row => row.dataset.countryCode === code)?.querySelector(".coverage-country-name")?.textContent || code;
    }
  }

  function setLanguage(value) {
    locale = safeLocale(value);
    html.lang = locale;
    html.dir = locale === "ar" ? "rtl" : "ltr";
    if (languageToggle) languageToggle.value = locale;
    if (languageMenu) {
      languageMenu.querySelectorAll(".language-option-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.locale === locale);
      });
    }
    document.querySelectorAll("[data-i18n]").forEach(element => {
      const translation = t(element.dataset.i18n);
      if (translation) element.textContent = translation;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });
    document.title = t("coveragePageTitle") + " — ExportFlow";
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = t("coveragePageDescription");
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogTitle) ogTitle.content = document.title;
    if (ogDescription && description) ogDescription.content = description.content;
    rows.forEach(row => {
      const name = row.querySelector(".coverage-country-name");
      if (name) name.textContent = countryName(row.dataset.countryCode);
      updateStatusLabel(row);
    });
    updateList();
    renderCarrierDirectory(directoryPayload);
    syncLocalePath(locale);
    persistLocale(locale);
  }

  function statusKey(status) {
    return ({
      direct: "coverageStatusDirect",
      "universal-fallback": "coverageStatusFallback",
      "link-only": "coverageStatusLink",
      "not-listed": "coverageStatusNone",
      loading: "coverageStatusLoading"
    })[status] || "coverageStatusNone";
  }

  function updateStatusLabel(row) {
    const statusLabel = row.querySelector("[data-country-status]");
    if (statusLabel) statusLabel.textContent = t(statusKey(row.dataset.status || "loading"));
  }

  function updateList() {
    const term = (searchInput.value || "").trim().toLocaleLowerCase(locale);
    const status = filterSelect.value;
    let visible = 0;
    rows.forEach(row => {
      const haystack = [
        row.querySelector(".coverage-country-name")?.textContent || "",
        row.dataset.countryCode || "",
        row.dataset.carriersSearch || row.querySelector("[data-country-carriers]")?.textContent || ""
      ].join(" ").toLocaleLowerCase(locale);
      const matches = (!term || haystack.includes(term)) && (status === "all" || row.dataset.status === status);
      row.hidden = !matches;
      if (matches) visible += 1;
    });
    resultCount.textContent = visible === 0 ? t("coverageNoResults") : visible + " / " + rows.length;
  }

  function applyCatalog(payload) {
    const summary = payload.summary || {};
    document.getElementById("coverageTotalCountries").textContent = Number(summary.allCountries || rows.length).toLocaleString(locale);
    document.getElementById("coverageCatalogEntries").textContent = Number(summary.catalogEntries || 0).toLocaleString(locale);
    document.getElementById("coverageDirectCountries").textContent = Number(summary.directCountryCount || 0).toLocaleString(locale);
    const byCode = new Map((payload.countries || []).map(country => [country.code, country]));
    rows.forEach(row => {
      const country = byCode.get(row.dataset.countryCode);
      if (!country) {
        row.dataset.status = "not-listed";
        updateStatusLabel(row);
        return;
      }
      row.dataset.status = country.status || "not-listed";
      const carriers = row.querySelector("[data-country-carriers]");
      if (carriers) {
        const names = (country.carriers || []).map(carrier => carrier.name).filter(Boolean);
        row.dataset.carriersSearch = names.join(" ");
        carriers.textContent = names.slice(0, 5).join(" · ") + (names.length > 5 ? " · +" + (names.length - 5) : "");
      }
      updateStatusLabel(row);
    });
    updateList();
  }

  function translateEvidenceStatus(level) {
    const keys = {
      catalogued: "carrierEvidenceCatalogued",
      research: "carrierEvidenceResearch",
      testing: "carrierEvidenceTesting",
      integrated: "carrierEvidenceIntegrated",
      verified: "carrierEvidenceVerified",
      blocked: "carrierEvidenceBlocked",
      deprecated: "carrierEvidenceDeprecated"
    };
    return t(keys[level] || "carrierEvidenceCatalogued");
  }

  function evidenceAccessLabel(value) {
    const keys = {
      not_assessed: "carrierEvidenceAccessNone",
      contracted_account_required: "carrierEvidenceAccessAccount",
      account_and_eula_required: "carrierEvidenceAccessAccount",
      partner_onboarding_required: "carrierEvidenceAccessPartner",
      developer_onboarding_required: "carrierEvidenceAccessPartner",
      business_account_onboarding_required: "carrierEvidenceAccessAccount",
      country_specific_approval_required: "carrierEvidenceAccessPartner",
      third_party_provider_approval_required: "carrierEvidenceAccessPartner",
      written_permission_required: "carrierEvidenceAccessWritten",
      third_party_service_unverified: "carrierEvidenceAccessReview",
      public_tracker_unverified: "carrierEvidenceAccessReview",
      api_offer_access_unconfirmed: "carrierEvidenceAccessReview",
      customer_code_scoped: "carrierEvidenceAccessMerchant",
      merchant_account_scoped: "carrierEvidenceAccessMerchant",
      authorized_service_provider: "carrierEvidenceAccessAuthorized"
    };
    return t(keys[value] || "carrierEvidenceAccessNone");
  }

  function evidenceRightsLabel(value) {
    const keys = {
      not_assessed: "carrierEvidenceRightsNone",
      own_shipments_scope: "carrierEvidenceRightsOwn",
      third_party_permission_required: "carrierEvidenceRightsPending",
      third_party_authorized: "carrierEvidenceRightsAuthorized"
    };
    return t(keys[value] || "carrierEvidenceRightsNone");
  }

  function evidenceAdapterLabel(record) {
    if (record.evidence?.adapterState === "country_specific") return t("carrierEvidenceAdapterCountry");
    const keys = {
      dedicated: "carrierEvidenceAdapterPresent",
      "universal-fallback": "carrierEvidenceAdapterUniversal",
      "link-only": "carrierEvidenceAdapterLinkOnly",
      none: "carrierEvidenceAdapterNone"
    };
    return t(keys[record.adapterType] || "carrierEvidenceAdapterNone");
  }

  function appendEvidenceLine(card, label, value, className) {
    if (!value) return;
    const line = document.createElement("p");
    line.className = className || "carrier-evidence-meta";
    const heading = document.createElement("strong");
    heading.textContent = label + ": ";
    const text = document.createElement("span");
    text.textContent = value;
    line.append(heading, text);
    card.append(line);
  }

  function renderCarrierDirectory(payload) {
    if (!payload || !evidenceList) return;
    const summary = payload.summary || {};
    const snapshot = payload.upstreamSnapshot || {};
    const catalogCount = document.getElementById("carrierEvidenceCatalogCount");
    const adapterCount = document.getElementById("carrierEvidenceAdapterCount");
    const researchCount = document.getElementById("carrierEvidenceResearchCount");
    const verifiedCount = document.getElementById("carrierEvidenceVerifiedCount");
    if (catalogCount) catalogCount.textContent = Number(summary.catalogEntries || 0).toLocaleString(locale);
    if (adapterCount) adapterCount.textContent = Number(summary.dedicatedAdapterRecords || 0).toLocaleString(locale);
    if (researchCount) researchCount.textContent = Number(summary.evidenceRecords || 0).toLocaleString(locale);
    if (verifiedCount) verifiedCount.textContent = Number(summary.evidenceCounts?.verified || 0).toLocaleString(locale);

    const sourceNote = document.getElementById("carrierEvidenceUpstreamNote");
    if (sourceNote) {
      sourceNote.textContent = t("carrierEvidenceUpstreamNote")
        .replace("{networks}", String(snapshot.carrierNetworkClaim || "—"))
        .replace("{entries}", Number(snapshot.catalogEntries || 0).toLocaleString(locale))
        .replace("{adapters}", Number(snapshot.dedicatedAdapters || 0).toLocaleString(locale))
        .replace("{countries}", Number(snapshot.countriesRepresented || 0).toLocaleString(locale));
    }

    evidenceList.replaceChildren();
    const records = Array.isArray(payload.records) ? payload.records : [];
    if (records.length === 0) {
      if (evidenceMessage) evidenceMessage.textContent = t("carrierEvidenceNoResults");
    } else if (evidenceMessage) {
      evidenceMessage.textContent = "";
    }

    for (const record of records) {
      const card = document.createElement("article");
      card.className = "carrier-evidence-card";
      const header = document.createElement("div");
      header.className = "carrier-evidence-card-header";
      const nameGroup = document.createElement("div");
      nameGroup.className = "carrier-evidence-name-group";
      const name = document.createElement("h3");
      name.textContent = record.name || record.id;
      const id = document.createElement("code");
      id.textContent = record.id;
      nameGroup.append(name, id);
      const badge = document.createElement("span");
      badge.className = "carrier-evidence-status status-" + String(record.evidence?.level || "catalogued").replace(/[^a-z-]/g, "");
      badge.textContent = translateEvidenceStatus(record.evidence?.level || "catalogued");
      header.append(nameGroup, badge);
      card.append(header);

      appendEvidenceLine(
        card,
        t("carrierEvidenceCountryLabel"),
        Array.isArray(record.countries) && record.countries.length
          ? record.countries.join(", ")
          : (record.countryScope || "—")
      );
      if (Array.isArray(record.aliases) && record.aliases.length) {
        appendEvidenceLine(card, t("carrierEvidenceAliasesLabel"), record.aliases.slice(0, 4).join(" · "));
      }
      appendEvidenceLine(
        card,
        t("carrierEvidenceAdapterLabel"),
        (record.adapter || "—") + " · " + evidenceAdapterLabel(record)
      );
      appendEvidenceLine(
        card,
        t("carrierEvidenceAccessLabel"),
        evidenceAccessLabel(record.evidence?.commercialAccess)
      );
      appendEvidenceLine(
        card,
        t("carrierEvidenceRightsLabel"),
        evidenceRightsLabel(record.evidence?.trackingRights)
      );

      if (record.evidence?.sourceUrl) {
        const source = document.createElement("a");
        source.className = "carrier-evidence-source";
        source.href = record.evidence.sourceUrl;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.textContent = t("carrierEvidenceSource");
        card.append(source);
      }
      evidenceList.append(card);
    }

    const pagination = payload.pagination || {};
    if (evidencePrevious) evidencePrevious.disabled = !pagination.hasPrevious;
    if (evidenceNext) evidenceNext.disabled = !pagination.hasNext;
    if (evidencePageInfo) {
      evidencePageInfo.textContent = t("carrierEvidencePageInfo")
        .replace("{page}", Number(pagination.page || 1).toLocaleString(locale))
        .replace("{total}", Number(pagination.totalPages || 1).toLocaleString(locale))
        .replace("{matches}", Number(pagination.totalMatches || 0).toLocaleString(locale));
    }
  }

  async function loadCarrierDirectory(page = 1) {
    if (!evidenceList || !evidenceMessage) return;
    const requestId = ++directoryRequestId;
    directoryPage = Math.max(1, page);
    evidenceMessage.textContent = t("carrierEvidenceLoading");
    const params = new URLSearchParams({
      page: String(directoryPage),
      pageSize: "50",
      q: evidenceSearch?.value || "",
      evidence: evidenceFilter?.value || "all",
      adapter: adapterFilter?.value || "all"
    });

    try {
      const response = await fetch("/api/carrier-directory?" + params.toString(), {
        cache: "default",
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error("carrier_directory_http_" + response.status);
      const payload = await response.json();
      if (requestId !== directoryRequestId) return;
      if (!Array.isArray(payload.records) || !payload.summary || !payload.pagination) {
        throw new Error("carrier_directory_shape_invalid");
      }
      directoryPayload = payload;
      renderCarrierDirectory(payload);
    } catch {
      if (requestId !== directoryRequestId) return;
      evidenceList.replaceChildren();
      evidenceMessage.textContent = t("carrierEvidenceUnavailable");
      if (evidencePageInfo) evidencePageInfo.textContent = "—";
      if (evidencePrevious) evidencePrevious.disabled = true;
      if (evidenceNext) evidenceNext.disabled = true;
    }
  }

  async function loadCatalog() {
    try {
      const response = await fetch("/api/coverage", { cache: "no-store", headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error("coverage_http_" + response.status);
      const payload = await response.json();
      if (!Array.isArray(payload.countries) || !payload.summary) throw new Error("coverage_shape_invalid");
      applyCatalog(payload);
    } catch {
      rows.forEach(row => {
        row.dataset.status = "loading";
        updateStatusLabel(row);
      });
      updateList();
      resultCount.textContent = t("coverageLoadError");
    }
  }

  searchInput.addEventListener("input", updateList);
  if (evidenceSearch) {
    evidenceSearch.addEventListener("input", () => {
      window.clearTimeout(directoryDebounce);
      directoryDebounce = window.setTimeout(() => loadCarrierDirectory(1), 220);
    });
  }
  if (evidenceFilter) evidenceFilter.addEventListener("change", () => loadCarrierDirectory(1));
  if (adapterFilter) adapterFilter.addEventListener("change", () => loadCarrierDirectory(1));
  if (evidencePrevious) evidencePrevious.addEventListener("click", () => {
    loadCarrierDirectory(Math.max(1, directoryPage - 1));
  });
  if (evidenceNext) evidenceNext.addEventListener("click", () => {
    loadCarrierDirectory(directoryPage + 1);
  });
  filterSelect.addEventListener("change", updateList);
  if (languageToggle) {
    languageToggle.addEventListener("change", event => setLanguage(event.target.value));
  }
  if (languageBtnTrigger && languageMenu) {
    languageBtnTrigger.addEventListener("click", event => {
      event.stopPropagation();
      const isOpen = languageMenu.classList.toggle("open");
      languageBtnTrigger.setAttribute("aria-expanded", String(isOpen));
    });
    languageMenu.querySelectorAll(".language-option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        setLanguage(btn.dataset.locale);
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
  let saved = "";
  try { saved = localStorage.getItem("exportflow-language") || ""; } catch {}
  setLanguage(localeFromPath() || saved || html.lang || "en");
  loadCatalog();
  loadCarrierDirectory(1);
})();
