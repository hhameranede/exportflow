# ExportFlow — Full 743-Adapter Review Matrix

## Purpose and source
This is a 743-row review overlay kept separate from the immutable technical inventory. It is generated from the successful full-adapter audit artifact for plhery/universal-parcel-scraper commit 9c088edaa089135b89658f2b611f8a741d5238c6 (package version 0.1010.2).

- CSV: adapter-review-matrix.csv inside the GitHub Actions artifact exportflow-full-743-adapter-audit.
- Generator: scripts/build-743-review-matrix.mjs.
- Technical inventory: docs/FULL_743_ADAPTER_AUDIT.md.
- Source commit: https://github.com/plhery/universal-parcel-scraper/commit/9c088edaa089135b89658f2b611f8a741d5238c6

## Initial snapshot

| Review status | Rows | Meaning |
| --- | ---: | --- |
| unreviewed | 660 | No direct adapter-level rights/source review completed. |
| source-review-needed | 70 | Static security/source triage or an unresolved adapter-family identity boundary needs manual review. |
| merchant-delegation-needed | 2 | Exact USPS/UPS slug matches have account/MID/shipper authorization gates in the private ledger. |
| official-api-contract-needed | 7 | Exact provider slug matches are conditional API/contract candidates; adapter route is not assumed to be that API. |
| public-route-quarantined | 4 | Exact China Post, India Post, Singapore Post and YunExpress routes are not cleared for hosted public lookup. |
| Total | 743 | Zero adapters rights-cleared. |

Technical triage signals: 16 possible credential-literal heuristic flags, 27 HTTP/no-browser candidates with offline tests and fixtures, 3 adapters without offline test definitions, and 35 without fixtures. These are static signals, not confirmed secrets, vulnerabilities, endpoint health, or permission findings. The 737 live-test definitions were inventoried only; none were executed.

## Rights and identity rules

1. An exact adapter ID can be linked to a provider note as a provisional research reference only. It does not prove that the adapter uses the provider's official API or that ExportFlow is authorized.
2. Country, subsidiary, product-line and service variants do not inherit an umbrella carrier's classification. Confirm the exact legal entity, service, source route and contract per row. This is especially important for DPD, GLS, Correos, DHL, FedEx and Aramex.
3. The 13 direct ledger slug references are: usps, ups, fedex, yanwen, aramex, emirates-post, japan-post, la-poste, sf-express, china-post, india-post, singapore-post and yunexpress.
4. The ledger's A–E labels are research groupings, not production approval. This snapshot records B/C/D references only where the adapter slug matches exactly. It makes no E-class assignment where the restricted provider/product has no exact adapter row.
5. No adapter has verified official API evidence, public recipient-facing display permission, commercial/advertising permission, or a completed retention/deletion assessment in this matrix. Blank evidence fields mean not recorded, not that permission exists.
6. The upstream root Apache-2.0 license and repository NOTICE/nested licenses concern source/software materials. They do not grant carrier API access, website automation permission, shipment-data redistribution, trademark use, public display or commercial tracking rights.

## Column semantics

- review_status: current work-queue state, not live support or authorization status.
- technical_review_priority: static-source inspection order only. P0 flags need manual inspection before source reuse; P1 identifies missing tests or HTTP/no-browser source review; P2 marks fixture/privacy follow-up; P3 is routine.
- possible_credential_literal_heuristic: a static pattern match. The matrix stores no candidate value or secret.
- external_hostnames_static_source_signals: hostnames found in source strings; they may be placeholders, test hosts, third parties or stale endpoints, not verified official URLs.
- live_test_definition_present_not_executed: a test file exists, but it was not run and does not demonstrate a successful live shipment lookup.
- family_identity_boundary_note: warns against transferring research conclusions between related but legally distinct entities/products.
- rights_release_state: remains not_cleared until evidence and an authorized review justify a change.

## Required evidence before promotion

For each row, record exact legal carrier/entity; official source/API URL and date; exact integration route; source/software license provenance; provider terms and permitted use; account, MID or merchant-delegation requirement; public recipient-display permission; commercial/ads permission; retention/deletion obligations; privacy/security review; redacted controlled test evidence; reviewer and decision date.

Do not promote an adapter to approved-for-testing until a permitted test route and test data are confirmed. Do not promote to approved-for-production until repeatable authorized tests pass and data, display, commercial and retention rights are documented. A passing upstream offline test is not a carrier canary.

## Safety boundaries

No live carrier requests, real tracking numbers, credentials, recipient information, scraping sessions or production changes were used to generate this matrix. The CSV contains source-level indicators and empty evidence fields only. Keep the PR Draft until the review plan and evidence are checked. No merge or deployment is authorized by this work.


## Runtime versus test/fixture signal scope — 2026-11-09

The primary matrix columns (browser, HTTP client, external host, environment, authentication, reliability, privacy and dynamic-code indicators) are calculated from runtime adapter source and manifest metadata only. Test/spec and fixture files are counted and reported separately in \`non_runtime_source_signals\`. A browser or HTTP client used by an offline test is not evidence that the deployed adapter uses that client.

Credential-like literal findings are scanned across source files and text fixtures, with path-based classification for test directories and fixture directories. The matched value is never serialized. Re-run results supersede the historical technical triage counts above; use the newest workflow artifact for current counts.
