import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repositoryRoot = process.cwd();
const outputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(repositoryRoot, "parser-runtime-licenses.json");
const roots = ["@mozilla/readability", "linkedom", "papaparse"];

function locatePackage(name, fromDirectory) {
  const segments = name.split("/");
  let current = fromDirectory;
  while (true) {
    const candidate = join(current, "node_modules", ...segments, "package.json");
    if (existsSync(candidate)) return realpathSync(candidate);
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function readManifest(packageJsonPath) {
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  let license = "";
  if (typeof manifest.license === "string") license = manifest.license.trim();
  else if (typeof manifest.license?.type === "string") license = manifest.license.type.trim();
  else if (Array.isArray(manifest.licenses)) {
    license = manifest.licenses.map((item) => item?.type).filter(Boolean).join(" OR ");
  }
  return { manifest, license };
}

function findLicenseFiles(packageDirectory) {
  const candidates = [
    "LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "LICENCE.md",
    "COPYING", "COPYING.md", "NOTICE", "NOTICE.md",
  ];
  return candidates.filter((name) => existsSync(join(packageDirectory, name)));
}

const visited = new Set();
const packages = new Map();
const missingRequiredDependencies = [];
const missingLicenseMetadata = [];
const missingExplicitLicenseFiles = [];

function visit(name, fromDirectory, parent, required = true) {
  const packageJsonPath = locatePackage(name, fromDirectory);
  if (!packageJsonPath) {
    if (required) missingRequiredDependencies.push({ name, requiredBy: parent });
    return;
  }
  if (visited.has(packageJsonPath)) return;
  visited.add(packageJsonPath);

  const packageDirectory = dirname(packageJsonPath);
  const manifestResult = readManifest(packageJsonPath);
  const manifest = manifestResult.manifest;
  const license = manifestResult.license;
  const packageName = manifest.name || name;
  const version = manifest.version || null;
  const key = packageName + "@" + (version || "unknown");
  const licenseFiles = findLicenseFiles(packageDirectory);
  const seeLicense = /^SEE LICENSE IN (.+)$/i.exec(license);
  const explicitLicenseFile = seeLicense ? seeLicense[1].trim() : null;

  packages.set(key, {
    name: packageName,
    version,
    license: license || null,
    licenseFiles,
    explicitLicenseFile,
    locations: [packageJsonPath.startsWith(repositoryRoot)
      ? packageJsonPath.slice(repositoryRoot.length + 1)
      : packageJsonPath],
    requiredBy: parent,
  });

  if (!license || ["UNLICENSED", "UNKNOWN"].includes(license.toUpperCase())) {
    missingLicenseMetadata.push({ package: key, packageJson: packageJsonPath });
  }
  if (explicitLicenseFile && !existsSync(join(packageDirectory, explicitLicenseFile))) {
    missingExplicitLicenseFiles.push({
      package: key,
      license,
      missingFile: explicitLicenseFile,
    });
  }

  const dependencies = manifest.dependencies || {};
  for (const dependency of Object.keys(dependencies).sort()) {
    visit(dependency, packageDirectory, key, true);
  }

  const optionalDependencies = manifest.optionalDependencies || {};
  for (const dependency of Object.keys(optionalDependencies).sort()) {
    visit(dependency, packageDirectory, key, false);
  }

  const peerDependencies = manifest.peerDependencies || {};
  for (const dependency of Object.keys(peerDependencies).sort()) {
    if (locatePackage(dependency, packageDirectory)) {
      visit(dependency, packageDirectory, key, false);
    }
  }
}

for (const root of roots) visit(root, repositoryRoot, "ExportFlow parser runtime dependencies", true);

const lockPath = join(repositoryRoot, "package-lock.json");
let lockfileVersion = null;
if (existsSync(lockPath)) {
  lockfileVersion = JSON.parse(readFileSync(lockPath, "utf8")).lockfileVersion ?? null;
}

const report = {
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  lockfileVersion,
  roots: roots.map((name) => {
    const packageJsonPath = locatePackage(name, repositoryRoot);
    if (!packageJsonPath) return { name, missing: true };
    const manifestResult = readManifest(packageJsonPath);
    return {
      name,
      version: manifestResult.manifest.version || null,
      license: manifestResult.license || null,
    };
  }),
  packageCount: packages.size,
  packages: [...packages.values()].sort((a, b) =>
    a.name.localeCompare(b.name) || String(a.version).localeCompare(String(b.version))
  ),
  missingRequiredDependencies,
  missingLicenseMetadata,
  missingExplicitLicenseFiles,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
console.log("Parser transitive license inventory: " + report.packageCount + " packages");
console.log("Missing required dependencies: " + missingRequiredDependencies.length);
console.log("Missing license metadata: " + missingLicenseMetadata.length);
console.log("Missing SEE LICENSE IN files: " + missingExplicitLicenseFiles.length);
if (missingRequiredDependencies.length || missingLicenseMetadata.length || missingExplicitLicenseFiles.length) {
  process.exitCode = 1;
}
