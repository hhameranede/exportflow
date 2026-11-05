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
    // The Pages build image still invokes an older esbuild parser which does not
    // understand the newer JSON import-attributes syntax. JSON files are still
    // resolved by their .json extension once the attribute is removed.
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

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(output, file));
}

try {
  const jsonImports = await patchWorkerIncompatibleEngineFiles(engineDist);

  // JCEX's origin-pinning recovery path requires a custom Node undici Agent.
  // Keep its ordinary fetch/retry route, but disable only the Node socket fallback.
  const jcexOrigin = resolve(engineDist, "carriers/jcex/origin.js");
  await writeFile(jcexOrigin, `// Cloudflare Workers cannot pin a Node HTTPS socket to a custom origin.
export async function withJcexOrigin() {
  throw new Error("JCEX origin pinning is unavailable in this runtime");
}
`);

  // Cloudflare Workers cannot run local Playwright/Chromium or native Sharp.
  // Browser-only and image-challenge routes remain unavailable unless a remote
  // TRAWL browser is configured; normal HTTP carrier adapters remain enabled.
  const optionalTransport = resolve(engineDist, "core/transport/optional.js");
  await writeFile(optionalTransport, `import { TransportError } from '../errors/index.js';
export async function loadChromium(provider) {
  throw new TransportError(provider, 'Local browser automation is unavailable in Cloudflare Workers; configure the remote TRAWL service.');
}
export async function loadSharp(provider) {
  throw new TransportError(provider, 'Image challenge decoding is unavailable in Cloudflare Workers.');
}
`);

  // Deppon's adapter imports Sharp directly for its slider puzzle. Replace only
  // that solver entry so the adapter can report an unsupported challenge
  // instead of making the entire Pages Worker bundle depend on native Sharp.
  const depponAdapter = resolve(engineDist, "carriers/deppon/adapter.js");
  const depponSource = await readFile(depponAdapter, "utf8");
  const depponCompatible = depponSource.replace(
    /const sharp = \\(await import\\((["'])sharp\\1\\)\\)\\.default;/,
    "const sharp = () => { throw new ChallengeError(PROVIDER, 'Deppon image challenge decoding is unavailable in Cloudflare Workers'); };"
  );
  if (depponCompatible === depponSource) {
    throw new Error("Could not locate Deppon's native Sharp import for the Pages compatibility patch");
  }
  await writeFile(depponAdapter, depponCompatible);

  console.log(`Prepared upstream engine for Pages: normalized ${jsonImports} JSON imports; disabled Node-only JCEX, local-browser, and native-image challenge fallbacks.`);
} catch (error) {
  console.error("Could not prepare universal-parcel-scraper for Cloudflare Pages:", error);
  process.exitCode = 1;
  throw error;
}

console.log("Built ExportFlow static site into " + output);
