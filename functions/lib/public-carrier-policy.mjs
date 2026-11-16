/**
 * Owner-controlled public carrier release switch.
 *
 * The current release has no ExportFlow-local carrier quarantine entries.
 * Provider-side authentication, verification challenges, throttling and
 * service availability remain authoritative and are never bypassed here.
 *
 * Keep this small policy module so a future, explicitly reviewed operational
 * hold can be applied consistently to tracking, carrier catalog and coverage.
 */
const QUARANTINED_PUBLIC_CARRIERS = new Set();

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
