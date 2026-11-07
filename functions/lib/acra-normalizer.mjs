const INCLUDED_ENTITY_TYPES = new Set([
  "LOCAL COMPANY",
  "LIMITED LIABILITY PARTNERSHIP"
]);
const REGISTERED_STATUS = "REGISTERED";
const UEN_PATTERN = /^[A-Z0-9]{8,16}$/;

function cleanText(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ") : "";
}

function normalizedName(value) {
  return cleanText(value).toLocaleLowerCase("en");
}

function skip(reason) {
  return { eligible: false, reason, entity: null, sourceRecord: null };
}

/**
 * Conservative mapper for the official ACRA "Entities Registered with ACRA"
 * CSV/API schema. It intentionally includes only active Local Companies and
 * Limited Liability Partnerships. Sole proprietorships, partnerships,
 * branches, unknown entity types and non-registered records are excluded.
 *
 * No person/contact/director fields are accepted or copied. This function
 * maps data only; it does not authorize ingestion or public redistribution.
 */
export function normalizeAcraRecord(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return skip("invalid_record");
  }

  const uen = cleanText(row.uen).toUpperCase();
  const legalName = cleanText(row.entity_name);
  const entityType = cleanText(row.entity_type_desc).toUpperCase();
  const status = cleanText(row.uen_status_desc).toUpperCase();
  const issueDate = cleanText(row.uen_issue_date);
  const streetName = cleanText(row.reg_street_name);
  const postalCode = cleanText(row.reg_postal_code);

  if (!uen || !UEN_PATTERN.test(uen)) return skip("invalid_or_missing_uen");
  if (!legalName) return skip("missing_legal_name");
  if (!INCLUDED_ENTITY_TYPES.has(entityType)) return skip("excluded_or_unknown_entity_type");
  if (status !== REGISTERED_STATUS) return skip("not_currently_registered");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || Number.isNaN(Date.parse(issueDate))) {
    return skip("invalid_registration_date");
  }

  const sourceRecord = {
    uen,
    issuance_agency_desc: cleanText(row.issuance_agency_desc) || null,
    uen_status_desc: status,
    entity_name: legalName,
    entity_type_desc: entityType,
    uen_issue_date: issueDate,
    reg_street_name: streetName || null,
    reg_postal_code: postalCode || null
  };

  return {
    eligible: true,
    reason: "eligible_active_corporate_entity",
    entity: {
      entity_id: "sg:acra:" + uen,
      legal_name: legalName,
      normalized_name: normalizedName(legalName),
      jurisdiction: "SG",
      registry_identifier: uen,
      legal_form: entityType === "LOCAL COMPANY" ? "Local Company" : "Limited Liability Partnership",
      entity_status: "registered",
      registered_address: null,
      postal_code: postalCode || null,
      locality: null,
      region: null,
      country_code: "SG",
      industry_code: null,
      website_url: null,
      source_updated_at: null
    },
    sourceRecord
  };
}

export const ACRA_INCLUDED_ENTITY_TYPES = Object.freeze([...INCLUDED_ENTITY_TYPES]);
