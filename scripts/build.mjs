import { stageThirdPartyLicenses } from "./stage-third-party-licenses.mjs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const output = resolve(root, "dist");
const files = ["index.html", "styles.css", "app.js", "translations.js", "coverage.js", "robots.txt", "sitemap.xml", "_headers", "favicon.svg", "favicon-32x32.png", "apple-touch-icon.png", "site.webmanifest", "og-image-20261106.png", "404.html"];
const engineDist = resolve(root, "node_modules/universal-parcel-scraper/dist");
const localeCodes = ["en", "ar", "es", "zh", "hi", "pt", "fr", "ru"];
const localizedPageSpecs = [
  { source: "index.html", route: "/", kind: "home" },
  { source: "coverage/index.html", route: "/coverage/", kind: "coverage" }
];

function htmlAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function localizedUrl(locale, route) {
  return "https://exportflow.me/" + (locale === "en" ? "" : locale + "/") + (route === "/" ? "" : route.replace(/^\//, ""));
}

function withLocaleMetadata(source, locale, spec, translations) {
  const dictionary = translations[locale];
  const title = spec.kind === "home"
    ? "ExportFlow — " + dictionary.kicker
    : dictionary.coveragePageTitle + " — ExportFlow";
  const description = spec.kind === "home" ? dictionary.metaDescription : dictionary.coveragePageDescription;
  const canonical = localizedUrl(locale, spec.route);
  const alternates = localeCodes.map(code =>
    '<link rel="alternate" hreflang="' + code + '" href="' + localizedUrl(code, spec.route) + '">'
  ).concat('<link rel="alternate" hreflang="x-default" href="' + localizedUrl("en", spec.route) + '">').join("\n");

  let html = source
    .replace(/<html lang="[^"]+" dir="[^"]*">/, '<html lang="' + locale + '" dir="' + (locale === "ar" ? "rtl" : "ltr") + '">')
    .replace(/<title>[\s\S]*?<\/title>/, "<title>" + htmlAttribute(title) + "</title>")
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + htmlAttribute(description) + '">')
    .replace(/<link rel="canonical" href="[^"]+"\s*\/?\s*>/, '<link rel="canonical" href="' + canonical + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + htmlAttribute(title) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + htmlAttribute(description) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + canonical + '">');

  if (locale !== "en") {
    html = html.replaceAll('href="/"', 'href="/' + locale + '/"');
    html = html.replaceAll('href="/coverage/"', 'href="/' + locale + '/coverage/"');
  }
  return html.replace("</head>", alternates + "\n</head>");
}

async function generateLocalizedPages() {
  const translationSource = await readFile(resolve(root, "translations.js"), "utf8");
  const match = translationSource.match(/window\.EXPORTFLOW_TRANSLATIONS\s*=\s*([\s\S]*);\s*$/);
  if (!match) throw new Error("Could not parse ExportFlow locale dictionaries during the build");
  const translations = JSON.parse(match[1]);
  if (localeCodes.some(locale => !translations[locale])) {
    throw new Error("A required locale dictionary is missing; localized SEO pages were not generated");
  }

  const sitemapEntries = [];
  for (const spec of localizedPageSpecs) {
    const source = await readFile(resolve(root, spec.source), "utf8");
    const alternateLinks = localeCodes.map(locale =>
      '    <xhtml:link rel="alternate" hreflang="' + locale + '" href="' + localizedUrl(locale, spec.route) + '" />'
    ).concat('    <xhtml:link rel="alternate" hreflang="x-default" href="' + localizedUrl("en", spec.route) + '" />');

    for (const locale of localeCodes) {
      const prefix = locale === "en" ? "" : locale + "/";
      const relativePath = spec.kind === "home"
        ? prefix + "index.html"
        : prefix + "coverage/index.html";
      const target = resolve(output, relativePath);
      await mkdir(resolve(target, ".."), { recursive: true });
      await writeFile(target, withLocaleMetadata(source, locale, spec, translations));

      sitemapEntries.push(
        "  <url>\n    <loc>" + localizedUrl(locale, spec.route) + "</loc>\n" +
        alternateLinks.join("\n") + "\n  </url>"
      );
    }
  }

  for (const route of ["/about/", "/contact/", "/privacy/", "/terms/", "/cookies/", "/security/", "/disclaimer/", "/licenses/"]) {
    sitemapEntries.push("  <url>\n    <loc>https://exportflow.me" + route + "</loc>\n  </url>");
  }

  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    sitemapEntries.join("\n") + "\n</urlset>\n";
  await writeFile(resolve(output, "sitemap.xml"), sitemap);
  console.log("Generated " + (localeCodes.length * localizedPageSpecs.length) + " localized SEO pages and an hreflang sitemap.");
}


async function patchWorkerIncompatibleEngineFiles(directory) {
  // Wrangler's current esbuild parser does not accept Node's JSON import attributes.
  // The files are bundled by esbuild, which already selects the JSON loader by extension.
  // This happens after Node regression tests and only in the Pages build tree.
  let normalized = 0;

  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = resolve(folder, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
        continue;
      }
      if (!entry.isFile() || !/\.m?js$/.test(entry.name)) continue;

      const original = await readFile(file, "utf8");
      const matches = original.match(/\bfrom\s+["'][^"']+\.json["']\s+with\s*\{\s*type\s*:\s*["']json["']\s*\}/g) ?? [];
      if (matches.length === 0) continue;

      const compatible = original.replace(
        /(["'][^"']+\.json["'])\s+with\s*\{\s*type\s*:\s*["']json["']\s*\}/g,
        "$1"
      );
      await writeFile(file, compatible);
      normalized += matches.length;
    }
  }

  await visit(directory);
  if (normalized === 0) {
    throw new Error("Expected JSON import attributes in the pinned engine build; none were found");
  }
  return normalized;
}

async function patchWorkerPlaceAssets() {
  const placesFile = resolve(engineDist, "places/index.js");
  let source = await readFile(placesFile, "utf8");

  if (source.includes("Place enrichment is optional on Workers")) {
    return;
  }

  // Workers' bundled module URL is not a Node file URL. Keep these URLs valid
  // at module initialization; file reads below are guarded and fall back to
  // empty place datasets when the Worker has no filesystem-backed package data.
  let urlCount = 0;
  if (!source.includes("file:///exportflow")) {
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

const publicPageDirectories = [
  "coverage", "about", "contact", "privacy", "terms", "cookies", "security", "disclaimer"
];
for (const page of publicPageDirectories) {
  await mkdir(resolve(output, page), { recursive: true });
  await cp(resolve(root, page, "index.html"), resolve(output, page, "index.html"));
}

await generateLocalizedPages();

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
  if (!depponSource.includes("Deppon image challenge decoding is unavailable in Cloudflare Workers")) {
    const depponCompatible = depponSource.replace(
      /const sharp = \(await import\((["'])sharp\1\)\)\.default;/,
      "const sharp = () => { throw new ChallengeError(PROVIDER, 'Deppon image challenge decoding is unavailable in Cloudflare Workers'); };"
    );
    if (depponCompatible === depponSource) {
      throw new Error("Could not locate Deppon's native Sharp import for the Pages compatibility patch");
    }
    await writeFile(depponAdapter, depponCompatible);
  }

  console.log(
    "Prepared upstream engine for Pages: normalized " + jsonImports +
    " JSON imports; guarded place-data filesystem reads; disabled Node-only JCEX, local-browser, and native-image challenge fallbacks."
  );
} catch (error) {
  console.error("Could not prepare universal-parcel-scraper for Cloudflare Pages:", error);
  process.exitCode = 1;
  throw error;
}

const licenseStage = await stageThirdPartyLicenses({ root, output });
console.log("Staged " + licenseStage.packageCount + " third-party package license records in " + licenseStage.licenseRoot);
console.log("Built ExportFlow static site into " + output);
