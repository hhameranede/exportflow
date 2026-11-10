/**
 * Public tracking policy for rights-gated source routes.
 *
 * Quarantine is scoped to ExportFlow's public tracking API, public carrier
 * directory and coverage output. The upstream package stays intact so its
 * code, provenance and adapter implementations remain available for audit.
 *
 * - india-post: the pinned adapter calls MySpeedPost, whose published terms
 *   expressly prohibit automated access and commercial reuse without prior
 *   written permission. This is a MySpeedPost-route finding, not an India
 *   Post-wide finding.
 * - yunexpress: the Yuntrack Terms of Use reserve site content/data and say
 *   use, copying or display requires express written authorization. No such
 *   ExportFlow authorization is recorded.
 * - singapore-post: SingPost's website terms reserve proprietary content and
 *   grant no licence to use or reproduce it. No API or public third-party
 *   display authorization is recorded. The terms review did not establish a
 *   separate blanket automated-access prohibition; this is a rights hold.
 * - usps: the pinned adapter uses the public USPS browser tracking page, which
 *   returns an interactive verification challenge in Production. No ExportFlow
 *   service-provider access, paid API entitlement, or shipment/MID authorization
 *   is recorded. Keep this public route blocked; a separately approved official
 *   merchant API route may be implemented independently.
 * - china-post: the pinned route uses the EMS app guest endpoint / browser
 *   route. No public developer entitlement or third-party hosted-display
 *   authorization for ExportFlow was established. This is an unresolved
 *   rights hold, not a finding that China Post prohibits all API use.
 *
 * These are route-specific public-service holds, not findings that every
 * carrier service or official integration is prohibited. Re-enable an ID only
 * after documenting permission for the exact source, automated access,
 * recipient-facing display and commercial model, or after replacing it with
 * a separately verified authorized API route.
 */
const QUARANTINED_PUBLIC_CARRIERS = new Set([
  "china-post",
  "india-post",
  "singapore-post",
  "usps",
  "yunexpress"
]);

export function isPublicCarrierQuarantined(carrierId) {
  return typeof carrierId === "string"
    && QUARANTINED_PUBLIC_CARRIERS.has(carrierId.trim().toLowerCase());
}

export function filterPublicCarrierIds(carrierIds) {
  return carrierIds.filter(carrierId => !isPublicCarrierQuarantined(carrierId));
}

export function filterPublicCarrierRecords(records) {
  return records.filter(record => !isPublicCarrierQuarantined(record?.id));
}
