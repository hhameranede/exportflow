-- D1-backed merchant identity and revocable opaque sessions.
-- Session bearer tokens are never stored: only SHA-256 digests are persisted.
CREATE TABLE IF NOT EXISTS merchant_users (
  id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL CHECK (auth_provider = 'google'),
  provider_subject TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email_verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL,
  disabled_at TEXT,
  UNIQUE (auth_provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS merchant_sessions (
  id TEXT PRIMARY KEY,
  merchant_user_id TEXT NOT NULL REFERENCES merchant_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_merchant_sessions_user_expiry
  ON merchant_sessions (merchant_user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_merchant_sessions_expiry
  ON merchant_sessions (expires_at);

CREATE TABLE IF NOT EXISTS merchant_security_events (
  id TEXT PRIMARY KEY,
  merchant_user_id TEXT,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('merchant.session.created', 'merchant.session.revoked')
  ),
  created_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL CHECK (length(metadata_json) <= 1024)
);

CREATE INDEX IF NOT EXISTS idx_merchant_security_events_user_created
  ON merchant_security_events (merchant_user_id, created_at);

-- Audit events are append-only. Keep them after account removal for investigations.
CREATE TRIGGER IF NOT EXISTS merchant_security_events_no_update
BEFORE UPDATE ON merchant_security_events
BEGIN
  SELECT RAISE(ABORT, 'merchant security events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS merchant_security_events_no_delete
BEFORE DELETE ON merchant_security_events
BEGIN
  SELECT RAISE(ABORT, 'merchant security events are append-only');
END;
