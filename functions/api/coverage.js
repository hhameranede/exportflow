import { CARRIERS, CARRIER_IDS } from "universal-parcel-scraper";
import { COUNTRY_CODES } from "../lib/country-codes.mjs";
import { filterPublicCarrierIds, filterPublicCarrierRecords } from "../lib/public-carrier-policy.mjs";

const SOURCE_REVISION = "e64a466772ef25ce68e02d9c7c9f1613eec1208b";
function add(map, code, carrier, adapter) {
  if (!map.has(code)) map.set(code, []);
  map.get(code).push({ id: carrier.id, name: carrier.name || carrier.id, adapter: adapter || null });
}
const sorted = values => values.slice().sort((a,b) => a.name.localeCompare(b.name, "en"));

export async function onRequestGet() {
  const direct = new Map(), universal = new Map(), linkOnly = new Map(), all = new Map();
  const selectable = filterPublicCarrierRecords(Object.values(CARRIERS).filter(carrier => carrier && carrier.id !== "unknown" && carrier.capabilities?.selectable === true));
  const directCarrierIds = new Set();
  for (const carrier of selectable) {
    const codes = Array.isArray(carrier.countries) ? carrier.countries : [];
    const tracking = carrier.capabilities?.tracking;
    if (!tracking) continue;
    for (const raw of codes) {
      const code = typeof raw === "string" ? raw.toUpperCase() : "";
      if (!/^[A-Z]{2}$/.test(code)) continue;
      add(all, code, carrier, tracking.adapter);
      if (tracking.mode === "link-only") add(linkOnly, code, carrier, tracking.adapter);
      else if (tracking.mode === "automatic" && tracking.adapter === "universal") add(universal, code, carrier, tracking.adapter);
      else if (tracking.mode === "automatic" && typeof tracking.adapter === "string" && tracking.adapter.length) {
        add(direct, code, carrier, tracking.adapter);
        directCarrierIds.add(carrier.id);
      }
    }
  }
  const countries = COUNTRY_CODES.map(code => {
    const directCarriers = sorted(direct.get(code) || []);
    const fallbackCarriers = sorted(universal.get(code) || []);
    const linkCarriers = sorted(linkOnly.get(code) || []);
    const carriers = sorted(all.get(code) || []);
    const status = directCarriers.length ? "direct" : fallbackCarriers.length ? "universal-fallback" : linkCarriers.length ? "link-only" : "not-listed";
    return { code, status, carrierCount: carriers.length, directCarrierCount: directCarriers.length, fallbackCarrierCount: fallbackCarriers.length, linkOnlyCarrierCount: linkCarriers.length, carriers, directCarriers, fallbackCarriers, linkOnlyCarriers: linkCarriers };
  });
  const summary = {
    allCountries: COUNTRY_CODES.length,
    catalogEntries: filterPublicCarrierIds(CARRIER_IDS).length,
    quarantinedCarrierCount: CARRIER_IDS.length - filterPublicCarrierIds(CARRIER_IDS).length,
    selectableCarrierRecords: selectable.length,
    directCarrierRecords: directCarrierIds.size,
    directCountryCount: countries.filter(c => c.status === "direct").length,
    universalFallbackCountryCount: countries.filter(c => c.fallbackCarrierCount > 0).length,
    linkOnlyCountryCount: countries.filter(c => c.status === "link-only").length,
    countriesWithAnyCatalogEntry: countries.filter(c => c.status !== "not-listed").length,
    countriesWithoutCatalogEntry: countries.filter(c => c.status === "not-listed").length
  };
  return new Response(JSON.stringify({ source: "installed-universal-parcel-scraper-catalog", upstreamRevision: SOURCE_REVISION, generatedAt: new Date().toISOString(), summary, countries }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" }
  });
}
