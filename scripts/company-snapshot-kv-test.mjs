import assert from "node:assert/strict";
import {
  deleteSnapshotManifest,
  getSnapshotManifest,
  putSnapshotManifest,
  snapshotManifestKey
} from "../functions/lib/company-snapshot-kv.mjs";

const values = new Map();
const calls = [];
const kv = {
  async put(key, value, options) {
    calls.push({ key, value, options });
    values.set(key, JSON.parse(value));
  },
  async get(key, type) {
    assert.equal(type, "json");
    return values.get(key) ?? null;
  },
  async delete(key) {
    values.delete(key);
  }
};

const manifestInput = {
  sourceId: "gleif-global-lei",
  snapshotId: "gleif-2026-11-07",
  sha256: "a".repeat(64),
  fileFormat: "jsonl",
  recordCount: 120,
  retrievedAt: "2026-11-07T12:00:00.000Z",
  sourceUpdatedAt: "2026-11-07T00:00:00.000Z",
  rightsEvidenceUrl: "https://www.gleif.org/en/lei-data/access-and-use-lei-data",
  licenseId: "CC0-1.0",
  status: "validated",
  rawRows: [{ legalName: "must never be stored" }],
  personalData: "must never be stored"
};

const stored = await putSnapshotManifest(kv, manifestInput);
assert.equal(stored.key, snapshotManifestKey("gleif-global-lei", "gleif-2026-11-07"));
assert.equal(calls.length, 1);
assert.equal(calls[0].options.expirationTtl, 7 * 24 * 60 * 60);
assert.equal(stored.manifest.schemaVersion, 1);
assert.equal("rawRows" in stored.manifest, false);
assert.equal("personalData" in stored.manifest, false);
assert.deepEqual(await getSnapshotManifest(kv, "gleif-global-lei", "gleif-2026-11-07"), stored.manifest);
assert.equal(await getSnapshotManifest(kv, "gleif-global-lei", "missing-snapshot"), null);

await putSnapshotManifest(kv, { ...manifestInput, snapshotId: "short-ttl" }, { expirationTtl: 3600 });
assert.equal(calls[1].options.expirationTtl, 3600);

await assert.rejects(
  putSnapshotManifest(kv, { ...manifestInput, sha256: "bad" }),
  /sha256/
);
await assert.rejects(
  putSnapshotManifest(kv, { ...manifestInput, rightsEvidenceUrl: "http://invalid.example" }),
  /HTTPS/
);
await assert.rejects(
  putSnapshotManifest(kv, { ...manifestInput, fileFormat: "exe" }),
  /fileFormat/
);
await assert.rejects(
  putSnapshotManifest(kv, { ...manifestInput, recordCount: -1 }),
  /recordCount/
);
await assert.rejects(
  putSnapshotManifest(kv, { ...manifestInput, sourceId: "../bad" }),
  /sourceId/
);
await assert.rejects(
  putSnapshotManifest(kv, manifestInput, { expirationTtl: 30 }),
  /expirationTtl/
);

await deleteSnapshotManifest(kv, "gleif-global-lei", "gleif-2026-11-07");
assert.equal(await getSnapshotManifest(kv, "gleif-global-lei", "gleif-2026-11-07"), null);
console.log("Company snapshot KV tests passed: scoped keys, compact rights metadata, TTL, validation, read and delete.");
