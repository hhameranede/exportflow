-- Tenant-scoped API credentials and persistent plan request quotas.
-- Apply only to an explicitly approved ExportFlow D1 database.
-- This migration intentionally seeds no plan limits or tenants: commercial limits
-- must be chosen and provisioned by the project owner before the public endpoint is enabled.

CREATE TABLE IF NOT EXISTS plan_policies (
  plan_code TEXT PRIMARY KEY,
  quota_period TEXT NOT NULL CHECK (quota_period IN ('daily', 'monthly')),
  request_limit INTEGER NOT NULL
    CHECK (typeof(request_limit) = 'integer' AND request_limit > 0),
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (plan_code) REFERENCES plan_policies(plan_code)
);

CREATE INDEX IF NOT EXISTS idx_tenants_status_plan
  ON tenants (status, plan_code);

CREATE TABLE IF NOT EXISTS api_keys (
  key_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE
    CHECK (length(key_hash) = 64),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  scopes_json TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_status
  ON api_keys (tenant_id, status);

CREATE TABLE IF NOT EXISTS tenant_request_usage (
  tenant_id TEXT NOT NULL,
  window_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  request_limit INTEGER NOT NULL
    CHECK (typeof(request_limit) = 'integer' AND request_limit > 0),
  requests_used INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(requests_used) = 'integer' AND requests_used >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, window_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
  FOREIGN KEY (plan_code) REFERENCES plan_policies(plan_code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_request_usage_window
  ON tenant_request_usage (window_id, tenant_id);

CREATE TRIGGER IF NOT EXISTS guard_tenant_request_usage_limit_insert
BEFORE INSERT ON tenant_request_usage
WHEN NEW.requests_used > NEW.request_limit
BEGIN
  SELECT RAISE(ABORT, 'PLAN_REQUEST_QUOTA_EXCEEDED');
END;

CREATE TRIGGER IF NOT EXISTS guard_tenant_request_usage_limit_update
BEFORE UPDATE OF requests_used, request_limit ON tenant_request_usage
WHEN NEW.requests_used > NEW.request_limit
BEGIN
  SELECT RAISE(ABORT, 'PLAN_REQUEST_QUOTA_EXCEEDED');
END;
