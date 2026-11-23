-- Human-user to tenant mapping for OAuth and the shared REST/MCP authorization gateway.
-- Apply only through an explicitly approved migration to EXPORTFLOW_AUTH_DB.

CREATE TABLE IF NOT EXISTS tenant_memberships (
  membership_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL CHECK (length(trim(user_id)) BETWEEN 1 AND 128),
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  membership_version INTEGER NOT NULL DEFAULT 1 CHECK (typeof(membership_version) = 'integer' AND membership_version > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'suspended')),
  created_by TEXT NOT NULL CHECK (length(trim(created_by)) BETWEEN 1 AND 128),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE (user_id, tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_status
  ON tenant_memberships (user_id, status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_status_role
  ON tenant_memberships (tenant_id, status, role, user_id);

CREATE TABLE IF NOT EXISTS tenant_oauth_selections (
  session_id TEXT PRIMARY KEY CHECK (length(trim(session_id)) BETWEEN 1 AND 128),
  user_id TEXT NOT NULL CHECK (length(trim(user_id)) BETWEEN 1 AND 128),
  tenant_id TEXT NOT NULL,
  selected_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_oauth_selections_user_expiry
  ON tenant_oauth_selections (user_id, expires_at);

CREATE TRIGGER IF NOT EXISTS guard_tenant_membership_last_owner
BEFORE UPDATE OF role, status ON tenant_memberships
WHEN OLD.status = 'active' AND OLD.role = 'owner'
  AND (NEW.status <> 'active' OR NEW.role <> 'owner')
  AND NOT EXISTS (
    SELECT 1 FROM tenant_memberships AS other
    WHERE other.tenant_id = OLD.tenant_id AND other.user_id <> OLD.user_id
      AND other.role = 'owner' AND other.status = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'TENANT_MUST_RETAIN_AN_ACTIVE_OWNER');
END;

CREATE TRIGGER IF NOT EXISTS prevent_tenant_membership_identity_update
BEFORE UPDATE OF membership_id, user_id, tenant_id, created_by, created_at ON tenant_memberships
BEGIN
  SELECT RAISE(ABORT, 'TENANT_MEMBERSHIP_IDENTITY_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS prevent_tenant_membership_delete
BEFORE DELETE ON tenant_memberships
BEGIN
  SELECT RAISE(ABORT, 'TENANT_MEMBERSHIP_DELETE_FORBIDDEN');
END;

-- Any tenant suspension/reactivation or plan change invalidates all previously issued
-- tenant-bound OAuth tokens. The resource server still re-checks the live membership.
CREATE TRIGGER IF NOT EXISTS bump_tenant_membership_version_on_tenant_state_change
AFTER UPDATE OF status, plan_code ON tenants
WHEN OLD.status <> NEW.status OR OLD.plan_code <> NEW.plan_code
BEGIN
  UPDATE tenant_memberships
  SET membership_version = membership_version + 1,
      updated_at = NEW.updated_at
  WHERE tenant_id = NEW.tenant_id;
END;
