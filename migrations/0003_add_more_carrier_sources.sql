INSERT OR IGNORE INTO upstream_sources
(id, repository, branch, license_spdx, import_policy, status, notes)
VALUES
('open-parcels-reference', 'gek0v/open-parcels', 'main', 'MIT', 'monitor-only', 'active', 'Go source reference only. Some DHL/UPS fallback paths emit simulated events; never import or expose those as real tracking.'),
('myparcel', 'Satal/myparcel', 'main', 'MIT', 'review-and-port', 'active', 'Python adapter candidates: Royal Mail, DPD, Evri, Amazon Logistics and Relay; port individually after review.'),
('nordic-parcel', 'jumpingmushroom/nordic-parcel', 'main', 'MIT', 'review-and-port', 'active', 'Home Assistant carrier candidates: Bring/Posten Norge, PostNord and Helthjem; port only carrier logic.');
