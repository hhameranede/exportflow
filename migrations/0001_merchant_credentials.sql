-- AES-256-GCM ciphertext only. Never add plaintext credential columns.
CREATE TABLE IF NOT EXISTS merchant_provider_credentials (
  merchant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN (
    'yalidine', 'guepex', 'zrexpress', 'maystro', 'ecotrack',
    'noest', 'ecom', 'mdm', 'elogistia'
  )),
  key_id TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope = 'track'),
  consented_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (merchant_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_merchant_provider_credentials_updated
  ON merchant_provider_credentials (updated_at);
