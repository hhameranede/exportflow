/**
 * Public tracking policy for route-specific source restrictions.
 *
 * India Post's current upstream adapter reads MySpeedPost, a third-party tracker
 * whose published Terms of Service prohibit automated access and commercial
 * reuse without prior written permission. This restriction applies to the
 * current MySpeedPost-backed route, not to India Post's official systems.
 *
 * Keep the upstream package intact for source auditing; filter this ID from
 * ExportFlow's public tracking API, catalog and coverage until written rights
 * for the exact route and intended use are evidenced.
 */
const QUARANTINED_PUBLIC_CARRIERS = new Set(["india-post"]);

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
