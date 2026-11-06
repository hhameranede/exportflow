(() => {
  const supported = ["en", "ar", "es", "zh", "hi", "pt", "fr", "ru"];
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
  let locale = "en";

  const t = key => translations[locale]?.[key] || translations.en?.[key] || key;
  const safeLocale = value => supported.includes(value) ? value : "en";

  function localeFromPath() {
    const match = window.location.pathname.match(/^\\/(ar|es|zh|hi|pt|fr|ru)(?=\\/|$)/);
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
    const match = currentPath.match(/^\\/(ar|es|zh|hi|pt|fr|ru)(?=\\/|$)/);
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
})();
