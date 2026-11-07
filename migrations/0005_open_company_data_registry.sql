-- Rights-gated company/legal-entity catalogue for Global Logistics Intelligence.
-- This migration creates schema only. It does not download or import any third-party data.
-- Raw snapshots belong in R2; D1 stores compact normalized records and provenance.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS company_data_sources (
  source_id TEXT PRIMARY KEY CHECK (length(source_id) BETWEEN 3 AND 120),
  source_name TEXT NOT NULL CHECK (length(source_name) BETWEEN 2 AND 240),
  publisher TEXT NOT NULL CHECK (length(publisher) BETWEEN 2 AND 240),
  source_url TEXT NOT NULL CHECK (source_url LIKE 'https://%'),
  license_id TEXT NOT NULL CHECK (length(license_id) BETWEEN 2 AND 120),
  rights_status TEXT NOT NULL DEFAULT 'pending' CHECK (rights_status IN ('pending', 'approved', 'quarantined', 'blocked')),
  commercial_use INTEGER NOT NULL DEFAULT 0 CHECK (commercial_use IN (0, 1)),
  redistribution INTEGER NOT NULL DEFAULT 0 CHECK (redistribution IN (0, 1)),
  attribution_required INTEGER NOT NULL DEFAULT 0 CHECK (attribution_required IN (0, 1)),
  attribution_text TEXT,
  access_method TEXT NOT NULL DEFAULT 'unknown',
  update_frequency TEXT NOT NULL DEFAULT 'unknown',
  coverage_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(coverage_json)),
  data_scope_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(data_scope_json)),
  limitations_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(limitations_json)),
  evidence_urls_json TEXT NOT NULL CHECK (json_valid(evidence_urls_json)),
  ingestion_status TEXT NOT NULL DEFAULT 'discovery' CHECK (ingestion_status IN (
    'discovery', 'candidate', 'approved', 'ingesting', 'active', 'paused', 'blocked'
  )),
  personal_data_review_status TEXT NOT NULL DEFAULT 'pending' CHECK (personal_data_review_status IN (
    'not_required', 'pending', 'approved', 'blocked'
  )),
  metadata_hash TEXT,
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (redistribution = 0 OR rights_status = 'approved'),
  CHECK (rights_status != 'approved' OR commercial_use = 1 OR redistribution = 0),
  CHECK (attribution_required = 0 OR length(COALESCE(attribution_text, '')) > 0)
);

