-- Append-only administrative audit trail for tenant and API-key lifecycle events.
-- This schema is intentionally separate from Better Auth's AUTH_DB.

CREATE TABLE IF NOT EXISTS tenant_admin_audit_log (
  event_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL CHECK (length(trim(actor_id)) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 64),
  resource_type TEXT NOT NULL CHECK (length(resource_type) BETWEEN 1 AND 32),
  resource_id TEXT NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 128),
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_admin_audit_resource
  ON tenant_admin_audit_log (resource_type, resource_id, created_at);

CREATE INDEX IF NOT EXISTS idx_tenant_admin_audit_actor
  ON tenant_admin_audit_log (actor_id, created_at);

CREATE TRIGGER IF NOT EXISTS prevent_tenant_admin_audit_update
BEFORE UPDATE ON tenant_admin_audit_log
BEGIN
  SELECT RAISE(ABORT, 'TENANT_ADMIN_AUDIT_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS prevent_tenant_admin_audit_delete
BEFORE DELETE ON tenant_admin_audit_log
BEGIN
  SELECT RAISE(ABORT, 'TENANT_ADMIN_AUDIT_APPEND_ONLY');
END;
