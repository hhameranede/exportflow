import { CARRIERS, CARRIER_IDS, CARRIER_CATALOG_METADATA, CARRIER_INTEGRATION_MATRIX } from "../../data/carrier-catalog.generated.mjs";

const SAFE_TRACKING_MODES = new Set(["automatic", "link-only"]);
const CARRIER_EVIDENCE_SQL = `
  SELECT
    provider_id, display_name, country_scope, integration_method, adapter_state,
    adapter_ids_json, commercial_access_status, tracking_rights_status,
    official_source_url, public_disclosure, evidence_status, verification_method,
    verified_at, verification_evidence_url, authorization_evidence_url
  FROM carrier_evidence
  WHERE evidence_status != 'deprecated'
  ORDER BY display_name
`;

const GENERIC_DISCLOSURE =
  "Upstream catalog metadata only. It does not establish a live successful lookup, carrier authorization or permission to display shipment data for third parties.";

function parseAdapterIds(value) {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter(id => typeof id === "string" && /^[a-z0-9-]{2,80}$/i.test(id)))]
      : [];
  } catch {
    return [];
  }
}

function publicEvidenceRecord(row) {
  const evidenceStatus = ["research", "testing", "integrated", "verified", "blocked", "deprecated"].includes(row?.evidence_status)
    ? row.evidence_status
    : "research";
  const verificationMethod = ["none", "mock", "sandbox", "live"].includes(row?.verification_method)
    ? row.verification_method
    : "none";
  const verifiedEvidenceUrl = typeof row?.verification_evidence_url === "string" &&
    row.verification_evidence_url.startsWith("https://")
    ? row.verification_evidence_url
    : null;
  const authorizationEvidenceUrl = typeof row?.authorization_evidence_url === "string" &&
    row.authorization_evidence_url.startsWith("https://")
    ? row.authorization_evidence_url
    : null;
  const verifiedAt = typeof row?.verified_at === "string" ? row.verified_at : null;
  const defensibleVerified = evidenceStatus === "verified" &&
    verificationMethod === "live" &&
    row?.tracking_rights_status === "third_party_authorized" &&
    row?.commercial_access_status === "authorized_service_provider" &&
    Boolean(verifiedAt && verifiedEvidenceUrl && authorizationEvidenceUrl);
  const safeEvidenceStatus = evidenceStatus === "verified" && !defensibleVerified
    ? "research"
    : evidenceStatus;
  const adapterState = ["present", "country_specific", "missing"].includes(row?.adapter_state)
    ? row.adapter_state
    : "missing";

  return {
    id: row.provider_id,
    name: typeof row.display_name === "string" ? row.display_name.slice(0, 120) : row.provider_id,
    countryScope: typeof row.country_scope === "string" ? row.country_scope.slice(0, 240) : "",
    integrationMethod: typeof row.integration_method === "string" ? row.integration_method : "manual",
    adapterState,
    adapterIds: parseAdapterIds(row.adapter_ids_json),
    evidenceLevel: safeEvidenceStatus,
    verification: {
      method: evidenceStatus === "verified" && !defensibleVerified ? "none" : verificationMethod,
      liveVerified: defensibleVerified,
      verifiedAt: defensibleVerified ? verifiedAt : null,
      evidenceUrl: defensibleVerified ? verifiedEvidenceUrl : null,
      authorizationConfirmed: Boolean(
        authorizationEvidenceUrl &&
        row?.tracking_rights_status === "third_party_authorized" &&
        row?.commercial_access_status === "authorized_service_provider"
      )
    },
    commercialAccess: typeof row.commercial_access_status === "string"
      ? row.commercial_access_status
      : "not_assessed",
    trackingRights: typeof row.tracking_rights_status === "string"
      ? row.tracking_rights_status
      : "not_assessed",
    sourceUrl: typeof row.official_source_url === "string" &&
      row.official_source_url.startsWith("https://")
      ? row.official_source_url
      : null,
    disclosure: typeof row.public_disclosure === "string"
      ? row.public_disclosure.slice(0, 420)
      : GENERIC_DISCLOSURE
  };
}

async function loadEvidenceRegistry(env) {
  if (!env?.MERCHANT_DB || typeof env.MERCHANT_DB.prepare !== "function") {
    return { available: false, records: [] };
  }

  try {
    const result = await env.MERCHANT_DB.prepare(CARRIER_EVIDENCE_SQL).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    return {
      available: true,
      records: rows.map(publicEvidenceRecord)
    };
  } catch {
    // The carrier directory remains useful before a preview DB migration is
    // applied. Missing D1 data never promotes a catalog entry to verified.
    return { available: false, records: [] };
  }
}

