UPDATE upstream_sources
SET license_spdx = 'NOASSERTION',
    notes = 'GitHub reports NOASSERTION for the root repository; README describes LGPL-3.0 for core/community and a separate enterprise license for /ee. Verify file-level license before reuse.'
WHERE id = 'karrio';
