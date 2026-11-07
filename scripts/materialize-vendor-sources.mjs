#!/usr/bin/env node
/**
 * Materialize the reviewed, pinned upstream source snapshots as ordinary files.
 *
 * This is intentionally a repository-maintenance script. The vendored trees are
 * reference/source snapshots; ExportFlow's runtime continues to use its pinned
 * npm dependency and does not import code from vendor/sources.
 */
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const EXPECTED_BRANCH = "feat/exportflow-global-logistics-1-2-20261107";
const SOURCES = [
  {
    id: "universal-parcel-scraper",
    source: "vendor/universal-parcel-scraper",
    destination: "vendor/sources/universal-parcel-scraper",
    repository: "https://github.com/plhery/universal-parcel-scraper",
    commit: "e64a466772ef25ce68e02d9c7c9f1613eec1208b",
    license: "Apache-2.0 core; upstream NOTICE and nested MIT/CC BY 4.0/Open Database License attributions preserved",
    excluded: ["trawl/ (optional AGPL-3.0 component)"]
  },
  {
    id: "shopana-carrier-api",
    source: "vendor/shopana-carrier-api",
    destination: "vendor/sources/shopana-carrier-api",
    repository: "https://github.com/shopanaio/carrier-api",
    commit: "450ab76612a359b494c5bb7a6bce1d97add130a2",
    license: "Apache-2.0, including package-level license files",
    excluded: []
  },
  {
    id: "karrio-community",
    source: "vendor/reference/karrio-community",
    destination: "vendor/sources/reference/karrio-community",
    repository: "https://github.com/karrioapi/community",
    commit: "4d5303d8c66bee2b605f1d9ea35c105cb5725471",
    license: "LGPL-3.0; upstream README claims Apache-2.0, but checked-in LICENSE is controlling for this snapshot",
    excluded: []
  }
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  }).trim();
}

function countTree(directory) {
  let files = 0;
  let bytes = 0;
  const visit = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (entry.isFile()) {
        files += 1;
        bytes += lstatSync(full).size;
      } else if (entry.isSymbolicLink()) {
        throw new Error("Vendored source contains an unexpected symbolic link: " + path.relative(ROOT, full));
      }
    }
  };
  visit(directory);
  return { files, bytes };
}

function shouldCopy(sourceId, sourceRoot, candidate) {
  const relative = path.relative(sourceRoot, candidate);
  if (!relative) return true;

  const parts = relative.split(path.sep);
  const base = parts.at(-1);

  if (parts.includes(".git") || parts.includes("node_modules") || parts.includes(".wrangler")) {
    return false;
  }
  if (sourceId === "universal-parcel-scraper" && parts[0] === "trawl") {
    return false;
  }
  if (base === ".DS_Store" || base === ".npmrc" || base === ".netrc" || base === ".pypirc") {
    return false;
  }
  if (/^\.env(?:\..*)?$/i.test(base) && base !== ".env.example") {
    return false;
  }
  if (/^\.dev\.vars(?:\..*)?$/i.test(base)) {
    return false;
  }
  if (/\.(?:pem|p12|pfx|sqlite|db|log)$/i.test(base) || /\.private\.key$/i.test(base)) {
    return false;
  }
  if (lstatSync(candidate).isSymbolicLink()) {
    return false;
  }
  return true;
}

function assertFile(relativePath, label) {
  const full = path.join(ROOT, relativePath);
  if (!existsSync(full) || !lstatSync(full).isFile() || lstatSync(full).size === 0) {
    throw new Error("Required upstream license/provenance file missing: " + label + " (" + relativePath + ")");
  }
}

function existingMaterialization() {
  return SOURCES.every(source => existsSync(path.join(ROOT, source.destination, "LICENSE")));
}

const branch = run("git", ["branch", "--show-current"]);
if (process.env.GITHUB_ACTIONS === "true" && branch !== EXPECTED_BRANCH) {
  throw new Error("Refusing to materialize sources outside the approved feature branch.");
}

