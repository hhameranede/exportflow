# Singapore ACRA company-register import specification

**Review date:** 2026-11-07  
**Source:** [ACRA Entities Registered with ACRA](https://data.gov.sg/datasets/d_3f960c10fed6145404ca7b821f263b87/view)  
**Source ID:** `acra-singapore-entities`  
**Decision:** parser and normalizer implemented; ingestion remains blocked pending source-level privacy review.

## Publisher schema confirmed

The official data.gov.sg page lists the CSV `EntitiesRegisteredwithACRA.csv` with 2.1 million rows (October 2026 release; 223.4 MB) and these eight columns:

| CSV/API field | Published meaning | Handling |
|---|---|---|
| `uen` | Unique Entity Number | Required stable source/native registry ID |
| `issuance_agency_desc` | Issuance agency | Preserve as source metadata |
| `uen_status_desc` | UEN status | Only `Registered` is eligible |
| `entity_name` | Entity name | Required legal name; preserve original spelling |
| `entity_type_desc` | Entity type | Strict allowlist below |
| `uen_issue_date` | UEN issue date | Require ISO `YYYY-MM-DD` |
| `reg_street_name` | Registered street name | Keep only in source provenance; this is not a complete street address |
| `reg_postal_code` | Registered postal code | Optional postal code |

The source's current explorer shows the main types as Sole Proprietorship/Partnership, Local Company, Limited Liability Partnership and Foreign Company Branch, plus one additional type. The percentage mix is approximately 49.2% sole proprietorship/partnership, 48.3% local company, 2.0% LLP and 0.4% foreign branch in the October 2026 source display. Unknown/future values must fail closed.

## Conservative inclusion policy

Include only records satisfying all of the following:
- `entity_type_desc` is exactly `Local Company` or `Limited Liability Partnership` (case-insensitive after normalization).
- `uen_status_desc` is `Registered`.
- UEN matches the bounded alphanumeric identifier validator.
- Entity name is non-empty.
- UEN issue date is a valid ISO date.

Exclude:
- Sole Proprietorship/Partnership (contains natural-person/sole-trader records).
- Foreign Company Branch (not a Singapore-incorporated company record).
- Any other entity type not explicitly reviewed.
- Deregistered or unknown statuses.
- Malformed rows, missing UEN/name, or invalid date.

No director, officer, beneficial-owner, email, phone, national ID or personal contact fields are selected or copied. The source file currently has only eight fields; the strict projection prevents future extra fields from leaking into normalized rows.

## Normalized D1 projection

The current helper `functions/lib/acra-normalizer.mjs` produces an `company_entities` projection:
- `entity_id = sg:acra:<UEN>`
- `legal_name`, case-preserving
- `normalized_name`, Unicode NFKC, whitespace-collapsed, lowercase
- `jurisdiction = SG`, `country_code = SG`
- `registry_identifier = UEN`
- `legal_form = Local Company | Limited Liability Partnership`
- `entity_status = registered`
- `postal_code`, if present
- `registered_address = NULL` because street name alone is not the full address
- no website, industry code, locality, director/contact or beneficial-owner fields inferred

The paired `sourceRecord` object is a strict eight-field allowlist retaining source provenance. It is not yet inserted into D1.

## Rights and operational gates

- The metadata registry records Singapore Open Data Licence 1.0, commercial use and redistribution at the dataset level, and required attribution.
- The licence excludes personal data and third-party rights; API access must also follow data.gov.sg terms.
- Source metadata remains `ingestion_status=candidate` and `personal_data_review_status=pending`. Do not change those flags merely because a parser test passes.
- No ACRA source-record or company-entity rows have been imported. A successful mapping test is not a live source validation or a blanket legal determination.
- Before enabling ingestion, complete the privacy review for the two allowed entity types, obtain a small official sample, verify no personal-nature edge cases, attach the dated attribution text, and approve the source in Preview only.
- The CSV is around 223 MB and refreshed monthly; do not store the full raw file in Workers KV. KV is reserved for compact manifests/checkpoints. Large raw snapshots remain deferred while R2 is unavailable. D1 free-tier capacity and daily write quotas must be measured before any full import.

## Code and regression tests

- `functions/lib/acra-normalizer.mjs`: strict allowlist mapper.
- `scripts/acra-normalizer-test.mjs`: tests local company and LLP inclusion; sole trader, partnership, foreign branch, unknown type, deregistered status, missing fields and invalid date exclusion; confirms no personal/contact field copying.
- The test is included in `npm run check`, `npm test` (Datadog manual suite), package lint and CI syntax checks.

## Official evidence

- [ACRA dataset page and schema](https://data.gov.sg/datasets/d_3f960c10fed6145404ca7b821f263b87/view)
- [Singapore Open Data Licence 1.0](https://developers.data.gov.sg/open-data-licence)
- [data.gov.sg API/privacy terms](https://developers.data.gov.sg/privacy-and-terms)
