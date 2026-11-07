import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const sourceRoot = resolve(root, "vendor/sources/universal-parcel-scraper/carriers");
const outputFile = resolve(root, "data/carrier-catalog.generated.mjs");
const upstreamCommit = "e64a466772ef25ce68e02d9c7c9f1613eec1208b";
const expectedRecords = 1339;
const expectedAdapterDirectories = 732;
const expectedLiveTestFiles = 727;

const API_CLIENT_PROFILES = Object.freeze({
  "dhl-express": {
    authentication: "api_key_header",
    requiredEnvironment: ["DHL_API_KEY"],
    sandboxMode: "no_external_customer_test_environment",
    sandboxBaseUrl: null,
    apiDocumentationUrl: "https://developer.dhl.com/api-reference/shipment-tracking",
    contractTest: "carrier-official-api-contract-test"
  },
  fedex: {
    authentication: "oauth2_client_credentials",
    requiredEnvironment: ["FEDEX_API_KEY", "FEDEX_SECRET_KEY"],
    sandboxMode: "developer_sandbox",
    sandboxBaseUrl: "https://apis-sandbox.fedex.com",
    apiDocumentationUrl: "https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html",
    contractTest: "carrier-official-api-contract-test",
    onboardingRole: "integrator_provider"
  },
  ups: {
    authentication: "oauth2_client_credentials",
    requiredEnvironment: ["UPS_CLIENT_ID", "UPS_CLIENT_SECRET"],
    sandboxMode: "customer_integration_environment",
    sandboxBaseUrl: "https://wwwcie.ups.com",
    apiDocumentationUrl: "https://developer.ups.com/tag/Tracking?loc=en_US",
    contractTest: "carrier-official-api-contract-test"
  }
});

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readCarrierDirectory(entry) {
  if (!entry.isDirectory()) return null;
  const directory = join(sourceRoot, entry.name);
  const manifestPath = join(directory, "carrier.json");
  if (!(await exists(manifestPath))) return null;

  const raw = JSON.parse(await readFile(manifestPath, "utf8"));
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(id)) {
    throw new Error("Invalid carrier id in " + manifestPath);
  }
  if (id !== entry.name) {
    throw new Error("Carrier directory/id mismatch in " + manifestPath);
  }

  const displayName = typeof raw.displayName === "string" && raw.displayName.trim()
    ? raw.displayName.trim().slice(0, 120)
    : id;
  const aliases = Array.isArray(raw.aliases)
    ? [...new Set(raw.aliases.filter(value => typeof value === "string" && value.trim()).map(value => value.trim().slice(0, 100)))].slice(0, 8)
    : [];
  const countries = Array.isArray(raw.region?.countries)
    ? [...new Set(raw.region.countries.filter(value => typeof value === "string" && /^[A-Z]{2}$/i.test(value)).map(value => value.toUpperCase()))].sort()
    : [];
  const mode = ["automatic", "link-only"].includes(raw.tracking?.mode) ? raw.tracking.mode : "not-declared";
  const adapter = typeof raw.tracking?.adapter === "string" && /^[a-z0-9_-]{1,80}$/i.test(raw.tracking.adapter)
    ? raw.tracking.adapter
    : null;

  const portalCandidate = typeof raw.portal?.searchUrl === "string" && raw.portal.searchUrl.startsWith("https://")
    ? raw.portal.searchUrl
    : typeof raw.portal?.url === "string" && raw.portal.url.startsWith("https://")
      ? raw.portal.url
      : null;

  return {
    id,
    name: displayName,
    aliases,
    countries,
    provenance: {
      sourceType: "upstream_carrier_manifest",
      repository: "https://github.com/plhery/universal-parcel-scraper",
      commit: upstreamCommit,
      manifestPath: "carriers/" + id + "/carrier.json",
      sourceUrl: "https://github.com/plhery/universal-parcel-scraper/blob/" + upstreamCommit + "/carriers/" + id + "/carrier.json",
      sourceLicense: "Apache-2.0",
      licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
      licensePath: "vendor/sources/universal-parcel-scraper/LICENSE",
      attributionPath: "vendor/sources/universal-parcel-scraper/NOTICE",
      licenseStatus: "recorded_from_pinned_upstream_repository",
      licenseScope: "upstream_carrier_manifest",
      portalUrlCandidate: portalCandidate,
      trackingPageCandidateStatus: portalCandidate ? "upstream_declared_unverified" : "not_provided",
      authorityStatus: "upstream_manifest_candidate_not_independently_verified",
      officialCarrierStatus: "not_independently_verified",
      commercialTrackingRights: "not_granted_by_software_license",
      carrierTrademarkRights: "not_granted_by_software_license",
      carrierApiAuthorization: "not_granted_by_software_license",
      thirdPartyTrackingDataRights: "not_assessed",
      rightsNote: "The upstream software license does not grant carrier trademark, API, shipment-data, partnership or endorsement rights."
    },
    capabilities: {
      selectable: raw.selectable === true,
      tracking: { mode, adapter }
    },
    sourceArtifacts: {
      adapterSource: await exists(join(directory, "adapter.ts")),
      liveTest: await exists(join(directory, "adapter.live.test.ts")),
      fixtureTest: await exists(join(directory, "adapter.test.ts")),
      apiModule: await exists(join(directory, "api.ts")),
      trackingSteps: Array.isArray(raw.tracking?.steps)
        ? [...new Set(raw.tracking.steps.filter(value =>
            typeof value === "string" && /^[a-z0-9_-]{1,40}$/i.test(value)
          ))]
        : []
    }
  };
}

