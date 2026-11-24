-- Durable tenant-scoped task lifecycle and idempotent quota reservation.
-- Apply only through an explicitly approved migration to EXPORTFLOW_AUTH_DB.
-- Request payloads and idempotency keys are never stored in plaintext.
-- Task result retention is 24 hours; expired rows are eligible for cleanup on later task acceptance.

CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY CHECK (length(task_id) BETWEEN 8 AND 64),
  tenant_id TEXT NOT NULL,
  idempotency_key_hash TEXT NOT NULL CHECK (length(idempotency_key_hash) = 64),
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  operation TEXT NOT NULL CHECK (operation IN ('fetch', 'map', 'crawl', 'extract', 'search', 'research')),
  state TEXT NOT NULL CHECK (state IN ('accepted', 'running', 'partial', 'succeeded', 'failed', 'cancelled', 'expired', 'unsupported')),
  quota_period TEXT NOT NULL CHECK (quota_period IN ('daily', 'monthly')),
  quota_window_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  quota_limit INTEGER NOT NULL CHECK (typeof(quota_limit) = 'integer' AND quota_limit > 0),
  quota_used INTEGER NOT NULL DEFAULT 0 CHECK (typeof(quota_used) = 'integer' AND quota_used >= 0),
  quota_remaining INTEGER NOT NULL DEFAULT 0 CHECK (typeof(quota_remaining) = 'integer' AND quota_remaining >= 0),
  quota_reset_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  lease_expires_at TEXT,
  expires_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (typeof(attempt_count) = 'integer' AND attempt_count >= 0),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (typeof(revision) = 'integer' AND revision >= 0),
  response_json TEXT CHECK (
    response_json IS NULL OR length(CAST(response_json AS BLOB)) <= 1500000
  ),
  result_available INTEGER NOT NULL DEFAULT 0 CHECK (result_available IN (0, 1)),
  error_code TEXT,
  usage_json TEXT CHECK (usage_json IS NULL OR json_valid(usage_json)),
  execution_json TEXT CHECK (execution_json IS NULL OR json_valid(execution_json)),
  UNIQUE (tenant_id, idempotency_key_hash),
  UNIQUE (task_id, tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
  FOREIGN KEY (plan_code) REFERENCES plan_policies(plan_code)
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_created
  ON tasks (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_state_lease
  ON tasks (tenant_id, state, lease_expires_at);

CREATE TABLE IF NOT EXISTS task_events (
  event_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (typeof(revision) = 'integer' AND revision >= 0),
  event_type TEXT NOT NULL CHECK (length(event_type) BETWEEN 1 AND 64),
  occurred_at TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  UNIQUE (task_id, revision),
  FOREIGN KEY (task_id, tenant_id) REFERENCES tasks(task_id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_events_tenant_task
  ON task_events (tenant_id, task_id, revision);

-- Reject only a genuinely new logical task when the existing UTC window is already exhausted.
-- The unique-key replay path is excluded, so a client retry can still retrieve its original Task.
CREATE TRIGGER IF NOT EXISTS guard_task_quota_capacity_before_insert
BEFORE INSERT ON tasks
WHEN NOT EXISTS (
  SELECT 1 FROM tasks
  WHERE tenant_id = NEW.tenant_id
    AND idempotency_key_hash = NEW.idempotency_key_hash
)
AND EXISTS (
  SELECT 1 FROM tenant_request_usage
  WHERE tenant_id = NEW.tenant_id
    AND window_id = NEW.quota_window_id
    AND requests_used >= request_limit
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_REQUEST_QUOTA_EXCEEDED');
END;

-- The task insert is the single idempotency/quota acceptance point.
-- An idempotency conflict does not fire this AFTER INSERT trigger and cannot consume quota.
CREATE TRIGGER IF NOT EXISTS reserve_quota_for_new_task
AFTER INSERT ON tasks
BEGIN
  INSERT INTO tenant_request_usage (
    tenant_id, window_id, plan_code, policy_version,
    request_limit, requests_used, updated_at
  )
  VALUES (
    NEW.tenant_id, NEW.quota_window_id, NEW.plan_code, NEW.policy_version,
    NEW.quota_limit, 1, NEW.created_at
  )
  ON CONFLICT (tenant_id, window_id)
  DO UPDATE SET
    requests_used = tenant_request_usage.requests_used + 1,
    updated_at = excluded.updated_at
  WHERE tenant_request_usage.requests_used < tenant_request_usage.request_limit;

  UPDATE tasks
  SET plan_code = (
        SELECT plan_code FROM tenant_request_usage
        WHERE tenant_id = NEW.tenant_id AND window_id = NEW.quota_window_id
      ),
      policy_version = (
        SELECT policy_version FROM tenant_request_usage
        WHERE tenant_id = NEW.tenant_id AND window_id = NEW.quota_window_id
      ),
      quota_limit = (
        SELECT request_limit FROM tenant_request_usage
        WHERE tenant_id = NEW.tenant_id AND window_id = NEW.quota_window_id
      ),
      quota_used = (
        SELECT requests_used FROM tenant_request_usage
        WHERE tenant_id = NEW.tenant_id AND window_id = NEW.quota_window_id
      ),
      quota_remaining = MAX(0, (
        SELECT request_limit FROM tenant_request_usage
        WHERE tenant_id = NEW.tenant_id AND window_id = NEW.quota_window_id
      ) - (
        SELECT requests_used FROM tenant_request_usage
        WHERE tenant_id = NEW.tenant_id AND window_id = NEW.quota_window_id
      ))
  WHERE task_id = NEW.task_id;

  INSERT INTO task_events (
    event_id, task_id, tenant_id, revision, event_type, occurred_at, details_json
  )
  VALUES (
    NEW.task_id || ':0', NEW.task_id, NEW.tenant_id, 0,
    'task.accepted', NEW.created_at, json_object('state', 'accepted')
  );
END;

CREATE TRIGGER IF NOT EXISTS guard_task_state_transitions
BEFORE UPDATE OF state ON tasks
WHEN OLD.state <> NEW.state
 AND NOT (
   (OLD.state = 'accepted' AND NEW.state IN ('running', 'failed', 'cancelled', 'expired')) OR
   (OLD.state = 'running' AND NEW.state IN ('partial', 'succeeded', 'failed', 'cancelled', 'expired', 'unsupported'))
 )
BEGIN
  SELECT RAISE(ABORT, 'TASK_INVALID_STATE_TRANSITION');
END;

-- Lifecycle events are generated from successful state transitions in the same D1 write.
CREATE TRIGGER IF NOT EXISTS record_task_state_transitions
AFTER UPDATE OF state ON tasks
WHEN OLD.state <> NEW.state
BEGIN
  INSERT INTO task_events (
    event_id, task_id, tenant_id, revision, event_type, occurred_at, details_json
  )
  VALUES (
    NEW.task_id || ':' || NEW.revision,
    NEW.task_id,
    NEW.tenant_id,
    NEW.revision,
    CASE NEW.state
      WHEN 'running' THEN 'task.started'
      WHEN 'partial' THEN 'task.partial'
      WHEN 'succeeded' THEN 'task.succeeded'
      WHEN 'failed' THEN 'task.failed'
      WHEN 'cancelled' THEN 'task.cancelled'
      WHEN 'expired' THEN 'task.expired'
      WHEN 'unsupported' THEN 'task.unsupported'
      ELSE 'task.updated'
    END,
    COALESCE(NEW.completed_at, NEW.started_at, NEW.updated_at),
    json_object('state', NEW.state, 'attempt', NEW.attempt_count, 'errorCode', NEW.error_code)
  );
END;

CREATE TRIGGER IF NOT EXISTS guard_task_identity_immutable
BEFORE UPDATE OF task_id, tenant_id, idempotency_key_hash, request_hash, operation,
  quota_period, quota_window_id, created_at, expires_at ON tasks
BEGIN
  SELECT RAISE(ABORT, 'TASK_IDENTITY_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS guard_task_events_immutable
BEFORE UPDATE ON task_events
BEGIN
  SELECT RAISE(ABORT, 'TASK_EVENTS_APPEND_ONLY');
END;