CREATE TABLE IF NOT EXISTS company_entities (
  entity_id TEXT PRIMARY KEY CHECK (length(entity_id) BETWEEN 4 AND 160),
  legal_name TEXT NOT NULL CHECK (length(legal_name) BETWEEN 1 AND 300),
  normalized_name TEXT NOT NULL CHECK (length(normalized_name) BETWEEN 1 AND 300),
  jurisdiction TEXT NOT NULL CHECK (length(jurisdiction) = 2),
  registry_identifier TEXT,
  lei TEXT,
  legal_form TEXT,
  entity_status TEXT,
  registered_address TEXT,
  postal_code TEXT,
  locality TEXT,
  region TEXT,
  country_code TEXT NOT NULL CHECK (length(country_code) = 2),
  industry_code TEXT,
  website_url TEXT CHECK (website_url IS NULL OR website_url LIKE 'https://%'),
  source_updated_at TEXT,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Intentionally no email, phone, personal-ID, shareholder or beneficial-owner columns.
CREATE INDEX IF NOT EXISTS idx_company_entities_jurisdiction_name
  ON company_entities (jurisdiction, normalized_name);
CREATE INDEX IF NOT EXISTS idx_company_entities_jurisdiction_registry
  ON company_entities (jurisdiction, registry_identifier)
  WHERE registry_identifier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_entities_lei
  ON company_entities (lei)
  WHERE lei IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_entities_status
  ON company_entities (jurisdiction, entity_status);

CREATE TABLE IF NOT EXISTS company_source_snapshots (
  snapshot_id TEXT PRIMARY KEY CHECK (length(snapshot_id) BETWEEN 8 AND 160),
  source_id TEXT NOT NULL REFERENCES company_data_sources(source_id) ON DELETE RESTRICT,
  snapshot_date TEXT NOT NULL,
  object_key TEXT,
  etag TEXT,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  file_format TEXT NOT NULL CHECK (file_format IN ('csv', 'json', 'jsonl', 'xml', 'parquet', 'zip', 'other')),
  compressed_size_bytes INTEGER CHECK (compressed_size_bytes IS NULL OR compressed_size_bytes >= 0),
  retrieved_at TEXT NOT NULL,
  source_modified_at TEXT,
  rights_evidence_url TEXT NOT NULL CHECK (rights_evidence_url LIKE 'https://%'),
  license_id TEXT NOT NULL,
  ingestion_status TEXT NOT NULL DEFAULT 'discovered' CHECK (ingestion_status IN (
    'discovered', 'downloaded', 'validated', 'quarantined', 'processed', 'failed'
  )),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_id, sha256)
);
CREATE INDEX IF NOT EXISTS idx_company_source_snapshots_source_date
  ON company_source_snapshots (source_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS company_source_records (
  source_id TEXT NOT NULL REFERENCES company_data_sources(source_id) ON DELETE RESTRICT,
  source_record_id TEXT NOT NULL CHECK (length(source_record_id) BETWEEN 1 AND 240),
  entity_id TEXT NOT NULL REFERENCES company_entities(entity_id) ON DELETE CASCADE,
  snapshot_id TEXT REFERENCES company_source_snapshots(snapshot_id) ON DELETE SET NULL,
  source_retrieved_at TEXT NOT NULL,
  source_updated_at TEXT,
  record_hash TEXT NOT NULL CHECK (length(record_hash) = 64),
  source_record_json TEXT NOT NULL CHECK (json_valid(source_record_json)),
  rights_status TEXT NOT NULL CHECK (rights_status = 'approved'),
  redistribution_allowed INTEGER NOT NULL CHECK (redistribution_allowed = 1),
  personal_data_review_status TEXT NOT NULL CHECK (personal_data_review_status IN ('not_required', 'approved')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_company_source_records_entity
  ON company_source_records (entity_id, source_id);
CREATE INDEX IF NOT EXISTS idx_company_source_records_snapshot
  ON company_source_records (source_id, snapshot_id);

-- Every normalized field keeps a traceable source record; never merge entities by name alone.
CREATE TABLE IF NOT EXISTS company_field_provenance (
  entity_id TEXT NOT NULL REFERENCES company_entities(entity_id) ON DELETE CASCADE,
  field_name TEXT NOT NULL CHECK (length(field_name) BETWEEN 1 AND 80),
  source_id TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  value_hash TEXT NOT NULL CHECK (length(value_hash) = 64),
  source_updated_at TEXT,
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_id, field_name, source_id, source_record_id),
  FOREIGN KEY (source_id, source_record_id)
    REFERENCES company_source_records(source_id, source_record_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_company_field_provenance_current
  ON company_field_provenance (entity_id, field_name, is_current);

CREATE TABLE IF NOT EXISTS company_entity_links (
  entity_a TEXT NOT NULL REFERENCES company_entities(entity_id) ON DELETE CASCADE,
  entity_b TEXT NOT NULL REFERENCES company_entities(entity_id) ON DELETE CASCADE,
  match_method TEXT NOT NULL CHECK (match_method IN (
    'lei', 'jurisdiction_registry_id', 'official_cross_reference', 'manual_review'
  )),
  confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  review_status TEXT NOT NULL DEFAULT 'candidate' CHECK (review_status IN ('candidate', 'verified', 'rejected')),
  evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (entity_a < entity_b),
  PRIMARY KEY (entity_a, entity_b, match_method)
);

CREATE TABLE IF NOT EXISTS company_ingestion_runs (
  run_id TEXT PRIMARY KEY CHECK (length(run_id) BETWEEN 8 AND 160),
  source_id TEXT NOT NULL REFERENCES company_data_sources(source_id) ON DELETE RESTRICT,
  snapshot_id TEXT REFERENCES company_source_snapshots(snapshot_id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'scheduled', 'webhook', 'backfill')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  records_read INTEGER NOT NULL DEFAULT 0 CHECK (records_read >= 0),
  records_inserted INTEGER NOT NULL DEFAULT 0 CHECK (records_inserted >= 0),
  records_updated INTEGER NOT NULL DEFAULT 0 CHECK (records_updated >= 0),
  records_skipped INTEGER NOT NULL DEFAULT 0 CHECK (records_skipped >= 0),
  records_quarantined INTEGER NOT NULL DEFAULT 0 CHECK (records_quarantined >= 0),
  bytes_processed INTEGER NOT NULL DEFAULT 0 CHECK (bytes_processed >= 0),
  cursor_json TEXT CHECK (cursor_json IS NULL OR json_valid(cursor_json)),
  error_summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_company_ingestion_runs_source
  ON company_ingestion_runs (source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS company_data_source_audit (
  audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES company_data_sources(source_id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN (
    'discovered', 'license_verified', 'license_changed', 'approved', 'quarantined', 'blocked',
    'ingestion_started', 'ingestion_completed', 'ingestion_failed', 'personal_data_reviewed'
  )),
  actor TEXT NOT NULL DEFAULT 'system',
  evidence_url TEXT CHECK (evidence_url IS NULL OR evidence_url LIKE 'https://%'),
  notes TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_company_data_source_audit_source
  ON company_data_source_audit (source_id, recorded_at DESC);

-- Fail closed: a public company source record cannot be inserted unless the source itself
-- is approved for both commercial use and redistribution, and personal-data review is complete.
CREATE TRIGGER IF NOT EXISTS trg_company_source_records_rights_insert
BEFORE INSERT ON company_source_records
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM company_data_sources
  WHERE source_id = NEW.source_id
    AND rights_status = 'approved'
    AND commercial_use = 1
    AND redistribution = 1
    AND ingestion_status IN ('approved', 'ingesting', 'active')
)
BEGIN
  SELECT RAISE(ABORT, 'company source rights are not approved for commercial redistribution');
END;

CREATE TRIGGER IF NOT EXISTS trg_company_source_records_rights_update
BEFORE UPDATE OF source_id, rights_status, redistribution_allowed, personal_data_review_status
ON company_source_records
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM company_data_sources
  WHERE source_id = NEW.source_id
    AND rights_status = 'approved'
    AND commercial_use = 1
    AND redistribution = 1
    AND ingestion_status IN ('approved', 'ingesting', 'active')
)
BEGIN
  SELECT RAISE(ABORT, 'company source rights are not approved for commercial redistribution');
END;
