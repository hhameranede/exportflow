# Materialized upstream sources

These are ordinary tracked files copied from exact upstream commits. No Git submodule pointers are used. These are source/reference snapshots, not runtime imports.
ExportFlow's deployed tracking integration continues to use the pinned npm dependency in package.json.

## universal-parcel-scraper
- Upstream: https://github.com/plhery/universal-parcel-scraper
- Pinned commit: `e64a466772ef25ce68e02d9c7c9f1613eec1208b`
- License: Apache-2.0 core; preserve upstream NOTICE and nested MIT/CC BY 4.0/Open Database License and government-data attributions
- Files stored: 12618
- Source bytes stored: 83629080
- Exclusions: trawl/ (85 files; optional AGPL-3.0 component)

## shopana-carrier-api
- Upstream: https://github.com/shopanaio/carrier-api
- Pinned commit: `450ab76612a359b494c5bb7a6bce1d97add130a2`
- License: Apache-2.0, including root and all three package-level licenses
- Files stored: 219
- Source bytes stored: 5738947
- Exclusions: generated coverage/ reports (41 files; 897,019 bytes)

## karrio-community
- Upstream: https://github.com/karrioapi/community
- Pinned commit: `4d5303d8c66bee2b605f1d9ea35c105cb5725471`
- License: LGPL-3.0; upstream README claims Apache-2.0, but checked-in LICENSE is controlling for this snapshot
- Files stored: 975
- Source bytes stored: 12795919
- Exclusions: VCS metadata, caches, symlinks, credential-bearing local configuration and runtime databases

The active production carrier engine remains the separately pinned npm dependency; Shopana and Karrio are source references only.
Do not treat source catalog entries as proof of a working adapter or carrier authorization.
Do not import LGPL reference code into the deployed bundle without a separate license and architecture review.
Preserve each upstream LICENSE, NOTICE, and nested component license when updating these snapshots.

## dz-delivery-algeria
- Upstream: https://github.com/developing-off/dz-delivery
- Pinned commit: `45aa32ddf2ba7392da6c696aef187fcc059b3c8d`
- License: MIT (root LICENSE and @dz-delivery/core package metadata)
- Files stored: 910
- Source bytes stored: 4228323
- Scope: full upstream repository snapshot; TypeScript SDK is under `packages/ts`; PHP package and documentation are retained as source references
- Runtime: the merchant-only `/api/merchant/track` feature imports the pinned TypeScript source entrypoint; Wrangler bundle and Preview validation pending
