import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const engineDist = resolve(root, "node_modules/universal-parcel-scraper/dist");

function addJsonImportAttributes(source) {
  return source.replace(
    /import\s+[^;]*from\s+["']([^"']+\.json)["'](?!\s*with\s*\{)/g,
    'import $& from "$1" with { type: "json" }'
  );
}

async function addAttributes(directory) {
  let totalAdded = 0;

  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = resolve(folder, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
        continue;
      }
      if (!entry.isFile() || !/\.m?js$/.test(entry.name)) continue;

      const original = await readFile(file, "utf8");
      const modified = addJsonImportAttributes(original);
      if (modified !== original) {
        await writeFile(file, modified);
        totalAdded += 1;
      }
    }
  }

  await visit(engineDist);
  return totalAdded;
}

const added = await addAttributes(engineDist);
if (added > 0) {
  console.log("Added JSON import attributes to " + added + " files for local test execution.");
} else {
  console.log("No JSON imports needed attribute addition.");
}