if (!existsSync(path.join(ROOT, ".gitmodules"))) {
  if (!existingMaterialization()) {
    throw new Error("Submodule manifest is absent and the full source materialization is incomplete.");
  }
  console.log("Pinned sources are already materialized; no changes are required.");
  process.exit(0);
}

const materialized = [];
for (const source of SOURCES) {
  const sourceRoot = path.join(ROOT, source.source);
  const destination = path.join(ROOT, source.destination);
  if (!existsSync(sourceRoot)) {
    throw new Error("Submodule checkout is missing: " + source.source);
  }

  const actualCommit = run("git", ["-C", source.source, "rev-parse", "HEAD"]);
  if (actualCommit !== source.commit) {
    throw new Error(
      "Upstream pin mismatch for " + source.id + ": expected " + source.commit + ", got " + actualCommit
    );
  }

  rmSync(destination, { recursive: true, force: true });
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(sourceRoot, destination, {
    recursive: true,
    dereference: false,
    filter: candidate => shouldCopy(source.id, sourceRoot, candidate)
  });

  if (source.id === "universal-parcel-scraper") {
    assertFile(path.join(source.destination, "LICENSE"), source.id + " Apache license");
    assertFile(path.join(source.destination, "NOTICE"), source.id + " upstream NOTICE");
    if (existsSync(path.join(destination, "trawl"))) {
      throw new Error("The optional AGPL-3.0 TRAWL source must not be included in this Apache-licensed snapshot.");
    }
  } else if (source.id === "shopana-carrier-api") {
    assertFile(path.join(source.destination, "LICENSE"), source.id + " root license");
    assertFile(path.join(source.destination, "packages/novaposhta-api-client/LICENSE"), "Nova Poshta package license");
    assertFile(path.join(source.destination, "packages/novaposhta-transport-fetch/LICENSE"), "Fetch transport package license");
  } else {
    assertFile(path.join(source.destination, "LICENSE"), source.id + " LGPL license");
    assertFile(path.join(source.destination, "plugins/easypost/LICENSE"), "EasyPost plugin LGPL license");
  }

  materialized.push({ ...source, ...countTree(destination) });
}

const manifest = [
  "# Materialized upstream sources",
  "",
  "These are ordinary tracked files copied from exact upstream commits. They are source/reference snapshots, not runtime imports.",
  "ExportFlow's deployed tracking integration continues to use the pinned npm dependency in package.json.",
  "",
  ...materialized.flatMap(source => [
    "## " + source.id,
    "- Upstream: " + source.repository,
    "- Pinned commit: `" + source.commit + "`",
    "- License: " + source.license,
    "- Files: " + source.files,
    "- Source bytes: " + source.bytes,
    "- Exclusions: " + (source.excluded.length ? source.excluded.join(", ") : "credential-bearing local config, VCS metadata, caches, symlinks and runtime databases"),
    ""
  ]),
  "Do not treat source catalog entries as proof of a working adapter or carrier authorization.",
  "Do not import LGPL reference code into the deployed bundle without a separate license and architecture review.",
  "Preserve each upstream LICENSE, NOTICE, and nested component license when updating these snapshots.",
  ""
].join("\n");
writeFileSync(path.join(ROOT, "vendor/sources/README.md"), manifest, "utf8");

// The Git submodule gitlinks are replaced by the copied, ordinary source files.
for (const source of SOURCES) {
  run("git", ["rm", "--cached", "-f", "--", source.source]);
  rmSync(path.join(ROOT, source.source), { recursive: true, force: true });
}
rmSync(path.join(ROOT, ".gitmodules"), { force: true });

const report = materialized.map(source => ({
  source: source.id,
  commit: source.commit,
  files: source.files,
  bytes: source.bytes,
  destination: source.destination
}));
console.log(JSON.stringify({ materialized: report, removedSubmoduleManifest: true }, null, 2));
