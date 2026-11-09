import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const licensesRoot = path.resolve(root, "dist/licenses");
const manifest = JSON.parse(await readFile(path.join(licensesRoot, "manifest.json"), "utf8"));

assert.equal(manifest.packageCount, 33, "all locked production packages must be represented");
assert.equal(manifest.packages.length, manifest.packageCount);
assert.ok(manifest.packages.every(pkg => pkg.name && pkg.version && pkg.license));
assert.ok(manifest.packages.every(pkg => Array.isArray(pkg.licenseFiles) && pkg.licenseFiles.length > 0),
  "every package must ship at least one license/notice text file");

for (const pkg of manifest.packages) {
  for (const file of pkg.licenseFiles) {
    const relative = file.outputPath;
    assert.ok(relative.startsWith("licenses/packages/"), "license paths must remain under public licenses folder");
    await access(path.resolve(root, "dist", relative));
  }
}

const upstream = manifest.packages.find(pkg => pkg.name === "universal-parcel-scraper");
assert.ok(upstream);
assert.ok(upstream.licenseFiles.some(file => file.sourcePath.endsWith("/LICENSE")));
assert.ok(upstream.licenseFiles.some(file => file.sourcePath.endsWith("/NOTICE")));
assert.ok((await readFile(path.join(licensesRoot, "index.html"), "utf8")).includes("Third-party software notices"));
assert.ok((await readFile(path.join(licensesRoot, "THIRD_PARTY_NOTICES.md"), "utf8")).includes("Locked production dependencies"));
console.log("third-party license staging: " + manifest.packageCount + " packages; every package has a copied LICENSE/NOTICE file");
