import { CARRIERS, CARRIER_IDS, CARRIER_CATALOG_METADATA, CARRIER_INTEGRATION_MATRIX } from "../../data/carrier-catalog.generated.mjs";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 120;
const SOURCE_REVISION = "e64a466772ef25ce68e02d9c7c9f1613eec1208b";
const EVIDENCE_SQL = `
  SELECT provider_id, display_name, country_scope, integration_method, adapter_state,
         adapter_ids_json, commercial_access_status, tracking_rights_status,
         official_source_url, public_disclosure, evidence_status, verification_method,
         verified_at, verification_evidence_url, authorization_evidence_url
  FROM carrier_evidence
  ORDER BY display_name
`;

const EVIDENCE_LEVELS = new Set([
  "catalogued", "research", "testing", "integrated", "verified", "blocked", "deprecated"
]);
const INTEGRATION_CLASSES = new Set([
  "provider_api_client", "dedicated_adapter", "universal_fallback",
  "link_only", "adapter_reference_only", "catalogue_only"
]);

function safeId(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(value)
    ? value
    : null;
}

function safeText(value, max = 180) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function safeCountries(carrier) {
  const input = Array.isArray(carrier?.countries)
    ? carrier.countries
    : Array.isArray(carrier?.region?.countries)
      ? carrier.region.countries
      : [];
  return [...new Set(input
    .filter(code => typeof code === "string" && /^[A-Z]{2}$/i.test(code))
    .map(code => code.toUpperCase()))].sort();
}

function safeAliases(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(alias => safeText(alias, 100))
    .filter(Boolean))].slice(0, 8);
}

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

function normalizeEvidence(row) {
  const level = EVIDENCE_LEVELS.has(row?.evidence_status) ? row.evidence_status : "research";
  const method = ["none", "mock", "sandbox", "live"].includes(row?.verification_method)
    ? row.verification_method
    : "none";
  const testUrl = typeof row?.verification_evidence_url === "string" && row.verification_evidence_url.startsWith("https://")
    ? row.verification_evidence_url
    : null;
  const authorizationUrl = typeof row?.authorization_evidence_url === "string" && row.authorization_evidence_url.startsWith("https://")
    ? row.authorization_evidence_url
    : null;
  const verifiedAt = typeof row?.verified_at === "string" ? row.verified_at : null;
  const validVerified = level === "verified" &&
    method === "live" &&
    Boolean(verifiedAt && testUrl && authorizationUrl) &&
    row?.tracking_rights_status === "third_party_authorized" &&
    row?.commercial_access_status === "authorized_service_provider";

  return {
    id: safeId(row?.provider_id),
    name: safeText(row?.display_name, 120),
    countryScope: safeText(row?.country_scope, 240),
    integrationMethod: safeText(row?.integration_method, 32) || "manual",
    adapterState: ["present", "country_specific", "missing"].includes(row?.adapter_state) ? row.adapter_state : "missing",
    adapterIds: parseAdapterIds(row?.adapter_ids_json),
    level: level === "verified" && !validVerified ? "research" : level,
    verification: {
      method: validVerified ? "live" : level === "verified" ? "none" : method,
      liveVerified: validVerified,
      verifiedAt: validVerified ? verifiedAt : null
    },
    commercialAccess: safeText(row?.commercial_access_status, 80) || "not_assessed",
    trackingRights: safeText(row?.tracking_rights_status, 80) || "not_assessed",
    sourceUrl: typeof row?.official_source_url === "string" && row.official_source_url.startsWith("https://")
      ? row.official_source_url
      : null,
    disclosure: safeText(row?.public_disclosure, 420)
  };
}

async function loadEvidence(env) {
  if (!env?.MERCHANT_DB || typeof env.MERCHANT_DB.prepare !== "function") {
    return { available: false, records: [] };
  }
  try {
    const result = await env.MERCHANT_DB.prepare(EVIDENCE_SQL).all();
    return {
      available: true,
      records: (Array.isArray(result?.results) ? result.results : [])
        .map(normalizeEvidence)
        .filter(record => record.id)
    };
  } catch {
    return { available: false, records: [] };
  }
}

