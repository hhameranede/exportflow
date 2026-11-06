import { readFile, writeFile } from 'node:fs/promises';

const sha = process.env.UPS_SHA;
const version = process.env.UPS_VERSION;
if (!/^[0-9a-f]{40}$/.test(sha || '') || !/^\d+\.\d+\.\d+/.test(version || '')) {
  throw new Error('UPS_SHA and UPS_VERSION must be valid pinned upstream metadata.');
}
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
packageJson.dependencies['universal-parcel-scraper'] = `github:plhery/universal-parcel-scraper#${sha}`;
packageJson.allowScripts = { ...(packageJson.allowScripts || {}), [`universal-parcel-scraper@${version}`]: true };
await writeFile('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
const facadePath = 'functions/lib/exportflow-carrier-engine.mjs';
const facade = await readFile(facadePath, 'utf8');
const updated = facade.replace(/upstreamCommit: "[0-9a-f]{40}"/, `upstreamCommit: "${sha}"`);
if (updated === facade) throw new Error('Pinned upstream commit marker not found in ExportFlow facade.');
await writeFile(facadePath, updated);