const entries = await readdir(sourceRoot, { withFileTypes: true });
const parsed = [];
for (const entry of entries) {
  const record = await readCarrierDirectory(entry);
  if (record) parsed.push(record);
}
parsed.sort((a, b) => a.id.localeCompare(b.id, "en"));

const ids = parsed.map(record => record.id);
if (ids.length !== expectedRecords) {
  throw new Error("Pinned carrier snapshot expected " + expectedRecords + " records, found " + ids.length);
}
if (new Set(ids).size !== ids.length) throw new Error("Duplicate carrier ids found in pinned source snapshot");
if (!ids.includes("unknown")) throw new Error("Reserved unknown carrier record is missing");
const adapterDirectories = parsed.filter(record => record.sourceArtifacts.adapterSource).length;
const liveTestFiles = parsed.filter(record => record.sourceArtifacts.liveTest).length;
const providerApiModules = parsed.filter(record => record.sourceArtifacts.apiModule).length;
if (adapterDirectories !== expectedAdapterDirectories) {
  throw new Error("Expected " + expectedAdapterDirectories + " adapter source directories, found " + adapterDirectories);
}
if (liveTestFiles !== expectedLiveTestFiles) {
  throw new Error("Expected " + expectedLiveTestFiles + " live adapter test files, found " + liveTestFiles);
}

const carriers = Object.fromEntries(parsed.map(record => {
  const { sourceArtifacts, provenance, ...publicMetadata } = record;
  // Do not leak unreviewed carrier portal candidates into the public API index.
  const { portalUrlCandidate, ...publicProvenance } = provenance;
  return [record.id, { ...publicMetadata, provenance: publicProvenance }];
}));
const metadata = {
  catalogMaintainer: "ExportFlow",
  catalogKind: "normalized in-repository derivative index",
  catalogOwnershipNote: "ExportFlow maintains the normalized schema and curation; upstream source material and carrier marks remain with their respective rightsholders. No exclusive ownership is claimed over third-party carrier data or brands.",
  upstreamRepository: "https://github.com/plhery/universal-parcel-scraper",
  upstreamCommit,
  upstreamCoreLicense: "Apache-2.0",
  upstreamLicenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
  upstreamLicensePath: "vendor/sources/universal-parcel-scraper/LICENSE",
  attributionPath: "vendor/sources/universal-parcel-scraper/NOTICE",
  sourceLicenseCoverageRecords: parsed.length,
  displayCarrierRecords: parsed.filter(record => record.id !== "unknown").length,
  independentlyVerifiedOfficialCarrierRecords: 0,
  carrierAuthorizationRecords: 0,
  carrierRecords: parsed.length,
  selectableCarrierRecords: parsed.filter(record => record.capabilities.selectable).length,
  adapterSourceDirectories: adapterDirectories,
  liveAdapterTestFiles: liveTestFiles,
  providerApiModuleDirectories: providerApiModules,
  generatedFrom: "vendor/sources/universal-parcel-scraper/carriers/*/carrier.json",
  generationUsesNetwork: false
};

function classifyIntegration(record) {
  const mode = record.capabilities.tracking.mode;
  const adapter = record.capabilities.tracking.adapter;
  const source = record.sourceArtifacts;
  if (mode === "link-only") return "link_only";
  if (adapter === "universal") return "universal_fallback";
  if (source.apiModule) return "provider_api_client";
  if (source.adapterSource) return "dedicated_adapter";
  if (mode === "automatic" && adapter) return "adapter_reference_only";
  return "catalogue_only";
}

