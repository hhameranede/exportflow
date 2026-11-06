(() => {
  const supported = ["en", "ar", "es", "zh", "hi", "pt", "fr", "ru"];
  const html = document.documentElement;
  const translations = window.EXPORTFLOW_TRANSLATIONS || {};
  const languageToggle = document.getElementById("languageToggle");
  const searchInput = document.getElementById("coverageSearch");
  const filterSelect = document.getElementById("coverageFilter");
  const list = document.getElementById("coverageCountryList");
  const rows = [...list.querySelectorAll("[data-country-code]")];
  const resultCount = document.getElementById("coverageResultCount");
  let locale = "en";

  const t = key => translations[locale]?.[key] || translations.en?.[key] || key;
  const safeLocale = value => supported.includes(value) ? value : "en";

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
    languageToggle.value = locale;
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
    rows.forEach(row => {
      const name = row.querySelector(".coverage-country-name");
      if (name) name.textContent = countryName(row.dataset.countryCode);
      updateStatusLabel(row);
    });
    updateList();
    try { localStorage.setItem("exportflow-language", locale); } catch {}
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
  filterSelect.addEventListener("change", updateList);
  languageToggle.addEventListener("change", event => setLanguage(event.target.value));
  let saved = "en";
  try { saved = localStorage.getItem("exportflow-language") || "en"; } catch {}
  setLanguage(saved);
  loadCatalog();
})();
