# GLEIF Global LEI Index — safe first-stage company import specification

**Review date:** 2026-11-07  
**Source ID:** `gleif-global-lei`  
**Publisher:** Global Legal Entity Identifier Foundation (GLEIF)  
**Decision:** CC0 and Access Service terms verified; normalizer implemented; live ingestion remains staged pending API integration and a bounded Preview pilot.

## Publisher rights and Access Service boundary

GLEIF's official Terms of Use state that:
- GLEIF's website Access Service is free.
- Data provided through the Access Service is licensed under CC0 1.0 Universal.
- Users must access LEI/LE-RD only through the official Access Service, not circumvent technical restrictions or access the repository/files by alternative means.
- Users may not claim proprietary rights over LEIs or LEI reference data.
- Users must not imply their products are provided, supported, authorized, endorsed or affiliated with GLEIF or an LEI issuer.

Official terms: https://www.gleif.org/en/meta/lei-data-terms-of-use

## Published scale and update model

The GLEIF Golden Copy page listed the 2026-10-23 08:00 LEI-CDF 3.1 Golden Copy as 3,471,073 records. Golden Copies are provided three times daily (02:00, 10:00 and 18:00 UTC) with delta files for updates since earlier publication windows. JSON, XML and CSV formats are available. The first integration should use the public API (official Access Service) with bounded pagination and the publisher's pagination links, not scrape internal storage.

Official pages:
- https://www.gleif.org/en/lei-data/gleif-golden-copy/download-the-golden-copy
- https://www.gleif.org/en/lei-data/gleif-golden-copy
- https://www.gleif.org/en/lei-data/gleif-api

The LEI directory is a valuable global legal-entity reference dataset, but it is not a complete list of all businesses, SMEs, logistics providers or carriers. It must not be presented as comprehensive global company coverage.

## Source schema verified

The GLEIF LEI-CDF 3.1 specification defines, among others:
- 20-character LEI.
- Entity legal name and optional other/transliterated names.
- Legal address and headquarters address.
- Legal jurisdiction and registration authority.
- Optional entity category: `BRANCH`, `GENERAL`, `FUND`, `SOLE_PROPRIETOR`, `RESIDENT_GOVERNMENT_ENTITY`, `INTERNATIONAL_ORGANIZATION`.
- Entity status: `ACTIVE`, `INACTIVE` or `NULL`.
- Legal form and registration record with a separate registration status and reporting dates.

Official schema reference: https://www.gleif.org/en/lei-data/access-and-use-lei-data/level-1-data-lei-cdf-3-1-format

The public API uses JSON:API resources:
`data[].type = lei-records`, `data[].id`, `data[].attributes.lei`, `data[].attributes.entity`, and `data[].attributes.registration`.
Official API landing page: https://www.gleif.org/en/lei-data/gleif-api

## Conservative initial inclusion rules

For the first pilot, accept only:
- Valid 20-character LEIs with ISO 17442 check digit (mod 97 = 1).
- Non-empty entity legal names.
- A valid two-letter legal-address country code.
- `entity.status = ACTIVE`.
- `registration.status = ISSUED`.
- Explicit entity categories `GENERAL`, `RESIDENT_GOVERNMENT_ENTITY`, or `INTERNATIONAL_ORGANIZATION`.

Explicitly exclude:
- `SOLE_PROPRIETOR`: GLEIF describes this category as an individual acting in a business capacity.
- `BRANCH`: it is a branch of another legal entity, not a separate independent legal entity for this first catalogue.
- `FUND`: excluded from the first general-company catalogue cohort.
- Missing or unknown explicit category, inactive/null entity status, lapsed/retired/pending registration statuses, invalid country/name/LEI, and malformed timestamps.

This is deliberately a smaller, high-confidence company catalogue cohort. It does not try to maximize the count at the expense of entity-type ambiguity.

## Stored projection and privacy boundary

`functions/lib/gleif-normalizer.mjs` projects the following fields:
- `entity_id = global:lei:<LEI>`
- LEI, legal name, normalized name, two-letter country/jurisdiction
- legal form code, entity status + registration status, source last-update timestamp
- a compact `sourceRecord` allowlist containing LEI, legal name/language, country, jurisdiction, category, legal-form code, entity status and selected registration metadata.

The first-stage projection deliberately does **not** store:
- Legal/headquarters street addresses, postal codes or locality.
- `registeredAs` registration numbers.
- BIC/MIC identifiers.
- Other names, parent/child relationships or raw full source objects.
- Any director, contact, email, phone, personal-ID or beneficial-owner fields.

This removes address fields from the first pilot because a legal-entity address may in some cases coincide with a natural person's home address. Address enrichment can be considered later only with a separate field-level privacy review.

## Idempotency, provenance and quotas

- Stable entity ID and source-record ID: `global:lei:<LEI>` / `<LEI>`.
- Hash the strict allowlisted source projection, not the raw unfiltered API response.
- Keep retrieval time, source record update time, Golden Copy publish time, API pagination cursor/links, row counts and run status in the ingestion run/snapshot metadata.
- Use the published pagination links from the official API; do not construct hidden storage URLs, enumerate undocumented buckets, or bypass service restrictions.
- Start with a small Preview-only sample (maximum 25 accepted records per pilot run), then inspect skip/quarantine counts and D1 storage/write usage before extending batches.
- Do not download or store the full 3.47M-record Golden Copy in Workers KV. KV is reserved for compact manifests/checkpoints. Full bulk archive storage remains deferred while R2 is unavailable.
- The D1 source metadata row is approved for commercial reuse/redistribution, and its seed marks personal-data review not required only for the address-free, entity-category-filtered initial projection. Any future expansion to addresses, SOLE_PROPRIETOR, or extra raw fields must be re-reviewed and must not inherit this approval.
- No source records are inserted until the bounded API fetcher uses the official Access Service, the output has been checked against this specification, and a Preview-only run is approved and measured.

## Regression tests

- `functions/lib/gleif-normalizer.mjs`
- `scripts/gleif-normalizer-test.mjs`

Tests cover LEI checksum, name/country validation, active/issued state, allowed and excluded categories, unknown category rejection, and intentional omission of addresses and identifiers that might expose personal data.

The test is wired into package lint/check, CI syntax validation and the Datadog manual regression suite.
