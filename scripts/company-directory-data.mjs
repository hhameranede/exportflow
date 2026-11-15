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

function replaceToken(html, token, value, replaceAll = false) {
  const occurrences = html.split(token).length - 1;
  if (replaceAll ? occurrences === 0 : occurrences !== 1) {
    throw new Error(
      "Expected " + (replaceAll ? "at least one" : "exactly one") +
      " directory template token: " + token
    );
  }
  return replaceAll ? html.replaceAll(token, value) : html.replace(token, value);
}

export function collectAdapterCarriers(payload) {
  if (!payload || !Array.isArray(payload.directoryCarriers) || !payload.summary) {
    throw new TypeError("The adapter directory payload is invalid");
  }
  const records = new Map();
  for (const carrier of payload.directoryCarriers) {
    if (typeof carrier?.id !== "string" || !carrier.id.trim() ||
        typeof carrier?.name !== "string" || !carrier.name.trim() ||
        typeof carrier?.adapter !== "string" || !carrier.adapter.trim() ||
        carrier.adapter === "universal" || !Array.isArray(carrier.countries)) continue;
    let record = records.get(carrier.id);
    if (!record) {
      record = { id:carrier.id, name:carrier.name.trim(), adapter:carrier.adapter, countries:[] };
      records.set(carrier.id, record);
    }
    for (const raw of carrier.countries) {
      const code=typeof raw==="string" ? raw.toUpperCase() : "";
      if (/^[A-Z]{2}$/.test(code) && !record.countries.includes(code)) record.countries.push(code);
    }
  }
  const result=[...records.values()]
    .map(record=>({...record,countries:record.countries.sort((x,y)=>countryName(x).localeCompare(countryName(y),"en"))}))
    .sort((x,y)=>x.name.localeCompare(y.name,"en") || x.id.localeCompare(y.id,"en"));
  const expected=Number(payload.summary.directoryCarrierRecords);
  if(!Number.isInteger(expected) || result.length!==expected) {
    throw new Error("Directory count mismatch: built "+result.length+
      " adapter-backed carrier records, expected "+String(payload.summary.directoryCarrierRecords));
  }
  return result;
}

export function renderCompanyDirectory(template, payload) {
  if (typeof template !== "string") throw new TypeError("Directory template must be text");
  const carriers = collectAdapterCarriers(payload);
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
        escapeHtml(monogram) + '</span><span class="directory-category">Carrier profile</span></div>',
      '  <h2>' + escapeHtml(carrier.name) + "</h2>",
      '  <p>Explore ' + escapeHtml(carrier.name) +
        ' parcel, postal and delivery services. ExportFlow brings carrier information and shipment lookup tools together; availability depends on the selected route and shipment reference.</p>',
      '  <div class="directory-card-region"><span aria-hidden="true">◎</span>' +
        escapeHtml(marketSummary) + "</div>",
      '  <a class="directory-company-link" href="/">Explore ExportFlow <span aria-hidden="true">↗</span></a>',
      "</article>"
    ].join("\n");
  }).join("\n");

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "ExportFlow Carrier & Delivery Directory",
    "description": "Carrier profiles represented in ExportFlow's adapter catalog. Shipment lookup availability depends on the selected route, shipment reference and carrier response.",
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
          "description": "Carrier profile represented in ExportFlow's shipment-adapter catalog for " +
            carrier.countries.map(countryName).join(", ") + "."
        }
      }))
    }
  };
  const safeSchema = JSON.stringify(schema).replaceAll("<", "\\u003c");

  let html = template;
  html = replaceToken(html, "<!-- EXPORTFLOW_COMPANY_SCHEMA -->",
    '<script type="application/ld+json">' + safeSchema + "</script>");
  html = replaceToken(html, "{{COMPANY_COUNT}}", carriers.length.toLocaleString("en-US"), true);
  html = replaceToken(html, "{{COUNTRY_COUNT}}",
    Number(payload.summary.directoryCountryCount).toLocaleString("en-US"));
  html = replaceToken(html, "<!-- EXPORTFLOW_COMPANY_COUNTRY_OPTIONS -->", countryOptions);
  html = replaceToken(html, "<!-- EXPORTFLOW_COMPANY_CARDS -->", cards);
  return html;
}