function publicCarrierRecord(carrier, evidenceByAdapter) {
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

  const matrix = CARRIER_INTEGRATION_MATRIX[id] || null;
  const integrationClass = [
    "provider_api_client", "dedicated_adapter", "universal_fallback",
    "link_only", "adapter_reference_only", "catalogue_only"
  ].includes(matrix?.integrationClass) ? matrix.integrationClass : "catalogue_only";
  const sourceIntegration = {
    integrationClass,
    apiClient: matrix?.apiClient === "source_module_present" ? "source_module_present" : "not_assessed",
    apiAuthentication: typeof matrix?.apiAuthentication === "string" ? matrix.apiAuthentication : null,
    requiredEnvironment: Array.isArray(matrix?.requiredEnvironment) ? matrix.requiredEnvironment : [],
    sandboxMode: typeof matrix?.sandboxMode === "string" ? matrix.sandboxMode : "not_assessed",
    sandboxBaseUrl: typeof matrix?.sandboxBaseUrl === "string" && matrix.sandboxBaseUrl.startsWith("https://") ? matrix.sandboxBaseUrl : null,
    onboardingRole: typeof matrix?.onboardingRole === "string" ? matrix.onboardingRole : null,
    mockContractTest: typeof matrix?.mockContractTest === "string" ? matrix.mockContractTest : null,
    adapterSource: matrix?.adapterSource === "present" ? "present" : "not_found",
    fixtureTest: matrix?.fixtureTest === "defined" ? "defined" : "not_found",
    liveTestDefinition: matrix?.liveTestDefinition === "defined" ? "defined" : "not_found",
    upstreamTrackingSteps: Array.isArray(matrix?.upstreamTrackingSteps) ? matrix.upstreamTrackingSteps : []
  };
  const evidence = adapter ? evidenceByAdapter.get(adapter) : null;
  return {
    id,
    name: typeof carrier.name === "string" ? carrier.name.slice(0, 120) : id,
    countries,
    tracking: { mode, adapter },
    sourceIntegration,
    evidence: evidence
      ? {
          level: evidence.evidenceLevel,
          commercialAccess: evidence.commercialAccess,
          trackingRights: evidence.trackingRights,
          sourceUrl: evidence.sourceUrl,
          disclosure: evidence.disclosure,
          verification: evidence.verification
        }
      : {
          level: "catalogued",
          commercialAccess: "not_assessed",
          trackingRights: "not_assessed",
          sourceUrl: null,
          disclosure: GENERIC_DISCLOSURE,
          verification: { method: "none", liveVerified: false, verifiedAt: null, evidenceUrl: null, authorizationConfirmed: false }
        }
  };
}

export async function onRequestGet({ env } = {}) {
  const registry = await loadEvidenceRegistry(env);
  const evidenceByAdapter = new Map();
  for (const evidence of registry.records) {
    for (const adapterId of evidence.adapterIds) {
      evidenceByAdapter.set(adapterId, evidence);
    }
  }

  const carrierRecords = Object.values(CARRIERS)
    .filter(carrier => carrier?.capabilities?.selectable === true)
    .map(carrier => publicCarrierRecord(carrier, evidenceByAdapter))
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
  const evidenceRegistryCounts = {
    researched: registry.records.filter(record => record.evidenceLevel === "research").length,
    testing: registry.records.filter(record => record.evidenceLevel === "testing").length,
    integrated: registry.records.filter(record => record.evidenceLevel === "integrated").length,
    verified: registry.records.filter(record => record.evidenceLevel === "verified" && record.verification.liveVerified).length,
    blocked: registry.records.filter(record => record.evidenceLevel === "blocked").length,
    withoutAdapter: registry.records.filter(record => record.adapterState === "missing").length
  };

  return new Response(JSON.stringify({
    catalogEntries: CARRIER_IDS.length,
    catalogMetadata: CARRIER_CATALOG_METADATA,
    selectableCarrierRecords: carrierRecords.length,
    directAdapterCatalogRecords,
    universalFallbackCatalogRecords,
    linkOnlyCatalogRecords,
    carriers: CARRIER_IDS,
    carrierRecords,
    evidenceRegistryAvailable: registry.available,
    sourceIntegrationSummary: {
      records: CARRIER_CATALOG_METADATA.integrationMatrixRecords,
      providerApiClients: CARRIER_CATALOG_METADATA.providerApiClientRecords,
      classes: CARRIER_CATALOG_METADATA.integrationClassCounts
    },
    evidenceRegistryCounts,
    evidenceRegistry: registry.records,
    metadataNotice: "A carrier catalog entry or adapter is not a live availability check, an authorized integration or a carrier partnership. Research status remains distinct from verified tracking; Verified requires live test evidence and an authorization reference."
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
