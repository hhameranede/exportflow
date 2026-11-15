const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code) {
  return displayNames.of(code) || code;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function replaceToken(html, token, value) {
  const occurrences = html.split(token).length - 1;
  if (occurrences !== 1) {
    throw new Error("Expected exactly one directory template token: " + token);
  }
  return html.replace(token, value);
}

export function collectDirectCarriers(payload) {
  if (!payload || !Array.isArray(payload.countries) || !payload.summary) {
    throw new TypeError("The public carrier coverage payload is invalid");
  }

  const records = new Map();
  for (const country of payload.countries) {
    const code = typeof country?.code === "string" && /^[A-Z]{2}$/.test(country.code)
      ? country.code
      : null;
    if (!code || !Array.isArray(country.directCarriers)) continue;

    for (const carrier of country.directCarriers) {
      if (
        typeof carrier?.id !== "string" || !carrier.id.trim() ||
        typeof carrier?.name !== "string" || !carrier.name.trim() ||
        typeof carrier?.adapter !== "string" || !carrier.adapter.trim() ||
        carrier.adapter === "universal"
      ) continue;

      let record = records.get(carrier.id);
      if (!record) {
        record = {
          id: carrier.id,
          name: carrier.name.trim(),
          adapter: carrier.adapter,
          countries: []
        };
        records.set(carrier.id, record);
      }
      if (!record.countries.includes(code)) record.countries.push(code);
    }
  }

  const result = [...records.values()]
    .map(record => ({
      ...record,
      countries: record.countries.sort((a, b) => countryName(a).localeCompare(countryName(b), "en"))
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en"));

  const expected = Number(payload.summary.directCarrierRecords);
  if (!Number.isInteger(expected) || result.length !== expected) {
    throw new Error(
      "Directory count mismatch: built " + result.length +
      " direct carrier records, expected " + String(payload.summary.directCarrierRecords)
    );
  }
  return result;
}

export function renderCompanyDirectory(template, payload) {
  if (typeof template !== "string") throw new TypeError("Directory template must be text");
  const carriers = collectDirectCarriers(payload);
  if (carriers.length === 0) throw new Error("Refusing to build an empty carrier directory");

  const countryCodes = [...new Set(carriers.flatMap(carrier => carrier.countries))];
  const countryOptions = countryCodes
    .map(code => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map(({ code, name }) => '<option value="' + escapeHtml(code) + '">' + escapeHtml(name) + "</option>")
    .join("\n");

  const cards = carriers.map(carrier => {
    const marketNames = carrier.countries.map(countryName);
    const marketSummary = marketNames.length > 4
      ? marketNames.slice(0, 4).join(" · ") + " · +" + (marketNames.length - 4) + " more"
      : marketNames.join(" · ");
    const searchText = [
      carrier.name, carrier.id, carrier.adapter, ...marketNames, ...carrier.countries
    ].join(" ");
    const parts = carrier.name.match(/[A-Za-z0-9]+/g) || [];
    const monogram = (parts.length > 1
      ? parts[0][0] + parts[1][0]
      : (parts[0] || carrier.id).slice(0, 2)).toUpperCase();

    return [
      '<article class="directory-card" data-carrier-id="' + escapeHtml(carrier.id) +
        '" data-country-codes="' + escapeHtml(carrier.countries.join(" ")) +
        '" data-search="' + escapeHtml(searchText) + '">',
      '  <div class="directory-card-top"><span class="company-monogram" aria-hidden="true">' +
        escapeHtml(monogram) + '</span><span class="directory-category">Carrier-specific tracking</span></div>',
      '  <h2>' + escapeHtml(carrier.name) + "</h2>",
      '  <p>ExportFlow includes a carrier-specific tracking route for shipments handled by ' +
        escapeHtml(carrier.name) + '. Tracking events depend on the shipment reference and the carrier\'s latest response.</p>',
      '  <div class="directory-card-region"><span aria-hidden="true">◎</span>' +
        escapeHtml(marketSummary) + "</div>",
      '  <a class="directory-company-link" href="/">Track with ExportFlow <span aria-hidden="true">↗</span></a>',
      "</article>"
    ].join("\n");
  }).join("\n");

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "ExportFlow Carrier & Delivery Directory",
    "description": "Carrier profiles with carrier-specific shipment-tracking routes listed in ExportFlow. Tracking event availability depends on the shipment reference and carrier response.",
    "url": "https://exportflow.me/companies/",
    "isPartOf": {
      "@type": "WebSite",
      "name": "ExportFlow",
      "url": "https://exportflow.me/"
    },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": carriers.length,
      "itemListElement": carriers.map((carrier, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "Organization",
          "name": carrier.name,
          "description": "Carrier-specific tracking route listed for " +
            carrier.countries.map(countryName).join(", ") + "."
        }
      }))
    }
  };
  const safeSchema = JSON.stringify(schema).replaceAll("<", "\\u003c");

  let html = template;
  html = replaceToken(html, "<!-- EXPORTFLOW_COMPANY_SCHEMA -->",
    '<script type="application/ld+json">' + safeSchema + "</script>");
  html = replaceToken(html, "{{COMPANY_COUNT}}", carriers.length.toLocaleString("en-US"));
  html = replaceToken(html, "{{COUNTRY_COUNT}}",
    Number(payload.summary.directCountryCount).toLocaleString("en-US"));
  html = replaceToken(html, "<!-- EXPORTFLOW_COMPANY_COUNTRY_OPTIONS -->", countryOptions);
  html = replaceToken(html, "<!-- EXPORTFLOW_COMPANY_CARDS -->", cards);
  return html;
}
