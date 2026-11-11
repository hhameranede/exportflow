-- Separate merchant-owned official API credentials from the legacy Algeria-only vault.
-- AES-256-GCM ciphertext only; this is an isolated sandbox credential scope.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS merchant_official_api_credentials (
  merchant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('fedex', 'ups')),
  key_id TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope = 'sandbox_track'),
  consented_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (merchant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_merchant_official_api_credentials_updated
  ON merchant_official_api_credentials (updated_at);

-- Expand the metadata-only audit provider allowlist without dropping prior events.
-- Rebuild is required because SQLite cannot alter an existing CHECK constraint.
DROP TRIGGER IF EXISTS merchant_provider_audit_events_no_update;
DROP TRIGGER IF EXISTS merchant_provider_audit_events_no_delete;
DROP TRIGGER IF EXISTS merchant_provider_credentials_audit_insert;
DROP TRIGGER IF EXISTS merchant_provider_credentials_audit_update;
DROP TRIGGER IF EXISTS merchant_provider_credentials_audit_delete;

CREATE TABLE merchant_provider_audit_events_rebuilt (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL CHECK (length(merchant_id) BETWEEN 1 AND 128),
  provider TEXT NOT NULL CHECK (provider IN (
    'yalidine', 'guepex', 'zrexpress', 'maystro', 'ecotrack',
    'noest', 'ecom', 'mdm', 'elogistia', 'fedex', 'ups'
  )),
  event_type TEXT NOT NULL CHECK (
    event_type IN ('credential.connected', 'credential.updated', 'credential.disconnected')
  ),
  occurred_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL CHECK (length(metadata_json) <= 1024)
);

INSERT INTO merchant_provider_audit_events_rebuilt
  (id, merchant_id, provider, event_type, occurred_at, metadata_json)
SELECT id, merchant_id, provider, event_type, occurred_at, metadata_json
FROM merchant_provider_audit_events;

DROP TABLE merchant_provider_audit_events;
ALTER TABLE merchant_provider_audit_events_rebuilt RENAME TO merchant_provider_audit_events;

CREATE INDEX IF NOT EXISTS idx_merchant_provider_audit_merchant_time
  ON merchant_provider_audit_events (merchant_id, occurred_at);

CREATE TRIGGER IF NOT EXISTS merchant_provider_audit_events_no_update
BEFORE UPDATE ON merchant_provider_audit_events
BEGIN
  SELECT RAISE(ABORT, 'merchant provider audit events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS merchant_provider_audit_events_no_delete
BEFORE DELETE ON merchant_provider_audit_events
BEGIN
  SELECT RAISE(ABORT, 'merchant provider audit events are append-only');
END;

-- Official API credential lifecycle events record scope only, never secret fields.
-- Recreate the legacy Algeria credential audit hooks against the rebuilt audit table.
CREATE TRIGGER IF NOT EXISTS merchant_provider_credentials_audit_insert
AFTER INSERT ON merchant_provider_credentials
BEGIN
  INSERT INTO merchant_provider_audit_events
    (id, merchant_id, provider, event_type, occurred_at, metadata_json)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.merchant_id,
    NEW.provider,
    'credential.connected',
    NEW.updated_at,
    '{"scope":"track"}'
  );
END;

CREATE TRIGGER IF NOT EXISTS merchant_provider_credentials_audit_update
AFTER UPDATE ON merchant_provider_credentials
BEGIN
  INSERT INTO merchant_provider_audit_events
    (id, merchant_id, provider, event_type, occurred_at, metadata_json)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.merchant_id,
    NEW.provider,
    'credential.updated',
    NEW.updated_at,
    '{"scope":"track"}'
  );
END;

CREATE TRIGGER IF NOT EXISTS merchant_provider_credentials_audit_delete
AFTER DELETE ON merchant_provider_credentials
BEGIN
  INSERT INTO merchant_provider_audit_events
    (id, merchant_id, provider, event_type, occurred_at, metadata_json)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.merchant_id,
    OLD.provider,
    'credential.disconnected',
    OLD.updated_at,
    '{"scope":"track"}'
  );
END;

CREATE TRIGGER IF NOT EXISTS merchant_official_api_credentials_audit_insert
AFTER INSERT ON merchant_official_api_credentials
BEGIN
  INSERT INTO merchant_provider_audit_events
    (id, merchant_id, provider, event_type, occurred_at, metadata_json)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.merchant_id,
    NEW.provider,
    'credential.connected',
    NEW.updated_at,
    '{"scope":"sandbox_track"}'
  );
END;

CREATE TRIGGER IF NOT EXISTS merchant_official_api_credentials_audit_update
AFTER UPDATE ON merchant_official_api_credentials
BEGIN
  INSERT INTO merchant_provider_audit_events
    (id, merchant_id, provider, event_type, occurred_at, metadata_json)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.merchant_id,
    NEW.provider,
    'credential.updated',
    NEW.updated_at,
    '{"scope":"sandbox_track"}'
  );
END;

CREATE TRIGGER IF NOT EXISTS merchant_official_api_credentials_audit_delete
AFTER DELETE ON merchant_official_api_credentials
BEGIN
  INSERT INTO merchant_provider_audit_events
    (id, merchant_id, provider, event_type, occurred_at, metadata_json)
  VALUES (
    lower(hex(randomblob(16))),
    OLD.merchant_id,
    OLD.provider,
    'credential.disconnected',
    OLD.updated_at,
    '{"scope":"sandbox_track"}'
  );
END;
