# Full 743-adapter source audit

## Scope

Audit the complete Universal Parcel Scraper source snapshot at commit 9c088edaa089135b89658f2b611f8a741d5238c6. The upstream README for this exact revision reports 743 dedicated adapters, 5 universal fallbacks, 1,375 catalogue entries and 159 represented countries.

ExportFlow is currently pinned to an older snapshot with 732 adapter source directories. This audit compares IDs between snapshots but does not change the active runtime dependency.

## Per-adapter inspection

The generated JSON and CSV inventory covers every adapter directory and records manifest identity, tracking mode, country metadata, source/test/fixture files, local license/notice files, browser requirements, network-client patterns, external hostnames, imports, environment variable names only, authentication indicators, timeout/abort/retry/rate-limit/User-Agent patterns, privacy-related code signals and static security heuristics.

Static heuristics are signals for review, not proof of runtime behaviour or a vulnerability finding. The audit does not collect credential values, shipment numbers, recipient data or private fixtures. Credential-like literal matches are now reported with file path, line, field name, source kind and value length only; the matched values are never written. Runtime-source findings are separated from test/spec and fixture findings so synthetic mocks do not receive the same priority as deployed code.

## Offline validation

The workflow runs the upstream repository's normal offline validation commands: build, lint, typecheck, npm test, npm run test:scripts, generated-file checks and package verification. The upstream Vitest configuration excludes *.live.test.ts. Live tests, canaries, tracking-link tests and search-page tests are never invoked.

## Datadog Student-plan budget

Detailed adapter-level results remain in the GitHub Actions artifact. Only one aggregate manual Test Visibility test represents the source inventory, rather than emitting one event per adapter or assertion. Upstream test suites run without Datadog instrumentation to avoid consuming unnecessary test visibility units.

## Rights boundary

The root source declares Apache-2.0, but the repository NOTICE records nested MIT, CC BY 4.0, ODbL, public-domain and Government Open Data License - India material. The optional TRAWL component is AGPL-3.0 and is excluded from ExportFlow runtime imports. Adapter-local license/notice files are separately listed.

A source audit does not grant carrier API access, permission to scrape a carrier website, commercial use of shipment data, redistribution rights, trademark rights or official partnership status. Every adapter remains rights-review-required until its provenance, third-party materials and carrier-specific terms/permissions are established.

## Review matrix overlay

The workflow also generates a separate 743-row review overlay from the JSON inventory. The CSV is included in the same GitHub Actions artifact as adapter-review-matrix.csv. Its methodology and status counts are documented in docs/FULL_743_ADAPTER_REVIEW_MATRIX.md, and scripts/build-743-review-matrix.mjs asserts the pinned source commit, exact row count, unique adapter IDs and zero pre-cleared rights. No family-wide rights inheritance is applied to country/service variants.

## Outputs

- adapter-audit.json: full structured report with one object per adapter.
- adapter-audit.csv: filterable spreadsheet-friendly inventory.
- adapter-audit.md: summary and source/rights/testing interpretation.

No merge, production dependency update, D1 migration, credential activation, carrier live lookup or deployment is performed.
