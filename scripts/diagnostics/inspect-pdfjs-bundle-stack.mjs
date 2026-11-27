import { readFile } from "node:fs/promises";

const bundlePath = new URL("../../node_modules/unpdf/dist/pdfjs.mjs", import.meta.url);
const source = await readFile(bundlePath, "utf8");
const lines = source.split("\n");

const locations = [
  { line: 91, column: 6947 },
  { line: 91, column: 3003 },
  { line: 48, column: 123812 },
];

for (const location of locations) {
  const line = lines[location.line - 1] || "";
  const offset = Math.min(Math.max(location.column - 1, 0), line.length);
  const start = Math.max(0, offset - 700);
  const end = Math.min(line.length, offset + 1100);
  process.stdout.write(
    "\n[pdfjs-bundle-context] line " + location.line +
    " column " + location.column +
    " lineLength " + line.length +
    "\n" + line.slice(start, end) + "\n"
  );
}

const mapPath = new URL("../../node_modules/unpdf/dist/pdfjs.mjs.map", import.meta.url);
try {
  const map = JSON.parse(await readFile(mapPath, "utf8"));
  process.stdout.write(
    "\n[pdfjs-bundle-map] sources=" + (map.sources || []).length +
    " names=" + (map.names || []).slice(0, 80).join(",") + "\n"
  );
} catch {
  process.stdout.write("\n[pdfjs-bundle-map] no source map shipped with this package.\n");
}
