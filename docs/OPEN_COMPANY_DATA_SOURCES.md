# ExportFlow open company-data source register

**Review date:** 2026-11-07  
**Scope:** discover reusable company/legal-entity data from independent public repositories and official registries, while reusing and separately auditing ExportFlow's existing upstream repositories.  
**Status:** initial source register; not yet a production ingestion or a legal opinion.

## Non-negotiable rules

- A public GitHub repository is not automatically licensed for reuse. Check the exact data license, not only the repository code license.
- Keep code, database rights, individual record/content rights, personal data, trademarks and API terms as separate checks.
- Commercial use and redistribution must both be affirmatively supported before copying records into a redistributable ExportFlow dataset.
- Unknown, conflicting, or dataset-specific terms go into quarantine. Never infer permission from HTTP 200, public visibility, a package README, or a repository's MIT/Apache license.
- A source catalogue or connector is not a company partner, and a company record is not an ExportFlow-verified carrier integration.

## Priority source candidates

| Source | Licence / rights basis | Coverage and useful data | Refresh / access | Decision |
|---|---|---|---|---|
| [GLEIF Global LEI Index](https://www.gleif.org/en/lei-data/access-and-use-lei-data) | CC0-1.0; GLEIF says its website data is CC0 | Global LEI-identified legal entities, legal names, registered addresses, status, reference data and parent relationships where reported | Free complete files and Golden Copy/deltas; up to three daily updates | **Priority 1 — ingest** after schema mapping and status handling |
| [Wikidata structured data](https://www.wikidata.org/wiki/Wikidata:Licensing) | CC0-1.0 for structured data | Global organization/entity enrichment, aliases, websites, countries, industry and relationship claims where present | Public dumps / query services | **Priority 2 — enrichment only**, never sole authority |
| [Ireland CRO Company Records](https://opendata.cro.ie/dataset/companies) | CC BY 4.0, as listed in the EU data catalogue | Ireland company register, including current and historical dissolved/closed records | Daily snapshot; bulk CSV and API | **Priority 1 — ingest with attribution** |
| [UK Companies House](https://www.gov.uk/guidance/companies-house-data-products) | Public-register statutory reuse; Companies House says it imposes no use restrictions on register information, but this is not labelled OGL | UK live company names, addresses, SIC, status, filing dates and previous names | Free monthly bulk CSV; free public-register URIs; API credentials required | **Priority 1 — ingest with personal-data review** |
| [Finland PRH / YTJ open data](https://avoindata.prh.fi/en) | CC BY 4.0 | Finnish Trade Register entities, business IDs, company form, address and tax-register membership; excludes private traders and does not provide email/phone | Free API and bulk JSON; daily | **Priority 1 — ingest with attribution** |
| [Latvian Enterprise Register open data](https://www.ur.gov.lv/en/registers-open-data-latvian-open-data-portal) | Official register confirms commercial and non-commercial reuse without restriction; capture exact dataset-level portal licence before production | Latvian legal entities and public register details | Machine-readable CSV/XLSX on data.gov.lv; dataset-specific cadence | **Priority 1 — ingest after dataset metadata snapshot** |
| [US SEC EDGAR APIs](https://data.sec.gov/) | SEC states government-created sec.gov content and EDGAR public filing content are free to access and reuse; follow SEC fair-access/security policies | SEC reporting issuers, company submissions, filing metadata and XBRL company facts; not a complete US business register | Unauthenticated JSON; updated through the day | **Priority 2 — issuer/filing reference** |
| [GovDataHub Open Data Index](https://github.com/GovDataHub/open-data-index) | Index allowlists public domain, CC0, CC BY and OGL families; each dataset's licence and evidence is carried separately | Discovery index of government datasets, including economy and small-business datasets | GitHub CSV/JSON | **Discovery feed only**; fetch underlying publisher dataset and licence |
| [Dateno Data Portals Registry](https://github.com/datenoio/dataportals-registry) | Registry data CC BY 4.0; code MIT | Global data portal/catalogue metadata, not company records | JSONL, Parquet, DuckDB | **Discovery feed only**; not a company dataset |
| [OpenStreetMap business POIs](https://www.openstreetmap.org/copyright) | ODbL-1.0 | Global business points of interest, locations and categories | Planet extracts / regional extracts / Overpass | **Separate ODbL store only**; share-alike database obligations apply |
| [OpenCorporates](https://opencorporates.com/terms-of-use/) | ODbL database plus separate API terms | Global company register aggregation | Website/API/bulk products | **Blocked for free commercial ingestion**: website access is personal-use-only; API internal-use terms bar third-party service use; external distribution requires the appropriate contracted licence |

## Existing ExportFlow repositories — reuse, but do not overclaim

| Existing source | Pinned source licence | Current role | What it does not grant |
|---|---|---|---|
| [plhery/universal-parcel-scraper](https://github.com/plhery/universal-parcel-scraper) at `e64a466772ef25ce68e02d9c7c9f1613eec1208b` | Apache-2.0 core plus preserved nested MIT, CC BY 4.0, ODbL, government-data and public-domain notices | 12,618 source files; pinned carrier manifests/adapters; active npm engine | Carrier endorsement, carrier API credentials, shipment-data redistribution, or universal public tracking rights |
| [shopanaio/carrier-api](https://github.com/shopanaio/carrier-api) at `450ab76612a359b494c5bb7a6bce1d97add130a2` | Apache-2.0 | 219-file Nova Poshta client/MCP reference snapshot | Nova Poshta credentials or third-party commercial API rights |
| [karrioapi/community](https://github.com/karrioapi/community) at `4d5303d8c66bee2b605f1d9ea35c105cb5725471` | LGPL-3.0 (checked-in LICENSE governs; README mismatch noted) | 975-file reference-only snapshot | Permission to bundle into production without LGPL review |
| [developing-off/dz-delivery](https://github.com/developing-off/dz-delivery) at `45aa32ddf2ba7392da6c696aef187fcc059b3c8d` | MIT | 910-file Algerian SDK/reference snapshot | Provider authorization, merchant delegation or public third-party tracking rights |

The pinned Universal Parcel Scraper source is the existing catalogue source; do not duplicate its 1,339 manifests into a second company database. Its 732 adapters and 727 live-test definitions are source inventory counts, not verified live integrations or 732 provider licences. Keep the existing 22 carrier research dossiers at Research until each carrier's own access and public-display rights are proven.

## Ingestion architecture

1. **Source registry:** preserve publisher, dataset ID, exact URL, licence/version, access terms, attribution text, jurisdiction, retrieval timestamp and a hash of the source metadata.
2. **Separate raw stores:** CC0, CC BY, US government content and ODbL data must remain separable so ExportFlow can meet different obligations. Do not merge ODbL-derived database contents into a closed proprietary dataset.
3. **Normalized entity layer:** map source-native identifiers (LEI, national registration number, SEC CIK, Wikidata QID) without collapsing entities on name-only matches.
4. **Provenance per field:** every normalized field must retain source ID, source record ID, retrieval time and confidence. Preserve conflicting values instead of overwriting silently.
5. **Refresh and deletion:** support GLEIF delta updates and source-specific update cadence; process corrections/deletions and retain audit history without exposing personal data.
6. **Public API/MCP:** return source attribution and rights metadata; expose only fields whose source terms permit redistribution. Do not expose bulk exports from a source whose licence or contract does not permit them.
7. **Promotion gate:** only set a source to `redistribution_approved` after the dataset's exact current terms, commercial rights, redistribution rights and privacy restrictions have been captured and reviewed.

## Next implementation gates

- [ ] Capture current GLEIF terms and golden-copy schema; build an idempotent import plan and a small test fixture before full bulk ingestion.
- [ ] Implement Finland PRH CC BY attribution and API rate/refresh policy.
- [ ] Capture Ireland CRO CC BY attribution and verify the current daily CSV/API schema.
- [ ] Capture UK Companies House monthly snapshot versioning and review personal-data fields before public display.
- [ ] Capture exact Latvia dataset metadata and licence per CSV before importing.
- [ ] Add SEC issuer metadata as a separate source family and enforce SEC fair-access limits.
- [ ] Use GovDataHub and Dateno as discovery indexes only; crawl their metadata, then validate each underlying publisher dataset.
- [ ] Keep OpenCorporates blocked pending an explicit external-distribution contract.
- [ ] Keep ODbL sources isolated from the proprietary core catalogue.
- [ ] Extend automated checks to fail closed on missing licence, attribution, source URL, or redistribution status.

## Evidence

- GLEIF CC0, access-service restrictions and three daily Golden Copy releases: [LEI Data Terms of Use](https://www.gleif.org/en/meta/lei-data-terms-of-use), [Access and Use](https://www.gleif.org/en/lei-data/access-and-use-lei-data), [Golden Copy downloads](https://www.gleif.org/en/lei-data/gleif-golden-copy/download-the-golden-copy). Use only the official Access Service; do not imply GLEIF endorsement or claim rights in LEIs.
- Wikidata structured data CC0: [Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing).
- Finland PRH CC BY 4.0 and use in applications: [API information](https://avoindata.prh.fi/en/info/swagger-ui), [open data portal](https://avoindata.prh.fi/en).
- Ireland CRO Company Records CC BY 4.0: [official CRO dataset](https://opendata.cro.ie/dataset/companies), [EU data catalogue record](https://data.europa.eu/data/datasets/bf6f837d-0946-4c14-9a99-82cd6980c121).
- UK Companies House free monthly CSV and public-register reuse: [official data products and reuse guidance](https://www.gov.uk/guidance/companies-house-data-products), [API developer hub](https://developer.company-information.service.gov.uk/). The register reuse basis is not labelled OGL; apply separate privacy/copyright review.
- Latvia official commercial and non-commercial reuse statement: [Enterprise Register open data](https://www.ur.gov.lv/en/registers-open-data-latvian-open-data-portal); confirm exact dataset metadata before ingestion.
- SEC reuse and APIs: [SEC webmaster FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions), [Developer resources](https://www.sec.gov/about/developer-resources), [EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces).
- GovDataHub allowlisted source licensing: [open-data-index](https://github.com/GovDataHub/open-data-index).
- Dateno registry licence and scope: [dataportals-registry](https://github.com/datenoio/dataportals-registry).
- ODbL obligations: [OpenStreetMap copyright and licence](https://www.openstreetmap.org/copyright).
- OpenCorporates restrictions: [Terms of Use](https://opencorporates.com/terms-of-use/), [Self-serve API Terms](https://opencorporates.com/legal-information/self-service-api-terms-of-service/).
