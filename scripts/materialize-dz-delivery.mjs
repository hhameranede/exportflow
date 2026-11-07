#!/usr/bin/env node
/**
 * Materialize the reviewed Algerian delivery SDK at an exact upstream commit.
 * The snapshot is reference-only; it is not imported into the Cloudflare runtime.
 */
import {
  cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync
} from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const BRANCH = "feat/exportflow-global-logistics-1-2-20261107";
const SOURCE = "vendor/dz-delivery-upstream";
const DESTINATION = "vendor/sources/algeria/dz-delivery";
const REPOSITORY = "https://github.com/developing-off/dz-delivery";
const COMMIT = "45aa32ddf2ba7392da6c696aef187fcc059b3c8d";

function run(command, args) {
  return execFileSync(command, args, {
    cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}
function assertFile(relative) {
  const full = path.join(ROOT, relative);
  if (!existsSync(full) || !lstatSync(full).isFile() || lstatSync(full).size === 0) {
    throw new Error("Required source/license file missing: " + relative);
  }
}
function safeToCopy(candidate, sourceRoot) {
  const relative = path.relative(sourceRoot, candidate);
  if (!relative) return true;
  const parts = relative.split(path.sep);
  const base = parts.at(-1);
  if (parts.includes(".git") || parts.includes("node_modules") ||
      parts.includes(".wrangler") || parts.includes("coverage") ||
      parts.includes(".next") || parts.includes("dist") ||
      parts.includes("build")) return false;
  if (base === ".DS_Store" || base === ".npmrc" || base === ".netrc" ||
      base === ".pypirc") return false;
  if (/^\.env(?:\..*)?$/i.test(base) && base !== ".env.example") return false;
  if (/^\.dev\.vars(?:\..*)?$/i.test(base)) return false;
  if (/\.(?:pem|p12|pfx|sqlite|db|log)$/i.test(base) ||
      /\.private\.key$/i.test(base)) return false;
  if (lstatSync(candidate).isSymbolicLink()) return false;
  return true;
}
function countTree(directory) {
  let files = 0;
  let bytes = 0;
  const visit = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) { files += 1; bytes += lstatSync(full).size; }
      else if (entry.isSymbolicLink()) {
        throw new Error("Unexpected symlink in source snapshot: " + path.relative(ROOT, full));
      }
    }
  };
  visit(directory);
  return { files, bytes };
}

if (process.env.GITHUB_ACTIONS === "true" &&
    run("git", ["branch", "--show-current"]) !== BRANCH) {
  throw new Error("Refusing to materialize Algerian source outside the approved feature branch.");
}

const upstream = path.join(ROOT, SOURCE);
const destination = path.join(ROOT, DESTINATION);
if (!existsSync(upstream)) {
  // Idempotent reruns are allowed after the temporary checkout was removed.
  assertFile(DESTINATION + "/LICENSE");
  assertFile(DESTINATION + "/packages/ts/package.json");
  console.log(JSON.stringify({ alreadyMaterialized: true, ...countTree(destination) }, null, 2));
  process.exit(0);
}

const actual = run("git", ["-C", SOURCE, "rev-parse", "HEAD"]);
if (actual !== COMMIT) {
  throw new Error("Upstream pin mismatch: expected " + COMMIT + ", received " + actual);
}
rmSync(destination, { recursive: true, force: true });
mkdirSync(path.dirname(destination), { recursive: true });
cpSync(upstream, destination, {
  recursive: true,
  dereference: false,
  filter: candidate => safeToCopy(candidate, upstream)
});
assertFile(DESTINATION + "/LICENSE");
assertFile(DESTINATION + "/packages/ts/package.json");
assertFile(DESTINATION + "/packages/ts/README.md");
if (existsSync(path.join(destination, ".git")) ||
    existsSync(path.join(destination, "node_modules"))) {
  throw new Error("VCS metadata or installed dependencies were copied.");
}
const stats = countTree(destination);
rmSync(upstream, { recursive: true, force: true });
console.log(JSON.stringify({
  repository: REPOSITORY, commit: COMMIT, destination: DESTINATION, ...stats
}, null, 2));
