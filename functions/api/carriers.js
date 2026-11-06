import { CARRIER_IDS } from "universal-parcel-scraper";
import { CUSTOM_CARRIERS } from "../lib/custom-carriers.mjs";

export async function onRequestGet() {
  return new Response(JSON.stringify({
    catalogEntries: CARRIER_IDS.length,
    carriers: CARRIER_IDS,
    customCarriers: CUSTOM_CARRIERS
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
