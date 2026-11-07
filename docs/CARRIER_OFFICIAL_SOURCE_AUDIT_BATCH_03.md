# Carrier official-source audit — batch 03

**Review date:** 2026-11-07  
**Scope:** The final two records in the existing 22-provider D1 evidence overlay.

## Results

- China Post: official company contact page confirms the correct public tracking destinations for international letters/parcels and EMS.
- YunExpress: official website and tracking workflow identified; its business API documentation portal is visible, but API content is account/login restricted in this check.
- Both remain **Research**. Neither is treated as an open tracking API or an authorized ExportFlow integration.

## Per-provider evidence

| Provider | Primary source | What it establishes | Boundary / remaining work |
| --- | --- | --- | --- |
| China Post | [China Post — Contact Us](https://iframe.chinapost.com.cn/en/category/1408/3925-1.htm) | China Post directs international letters/parcels to its international postal tracker and international EMS tracking to the EMS website. | Official public trackers are not proof of a developer API; no current open China Post tracking API was established. Existing upstream EMS-based adapter is not a permission grant. |
| YunExpress | [YunExpress AWB Tracking Platform](https://www.yunexpress.com/resource/shipment-tracking) | The company-owned website exposes its AWB Tracking Platform and identifies the operating company. | The separate business API documentation portal is login-protected and was not independently reviewed. No ExportFlow credentials, service-provider approval or third-party data-display rights are recorded. |

## D1 evidence status

Migration `0007_carrier_official_source_research_batch_03.sql` updates the two remaining source URLs and dated research notes. Both remain:

- `evidence_status = research`
- `verification_method = none`
- `verified_at = NULL`
- `verification_evidence_url = NULL`
- `authorization_evidence_url = NULL`

## Completion of the seeded source-review queue

Together with batches 01 and 02, all **22 of 22 records** in the current D1 evidence registry now have a dated, carrier-owned or government-owned primary source reference. This is completion of the seeded research overlay only. It does not mean the sources all expose APIs: public tracking pages, login-protected business portals and open developer APIs are separately classified. It also does not mean any record is Testing, Integrated or Verified, or that ExportFlow has permission to call an API or republish third-party shipment data. All 22 remain Research until the applicable carrier terms, customer delegation and test/authorization evidence are recorded.
