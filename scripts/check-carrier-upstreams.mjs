import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lockFile = resolve(root, 'packages/exportflow-carrier-engine/upstream-lock.json');
const reportDir = resolve(root, 'artifacts/carrier-upstream-report');
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'ExportFlow-Carrier-Engine-Maintenance',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}
async function readLock() {
  try { return JSON.parse(await readFile(lockFile, 'utf8')); }
  catch (error) { if (error?.code === 'ENOENT') return { schemaVersion: 1, sources: {} }; throw error; }
}
async function listHaRepos() {
  const items = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await github(`/orgs/ha-parcel-integrations/repos?type=public&per_page=100&page=${page}&sort=pushed`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    items.push(...batch);
    if (batch.length < 100) break;
  }
  const skip = new Set(['ha-parcel-aggregator', 'ha-carrier-template', 'ha-parcel-integrations.github.io']);
  return items.filter(repo => repo.name?.startsWith('ha-') && !skip.has(repo.name) && !repo.archived);
}
async function snapshot(repo, role) {
  const branch = repo.default_branch || 'main';
  const commit = await github(`/repos/${repo.full_name}/commits/${encodeURIComponent(branch)}`);
  let version = null;
  if (repo.full_name === 'plhery/universal-parcel-scraper') {
    const file = await github(`/repos/${repo.full_name}/contents/package.json?ref=${commit.sha}`);
    if (file.content) version = JSON.parse(Buffer.from(file.content, file.encoding || 'base64').toString('utf8')).version || null;
  }
  return {
    repository: repo.full_name, branch, sha: commit.sha,
    license: repo.license?.spdx_id || 'NOASSERTION', role, version,
    pushedAt: repo.pushed_at || null, archived: Boolean(repo.archived)
  };
}
const previous = await readLock();
const fixedDefinitions = [
  { full_name: 'plhery/universal-parcel-scraper', role: 'runtime-core' },
  { full_name: 'bernalli/parcel-tracker-bot', role: 'supplementary-candidate' },
  { full_name: 'karrioapi/karrio', role: 'compliance-review-only' },
  { full_name: 'gek0v/open-parcels', role: 'pattern-reference-only' },
  { full_name: 'Satal/myparcel', role: 'carrier-adapter-candidate' },
  { full_name: 'jumpingmushroom/nordic-parcel', role: 'nordic-carrier-candidate' }
];
const [fixed, haRepos] = await Promise.all([
  Promise.all(fixedDefinitions.map(async item => ({ ...(await github(`/repos/${item.full_name}`)), role: item.role }))),
  listHaRepos()
]);
const targets = [...fixed, ...haRepos.map(repo => ({ ...repo, role: 'ha-carrier-candidate' }))];
let next = 0;
const snapshots = new Array(targets.length);
await Promise.all(Array.from({ length: Math.min(8, targets.length) }, async () => {
  while (true) {
    const i = next++;
    if (i >= targets.length) return;
    snapshots[i] = await snapshot(targets[i], targets[i].role);
  }
}));
const current = Object.fromEntries(snapshots.map(item => [item.repository, {
  branch: item.branch, sha: item.sha, license: item.license, role: item.role,
  pushedAt: item.pushedAt, archived: item.archived,
  ...(item.version ? { version: item.version } : {})
}]));
const added = snapshots.filter(item => !previous.sources?.[item.repository]);
const changed = snapshots.filter(item => {
  const old = previous.sources?.[item.repository];
  return old && (old.sha !== item.sha || old.license !== item.license || old.branch !== item.branch || old.role !== item.role || Boolean(old.archived) !== item.archived);
}).map(item => ({ ...item, previousSha: previous.sources[item.repository].sha, previousLicense: previous.sources[item.repository].license || 'UNKNOWN' }));
const removed = Object.keys(previous.sources || {}).filter(name => !current[name]).sort();
const licenseReview = snapshots.filter(item => item.license === 'NOASSERTION' || /^(GPL|AGPL|LGPL)/.test(item.license));
const oldUpsSha = previous.sources?.['plhery/universal-parcel-scraper']?.sha || '';
const ups = current['plhery/universal-parcel-scraper'];
const upsUpdated = Boolean(oldUpsSha && ups?.sha && oldUpsSha !== ups.sha);
const hasChanges = added.length + changed.length + removed.length > 0;
await writeFile(lockFile, `${JSON.stringify({ schemaVersion: 1, sources: Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b))) }, null, 2)}\n`);
const report = {
  checkedAt: new Date().toISOString(), repositoriesChecked: snapshots.length,
  haCarrierRepositoriesChecked: haRepos.length, added, changed, removed, licenseReview,
  runtime: { repository: 'plhery/universal-parcel-scraper', previousPinnedCommit: oldUpsSha || null, latestCommit: ups?.sha || null, latestVersion: ups?.version || null, updateAvailable: upsUpdated },
  safety: { sourceCodeDownloaded: false, sourceCodeMerged: false, productionDeployed: false, note: 'Metadata-only audit. Changes require a reviewed PR, license checks, regression tests and explicit merge.' }
};
const lines = [
  '# ExportFlow Carrier Engine — upstream maintenance report', '',
  `Checked: ${report.checkedAt}`, `Repositories checked: ${snapshots.length}`, `Home Assistant carrier repositories: ${haRepos.length}`,
  `New: ${added.length} · Changed: ${changed.length} · Removed: ${removed.length} · License review: ${licenseReview.length}`, '',
  '## Runtime engine', `Pinned: ${oldUpsSha || 'not yet recorded'}`, `Latest: ${ups?.sha || 'unavailable'} (${ups?.version || 'version unknown'})`,
  `Update available: ${upsUpdated ? 'YES — propose in a PR' : 'no'}`, '', '## Changed repositories',
  ...(changed.length ? changed.map(item => `- ${item.repository}: ${item.previousSha.slice(0, 7)} → ${item.sha.slice(0, 7)}; license ${item.previousLicense} → ${item.license}`) : ['- None']),
  '', '## New repositories', ...(added.length ? added.map(item => `- ${item.repository} (${item.license})`) : ['- None']),
  '', '## License review', ...(licenseReview.length ? licenseReview.map(item => `- ${item.repository}: ${item.license} — review before reuse`) : ['- None']),
  '', 'This workflow reads repository metadata and commit IDs only. It never copies upstream code or deploys it.'
].join('\n');
await mkdir(reportDir, { recursive: true });
await writeFile(resolve(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(resolve(reportDir, 'report.md'), `${lines}\n`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, [
  `has_changes=${hasChanges}`, `ups_updated=${upsUpdated}`, `ups_sha=${ups?.sha || ''}`,
  `ups_version=${ups?.version || ''}`, `repository_count=${snapshots.length}`,
  `changed_count=${changed.length}`, `license_review_count=${licenseReview.length}`
].join('\n') + '\n');
console.log(JSON.stringify({ repositoriesChecked: snapshots.length, haCarrierRepositoriesChecked: haRepos.length, added: added.length, changed: changed.length, removed: removed.length, licenseReview: licenseReview.length, upsUpdated, report: resolve(reportDir, 'report.md') }, null, 2));
