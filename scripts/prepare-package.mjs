import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const engineDir = 'node_modules/universal-parcel-scraper/dist';

async function patchJsonImports(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await patchJsonImports(path);
      continue;
    }
    if (!entry.isFile() || !/\.m?js$/.test(entry.name)) continue;

    let source = await readFile(path, 'utf8');
    const hasAttr = /\bwith\s*\{\s*type\s*:\s*"json"\s*\}/;
    if (hasAttr.test(source)) continue;
    
    const patch = source.replace(
      /import\s+(\w+)\s+from\s+['"]([^"']+\.json)['"][^;]*;?(\n|\r)/g,
      (_, varName, importPath, newline) => `import ${varName} from ${JSON.stringify(importPath)} with { type: "json" };${newline}`
    );

    if (patch !== source) {
      await writeFile(path, patch, 'utf8');
      console.log(`Patched JSON imports in ${path.replace(/^\.\//, '')}`);
    }
  }
}

await patchJsonImports(engineDir);
console.log('Universal Parcel Scraper prepared for Node 24 ESM compatibility.');