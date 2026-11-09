import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const licensesRoot = path.resolve(root, "dist/licenses");
const manifest = JSON.parse(await readFile(path.join(licensesRoot, "manifest.json"), "utf8"));
const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
const lockedPackages = Object.entries(lock.packages || {}).filter(([lockPath]) => lockPath.startsWith("node_modules/"));

assert.equal(manifest.packageCount, lockedPackages.length, "every locked production package must be represented");
assert.equal(manifest.packages.length, manifest.packageCount);
assert.ok(manifest.packages.every(pkg => pkg.name && pkg.version && pkg.license));
assert.ok(manifest.packages.every(pkg => Array.isArray(pkg.licenseFiles) && pkg.licenseFiles.length > 0),
  "every package must ship at least one license/notice text file");

for (const pkg of manifest.packages) {
  for (const file of pkg.licenseFiles) {
    const relative = file.outputPath;
    assert.ok(relative.startsWith("licenses/packages/"), "license paths must remain under public licenses folder");
    const copiedPath = path.resolve(root, "dist", relative);
    await access(copiedPath);
    const bytes = await readFile(copiedPath);
    assert.equal(bytes.byteLength, file.sizeBytes, "copied license size must match source metadata: " + file.sourcePath);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256,
      "copied license text must match recorded source SHA-256: " + file.sourcePath);
  }
}

const upstream = manifest.packages.find(pkg => pkg.name === "universal-parcel-scraper");
assert.ok(upstream);
assert.ok(upstream.licenseFiles.some(file => file.sourcePath.endsWith("/LICENSE")));
assert.ok(upstream.licenseFiles.some(file => file.sourcePath.endsWith("/NOTICE")));
const boolbase = manifest.packages.find(pkg => pkg.lockPath === "node_modules/boolbase");
assert.ok(boolbase);
assert.equal(boolbase.license, "ISC");
assert.equal(boolbase.licenseFileSource, "npm-package-archive-plus-repository-fallback");
const boolbaseFallback = boolbase.licenseFiles.find(file => file.provenance === "repository-license-fallback");
assert.ok(boolbaseFallback);
assert.equal(boolbaseFallback.sourceCommit, "54811f01c797a6bb1c263183ae90b7dd627e0638");
assert.equal(boolbaseFallback.sourceBlob, "a689aae96e8957e4ab7a3a7449fe5271a6516e4b");
assert.equal(boolbaseFallback.versionSourceMatchVerified, false);
assert.ok(boolbaseFallback.evidenceNote.includes("not proven historical match"));
const saxes = manifest.packages.find(pkg => pkg.lockPath === "node_modules/saxes");
assert.ok(saxes);
assert.equal(saxes.license, "ISC");
assert.equal(saxes.licenseFileSource, "npm-package-archive-plus-repository-fallback");
const saxesFallback = saxes.licenseFiles.find(file => file.provenance === "repository-license-fallback");
assert.ok(saxesFallback);
assert.equal(saxesFallback.sourceCommit, "211fa0ebec9b628affc09219199639887174bfc3");
assert.equal(saxesFallback.sourceBlob, "187f3ba399862022f4e670b2a3a1dbc6d7e6a800");
assert.equal(saxesFallback.npmGitHead, saxesFallback.sourceCommit);
assert.equal(saxesFallback.versionSourceMatchVerified, true);
assert.ok((await readFile(path.join(licensesRoot, "index.html"), "utf8")).includes("Third-party software notices"));
assert.ok((await readFile(path.join(licensesRoot, "THIRD_PARTY_NOTICES.md"), "utf8")).includes("Locked production dependencies"));
assert.ok((await readFile(path.join(licensesRoot, "EXPORTFLOW_MODIFICATIONS.md"), "utf8")).includes("Modified by ExportFlow for Cloudflare Workers"));
console.log("third-party license staging: " + manifest.packageCount + " packages; every package has a copied LICENSE/NOTICE file");
