PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS carrier_integrations (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  country_codes_json TEXT NOT NULL DEFAULT '[]',
  integration_mode TEXT NOT NULL CHECK (integration_mode IN ('direct', 'universal', 'link-only', 'catalog-only')),
  verification_status TEXT NOT NULL DEFAULT 'catalog-only' CHECK (verification_status IN ('catalog-only', 'adapter-present', 'canary-passing', 'temporarily-failing', 'unsupported')),
  source_repository TEXT NOT NULL,
  source_commit TEXT,
  source_license TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS carrier_health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  carrier_id TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_kind TEXT NOT NULL CHECK (check_kind IN ('offline-fixture', 'live-canary', 'runtime-observation')),
  outcome TEXT NOT NULL CHECK (outcome IN ('pass', 'fail', 'skipped', 'rate-limited', 'challenge', 'inconclusive')),
  response_ms INTEGER,
  event_count INTEGER,
  error_kind TEXT,
  source_commit TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (carrier_id) REFERENCES carrier_integrations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_carrier_health_checks_carrier_time ON carrier_health_checks(carrier_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_carrier_health_checks_time ON carrier_health_checks(checked_at DESC);

CREATE TABLE IF NOT EXISTS upstream_sources (
  id TEXT PRIMARY KEY,
  repository TEXT NOT NULL UNIQUE,
  branch TEXT NOT NULL,
  license_spdx TEXT,
  import_policy TEXT NOT NULL CHECK (import_policy IN ('runtime', 'review-and-port', 'monitor-only')),
  last_seen_commit TEXT,
  last_seen_at TEXT,
  license_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'license-review', 'archived')),
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS upstream_check_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  repositories_checked INTEGER NOT NULL DEFAULT 0,
  repositories_changed INTEGER NOT NULL DEFAULT 0,
  repositories_failed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'partial', 'failed')),
  report_url TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS upstream_repository_snapshots (
  repository TEXT PRIMARY KEY,
  branch TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  license_spdx TEXT,
  pushed_at TEXT,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  change_detected INTEGER NOT NULL DEFAULT 0 CHECK (change_detected IN (0, 1))
);

CREATE TABLE IF NOT EXISTS maintenance_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_repository TEXT NOT NULL,
  old_commit TEXT,
  new_commit TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'reviewed', 'resolved', 'ignored')),
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  review_notes TEXT
);

-- Deliberately no shipment IDs, recipient fields, postcodes or raw tracking responses.
-- Shipment history storage requires an explicit opt-in product flow and a separate migration.

INSERT OR IGNORE INTO upstream_sources (id, repository, branch, license_spdx, import_policy, status, notes) VALUES
  ('ups-core', 'plhery/universal-parcel-scraper', 'main', 'Apache-2.0', 'runtime', 'active', 'Pinned runtime source. Preserve upstream LICENSE and NOTICE.'),
  ('parcel-tracker-bot', 'bernalli/parcel-tracker-bot', 'main', 'MIT', 'review-and-port', 'active', 'Supplementary carrier candidates; not a production dependency.'),
  ('karrio', 'karrioapi/karrio', 'main', 'LGPL-3.0', 'monitor-only', 'license-review', 'Separate compliance review required; enterprise components excluded.');

INSERT OR IGNORE INTO carrier_integrations
  (id, display_name, country_codes_json, integration_mode, verification_status, source_repository, source_commit, source_license, enabled)
VALUES
  ('algerie-poste', 'Algérie Poste', '["DZ"]', 'direct', 'adapter-present', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('egypt-post', 'Egypt Post', '["EG"]', 'direct', 'adapter-present', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('posta-kenya', 'Posta Kenya', '["KE"]', 'direct', 'adapter-present', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('la-poste-senegal', 'La Poste du Sénégal', '["SN"]', 'direct', 'adapter-present', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('south-african-post-office', 'South African Post Office', '["ZA"]', 'direct', 'adapter-present', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('emirates-post', 'Emirates Post', '["AE"]', 'direct', 'adapter-present', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('saudi-post', 'Saudi Post / SPL', '["SA"]', 'direct', 'adapter-present', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('qatar-post', 'Qatar Post', '["QA"]', 'direct', 'adapter-present', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('jordan-post', 'Jordan Post', '["JO"]', 'direct', 'adapter-present', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('bangladesh-post', 'Bangladesh Post Office', '["BD"]', 'direct', 'adapter-present', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('la-poste-tunisienne', 'La Poste Tunisienne', '["TN"]', 'universal', 'catalog-only', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('libya-post', 'Libya Post', '["LY"]', 'universal', 'catalog-only', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('ghana-post', 'Ghana Post', '["GH"]', 'universal', 'catalog-only', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1),
  ('ethiopian-post', 'Ethiopian Postal Service', '["ET"]', 'universal', 'catalog-only', 'plhery/universal-parcel-scraper', 'e64a466772ef25ce68e02d9c7c9f1613eec1208b', 'Apache-2.0', 1);
