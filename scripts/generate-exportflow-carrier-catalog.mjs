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
    contractTest: "carrier-official-api-contract-test"
  },
  fedex: {
    authentication: "oauth2_client_credentials",
    requiredEnvironment: ["FEDEX_API_KEY", "FEDEX_SECRET_KEY"],
    contractTest: "carrier-official-api-contract-test"
  },
  ups: {
    authentication: "oauth2_client_credentials",
    requiredEnvironment: ["UPS_CLIENT_ID", "UPS_CLIENT_SECRET"],
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

  return {
    id,
    name: displayName,
    aliases,
    countries,
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
  const { sourceArtifacts, ...publicMetadata } = record;
  return [record.id, publicMetadata];
}));
const metadata = {
  catalogOwner: "ExportFlow",
  catalogKind: "normalized in-repository snapshot",
  upstreamRepository: "https://github.com/plhery/universal-parcel-scraper",
  upstreamCommit,
  upstreamCoreLicense: "Apache-2.0",
  attributionPath: "vendor/sources/universal-parcel-scraper/NOTICE",
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
    mockContractTest: profile?.contractTest || null,
    commercialAuthorization: "not_assessed",
    thirdPartyTrackingRights: "not_assessed"
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
console.log("Generated ExportFlow carrier catalogue: " + parsed.length + " records; " +
  adapterDirectories + " local adapter directories; " + liveTestFiles + " live-test files.");
