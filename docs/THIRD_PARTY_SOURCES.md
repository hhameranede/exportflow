# Third-party carrier engines and source repositories

This registry records the upstream projects pinned in this repository. The source checkouts are Git submodules: their exact commit IDs are stored in ExportFlow's Git tree, while the source repositories remain hosted by their original maintainers.

To materialize the complete pinned source checkouts after cloning ExportFlow:

```bash
git submodule update --init --recursive
```

These submodules are not automatically bundled into the Cloudflare Pages deployment. The production integration continues to use the pinned npm dependency listed in `package.json`. A submodule being present does not mean its adapters are active, tested, or authorized for public tracking.

## Included sources

| ExportFlow path | Upstream | Pinned commit | License status | Intended use |
| --- | --- | --- | --- | --- |
| `vendor/universal-parcel-scraper` | [plhery/universal-parcel-scraper](https://github.com/plhery/universal-parcel-scraper) | `e64a466772ef25ce68e02d9c7c9f1613eec1208b` | Apache-2.0 core; preserve upstream NOTICE and all component-specific licenses | Full source checkout corresponding to the engine version currently used by ExportFlow's npm dependency |
| `vendor/shopana-carrier-api` | [shopanaio/carrier-api](https://github.com/shopanaio/carrier-api) | `450ab76612a359b494c5bb7a6bce1d97add130a2` | Apache-2.0 at repository and package level | Reference source for the Nova Poshta TypeScript client and Fetch transport; edge-compatible design, but requires the authorized API key and is not wired into ExportFlow |
| `vendor/reference/karrio-community` | [karrioapi/community](https://github.com/karrioapi/community) | `4d5303d8c66bee2b605f1d9ea35c105cb5725471` | **License discrepancy:** the checked-in LICENSE file is LGPL-3.0, while README says Apache-2.0. Treat it as LGPL-3.0 until its maintainers resolve the inconsistency. EasyPost also has its own license file. | Reference-only Python carrier plugin source; not compatible with the current Cloudflare Pages runtime and not imported or executed |

## Upstream license copies

- `third-party-licenses/universal-parcel-scraper/LICENSE` and `NOTICE` preserve the pinned engine's notices, including its optional AGPL-3.0 TRAWL component and separately licensed data/model assets.
- `third-party-licenses/shopana-carrier-api/LICENSE` preserves the Apache-2.0 license for the Nova Poshta SDK source.
- `third-party-licenses/karrio-community/LICENSE` and `plugins/easypost-LICENSE` preserve the source license files as checked in upstream. The README/license mismatch is intentionally recorded rather than silently choosing the more permissive claim.

## Reviewed but not imported

- [karrioapi/karrio](https://github.com/karrioapi/karrio): its open-source core is LGPL-3.0, but the repository also contains `ee/` components governed by a separate commercial Karrio Enterprise License. The complete repository is not vendored.
- [landofcoder/purplship](https://github.com/landofcoder/purplship): its public OSS areas use Apache-2.0, but its `insiders/` directory is covered by a separate Enterprise License; the inspected repository's latest commit is from 2021. Not imported.
- [simonbrunou/parcel-tracker](https://github.com/simonbrunou/parcel-tracker): GPL-3.0 standalone Go application, not a drop-in Cloudflare/Workers adapter. Not imported.
- [plhery/peek-delivery-tracker](https://github.com/plhery/peek-delivery-tracker): a separate end-user tracking application built around Universal Parcel Scraper, not an additional carrier engine. Not imported.

## Important distinction: software license vs carrier authorization

An upstream software license governs copying, modifying and redistributing that code. It does **not** grant permission from DHL, UPS, FedEx, postal operators or other carriers to automate their websites, access account-bound APIs, reuse shipment data, or expose their tracking results as a public commercial service.

Before enabling any individual adapter, verify that carrier's current terms, API agreement, credentials and intended third-party display rights. If a provider requires a merchant/customer account, use that merchant's delegated authorization and isolate its credentials. A catalog entry or adapter file is never proof of an authorized live integration.

## Runtime policy

- Universal Parcel Scraper remains the single active tracking engine in this release.
- UPU remains the only default universal fallback, matching the existing ExportFlow configuration.
- Shopana and Karrio sources are reference-only; do not add them to the production bundle without a separate compatibility, authorization and test review.
- Never send tracking numbers to optional fallback providers unless they are explicitly enabled and their terms/privacy treatment have been approved.
- Never add credentials, real tracking numbers, customer postcodes or shipment PII to this repository.
