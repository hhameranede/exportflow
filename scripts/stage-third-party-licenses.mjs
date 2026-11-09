import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const LICENSE_FILE = /^(?:LICENSE|LICENCE|UNLICENSE|COPYING|NOTICE)(?:[._-][A-Z0-9._-]+)?$/i;
const SKIP_DIRS = new Set([".git", "node_modules", "fixtures", "__fixtures__", "__tests__", "tests", "test", "coverage"]);

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function encodePath(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function safeSlug(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, "__").replace(/^_+|_+$/g, "");
}

function licenseValue(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

async function findLicenseFiles(packageDir, currentDir = packageDir, depth = 0) {
  if (depth > 7) return [];
  const found = [];
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name);
    if (entry.isFile() && LICENSE_FILE.test(entry.name)) {
      found.push(path.relative(packageDir, absolute).split(path.sep).join("/"));
    } else if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
      found.push(...await findLicenseFiles(packageDir, absolute, depth + 1));
    }
  }
  return found.sort((a, b) => a.localeCompare(b));
}

export async function stageThirdPartyLicenses({ root = process.cwd(), output = path.resolve(root, "dist") } = {}) {
  const lock = JSON.parse(await readFile(path.resolve(root, "package-lock.json"), "utf8"));
  const lockedPackages = Object.entries(lock.packages || {})
    .filter(([lockPath]) => lockPath.startsWith("node_modules/"))
    .sort(([a], [b]) => a.localeCompare(b));
  const fallbackManifest = JSON.parse(await readFile(path.resolve(root, "third-party-license-fallbacks.json"), "utf8"));
  const licenseFallbacks = fallbackManifest.packages || {};

  if (lockedPackages.length === 0) throw new Error("package-lock.json contains no installed packages");

  const licensesRoot = path.resolve(output, "licenses");
  const packagesRoot = path.join(licensesRoot, "packages");
  await mkdir(packagesRoot, { recursive: true });

  const manifestPackages = [];
  const markdownRows = [];
  const htmlRows = [];
  for (const [lockPath, lockMeta] of lockedPackages) {
    const packageDir = path.resolve(root, lockPath);
    const relativePackageDir = path.relative(root, packageDir);
    if (relativePackageDir.startsWith("..") || path.isAbsolute(relativePackageDir)) {
      throw new Error("Unsafe package path in lockfile: " + lockPath);
    }

    const pkg = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8"));
    if (pkg.version !== lockMeta.version) {
      throw new Error("Installed version mismatch for " + lockPath + ": lock=" + lockMeta.version + ", package=" + pkg.version);
    }

    const declaredLicense = licenseValue(lockMeta.license || pkg.license);
    const packageLicense = licenseValue(pkg.license);
    if (!declaredLicense || !packageLicense) {
      throw new Error("Missing license metadata for " + lockPath);
    }
    if (declaredLicense !== packageLicense) {
      throw new Error("Lockfile/package.json license mismatch for " + lockPath + ": " + declaredLicense + " vs " + packageLicense);
    }

    const licenseFiles = await findLicenseFiles(packageDir);
    const hasPackagedLicenseText = licenseFiles.some(relativeFile =>
      /^(?:LICENSE|LICENCE|UNLICENSE|COPYING)(?:[._-][A-Z0-9._-]+)?$/i.test(path.basename(relativeFile))
    );
    const fallback = licenseFallbacks[lockPath] || null;
    if (!hasPackagedLicenseText && (!fallback || fallback.license !== declaredLicense)) {
      throw new Error("No packaged license text or verified fallback found for " + lockPath + " (" + declaredLicense + ")");
    }

    const slug = safeSlug(lockPath.slice("node_modules/".length)) + "__" + safeSlug(lockMeta.version);
    const destination = path.join(packagesRoot, slug);
    await mkdir(destination, { recursive: true });

    const filesToCopy = licenseFiles.map(relativeFile => ({
      relativeFile,
      sourcePath: lockPath + "/" + relativeFile,
      source: path.join(packageDir, ...relativeFile.split("/")),
      provenance: "npm-package-archive"
    }));
    if (!hasPackagedLicenseText && fallback) {
      const fallbackSource = path.resolve(root, fallback.path);
      const relativeFallback = path.relative(root, fallbackSource);
      if (relativeFallback.startsWith("..") || path.isAbsolute(relativeFallback)) {
        throw new Error("Unsafe license fallback path for " + lockPath);
      }
      await readFile(fallbackSource);
      filesToCopy.push({
        relativeFile: "LICENSE",
        sourcePath: fallback.path,
        source: fallbackSource,
        provenance: "repository-license-fallback",
        sourceUrl: fallback.sourceUrl,
        sourceCommit: fallback.sourceCommit,
        sourceBlob: fallback.sourceBlob,
        npmGitHead: fallback.npmGitHead || null,
        versionSourceMatchVerified: fallback.versionSourceMatchVerified === true,
        evidenceNote: fallback.evidenceNote || null
      });
    }

    const copiedFiles = [];
    for (const entry of filesToCopy) {
      const outputRelativeFile = entry.relativeFile;
      const source = entry.source;
      const target = path.join(destination, ...outputRelativeFile.split("/"));
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
      const bytes = await readFile(source);
      copiedFiles.push({
        sourcePath: entry.sourcePath,
        outputPath: "licenses/packages/" + slug + "/" + outputRelativeFile,
        href: "/licenses/packages/" + encodePath(slug + "/" + outputRelativeFile),
        provenance: entry.provenance,
        sourceUrl: entry.sourceUrl || null,
        sourceCommit: entry.sourceCommit || null,
        sourceBlob: entry.sourceBlob || null,
        npmGitHead: entry.npmGitHead || null,
        versionSourceMatchVerified: entry.versionSourceMatchVerified ?? null,
        evidenceNote: entry.evidenceNote || null,
        sizeBytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex")
      });
    }

    const packageMeta = {
      name: pkg.name,
      version: pkg.version,
      lockPath,
      license: declaredLicense,
      repository: pkg.repository || null,
      homepage: pkg.homepage || null,
      licenseFiles: copiedFiles,
      licenseFileSource: filesToCopy.some(entry => entry.provenance === "repository-license-fallback")
        ? "npm-package-archive-plus-repository-fallback"
        : "npm-package-archive"
    };
    await writeFile(path.join(destination, "package-metadata.json"), JSON.stringify(packageMeta, null, 2) + "\n");
    manifestPackages.push(packageMeta);

    const links = copiedFiles.map(file => {
      const sourceLink = file.sourceUrl
        ? ' <small>(source: <a href="' + escapeHtml(file.sourceUrl) + '">repository</a>)</small>'
        : "";
      return '<a href="' + escapeHtml(file.href) + '">' +
        escapeHtml(path.basename(file.sourcePath)) + '</a>' + sourceLink;
    }).join(" · ");
    const fallbackFile = copiedFiles.find(file => file.provenance === "repository-license-fallback");
    const fallbackNote = fallbackFile
      ? fallbackFile.versionSourceMatchVerified
        ? '<br><small>Repository license fallback; source commit matches the npm gitHead.</small>'
        : '<br><small>Repository license fallback; exact match to published package source is not verified.</small>'
      : "";
    markdownRows.push("| " + pkg.name + " | " + pkg.version + " | " + declaredLicense + " | " +
      copiedFiles.map(file => "[" + path.basename(file.sourcePath) + "](" + file.outputPath + ")").join(", ") + " |");
    htmlRows.push("<tr><td><code>" + escapeHtml(pkg.name) + "</code><br><small>" +
      escapeHtml(pkg.version) + "</small></td><td><code>" + escapeHtml(declaredLicense) +
      "</code></td><td>" + links + fallbackNote + "</td></tr>");
  }

  const upstream = manifestPackages.find(pkg => pkg.name === "universal-parcel-scraper");
  if (!upstream || !upstream.licenseFiles.some(file => file.sourcePath.endsWith("/LICENSE")) ||
      !upstream.licenseFiles.some(file => file.sourcePath.endsWith("/NOTICE"))) {
    throw new Error("The upstream Universal Parcel Scraper LICENSE and NOTICE must be included in the staged output");
  }

  const manifest = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    packageLockVersion: lock.lockfileVersion,
    packageCount: manifestPackages.length,
    packages: manifestPackages
  };
  await writeFile(path.join(licensesRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const upstreamLicense = upstream.licenseFiles.find(file => file.sourcePath.endsWith("/LICENSE"));
  const upstreamNotice = upstream.licenseFiles.find(file => file.sourcePath.endsWith("/NOTICE"));
  const tableRows = htmlRows.join("\n");
  const html = [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    "<title>Third-party software notices — ExportFlow</title>",
    '<meta name="description" content="Open-source license texts and attribution notices for third-party software used by ExportFlow.">',
    "<style>",
    ":root{color-scheme:light dark;font-family:system-ui,-apple-system,Segoe UI,sans-serif}",
    "body{max-width:960px;margin:0 auto;padding:32px 20px;line-height:1.6}",
    "h1,h2{line-height:1.2}p,li{max-width:78ch}table{width:100%;border-collapse:collapse;margin:20px 0}",
    "th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #8886}",
    "code{overflow-wrap:anywhere}small{opacity:.75}.notice{padding:14px 16px;border:1px solid #8888;border-radius:12px;margin:16px 0}a{color:inherit}",
    "</style></head><body>",
    '<p><a href="/">← ExportFlow home</a></p>',
    "<h1>Third-party software notices</h1>",
    "<p>This page lists third-party software included in the ExportFlow build and provides the license/notice files shipped with those dependencies. Each license applies to the corresponding package or component only; it does not license ExportFlow's original code or content.</p>",
    '<div class="notice"><strong>Carrier rights are separate.</strong> These software licenses do not grant carrier API access, permission to automate carrier websites, carrier trademarks, or rights to display or redistribute shipment data.</div>',
    "<h2>Core tracking dependency</h2>",
    "<p><strong>Universal Parcel Scraper 0.977.1</strong> is used under Apache-2.0. Its upstream copyright/license text and third-party notices are included here:</p>",
    '<ul><li><a href="/' + encodePath(upstreamLicense.outputPath) + '">Apache-2.0 LICENSE</a></li><li><a href="/' + encodePath(upstreamNotice.outputPath) + '">Upstream NOTICE</a></li></ul>',
    "<h2>Locked production dependencies</h2>",
    "<p>The entries below are generated from the exact package versions in ExportFlow's package-lock.json. The linked files are copied from each installed package during the production build.</p>",
    "<table><thead><tr><th>Package / version</th><th>Declared license</th><th>Included license/notice files</th></tr></thead><tbody>",
    tableRows,
    "</tbody></table>",
    '<p><a href="/licenses/manifest.json">Machine-readable package/license manifest</a> · <a href="/licenses/EXPORTFLOW_MODIFICATIONS.md">ExportFlow build modifications</a></p>',
    "<p><small>Generated during the ExportFlow build. See the repository's THIRD_PARTY_NOTICES.md for source-level notes and methodology.</small></p>",
    "</body></html>"
  ].join("\n") + "\n";

  await writeFile(path.join(licensesRoot, "index.html"), html);
  const markdown = [
    "# Third-party software notices", "",
    "This file records third-party software licenses included in the ExportFlow build. Each license applies only to its corresponding package or component and does not license ExportFlow's original code or content.", "",
    "Carrier API access, website automation, trademarks and shipment-data display/reuse permissions are separate from software copyright licenses.", "",
    "## Universal Parcel Scraper", "",
    "- Package: universal-parcel-scraper@0.977.1",
    "- Declared license: Apache-2.0",
    "- Upstream LICENSE and NOTICE files are included in licenses/packages/ in the build output.", "",
    "## Locked production dependencies", "",
    "| Package | Version | Declared license | Included files |",
    "| --- | --- | --- | --- |",
    ...markdownRows, "",
    "Full package license texts/notices are copied from the exact installed package directories into dist/licenses/packages/ and indexed by dist/licenses/manifest.json.", ""
  ].join("\n");
  await writeFile(path.join(licensesRoot, "THIRD_PARTY_NOTICES.md"), markdown);

  return { packageCount: manifestPackages.length, licenseRoot: licensesRoot, manifest };
}