function buildCatalogRecords() {
  return Object.values(CARRIERS)
    .filter(carrier => carrier && carrier.id !== "unknown")
    .map(carrier => {
      const id = safeId(carrier.id);
      if (!id) return null;
      const tracking = carrier.capabilities?.tracking || {};
      const adapter = safeId(tracking.adapter);
      const mode = ["automatic", "link-only"].includes(tracking.mode) ? tracking.mode : "not-declared";
      const countries = safeCountries(carrier);
      const aliases = safeAliases(carrier.aliases);
      const dedicatedAdapter = mode === "automatic" && adapter && adapter !== "universal";
      const adapterType = mode === "link-only"
        ? "link-only"
        : dedicatedAdapter
          ? "dedicated"
          : mode === "automatic" && adapter === "universal"
            ? "universal-fallback"
            : "none";

      const matrix = CARRIER_INTEGRATION_MATRIX[id] || null;
      const sourceIntegration = matrix && INTEGRATION_CLASSES.has(matrix.integrationClass)
        ? {
            integrationClass: matrix.integrationClass,
            apiClient: matrix.apiClient === "source_module_present" ? "source_module_present" : "not_assessed",
            apiAuthentication: typeof matrix.apiAuthentication === "string" ? matrix.apiAuthentication : null,
            requiredEnvironment: Array.isArray(matrix.requiredEnvironment)
              ? matrix.requiredEnvironment.filter(value => typeof value === "string" && /^[A-Z0-9_]{2,80}$/.test(value))
              : [],
            sandboxMode: typeof matrix.sandboxMode === "string" ? matrix.sandboxMode : "not_assessed",
            sandboxBaseUrl: typeof matrix.sandboxBaseUrl === "string" && matrix.sandboxBaseUrl.startsWith("https://") ? matrix.sandboxBaseUrl : null,
            onboardingRole: typeof matrix.onboardingRole === "string" ? matrix.onboardingRole : null,
            mockContractTest: typeof matrix.mockContractTest === "string" ? matrix.mockContractTest : null,
            adapterSource: matrix.adapterSource === "present" ? "present" : "not_found",
            fixtureTest: matrix.fixtureTest === "defined" ? "defined" : "not_found",
            liveTestDefinition: matrix.liveTestDefinition === "defined" ? "defined" : "not_found",
            upstreamTrackingSteps: Array.isArray(matrix.upstreamTrackingSteps)
              ? matrix.upstreamTrackingSteps.filter(value => typeof value === "string" && /^[a-z0-9_-]{1,40}$/i.test(value))
              : [],
            commercialAuthorization: "not_assessed",
            thirdPartyTrackingRights: "not_assessed"
          }
        : {
            integrationClass: "catalogue_only",
            apiClient: "not_assessed",
            apiAuthentication: null,
            requiredEnvironment: [],
            mockContractTest: null,
            adapterSource: "not_found",
            fixtureTest: "not_found",
            liveTestDefinition: "not_found",
            upstreamTrackingSteps: [],
            commercialAuthorization: "not_assessed",
            thirdPartyTrackingRights: "not_assessed"
          };

      return {
        id,
        name: safeText(carrier.name || carrier.displayName || id, 120),
        aliases,
        countries,
        selectable: carrier.capabilities?.selectable === true,
        trackingMode: mode,
        adapter,
        adapterType,
        sourceIntegration
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en"));
}

const CATALOG_RECORDS = buildCatalogRecords();
function buildEvidenceByAdapter(records) {
  const map = new Map();
  for (const record of records) {
    for (const adapterId of record.adapterIds) {
      map.set(adapterId, record);
    }
  }
  return map;
}

function publicRecord(carrier, evidenceByAdapter) {
  const evidence = carrier.adapter ? evidenceByAdapter.get(carrier.adapter) : null;
  return {
    ...carrier,
    isCatalogEntry: true,
    evidence: evidence
      ? {
          level: evidence.level,
          adapterState: evidence.adapterState,
          integrationMethod: evidence.integrationMethod,
          commercialAccess: evidence.commercialAccess,
          trackingRights: evidence.trackingRights,
          sourceUrl: evidence.sourceUrl,
          disclosure: evidence.disclosure,
          verification: evidence.verification
        }
      : {
          level: "catalogued",
          adapterState: "missing",
          integrationMethod: "not_assessed",
          commercialAccess: "not_assessed",
          trackingRights: "not_assessed",
          sourceUrl: null,
          disclosure: "Upstream catalog metadata only. This is not proof of live tracking, carrier authorization or permission to display third-party shipment data.",
          verification: { method: "none", liveVerified: false, verifiedAt: null }
        }
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

export async function onRequestGet({ request, env } = {}) {
  const url = new URL(request?.url || "https://exportflow.me/api/carrier-directory");
  const query = safeText(url.searchParams.get("q") || "", MAX_QUERY_LENGTH).toLocaleLowerCase("en");
  const rawCountry = (url.searchParams.get("country") || "").trim().toUpperCase();
  const country = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : "";
  const evidenceFilter = url.searchParams.get("evidence") || "all";
  const adapterFilter = url.searchParams.get("adapter") || "all";
  const integrationFilter = url.searchParams.get("integration") || "all";
  const page = Math.max(1, Math.min(100_000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number.parseInt(url.searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

  if (url.searchParams.has("country") && rawCountry && !country) {
    return json({ error: "invalid_country_code" }, 400);
  }
  if (!["all", ...EVIDENCE_LEVELS].includes(evidenceFilter)) {
    return json({ error: "invalid_evidence_filter" }, 400);
  }
  if (!["all", "dedicated", "universal-fallback", "link-only", "none"].includes(adapterFilter)) {
    return json({ error: "invalid_adapter_filter" }, 400);
  }
  if (!["all", ...INTEGRATION_CLASSES].includes(integrationFilter)) {
    return json({ error: "invalid_integration_filter" }, 400);
  }

  const evidenceRegistry = await loadEvidence(env);
  const evidenceByAdapter = buildEvidenceByAdapter(evidenceRegistry.records);
  const catalogDirectoryRecords = CATALOG_RECORDS.map(record => publicRecord(record, evidenceByAdapter));
  const knownAdapters = new Set(CATALOG_RECORDS.map(record => record.adapter).filter(Boolean));
  const knownCarrierIds = new Set(CATALOG_RECORDS.map(record => record.id));
  const standaloneResearchRecords = evidenceRegistry.records
    .filter(record =>
      !knownCarrierIds.has(record.id) &&
      !record.adapterIds.some(adapterId => knownAdapters.has(adapterId))
    )
    .map(record => ({
      id: record.id,
      name: record.name || record.id,
      aliases: [],
      countries: [],
      selectable: false,
      trackingMode: "not-declared",
      adapter: null,
      adapterType: "none",
      isCatalogEntry: false,
      countryScope: record.countryScope,
      evidence: {
        level: record.level,
        adapterState: record.adapterState,
        integrationMethod: record.integrationMethod,
        commercialAccess: record.commercialAccess,
        trackingRights: record.trackingRights,
        sourceUrl: record.sourceUrl,
        disclosure: record.disclosure,
        verification: record.verification
      }
    }));
  const directoryRecords = [...catalogDirectoryRecords, ...standaloneResearchRecords];

  const totalCatalogue = CATALOG_RECORDS.length;
  const selectableCount = CATALOG_RECORDS.filter(record => record.selectable).length;
  const dedicatedCount = CATALOG_RECORDS.filter(record => record.adapterType === "dedicated").length;
  const universalCount = CATALOG_RECORDS.filter(record => record.adapterType === "universal-fallback").length;
  const linkOnlyCount = CATALOG_RECORDS.filter(record => record.adapterType === "link-only").length;
  const integrationCounts = Object.fromEntries([...INTEGRATION_CLASSES].map(value => [
    value,
    CATALOG_RECORDS.filter(record => record.sourceIntegration?.integrationClass === value).length
  ]));
  const apiClientRecords = CATALOG_RECORDS.filter(record => record.sourceIntegration?.apiClient === "source_module_present").length;
  const evidenceCounts = {
    catalogued: directoryRecords.filter(record => record.evidence.level === "catalogued").length,
    research: evidenceRegistry.records.filter(record => record.level === "research").length,
    testing: evidenceRegistry.records.filter(record => record.level === "testing").length,
    integrated: evidenceRegistry.records.filter(record => record.level === "integrated").length,
    verified: evidenceRegistry.records.filter(record => record.level === "verified" && record.verification.liveVerified).length,
    blocked: evidenceRegistry.records.filter(record => record.level === "blocked").length,
    deprecated: evidenceRegistry.records.filter(record => record.level === "deprecated").length
  };

  const filtered = directoryRecords.filter(record => {
    if (country && !record.countries.includes(country)) return false;
    if (evidenceFilter !== "all" && record.evidence.level !== evidenceFilter) return false;
    if (adapterFilter !== "all" && record.adapterType !== adapterFilter) return false;
    if (integrationFilter !== "all" && record.sourceIntegration?.integrationClass !== integrationFilter) return false;
    if (query) {
      const haystack = [record.id, record.name, ...record.aliases, ...record.countries, record.countryScope || ""].join(" ").toLocaleLowerCase("en");
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const offset = (page - 1) * pageSize;
  const records = filtered.slice(offset, offset + pageSize);
  return json({
    source: "exportflow-native-carrier-catalog",
    catalogMetadata: CARRIER_CATALOG_METADATA,
    upstreamRevision: SOURCE_REVISION,
    upstreamSnapshot: {
      catalogEntries: CARRIER_IDS.length,
      countriesRepresented: 156,
      dedicatedAdapters: 732,
      universalFallbacks: 5,
      carrierNetworkClaim: "3500+",
      note: "Counts are transcribed from the pinned upstream README. Carrier entries and network names are not a count of independent legal entities or verified ExportFlow integrations."
    },
    generatedAt: new Date().toISOString(),
    summary: {
      catalogEntries: CARRIER_IDS.length,
      catalogRecordObjects: totalCatalogue,
      totalDirectoryRecords: directoryRecords.length,
      standaloneResearchRecords: standaloneResearchRecords.length,
      selectableRecords: selectableCount,
      dedicatedAdapterRecords: dedicatedCount,
      universalFallbackRecords: universalCount,
      linkOnlyRecords: linkOnlyCount,
      evidenceRegistryAvailable: evidenceRegistry.available,
      evidenceRecords: evidenceRegistry.records.length,
      integrationMatrixRecords: CATALOG_RECORDS.length,
      apiClientRecords,
      integrationCounts,
      evidenceCounts
    },
    pagination: {
      page,
      pageSize,
      totalMatches: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      hasPrevious: page > 1,
      hasNext: offset + pageSize < filtered.length
    },
    filters: { q: query, country: country || null, evidence: evidenceFilter, adapter: adapterFilter, integration: integrationFilter },
    records
  });
}
