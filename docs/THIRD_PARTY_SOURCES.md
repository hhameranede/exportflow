# Third-party carrier engines and source repositories

This registry distinguishes **stored upstream source**, **runtime dependencies**, **reference-only projects**, and **verified live integrations**.

## Materialized source snapshots stored in ExportFlow

The reviewed source snapshots below are now ordinary tracked files in this private repository under `vendor/sources/`. They are not Git submodules, and there is no `.gitmodules` file. Each directory preserves the exact upstream commit and the applicable license/provenance files.

| ExportFlow path | Upstream | Pinned commit | Files stored | Source bytes stored | License / scope |
| --- | --- | --- | ---: | ---: | --- |
| `vendor/sources/universal-parcel-scraper` | [plhery/universal-parcel-scraper](https://github.com/plhery/universal-parcel-scraper) | `e64a466772ef25ce68e02d9c7c9f1613eec1208b` | 12,618 | 83,629,080 | Apache-2.0 core; upstream NOTICE plus nested MIT, CC BY 4.0, Open Database License, government-data and public-domain attributions preserved |
| `vendor/sources/shopana-carrier-api` | [shopanaio/carrier-api](https://github.com/shopanaio/carrier-api) | `450ab76612a359b494c5bb7a6bce1d97add130a2` | 219 | 5,738,947 | Apache-2.0 root and package licenses; Nova Poshta API client, MCP server and Fetch transport source |
| `vendor/sources/reference/karrio-community` | [karrioapi/community](https://github.com/karrioapi/community) | `4d5303d8c66bee2b605f1d9ea35c105cb5725471` | 975 | 12,795,919 | LGPL-3.0; EasyPost plugin has its own nested LGPL-3.0 license |
| `vendor/sources/algeria/dz-delivery` | [developing-off/dz-delivery](https://github.com/developing-off/dz-delivery) | `45aa32ddf2ba7392da6c696aef187fcc059b3c8d` | 910 | 4,228,323 | MIT; full upstream source snapshot, TypeScript SDK at `packages/ts`; reference-only |

**Total stored source:** 14,722 files and 106,392,269 bytes (about 101.49 MiB), excluding the short inventory README.

### Explicit exclusions and license handling

- **Universal Parcel Scraper:** the optional `trawl/` component was excluded in full (85 upstream files; 811,658 bytes) because it is AGPL-3.0. Its upstream NOTICE remains stored and records that component and its provenance. The core Apache-2.0 source and other notices/data attributions remain.
- **Shopana:** generated coverage reports were excluded (41 files; 897,019 bytes). The root Apache-2.0 license and package-level license files for `novaposhta-api-client`, `novaposhta-mcp-server`, and `novaposhta-transport-fetch` are retained.
- **Karrio Community:** the checked-in root LICENSE is LGPL-3.0 even though the README claims Apache-2.0. We treat the actual LICENSE file as controlling and keep the snapshot reference-only. The nested EasyPost LICENSE is also retained. Do not import this source into the production bundle without a separate LGPL compliance and architecture review.
- All snapshots omit VCS metadata, credential-bearing local configuration, caches, symlinks and runtime databases. Original source files are otherwise preserved rather than whitespace-normalized or rewritten.

The machine-readable inventory is in [`vendor/sources/README.md`](../vendor/sources/README.md). The source snapshots are kept for auditability, future adapter research and reproducible diffs; **they are not all wired into the production runtime**.

## Runtime and integration status

- **Active tracking engine:** ExportFlow continues to use the pinned npm dependency `universal-parcel-scraper@0.977.1`, fixed to upstream commit `e64a466772ef25ce68e02d9c7c9f1613eec1208b`. The local snapshot is a separately stored source copy; it is not loaded as a second runtime engine.
- **Default universal fallback:** UPU remains the only default universal fallback, matching the current ExportFlow engine configuration.
- **Shopana:** source/reference only. Its Nova Poshta client needs the provider's authorized API key. The SDK is not currently wired into ExportFlow.
- **Karrio Community:** source/reference only. It is Python-based and not wired into the Cloudflare Pages runtime.
- A source file, catalog entry or API client does not prove that an adapter works against a live carrier, that access is permitted, or that results may be republished commercially.

The upstream Universal Parcel Scraper README at the pinned commit describes more than 3,500 carrier/service entries, 732 dedicated adapters, five universal fallback providers and 156 represented countries. Its published benchmark is a selected 100-carrier European sample (91 histories from dedicated adapters and 95 with all fallbacks enabled); it is not a global live-success guarantee. Carrier websites, API permissions, credentials, anti-bot controls and data freshness still vary.

## Algeria specialization source\n\nThe pinned `developing-off/dz-delivery` repository is being materialized as an ordinary tracked source snapshot under `vendor/sources/algeria/dz-delivery/`. Its MIT-licensed TypeScript SDK (`packages/ts`) documents Yalidine, ZRExpress, Maystro, Ecotrack (including DHD variants), GuepEx, NoEST, E-com Delivery, MDM Express and Elogistia. The SDK also contains parcel creation, fees and location methods; ExportFlow will initially evaluate only its tracking interface.\n\nThis source snapshot is **not yet a runtime integration**. The SDK's provider clients require credentials and may expose methods unrelated to public tracking. Do not call create/cancel/fees APIs from the public tracking route. Before any runtime adapter is enabled, inspect each provider's API terms, credential model, response mapping, timeout behavior and tests. Only tracking with user-authorized provider credentials may be considered. No carrier is claimed live-verified by copying this code.\n\n## Newly reviewed candidates — not materialized

Research checked on 2026-11-07. These projects were reviewed and intentionally not copied because they do not add a suitable self-contained global engine for the current Cloudflare runtime.

| Project | License / evidence | What it offers | Decision |
| --- | --- | --- | --- |
| [bernalli/parcel-tracker-bot](https://github.com/bernalli/parcel-tracker-bot) | MIT; LICENSE file checked | Python self-hosted Telegram/web application, seller workflow, 24+ courier sources, plugin architecture and quarantine after repeated scraper misses. Its broader fallback uses the separate 17TRACK API and an API key. | Reliability/quarantine reference, not a second self-contained global engine. Not materialized. |
| [cavit99/parcelcli](https://github.com/cavit99/parcelcli) | MIT; LICENSE file checked | Go CLI with six listed carrier flows (Evri, Royal Mail, UPS, FedEx, DHL and InPost); most use Chrome/CDP browser automation. | Small browser-dependent CLI; no global-coverage advantage over the active engine and not Cloudflare-edge compatible. Not materialized. |
| [developing-off/dz-delivery](https://github.com/developing-off/dz-delivery) | MIT; root LICENSE and `@dz-delivery/core` package metadata checked | TypeScript SDK for Algerian providers including Yalidine, ZRExpress, Maystro, Ecotrack/DHD, GuepEx, NoEST, E-com, MDM and Elogistia. Uses Fetch and provider credentials. | Candidate for a later Algeria-specialization phase after the global tracking path is stable. No provider was live-verified by this review. |
| [RomaBilka/parcel-tracking](https://github.com/RomaBilka/parcel-tracking) | MIT indicated by GitHub metadata and upstream LICENSE.md | Go service with one tracking endpoint and adapters for DHL, FedEx, Nova Poshta, Ukrposhta, Meest Express, UPS and USPS. Last source push inspected: 2023-02-24. | Older and narrower than the active global engine. Not materialized. |
| [cargofy/ATLAS](https://github.com/cargofy/ATLAS) | README claims Apache-2.0; GitHub license metadata is NOASSERTION and root LICENSE lookup did not resolve | MCP/web platform for TMS/WMS, shipments, carriers, rates and operational records; not a parcel tracking engine. | Potential logistics-intelligence/MCP reference; license needs authoritative confirmation. Not materialized. |
| [shevendra-nag/shipment-tracker](https://github.com/shevendra-nag/shipment-tracker) | No root LICENSE file found during this review | Self-hosted shipment-management app with manual milestones and optional AfterShip sync. | Not a standalone licensed carrier engine. Not materialized. |

## Previously reviewed but not materialized

- [karrioapi/karrio](https://github.com/karrioapi/karrio): its open-source core is LGPL-3.0, but the repository also contains `ee/` components governed by a separate commercial Karrio Enterprise License. The complete repository is not vendored.
- [landofcoder/purplship](https://github.com/landofcoder/purplship): public OSS areas use Apache-2.0, but `insiders/` is covered by a separate Enterprise License. The inspected repository is stale (last source push in 2021).
- [simonbrunou/parcel-tracker](https://github.com/simonbrunou/parcel-tracker): GPL-3.0 standalone Go application, not a drop-in Cloudflare/Workers adapter.
- [slince/shipment-tracking-foundation](https://github.com/slince/shipment-tracking-foundation): legacy MIT PHP library, with source activity last seen in 2017 and a narrow set of older carrier packages.
- [plhery/peek-delivery-tracker](https://github.com/plhery/peek-delivery-tracker): separate end-user tracking application built around Universal Parcel Scraper, not an additional carrier engine.
- [whereparcel/whereparcel-js](https://github.com/WhereParcel/whereparcel-js): MIT client SDK for WhereParcel's hosted tracking API; the SDK is open source, but the tracking service is not a self-hosted open-source engine.

## D1-backed carrier evidence register

The application now has a D1 `carrier_evidence` registry seeded with 22 research records for globally relevant networks. The records deliberately remain at `research`; the registry is distinct from the 3,500+ upstream catalog entries and is not a count of live or commercially authorized integrations.

Each record stores:
- the official carrier/developer source URL and a short public disclosure;
- the research scope and access model (account-linked, merchant/customer-code scoped, partner onboarding, public-tracker-only or written-permission required);
- exact upstream adapter IDs where the pinned source has a known corresponding adapter, with `country_specific` or `missing` recorded where appropriate;
- current evidence status and verification method.

The public `GET /api/carriers` response joins these records to matching catalog adapter IDs. Unmatched catalog entries remain `catalogued`. Internal research notes and authorization documents are not exposed.

The database rejects `verified` unless a repeatable live test, verification timestamp, test evidence URL, authorization evidence URL and declared rights scope are present. The API also downgrades malformed or incomplete `verified` records to `research` as defense in depth. No seeded provider is live-verified by this registry.

## Software license is not carrier authorization

An upstream software license governs copying, modifying and redistributing that code. It does **not** grant permission from DHL, UPS, FedEx, postal operators or other carriers to automate their websites, access account-bound APIs, reuse shipment data, or expose tracking results as a public commercial service.

Before enabling any individual adapter, verify the carrier's current terms, API agreement, credentials and intended third-party display rights. If a provider requires a merchant/customer account, use that merchant's delegated authorization and isolate its credentials. Never add credentials, real tracking numbers, customer postcodes or shipment PII to this repository.

## Evidence labels

- **Catalogued:** a provider appears in an upstream source catalogue.
- **Adapter-ready:** code and configuration exist, but no successful provider test has been demonstrated.
- **Mock-tested:** deterministic local fixtures or mocked responses passed.
- **Sandbox-tested:** an official provider sandbox returned a successful response.
- **Live-verified:** a permitted live integration was tested with authorized credentials and synthetic or otherwise approved data.

Do not promote a source or carrier to a higher evidence level without the corresponding test evidence.
