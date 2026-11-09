-- Separate merchant-owned official API credentials from the legacy Algeria-only vault.
-- AES-256-GCM ciphertext only. The two allowlisted API clients are sandbox-tested only.
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
