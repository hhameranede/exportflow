-- Append-only audit events for merchant carrier credential lifecycle.
-- The trigger records metadata only; never copy ciphertext, IVs or plaintext API values.
CREATE TABLE IF NOT EXISTS merchant_provider_audit_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL CHECK (length(merchant_id) BETWEEN 1 AND 128),
  provider TEXT NOT NULL CHECK (provider IN (
    'yalidine', 'guepex', 'zrexpress', 'maystro', 'ecotrack',
    'noest', 'ecom', 'mdm', 'elogistia'
  )),
  event_type TEXT NOT NULL CHECK (
    event_type IN ('credential.connected', 'credential.updated', 'credential.disconnected')
  ),
  occurred_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL CHECK (length(metadata_json) <= 1024)
);

CREATE INDEX IF NOT EXISTS idx_merchant_provider_audit_merchant_time
  ON merchant_provider_audit_events (merchant_id, occurred_at);

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
