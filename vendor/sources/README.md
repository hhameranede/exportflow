# Materialized upstream sources

These are ordinary tracked files copied from exact upstream commits. They are source/reference snapshots, not runtime imports.
ExportFlow's deployed tracking integration continues to use the pinned npm dependency in package.json.

## universal-parcel-scraper
- Upstream: https://github.com/plhery/universal-parcel-scraper
- Pinned commit: `e64a466772ef25ce68e02d9c7c9f1613eec1208b`
- License: Apache-2.0 core; upstream NOTICE and nested MIT/CC BY 4.0/Open Database License attributions preserved
- Files: 12618
- Source bytes: 83629080
- Exclusions: trawl/ (optional AGPL-3.0 component)

## shopana-carrier-api
- Upstream: https://github.com/shopanaio/carrier-api
- Pinned commit: `450ab76612a359b494c5bb7a6bce1d97add130a2`
- License: Apache-2.0, including package-level license files
- Files: 260
- Source bytes: 6635966
- Exclusions: credential-bearing local config, VCS metadata, caches, symlinks and runtime databases

## karrio-community
- Upstream: https://github.com/karrioapi/community
- Pinned commit: `4d5303d8c66bee2b605f1d9ea35c105cb5725471`
- License: LGPL-3.0; upstream README claims Apache-2.0, but checked-in LICENSE is controlling for this snapshot
- Files: 975
- Source bytes: 12795919
- Exclusions: credential-bearing local config, VCS metadata, caches, symlinks and runtime databases

Do not treat source catalog entries as proof of a working adapter or carrier authorization.
Do not import LGPL reference code into the deployed bundle without a separate license and architecture review.
Preserve each upstream LICENSE, NOTICE, and nested component license when updating these snapshots.
