# Third-party carrier engines and source repositories

This registry distinguishes source pointers, checked-out code, runtime dependencies, and live integrations. A Git submodule stores an exact upstream commit pointer in ExportFlow; it does **not** copy every upstream file into ExportFlow's own Git object database. The complete pinned files are fetched from the original upstream repositories when a developer initializes the submodules:

```bash
git submodule update --init --recursive
```

These submodules are not automatically bundled into the Cloudflare Pages deployment. The production integration uses the pinned npm dependency listed in `package.json`. A source pointer or package dependency does not prove that every upstream adapter is active, authorized, tested, or live-verified.

## Included and pinned sources

| ExportFlow path | Upstream | Pinned commit | License status | Intended use |
| --- | --- | --- | --- | --- |
| `vendor/universal-parcel-scraper` | [plhery/universal-parcel-scraper](https://github.com/plhery/universal-parcel-scraper) | `e64a466772ef25ce68e02d9c7c9f1613eec1208b` | Apache-2.0 core; preserve upstream NOTICE and all component-specific licenses | Full source checkout corresponding to the engine version currently used by ExportFlow's npm dependency |
| `vendor/shopana-carrier-api` | [shopanaio/carrier-api](https://github.com/shopanaio/carrier-api) | `450ab76612a359b494c5bb7a6bce1d97add130a2` | Apache-2.0 at repository and package level | Reference source for the Nova Poshta TypeScript client and Fetch transport; edge-compatible design, but requires an authorized API key and is not wired into ExportFlow |
| `vendor/reference/karrio-community` | [karrioapi/community](https://github.com/karrioapi/community) | `4d5303d8c66bee2b605f1d9ea35c105cb5725471` | **License discrepancy:** the checked-in LICENSE file is LGPL-3.0, while README says Apache-2.0. Treat it as LGPL-3.0 until maintainers resolve the inconsistency. EasyPost also has its own license file. | Reference-only Python carrier plugin source; not compatible with the current Cloudflare Pages runtime and not imported or executed |

## Upstream license copies

- `third-party-licenses/universal-parcel-scraper/LICENSE` and `NOTICE` preserve the pinned engine's notices, including its optional AGPL-3.0 TRAWL component and separately licensed data/model assets.
- `third-party-licenses/shopana-carrier-api/LICENSE` preserves the Apache-2.0 license for the Nova Poshta SDK source.
- `third-party-licenses/karrio-community/LICENSE` and `plugins/easypost-LICENSE` preserve the source license files as checked in upstream. The README/license mismatch is intentionally recorded rather than silently choosing the more permissive claim.

## Newly reviewed candidates — not imported

Research checked on 2026-11-07. These projects are recorded to avoid repeating discovery and to keep the global-first implementation order explicit.

| Project | License / evidence | What it offers | Decision |
| --- | --- | --- | --- |
| [bernalli/parcel-tracker-bot](https://github.com/bernalli/parcel-tracker-bot) | MIT; LICENSE file checked | Python self-hosted Telegram/web application, seller workflow, 24+ courier sources, plugin architecture and automatic quarantine after repeated scraper misses. Its broad fallback is the separate 17TRACK API and requires an API key. | Useful reliability/quarantine reference, but not another self-contained global engine; Python application and external fallback are not part of the Cloudflare runtime. Not imported. |
| [cavit99/parcelcli](https://github.com/cavit99/parcelcli) | MIT; LICENSE file checked | Go CLI with six listed carrier flows (Evri, Royal Mail, UPS, FedEx, DHL and InPost); most use Chrome/CDP browser automation. | Small, browser-dependent CLI; no advantage over the active engine for global coverage and not Cloudflare-edge compatible. Not imported. |
| [developing-off/dz-delivery](https://github.com/developing-off/dz-delivery) | MIT; package metadata and LICENSE checked | TypeScript SDK for Algerian delivery APIs, including ZRExpress, Yalidine, Maystro, Ecotrack, NoEST, E-com, Elogistia and MDM. Uses native Fetch and provider credentials. | Strong candidate for the later Algeria specialization phase. Kept out of the global-engine phase; no provider is live-verified by this review. |
| [RomaBilka/parcel-tracking](https://github.com/RomaBilka/parcel-tracking) | MIT indicated by GitHub repository metadata and upstream LICENSE.md | Go service with a single tracking endpoint and adapters for DHL, FedEx, Nova Poshta, Ukrposhta, Meest Express, UPS and USPS. Last source push inspected: 2023-02-24. | Older and narrower than the active global engine. Not imported. |
| [cargofy/ATLAS](https://github.com/cargofy/ATLAS) | README claims Apache-2.0; GitHub license metadata is NOASSERTION and the root LICENSE lookup did not resolve during this review | MCP and web platform for querying TMS/WMS, shipment, carrier, rates and operational records; not a carrier tracking engine. | Potential logistics-intelligence/MCP reference, but license needs authoritative confirmation and it is not a parcel adapter engine. Not imported. |
| [shevendra-nag/shipment-tracker](https://github.com/shevendra-nag/shipment-tracker) | No root LICENSE file found during this review | Self-hosted shipment-management app with manual milestones and optional AfterShip courier sync. | Not a standalone open-source carrier engine; do not copy without a clear license. Not imported. |

## Previously reviewed but not imported

- [karrioapi/karrio](https://github.com/karrioapi/karrio): its open-source core is LGPL-3.0, but the repository also contains `ee/` components governed by a separate commercial Karrio Enterprise License. The complete repository is not vendored.
- [landofcoder/purplship](https://github.com/landofcoder/purplship): public OSS areas use Apache-2.0, but `insiders/` is covered by a separate Enterprise License. The inspected repository is stale (last source push in 2021) and is not imported.
- [simonbrunou/parcel-tracker](https://github.com/simonbrunou/parcel-tracker): GPL-3.0 standalone Go application, not a drop-in Cloudflare/Workers adapter. Not imported.
- [slince/shipment-tracking-foundation](https://github.com/slince/shipment-tracking-foundation): legacy MIT PHP library, with source activity last seen in 2017 and a narrow set of older carrier packages. Not imported.
- [plhery/peek-delivery-tracker](https://github.com/plhery/peek-delivery-tracker): a separate end-user tracking application built around Universal Parcel Scraper, not an additional carrier engine. Not imported.
- [whereparcel/whereparcel-js](https://github.com/WhereParcel/whereparcel-js): MIT client SDK for WhereParcel's hosted tracking API; the SDK is open source, but the tracking service is not a self-hosted open-source engine. Not imported.

## Important distinction: software license vs carrier authorization

An upstream software license governs copying, modifying and redistributing that code. It does **not** grant permission from DHL, UPS, FedEx, postal operators or other carriers to automate their websites, access account-bound APIs, reuse shipment data, or expose tracking results as a public commercial service.

Before enabling any individual adapter, verify the carrier's current terms, API agreement, credentials and intended third-party display rights. If a provider requires a merchant/customer account, use that merchant's delegated authorization and isolate its credentials. A catalog entry or adapter file is never proof of an authorized live integration.

## Runtime and integration policy

- Universal Parcel Scraper remains the single active tracking engine in this release.
- UPU remains the only default universal fallback, matching the existing ExportFlow configuration.
- Shopana and Karrio sources are reference-only; do not add them to the production bundle without a separate compatibility, authorization and test review.
- The Algerian SDK is reserved for a later regional phase, after the global tracking path and coverage model are stable.
- Never send tracking numbers to optional fallback providers unless they are explicitly enabled and their terms/privacy treatment have been approved.
- Never add credentials, real tracking numbers, customer postcodes or shipment PII to this repository.

## Evidence labels

- **Catalogued:** project or carrier appears in a source repository.
- **Adapter-ready:** code and configuration exist, but no successful provider test has been demonstrated.
- **Mock-tested:** deterministic local fixtures or mocked responses passed.
- **Sandbox-tested:** an official provider sandbox returned a successful response.
- **Live-verified:** a permitted real provider integration was tested with authorized credentials and synthetic or otherwise approved data.

Do not promote a source or carrier to a higher evidence level without the corresponding test evidence.
