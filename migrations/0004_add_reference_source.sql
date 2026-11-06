INSERT OR IGNORE INTO upstream_sources
(id, repository, branch, license_spdx, import_policy, status, notes)
VALUES
('open-parcels-reference', 'gek0v/open-parcels', 'main', 'MIT', 'monitor-only', 'active', 'Reference-only. Go source review found simulated DHL/UPS fallback events; do not import those or count them as real tracking.');
