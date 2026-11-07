const PREFIX = "company:snapshot-manifest:v1";
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_MANIFEST_BYTES = 32 * 1024;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,119}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const FORMATS = new Set(["csv", "json", "jsonl", "xml", "parquet", "zip", "other"]);
const STATUSES = new Set(["discovered", "downloaded", "validated", "quarantined", "processed", "failed"]);

function requiredId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new TypeError(label + " must be a stable 2-120 character identifier");
  }
  return value;
}

function validateManifest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("snapshot manifest must be an object");
  }
  const sourceId = requiredId(input.sourceId, "sourceId");
  const snapshotId = requiredId(input.snapshotId, "snapshotId");
  if (!SHA256_PATTERN.test(String(input.sha256 || ""))) {
    throw new TypeError("sha256 must be a 64-character hexadecimal digest");
  }
  if (!FORMATS.has(input.fileFormat)) throw new TypeError("unsupported fileFormat");
  const status = input.status || "validated";
  if (!STATUSES.has(status)) throw new TypeError("unsupported snapshot status");
  const retrievedAt = input.retrievedAt || new Date().toISOString();
  if (Number.isNaN(Date.parse(retrievedAt))) throw new TypeError("retrievedAt must be an ISO-compatible date");
  const rightsEvidenceUrl = String(input.rightsEvidenceUrl || "");
  if (!rightsEvidenceUrl.startsWith("https://")) throw new TypeError("rightsEvidenceUrl must use HTTPS");
  const licenseId = String(input.licenseId || "").trim();
  if (!licenseId || licenseId.length > 120) throw new TypeError("licenseId is required");
  const recordCount = input.recordCount;
  if (!Number.isSafeInteger(recordCount) || recordCount < 0) throw new TypeError("recordCount must be a non-negative safe integer");

  // Deliberately whitelist compact provenance fields. Raw company rows and personal data
  // must never be copied into KV by this helper.
  return {
    schemaVersion: 1,
    sourceId,
    snapshotId,
    sha256: String(input.sha256).toLowerCase(),
    fileFormat: input.fileFormat,
    recordCount,
    retrievedAt,
    sourceUpdatedAt: input.sourceUpdatedAt ? String(input.sourceUpdatedAt) : null,
    rightsEvidenceUrl,
    licenseId,
    status
  };
}

export function snapshotManifestKey(sourceId, snapshotId) {
  return PREFIX + ":" + requiredId(sourceId, "sourceId") + ":" + requiredId(snapshotId, "snapshotId");
}

export async function putSnapshotManifest(kv, input, options = {}) {
  if (!kv || typeof kv.put !== "function") throw new TypeError("COMPANY_SNAPSHOT_KV binding is unavailable");
  const manifest = validateManifest(input);
  const serialized = JSON.stringify(manifest);
  if (new TextEncoder().encode(serialized).byteLength > MAX_MANIFEST_BYTES) {
    throw new RangeError("snapshot manifest exceeds the 32 KiB safety limit");
  }
  const ttl = options.expirationTtl ?? DEFAULT_TTL_SECONDS;
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 365 * 24 * 60 * 60) {
    throw new RangeError("expirationTtl must be between 60 seconds and one year");
  }
  const key = snapshotManifestKey(manifest.sourceId, manifest.snapshotId);
  await kv.put(key, serialized, { expirationTtl: ttl });
  return { key, manifest };
}

export async function getSnapshotManifest(kv, sourceId, snapshotId) {
  if (!kv || typeof kv.get !== "function") throw new TypeError("COMPANY_SNAPSHOT_KV binding is unavailable");
  const value = await kv.get(snapshotManifestKey(sourceId, snapshotId), "json");
  if (value == null) return null;
  return validateManifest(value);
}

export async function deleteSnapshotManifest(kv, sourceId, snapshotId) {
  if (!kv || typeof kv.delete !== "function") throw new TypeError("COMPANY_SNAPSHOT_KV binding is unavailable");
  await kv.delete(snapshotManifestKey(sourceId, snapshotId));
}
