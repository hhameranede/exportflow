import { CARRIERS, CARRIER_IDS } from "universal-parcel-scraper";

const SAFE_TRACKING_MODES = new Set(["automatic", "link-only"]);

function publicCarrierRecord(carrier) {
  const id = typeof carrier?.id === "string" && /^[a-z0-9-]{2,80}$/i.test(carrier.id)
    ? carrier.id
    : null;
  if (!id) return null;

  const tracking = carrier.capabilities?.tracking;
  const mode = SAFE_TRACKING_MODES.has(tracking?.mode) ? tracking.mode : "not-declared";
  const adapter = typeof tracking?.adapter === "string" &&
    /^[a-z0-9_-]{1,80}$/i.test(tracking.adapter)
    ? tracking.adapter
    : null;
  const countries = [...new Set(
    (Array.isArray(carrier.countries) ? carrier.countries : [])
      .filter(code => typeof code === "string" && /^[A-Z]{2}$/i.test(code))
      .map(code => code.toUpperCase())
  )].sort();

  return {
    id,
    name: typeof carrier.name === "string" ? carrier.name.slice(0, 120) : id,
    countries,
    tracking: { mode, adapter }
  };
}

export async function onRequestGet() {
  const carrierRecords = Object.values(CARRIERS)
    .filter(carrier => carrier?.capabilities?.selectable === true)
    .map(publicCarrierRecord)
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));

  const directAdapterCatalogRecords = carrierRecords.filter(record =>
    record.tracking.mode === "automatic" &&
    record.tracking.adapter &&
    record.tracking.adapter !== "universal"
  ).length;
  const universalFallbackCatalogRecords = carrierRecords.filter(record =>
    record.tracking.mode === "automatic" && record.tracking.adapter === "universal"
  ).length;
  const linkOnlyCatalogRecords = carrierRecords.filter(record =>
    record.tracking.mode === "link-only"
  ).length;

  return new Response(JSON.stringify({
    catalogEntries: CARRIER_IDS.length,
    selectableCarrierRecords: carrierRecords.length,
    directAdapterCatalogRecords,
    universalFallbackCatalogRecords,
    linkOnlyCatalogRecords,
    carriers: CARRIER_IDS,
    carrierRecords,
    metadataNotice: "Catalog capability metadata is not a live availability check, successful tracking guarantee or carrier partnership claim."
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
