import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const output = resolve(root, "dist");
const files = ["index.html", "styles.css", "app.js", "_headers"];
const engineDist = resolve(root, "node_modules/universal-parcel-scraper/dist");

async function patchWorkerIncompatibleEngineFiles(directory) {
  let jsonImports = 0;
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      jsonImports += await patchWorkerIncompatibleEngineFiles(path);
      continue;
    }
    if (!entry.isFile() || !/\.(?:js|mjs)$/.test(entry.name)) continue;

    const original = await readFile(path, "utf8");
    const compatible = original.replace(
      /\s+with\s*\{\s*type\s*:\s*(["'])json\1\s*\}/g,
      () => {
        jsonImports += 1;
        return "";
      }
    );
    if (compatible !== original) await writeFile(path, compatible);
  }

  return jsonImports;
}

async function patchWorkerPlaceAssets() {
  const placesFile = resolve(engineDist, "places/index.js");
  let source = await readFile(placesFile, "utf8");

  // Workers' bundled module URL is not a Node file URL. Keep these URLs valid
  // at module initialization; file reads below are guarded and fall back to
  // empty place datasets when the Worker has no filesystem-backed package data.
  let urlCount = 0;
  source = source.replace(
    /const (DATA|PINCODES|ZIPCODES) = new URL\((["'])\.\/(places\.tsv\.br|pincodes\.json|zipcodes\.json)\2, import\.meta\.url\);/g,
    (_match, name, quote, filename) => {
      urlCount += 1;
      return "const " + name + " = new URL(" + quote + "./" + filename + quote +
        ', "file:///exportflow/node_modules/universal-parcel-scraper/dist/places/index.js");';
    }
  );
  if (urlCount !== 3) {
    throw new Error("Expected to normalize all three place-data module URLs; found " + urlCount);
  }

  const lines = source.split(/\r?\n/);
  const replaceOne = (pattern, replacement, description) => {
    const matches = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (pattern.test(lines[index])) matches.push(index);
    }
    if (matches.length !== 1) {
      throw new Error("Expected one " + description + " line; found " + matches.length);
    }
    lines.splice(matches[0], 1, ...replacement);
  };

  replaceOne(
    /^\s*const bytes = .*brotliDecompressSync\(readFileSync\(DATA\)\)/,
    [
      "  let bytes;",
      "  try {",
      "    bytes = brotliDecompressSync(readFileSync(DATA));",
      "  } catch {",
      "    // Place enrichment is optional on Workers where package files are not mounted.",
      "    loaded = {",
      "      names: [], codes: [],",
      "      country: new Uint16Array(0), admin1: new Uint16Array(0), admin2: new Uint16Array(0),",
      "      latitude: new Float32Array(0), longitude: new Float32Array(0), population: new Uint32Array(0),",
      "      keys: new Map(), postcodes: new Map(), countries: new Map(), regions: new Map(),",
      "      regionNames: new Map(), airports: new Map(), byCountry: new Map(), airportNames: new Map(),",
      "    };",
      "    return loaded;",
      "  }",
    ],
    "gazetteer data read"
  );

  replaceOne(
    /^\s*zipPrefixes \?\?=.*readFileSync\(ZIPCODES/,
    [
      "  try {",
      "    zipPrefixes ??= JSON.parse(readFileSync(ZIPCODES, 'utf8')).prefixes;",
      "  } catch {",
      "    zipPrefixes ??= {};",
      "  }",
    ],
    "ZIP-code data read"
  );

  replaceOne(
    /^\s*pincodes \?\?=.*readFileSync\(PINCODES/,
    [
      "  try {",
      "    pincodes ??= JSON.parse(readFileSync(PINCODES, 'utf8'));",
      "  } catch {",
      "    pincodes ??= { towns: [], ranges: [] };",
      "  }",
    ],
    "PIN-code data read"
  );

  await writeFile(placesFile, lines.join("\n"));
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(output, file));
}

try {
  const jsonImports = await patchWorkerIncompatibleEngineFiles(engineDist);
  await patchWorkerPlaceAssets();

  // JCEX's origin-pinning recovery path requires a custom Node undici Agent.
  const jcexOrigin = resolve(engineDist, "carriers/jcex/origin.js");
  await writeFile(jcexOrigin,
    "// Cloudflare Workers cannot pin a Node HTTPS socket to a custom origin.\n" +
    "export async function withJcexOrigin() {\n" +
    "  throw new Error(\"JCEX origin pinning is unavailable in this runtime\");\n" +
    "}\n"
  );

  // Disable local browser and native image routes; normal HTTP carrier adapters remain enabled.
  const optionalTransport = resolve(engineDist, "core/transport/optional.js");
  await writeFile(optionalTransport,
    "import { TransportError } from '../errors/index.js';\n" +
    "export async function loadChromium(provider) {\n" +
    "  throw new TransportError(provider, 'Local browser automation is unavailable in Cloudflare Workers; configure the remote TRAWL service.');\n" +
    "}\n" +
    "export async function loadSharp(provider) {\n" +
    "  throw new TransportError(provider, 'Image challenge decoding is unavailable in Cloudflare Workers.');\n" +
    "}\n"
  );

  // Replace Deppon's direct Sharp solver so its adapter can fail gracefully without native Sharp.
  const depponAdapter = resolve(engineDist, "carriers/deppon/adapter.js");
  const depponSource = await readFile(depponAdapter, "utf8");
  const depponCompatible = depponSource.replace(
    /const sharp = \(await import\((["'])sharp\1\)\)\.default;/,
    "const sharp = () => { throw new ChallengeError(PROVIDER, 'Deppon image challenge decoding is unavailable in Cloudflare Workers'); };"
  );
  if (depponCompatible === depponSource) {
    throw new Error("Could not locate Deppon's native Sharp import for the Pages compatibility patch");
  }
  await writeFile(depponAdapter, depponCompatible);

  console.log(
    "Prepared upstream engine for Pages: normalized " + jsonImports +
    " JSON imports; guarded place-data filesystem reads; disabled Node-only JCEX, local-browser, and native-image challenge fallbacks."
  );
} catch (error) {
  console.error("Could not prepare universal-parcel-scraper for Cloudflare Pages:", error);
  process.exitCode = 1;
  throw error;
}

console.log("Built ExportFlow static site into " + output);
