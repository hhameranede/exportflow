import { CARRIER_IDS } from "universal-parcel-scraper";
import { filterPublicCarrierIds } from "../lib/public-carrier-policy.mjs";

export async function onRequestGet() {
  const carriers = filterPublicCarrierIds(CARRIER_IDS);
  return new Response(JSON.stringify({
    catalogEntries: carriers.length,
    carriers
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