const integrationMatrix = Object.fromEntries(parsed.map(record => {
  const profile = API_CLIENT_PROFILES[record.id] || null;
  const integrationClass = classifyIntegration(record);
  return [record.id, {
    carrierId: record.id,
    integrationClass,
    adapterId: record.capabilities.tracking.adapter,
    trackingMode: record.capabilities.tracking.mode,
    upstreamTrackingSteps: record.sourceArtifacts.trackingSteps,
    adapterSource: record.sourceArtifacts.adapterSource ? "present" : "not_found",
    fixtureTest: record.sourceArtifacts.fixtureTest ? "defined" : "not_found",
    liveTestDefinition: record.sourceArtifacts.liveTest ? "defined" : "not_found",
    apiClient: record.sourceArtifacts.apiModule ? "source_module_present" : "not_assessed",
    apiAuthentication: profile?.authentication || null,
    requiredEnvironment: profile?.requiredEnvironment || [],
    sandboxMode: profile?.sandboxMode || "not_assessed",
    sandboxBaseUrl: profile?.sandboxBaseUrl || null,
    apiDocumentationUrl: profile?.apiDocumentationUrl || null,
    onboardingRole: profile?.onboardingRole || null,
    mockContractTest: profile?.contractTest || null
  }];
}));

const integrationClassCounts = {};
for (const entry of Object.values(integrationMatrix)) {
  integrationClassCounts[entry.integrationClass] = (integrationClassCounts[entry.integrationClass] || 0) + 1;
}
metadata.integrationMatrixRecords = Object.keys(integrationMatrix).length;
metadata.integrationClassCounts = integrationClassCounts;
metadata.providerApiClientRecords = Object.values(integrationMatrix)
  .filter(entry => entry.apiClient === "source_module_present").length;

await mkdir(resolve(outputFile, ".."), { recursive: true });
const output = [
  "// Generated from the pinned, tracked source snapshot. Do not edit by hand.",
  "// Carrier names and marks remain those of their respective owners; this file is ExportFlow's normalized index.",
  "export const CARRIER_IDS = Object.freeze(" + JSON.stringify(ids) + ");",
  "export const CARRIERS = Object.freeze(" + JSON.stringify(carriers) + ");",
  "export const CARRIER_CATALOG_METADATA = Object.freeze(" + JSON.stringify(metadata) + ");",
  "export const CARRIER_INTEGRATION_MATRIX = Object.freeze(" + JSON.stringify(integrationMatrix) + ");",
  ""
].join("\n");
await writeFile(outputFile, output, "utf8");

// Keep a complete, machine-readable rights ledger for the private project catalogue.
// Candidate tracking URLs are retained here only as unverified research leads.
const licensingIndex = {
  schemaVersion: 1,
  catalogMaintainer: "ExportFlow",
  catalogKind: "per-record source provenance and license register",
  generatedFrom: "vendor/sources/universal-parcel-scraper/carriers/*/carrier.json",
  recordCount: parsed.filter(record => record.id !== "unknown").length,
  upstream: {
    repository: "https://github.com/plhery/universal-parcel-scraper",
    commit: upstreamCommit,
    license: "Apache-2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    licenseFile: "vendor/sources/universal-parcel-scraper/LICENSE",
    noticeFile: "vendor/sources/universal-parcel-scraper/NOTICE"
  },
  rightsPolicy: {
    sourceLicenseStatus: "recorded_from_pinned_upstream_repository",
    carrierTrademarkRights: "not_granted_by_software_license",
    carrierApiAuthorization: "not_granted_by_software_license",
    thirdPartyTrackingDataRights: "not_assessed",
    officialCarrierStatus: "not_independently_verified",
    note: "Apache-2.0 is the recorded license for upstream carrier manifest/source material in the pinned snapshot. It does not grant rights from individual carriers to use their trademarks, APIs, tracking pages or shipment data, and does not establish a partnership or official integration. Preserve the upstream LICENSE and NOTICE."
  },
  records: parsed
    .filter(record => record.id !== "unknown")
    .map(record => ({
      id: record.id,
      name: record.name,
      provenance: record.provenance
    }))
};
const licensingFile = resolve(root, "data/carrier-catalog-licensing.json");
await mkdir(resolve(licensingFile, ".."), { recursive: true });
await writeFile(licensingFile, JSON.stringify(licensingIndex, null, 2) + "\n", "utf8");

console.log("Generated ExportFlow carrier catalogue: " + parsed.length + " records (" +
  licensingIndex.recordCount + " display carriers); " + adapterDirectories +
  " local adapter directories; " + liveTestFiles + " live-test files; per-record license ledger.");
