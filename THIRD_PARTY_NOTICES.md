# Third-party software notices

This repository uses third-party software under the package-specific licenses recorded in package-lock.json. The root ExportFlow application is not relicensed by those dependencies.

The build generates a public /licenses/ page and copies the exact license and notice files found in each installed package to dist/licenses/packages/. It also emits dist/licenses/manifest.json, recording the exact locked package version, declared license metadata, and copied license-file paths.

The Universal Parcel Scraper dependency is pinned to commit e64a466772ef25ce68e02d9c7c9f1613eec1208b (version 0.977.1) and declares Apache-2.0. Its upstream LICENSE and NOTICE are included in the build output. Nested model license files are preserved when present in the package distribution.

The optional upstream TRAWL component is AGPL-3.0 and is not included or configured in the current ExportFlow production deployment. Do not enable or deploy it without a separate license and architecture review.

Data attribution notices identified by the upstream NOTICE (GeoNames CC BY 4.0, OpenStreetMap ODbL-1.0, Natural Earth and OurAirports public domain, and Government Open Data License - India) are identified separately from source-code licenses. The existence of an upstream data attribution does not establish that the dataset is used in ExportFlow production.

Software licenses do not grant carrier API access, automated website access permissions, carrier trademarks, or shipment-data display/reuse rights. Those remain separate subjects in the restricted Carrier Rights & Licensing Ledger.

The build intentionally does not add a root LICENSE to ExportFlow, because this audit does not declare ExportFlow's original source code to be Apache-2.0.
