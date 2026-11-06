import { CARRIERS } from "universal-parcel-scraper";
import { CUSTOM_CARRIERS } from "../lib/custom-carriers.mjs";

const COUNTRY_NAME = new Intl.DisplayNames(["en"], { type: "region" });

function addCarrier(map, code, carrier) {
  if (!map.has(code)) map.set(code, []);
  map.get(code).push({
    id: carrier.id,
    name: carrier.name,
    adapter: carrier.capabilities.tracking.adapter
  });
}

function sortedCarriers(carriers) {
  return carriers.slice().sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export async function onRequestGet() {
  const direct = new Map();
  const universal = new Map();
  const linkOnly = new Map();
  const catalog = new Map();

  for (const carrier of Object.values(CARRIERS)) {
    if (!carrier || carrier.id === "unknown" || carrier.capabilities?.selectable !== true) continue;
    const codes = Array.isArray(carrier.countries) ? carrier.countries : [];
    const tracking = carrier.capabilities?.tracking;
    if (!tracking) continue;

    for (const rawCode of codes) {
      const code = typeof rawCode === "string" ? rawCode.toUpperCase() : "";
      if (!/^[A-Z]{2}$/.test(code)) continue;
      addCarrier(catalog, code, carrier);

      if (tracking.mode === "link-only") {
        addCarrier(linkOnly, code, carrier);
      } else if (tracking.mode === "automatic" && tracking.adapter === "universal") {
        addCarrier(universal, code, carrier);
      } else if (tracking.mode === "automatic" && typeof tracking.adapter === "string" && tracking.adapter.length > 0) {
        addCarrier(direct, code, carrier);
      }
    }
  }

  for (const carrier of CUSTOM_CARRIERS) {
    const record = {
      id: carrier.id,
      name: carrier.name,
      adapter: carrier.adapter
    };
    addCarrier(catalog, carrier.country, record);
    addCarrier(direct, carrier.country, record);
  }

  const countries = [...direct.entries()]
    .map(([code, carriers]) => ({
      code,
      name: COUNTRY_NAME.of(code) || code,
      directCarrierCount: carriers.length,
      carriers: sortedCarriers(carriers)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  const catalogCountries = [...catalog.keys()].sort();
  const universalOnlyCountries = [...universal.keys()]
    .filter(code => !direct.has(code))
    .map(code => ({ code, name: COUNTRY_NAME.of(code) || code, carrierCount: universal.get(code).length }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const linkOnlyCountries = [...linkOnly.keys()]
    .filter(code => !direct.has(code) && !universal.has(code))
    .map(code => ({ code, name: COUNTRY_NAME.of(code) || code, carrierCount: linkOnly.get(code).length }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return new Response(JSON.stringify({
    engine: "universal-parcel-scraper",
    countryCount: countries.length,
    catalogCountryCount: catalogCountries.length,
    dedicatedAdapterCountries: countries,
    universalFallbackOnlyCountries: universalOnlyCountries,
    linkOnlyCountries,
    customCarriers: CUSTOM_CARRIERS,
    definitions: {
      direct: "At least one selectable carrier has an automatic dedicated adapter and lists this country.",
      universalFallback: "Only an automatic universal/UPU carrier entry lists this country; a live result is not guaranteed.",
      linkOnly: "Only carriers with a tracking-page link, not an automatic adapter, list this country."
    }
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
