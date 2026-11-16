-- Dedicated, append-only diagnostics for completed tracking lookups.
-- Apply only to a newly provisioned ExportFlow telemetry D1 database.
CREATE TABLE IF NOT EXISTS exportflow_tracking_events (
  request_id TEXT PRIMARY KEY NOT NULL CHECK (length(request_id) = 36),
  occurred_at TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  carrier TEXT NOT NULL CHECK (length(carrier) BETWEEN 1 AND 80),
  source TEXT,
  status TEXT,
  error_class TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  event_count INTEGER CHECK (event_count IS NULL OR event_count BETWEEN 0 AND 1000),
  attempts_json TEXT NOT NULL CHECK (json_valid(attempts_json)),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exportflow_tracking_events_expiry
  ON exportflow_tracking_events (expires_at);

CREATE INDEX IF NOT EXISTS idx_exportflow_tracking_events_occurred_at
  ON exportflow_tracking_events (occurred_at);
