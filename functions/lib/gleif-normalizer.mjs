const LEI_PATTERN = /^[A-Z0-9]{18}[0-9]{2}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const ALLOWED_CATEGORIES = new Set([
  "GENERAL",
  "RESIDENT_GOVERNMENT_ENTITY",
  "INTERNATIONAL_ORGANIZATION"
]);
const EXCLUDED_CATEGORIES = new Set(["BRANCH", "FUND", "SOLE_PROPRIETOR"]);
const EXCLUDED_REGISTRATION_STATUSES = new Set([
  "LAPSED",
  "RETIRED",
  "PENDING_TRANSFER",
  "PENDING_ARCHIVAL"
]);

function cleanText(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ")
    : "";
}

function normalizeName(value) {
  return cleanText(value).toLocaleLowerCase("en");
}

function isValidLei(value) {
  const lei = cleanText(value).toUpperCase();
  if (!LEI_PATTERN.test(lei)) return false;

  // ISO 17442 check digits: expand A-Z to 10-35 and verify mod 97 == 1.
  let remainder = 0;
  for (const character of lei) {
    const numeric = character >= "0" && character <= "9"
      ? character.charCodeAt(0) - 48
      : character.charCodeAt(0) - 55;
    for (const digit of String(numeric)) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

function skip(reason) {
  return { eligible: false, reason, entity: null, sourceRecord: null };
}

function pickSafeRegistration(registration) {
  return {
    status: cleanText(registration.status).toUpperCase(),
    initialRegistrationDate: cleanText(registration.initialRegistrationDate) || null,
    lastUpdateDate: cleanText(registration.lastUpdateDate) || null,
    nextRenewalDate: cleanText(registration.nextRenewalDate) || null,
    managingLou: cleanText(registration.managingLou) || null,
    validationSources: cleanText(registration.validationSources).toUpperCase() || null
  };
}

/**
 * Maps one GLEIF JSON:API LEI record into a conservative company-catalogue row.
 *
 * Safety boundary:
 * - Rejects branch, fund and sole-proprietor records.
 * - Rejects unknown explicit categories and non-active/non-issued records.
 * - Verifies the ISO 17442 LEI checksum, country code and required name fields.
 * - Omits registeredAs, addresses, contact data, people and relationship data
 *   from both normalized output and stored provenance in the initial pilot.
 * - Does not imply complete country/company coverage or GLEIF endorsement.
 *
 * The caller must access GLEIF only through its official Access Service and
 * must separately verify source rights/privacy status before inserting rows.
 */
export function normalizeGleifRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return skip("invalid_record");
  }

  const attributes = record.attributes;
  if (!attributes || typeof attributes !== "object") {
    return skip("missing_attributes");
  }

  const lei = cleanText(attributes.lei || record.id).toUpperCase();
  if (!isValidLei(lei)) return skip("invalid_lei_or_check_digit");

  const entity = attributes.entity;
  const registration = attributes.registration;
  if (!entity || typeof entity !== "object") return skip("missing_entity");
  if (!registration || typeof registration !== "object") return skip("missing_registration");

  const legalName = cleanText(entity.legalName?.name);
  if (!legalName) return skip("missing_legal_name");

  const countryCode = cleanText(entity.legalAddress?.country).toUpperCase();
  if (!COUNTRY_PATTERN.test(countryCode)) return skip("invalid_or_missing_country");

  const entityStatus = cleanText(entity.status).toUpperCase();
  if (entityStatus !== "ACTIVE") return skip("entity_not_active");

  const registrationStatus = cleanText(registration.status).toUpperCase();
  if (registrationStatus !== "ISSUED") {
    return skip(EXCLUDED_REGISTRATION_STATUSES.has(registrationStatus)
      ? "registration_not_issued"
      : "unknown_registration_status");
  }

  const category = cleanText(entity.category).toUpperCase();
  if (!category) return skip("missing_entity_category");
  if (EXCLUDED_CATEGORIES.has(category)) return skip("excluded_entity_category");
  if (!ALLOWED_CATEGORIES.has(category)) return skip("unknown_entity_category");

  const legalFormId = cleanText(entity.legalForm?.id) || null;
  const sourceUpdatedAt = cleanText(registration.lastUpdateDate) || null;
  if (sourceUpdatedAt && Number.isNaN(Date.parse(sourceUpdatedAt))) {
    return skip("invalid_source_update_timestamp");
  }

  // Intentionally do not store addresses, postal codes, registeredAs,
  // director/person data, BIC/MIC links or ownership relationships.
  const sourceRecord = {
    lei,
    legalName,
    legalNameLanguage: cleanText(entity.legalName?.language) || null,
    countryCode,
    legalJurisdiction: cleanText(entity.jurisdiction).toUpperCase() || null,
    category: category || null,
    legalFormId,
    entityStatus,
    registration: pickSafeRegistration(registration)
  };

  return {
    eligible: true,
    reason: "active_issued_legal_entity",
    sourceUpdatedAt,
    entity: {
      entity_id: "global:lei:" + lei,
      lei,
      legal_name: legalName,
      normalized_name: normalizeName(legalName),
      jurisdiction: countryCode,
      registry_identifier: null,
      legal_form: legalFormId,
      entity_status: entityStatus + ":" + registrationStatus,
      registered_address: null,
      postal_code: null,
      locality: null,
      region: null,
      country_code: countryCode,
      industry_code: null,
      website_url: null,
      source_updated_at: sourceUpdatedAt
    },
    sourceRecord
  };
}

export const GLEIF_ALLOWED_CATEGORIES = Object.freeze([...ALLOWED_CATEGORIES]);
export const GLEIF_EXCLUDED_CATEGORIES = Object.freeze([...EXCLUDED_CATEGORIES]);
