import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { channel } from "node:diagnostics_channel";
import { classifyCredentialLiteralFindings } from "./credential-literal-classifier.mjs";

const PIN = "9c088edaa089135b89658f2b611f8a741d5238c6";
const EXPECTED_ADAPTERS = 743;
const EXPECTED_CATALOG = 1375;
const sourceRoot = resolve(process.env.EXPORTFLOW_UPSTREAM_ROOT || ".audit/upstream");
const previousRoot = resolve(process.env.EXPORTFLOW_COMPARE_ROOT || "vendor/sources/universal-parcel-scraper");
const outputRoot = resolve(process.env.EXPORTFLOW_AUDIT_OUTPUT || "artifacts/full-743-adapter-audit");
const datadogEnabled = process.env.DD_CIVISIBILITY_AGENTLESS_ENABLED === "true";
const testStart = channel("dd-trace:ci:manual:test:start");
const testFinish = channel("dd-trace:ci:manual:test:finish");
const testName = "exportflow-full-743-adapter-source-inventory";

async function walk(dir, prefix = "") {
  const result = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", ".next"].includes(ent.name)) continue;
    const rel = prefix ? prefix + "/" + ent.name : ent.name;
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) result.push(...await walk(abs, rel));
    else if (ent.isFile()) result.push({ path: rel, absolute: abs });
  }
  return result;
}
async function readText(path, limit = 200000) {
  try {
    const value = await readFile(path, "utf8");
    return value.length > limit ? value.slice(0, limit) : value;
  } catch { return ""; }
}
function gitHead(path) {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: path, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}
function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "en"));
}
function captures(source, regex) {
  return [...source.matchAll(regex)].map(x => x[1]).filter(Boolean);
}
function csv(value) {
  const v = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return '"' + v.replaceAll('"', '""') + '"';
}
function licenseId(content) {
  const s = content.slice(0, 16000);
  const choices = [
    ["AGPL-3.0", /GNU AFFERO GENERAL PUBLIC LICENSE[\s\S]{0,300}Version 3|AGPL[- ]3\.0/i],
    ["GPL-3.0", /GNU GENERAL PUBLIC LICENSE[\s\S]{0,300}Version 3|GPL[- ]3\.0/i],
    ["LGPL-3.0", /GNU LESSER GENERAL PUBLIC LICENSE[\s\S]{0,300}Version 3|LGPL[- ]3\.0/i],
    ["Apache-2.0", /Apache License[\s\S]{0,100}Version 2\.0/i],
    ["MIT", /Permission is hereby granted, free of charge/i],
    ["BSD", /Redistribution and use in source and binary forms/i],
    ["CC-BY-4.0", /Creative Commons Attribution 4\.0/i],
    ["ODbL-1.0", /Open Data Commons Open Database License/i],
    ["GODL-India", /Government Open Data License/i]
  ];
  const found = choices.find(x => x[1].test(s));
  return found ? found[0] : "unclassified";
}
function signals(code, manifest) {
  const steps = Array.isArray(manifest?.tracking?.steps) ? manifest.tracking.steps.filter(x => typeof x === "string") : [];
  const browser = manifest?.tracking?.browser === true || steps.some(x => /browser|trawl|page/i.test(x)) ||
    /playwright|chromium|browserExecutablePath|trawlUrl|page\.goto/i.test(code);
  const env = unique([
    ...captures(code, /\bprocess\.env\.([A-Z][A-Z0-9_]*)/g),
    ...captures(code, /\bprocess\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g)
  ]);
  const imports = unique([
    ...captures(code, /\bfrom\s*['"]([^./][^'"]*)['"]/g),
    ...captures(code, /\bimport\s*\(\s*['"]([^./][^'"]*)['"]\s*\)/g),
    ...captures(code, /\brequire\s*\(\s*['"]([^./][^'"]*)['"]\s*\)/g)
  ]).map(x => x.split("/").slice(0, x.startsWith("@") ? 2 : 1).join("/"));
  const hosts = unique(captures(code, /https?:\/\/([^/\s'"<>]+)/g)
    .map(x => x.toLowerCase().replace(/:\d+$/, ""))
    .filter(x => x && !/^(localhost|127\.0\.0\.1|example\.(com|org|net))$/.test(x)));
  return {
    steps, externalHosts: hosts, imports, environmentVariableNames: env,
    network: {
      fetch: /\bfetch\s*\(/i.test(code),
      axios: /\baxios\b/i.test(code),
      undici: /\bundici\b/i.test(code),
      otherHttpClient: /\b(?:got|superagent|node-fetch|request)\b/i.test(code),
      browser
    },
    authentication: {
      tokenOrApiKey: /authorization|oauth|bearer|api[_-]?key|client[_-]?secret|access[_-]?token/i.test(code),
      cookieOrCsrf: /cookie|set-cookie|csrf|xsrf/i.test(code)
    },
    reliability: {
      timeoutOrDeadline: /timeout|deadline|budgetMs|lookupBudget/i.test(code),
      abortSignal: /AbortSignal|AbortController/i.test(code),
      retryOrBackoff: /retry|backoff|attempts?/i.test(code),
      rateLimit: /rate.?limit|too many requests|429/i.test(code),
      userAgent: /user.?agent/i.test(code)
    },
    privacySignals: unique(["recipient", "postcode", "postal_code", "address", "email", "phone", "signatory", "proof_of_delivery"]
      .filter(term => new RegExp(term.replaceAll("_", "[_-]?"), "i").test(code))),
    securityHeuristics: {
      dynamicCodeExecution: /\beval\s*\(|new\s+Function\s*\(/.test(code),
      possibleCredentialLiteral: /(?:api[_-]?key|client[_-]?secret|password|access[_-]?token)\s*[:=]\s*['"][^'"]{12,}['"]/i.test(code)
    }
  };
}
async function adapterIds(root) {
  const dirs = await readdir(join(root, "carriers"), { withFileTypes: true });
  const ids = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    try { await readFile(join(root, "carriers", d.name, "adapter.ts"), "utf8"); ids.push(d.name); } catch {}
  }
  return unique(ids);
}

async function runAudit() {
  const commit = gitHead(sourceRoot);
  assert.equal(commit, PIN, "Audit source must be the immutable upstream snapshot.");
  const root = join(sourceRoot, "carriers");
  const entries = await readdir(root, { withFileTypes: true });
  const pkg = JSON.parse(await readText(join(sourceRoot, "package.json")));
  const readme = await readText(join(sourceRoot, "README.md"));
  const readmeAdapters = Number(readme.match(/([\d,]+)\s+dedicated adapters/i)?.[1]?.replaceAll(",", "") || 0);
  const readmeCatalog = Number(readme.match(/([\d,]+)\s+catalog entries/i)?.[1]?.replaceAll(",", "") || 0);
  const readmeFallbacks = Number(readme.match(/([\d,]+)\s+universal fallbacks/i)?.[1]?.replaceAll(",", "") || 0);
  const readmeCountries = Number(readme.match(/([\d,]+)\s+countries represented/i)?.[1]?.replaceAll(",", "") || 0);
  const adapters = [];
  const nonAdapterCatalogEntries = [];
  const integrityIssues = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const folder = join(root, ent.name);
    let adapter;
    try { adapter = await readFile(join(folder, "adapter.ts"), "utf8"); } catch { adapter = ""; }
    let manifest = null;
    try { manifest = JSON.parse(await readFile(join(folder, "carrier.json"), "utf8")); }
    catch (e) { if (adapter) integrityIssues.push({ id: ent.name, issue: e.code === "ENOENT" ? "missing_manifest" : "invalid_manifest_json" }); }
    if (!adapter) {
      if (manifest) nonAdapterCatalogEntries.push(ent.name);
      continue;
    }
    const files = await walk(folder);
    const sourceFiles = files.filter(x => /\.(ts|tsx|js|mjs|cjs)$/.test(x.path));
    const sourceContents = await Promise.all(sourceFiles.map(async file => ({ path: file.path, content: await readText(file.absolute) })));
    const code = sourceContents.map(file => file.content).join("\n");
    const tests = files.filter(x => /\.(test|spec)\.(ts|tsx|js|mjs|cjs)$/.test(x.path)).map(x => x.path);
    const liveTests = tests.filter(x => /\.live\.test\./i.test(x));
    const offlineTests = tests.filter(x => !/\.live\.test\./i.test(x));
    const fixtures = files.filter(x => /(^|\/)fixtures?\//i.test(x.path) || /\.(html|fixture)\.(json|txt)$/i.test(x.path)).map(x => x.path);
    const localRights = files.filter(x => /(^|\/)(LICENSE|LICENCE|NOTICE|COPYING|COPYRIGHT)([._-]|$)/i.test(x.path)).map(x => x.path);
    const sig = signals(code, manifest || {});
    const credentialLiteralFindings = classifyCredentialLiteralFindings(sourceContents);
    const runtimeCredentialLiteralFindings = credentialLiteralFindings.filter(x => x.sourceKind === "runtime");
    const testFixtureCredentialLiteralFindings = credentialLiteralFindings.filter(x => x.sourceKind !== "runtime");
    const securityHeuristics = {
      ...sig.securityHeuristics,
      possibleCredentialLiteral: credentialLiteralFindings.length > 0,
      possibleCredentialLiteralInRuntimeSource: runtimeCredentialLiteralFindings.length > 0,
      possibleCredentialLiteralInTestOrFixture: testFixtureCredentialLiteralFindings.length > 0,
      credentialLiteralFindingLocations: credentialLiteralFindings
    };
    const id = typeof manifest?.id === "string" ? manifest.id : ent.name;
    if (id !== ent.name) integrityIssues.push({ id: ent.name, issue: "manifest_id_mismatch" });
    adapters.push({
      id, directory: ent.name, displayName: manifest?.displayName || ent.name,
      trackingMode: manifest?.tracking?.mode || "not_declared",
      trackingAdapter: manifest?.tracking?.adapter || null,
      selectable: manifest?.selectable === true,
      countries: Array.isArray(manifest?.region?.countries) ? unique(manifest.region.countries.filter(x => typeof x === "string").map(x => x.toUpperCase())) : [],
      trackingSteps: sig.steps, sourceFileCount: sourceFiles.length,
      sourceFiles: sourceFiles.map(x => x.path),
      offlineTestFiles: offlineTests, liveTestFiles: liveTests, fixtureFiles: fixtures,
      hasOfflineTest: offlineTests.length > 0, hasLiveTestDefinition: liveTests.length > 0,
      localLicenseNoticeFiles: localRights,
      licenseReview: localRights.length ? "local_license_notice_requires_file_review" : "root_license_notice_pending_file_level_review",
      networkSignals: sig.network, externalHosts: sig.externalHosts, imports: sig.imports,
      environmentVariableNamesOnly: sig.environmentVariableNames,
      authenticationSignals: sig.authentication, reliabilitySignals: sig.reliability,
      privacyRelatedCodeSignals: sig.privacySignals, securityHeuristics,
      officialCarrierStatus: "not_independently_verified",
      carrierApiAuthorization: "not_established_by_software_license",
      commercialTrackingRights: "not_assessed"
    });
  }

  const ids = adapters.map(x => x.id);
  const uniqueIds = unique(ids);
  const duplicateIds = unique(ids.filter((id, i) => ids.indexOf(id) !== i));
  const oldIds = await adapterIds(previousRoot);
  const addedIds = uniqueIds.filter(x => !oldIds.includes(x));
  const removedIds = oldIds.filter(x => !uniqueIds.includes(x));
  const allFiles = await walk(sourceRoot);
  const rightsInventory = [];
  for (const file of allFiles.filter(x => /(^|\/)(LICENSE|LICENCE|NOTICE|COPYING|COPYRIGHT)([._-]|$)/i.test(x.path))) {
    const content = await readText(file.absolute, 100000);
    rightsInventory.push({ path: file.path, detectedLicense: licenseId(content), sizeChars: content.length });
  }
  const summary = {
    dedicatedAdapterDirectories: adapters.length,
    uniqueAdapterIds: uniqueIds.length,
    catalogueDirectories: entries.filter(x => x.isDirectory()).length,
    nonAdapterCatalogEntries: nonAdapterCatalogEntries.length,
    duplicateAdapterIds: duplicateIds,
    integrityIssues,
    adaptersWithOfflineTests: adapters.filter(x => x.hasOfflineTest).length,
    offlineTestFiles: adapters.reduce((n, x) => n + x.offlineTestFiles.length, 0),
    adaptersWithLiveTestDefinitions: adapters.filter(x => x.hasLiveTestDefinition).length,
    liveTestDefinitionFiles: adapters.reduce((n, x) => n + x.liveTestFiles.length, 0),
    adaptersWithFixtures: adapters.filter(x => x.fixtureFiles.length > 0).length,
    browserDependentOrIndicated: adapters.filter(x => x.networkSignals.browser).length,
    adaptersWithAuthSignals: adapters.filter(x => x.authenticationSignals.tokenOrApiKey || x.authenticationSignals.cookieOrCsrf || x.environmentVariableNamesOnly.length).length,
    adaptersWithTimeoutOrAbortSignals: adapters.filter(x => x.reliabilitySignals.timeoutOrDeadline || x.reliabilitySignals.abortSignal).length,
    adaptersWithRetryOrRateLimitSignals: adapters.filter(x => x.reliabilitySignals.retryOrBackoff || x.reliabilitySignals.rateLimit).length,
    adaptersWithLocalLicenseNoticeFiles: adapters.filter(x => x.localLicenseNoticeFiles.length > 0).length,
    uniqueExternalHostnames: unique(adapters.flatMap(x => x.externalHosts)).length,
    adaptersWithCredentialLiteralInRuntimeSource: adapters.filter(x => x.securityHeuristics.possibleCredentialLiteralInRuntimeSource).length,
    adaptersWithCredentialLiteralOnlyInTestsOrFixtures: adapters.filter(x => !x.securityHeuristics.possibleCredentialLiteralInRuntimeSource && x.securityHeuristics.possibleCredentialLiteralInTestOrFixture).length,
    credentialLiteralFindingsBySourceKind: {
      runtime: adapters.reduce((n, x) => n + x.securityHeuristics.credentialLiteralFindingLocations.filter(f => f.sourceKind === "runtime").length, 0),
      test: adapters.reduce((n, x) => n + x.securityHeuristics.credentialLiteralFindingLocations.filter(f => f.sourceKind === "test").length, 0),
      fixture: adapters.reduce((n, x) => n + x.securityHeuristics.credentialLiteralFindingLocations.filter(f => f.sourceKind === "fixture").length, 0)
    },
    repositoryLicenseNoticeFiles: rightsInventory.length
  };
  const failures = [];
  if (summary.dedicatedAdapterDirectories !== EXPECTED_ADAPTERS) failures.push("Expected 743 adapters, found " + summary.dedicatedAdapterDirectories);
  if (summary.uniqueAdapterIds !== EXPECTED_ADAPTERS) failures.push("Expected 743 unique IDs, found " + summary.uniqueAdapterIds);
  if (summary.catalogueDirectories !== EXPECTED_CATALOG) failures.push("Expected 1,375 catalogue directories, found " + summary.catalogueDirectories);
  if (readmeAdapters !== EXPECTED_ADAPTERS || readmeCatalog !== EXPECTED_CATALOG) failures.push("README count mismatch for pinned source");
  if (duplicateIds.length || integrityIssues.length) failures.push("Manifest or adapter identity integrity issues found");

  const report = {
    schemaVersion: "1.0.0", generatedAt: new Date().toISOString(),
    source: {
      repository: "https://github.com/plhery/universal-parcel-scraper",
      commit, commitUrl: "https://github.com/plhery/universal-parcel-scraper/commit/" + commit,
      packageVersion: pkg.version || "unknown", declaredLicense: pkg.license || "not_declared",
      readmeCounts: { dedicatedAdapters: readmeAdapters, catalogueEntries: readmeCatalog, universalFallbacks: readmeFallbacks, representedCountries: readmeCountries }
    },
    comparison: {
      previousExportFlowAdapterCount: oldIds.length, currentUpstreamAdapterCount: uniqueIds.length,
      addedCount: addedIds.length, removedCount: removedIds.length, addedIds, removedIds
    },
    summary, rightsInventory,
    rightsBoundary: {
      adaptersIndependentlyRightsCleared: false,
      softwareLicenseGrantsCarrierApiAuthorization: false,
      softwareLicenseGrantsCarrierTrademarkRights: false,
      shipmentDataRedistributionRightsReviewedPerCarrier: false,
      nestedLicenseFilesRemainDistinct: true,
      optionalTrawlComponent: "AGPL-3.0; excluded from ExportFlow runtime import"
    },
    testPolicy: {
      offlineSuite: "npm test and npm run test:scripts",
      liveTestDefinitionsInventoriedOnly: true, liveTestsExecuted: false,
      realCarrierRequestsMade: false, shipmentNumbersOrCredentialsCollected: false
    },
    failures, adapters
  };

  await mkdir(outputRoot, { recursive: true });
  await writeFile(join(outputRoot, "adapter-audit.json"), JSON.stringify(report, null, 2) + "\n");
  const columns = ["id","directory","displayName","trackingMode","trackingAdapter","selectable","countries","trackingSteps","sourceFileCount","sourceFiles","hasOfflineTest","offlineTestFiles","hasLiveTestDefinition","liveTestFiles","fixtureFiles","localLicenseNoticeFiles","licenseReview","networkSignals","externalHosts","imports","environmentVariableNamesOnly","authenticationSignals","reliabilitySignals","privacyRelatedCodeSignals","securityHeuristics","officialCarrierStatus","carrierApiAuthorization","commercialTrackingRights"];
  const csvRows = [columns.map(csv).join(",")];
  for (const adapter of adapters) csvRows.push(columns.map(key => csv(adapter[key])).join(","));
  await writeFile(join(outputRoot, "adapter-audit.csv"), csvRows.join("\n") + "\n");
  const md = [
    "# ExportFlow full 743-adapter source audit", "",
    "Generated: " + report.generatedAt, "",
    "## Pinned source",
    "- Repository: " + report.source.repository,
    "- Commit: " + commit,
    "- Package version: " + report.source.packageVersion,
    "- Declared root license: " + report.source.declaredLicense,
    "- Upstream README: " + readmeAdapters + " adapters; " + readmeCatalog + " catalogue entries; " + readmeFallbacks + " universal fallbacks; " + readmeCountries + " countries.", "",
    "## Inventory summary",
    "| Measure | Count |", "| --- | ---: |",
    "| Dedicated adapter directories | " + summary.dedicatedAdapterDirectories + " |",
    "| Unique adapter IDs | " + summary.uniqueAdapterIds + " |",
    "| Catalogue directories | " + summary.catalogueDirectories + " |",
    "| Adapters with offline tests | " + summary.adaptersWithOfflineTests + " |",
    "| Offline test files | " + summary.offlineTestFiles + " |",
    "| Adapters with live-test definitions (not executed) | " + summary.adaptersWithLiveTestDefinitions + " |",
    "| Live-test definition files | " + summary.liveTestDefinitionFiles + " |",
    "| Adapters with fixtures | " + summary.adaptersWithFixtures + " |",
    "| Browser-dependent/indicated adapters | " + summary.browserDependentOrIndicated + " |",
    "| Adapters with credential-like literals in runtime source (heuristic) | " + summary.adaptersWithCredentialLiteralInRuntimeSource + " |",
    "| Adapters with credential-like literals only in tests/fixtures | " + summary.adaptersWithCredentialLiteralOnlyInTestsOrFixtures + " |",
    "| Adapters with auth signals | " + summary.adaptersWithAuthSignals + " |",
    "| Adapters with timeout/abort signals | " + summary.adaptersWithTimeoutOrAbortSignals + " |",
    "| Adapters with retry/rate-limit signals | " + summary.adaptersWithRetryOrRateLimitSignals + " |",
    "| Adapters with local license/notice files | " + summary.adaptersWithLocalLicenseNoticeFiles + " |",
    "| Unique external hostnames | " + summary.uniqueExternalHostnames + " |",
    "| Repository license/NOTICE files | " + summary.repositoryLicenseNoticeFiles + " |", "",
    "## Difference from previous ExportFlow snapshot",
    "- Previous pinned adapter directories: " + oldIds.length,
    "- Audited upstream adapter directories: " + uniqueIds.length,
    "- Added adapter IDs: " + addedIds.length,
    "- Removed adapter IDs: " + removedIds.length,
    "- Added IDs: " + (addedIds.join(", ") || "None"),
    "- Removed IDs: " + (removedIds.join(", ") || "None"), "",
    "## Rights and test boundary",
    "- No adapter is independently rights-cleared by this inventory.",
    "- Apache-2.0 software licensing does not grant carrier API authorization, trademark rights, shipment-data redistribution permission or official partnership.",
    "- Nested license/notice files remain separately attributed.",
    "- Optional AGPL-3.0 TRAWL component is excluded from ExportFlow runtime imports.",
    "- Browser/network/auth/reliability/privacy/security flags are static indicators, not proven runtime facts.",
    "- Live tests were inventoried only; no carrier requests, credentials or shipment samples were used.", "",
    "Detailed per-adapter records are in adapter-audit.json and adapter-audit.csv.",
    failures.length ? "Integrity findings: " + failures.join("; ") : "Source commit, count and unique identity checks passed."
  ].join("\n");
  await writeFile(join(outputRoot, "adapter-audit.md"), md + "\n");
  const result = { commit, outputRoot, summary, comparison: report.comparison, failures };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (datadogEnabled) testStart.publish({ testName, testSuite: "ExportFlow full adapter source audit" });
try {
  const result = await runAudit();
  if (datadogEnabled) testFinish.publish({ status: result.failures.length ? "fail" : "pass" });
  if (result.failures.length) process.exitCode = 1;
} catch (error) {
  if (datadogEnabled) testFinish.publish({ status: "fail", error });
  throw error;
}
