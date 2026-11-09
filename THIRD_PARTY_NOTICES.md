# Third-party software notices

This repository uses third-party software under the package-specific licenses recorded in package-lock.json. The root ExportFlow application is not relicensed by those dependencies.

The build generates a public /licenses/ page and copies the exact license and notice files found in each installed package to dist/licenses/packages/. It also emits dist/licenses/manifest.json with the exact locked package version, declared license metadata, copied license-file paths, and SHA-256 hashes. Worker-specific files patched by ExportFlow carry prominent modification comments, with the changes summarized in dist/licenses/EXPORTFLOW_MODIFICATIONS.md.

The Universal Parcel Scraper dependency is pinned to commit e64a466772ef25ce68e02d9c7c9f1613eec1208b (version 0.977.1) and declares Apache-2.0. Its upstream LICENSE and NOTICE are included in the build output. Nested model license files are preserved when present in the package distribution.

The optional upstream TRAWL component is AGPL-3.0 and is not included or configured in the current ExportFlow production deployment. Do not enable or deploy it without a separate license and architecture review.

Data attribution notices identified by the upstream NOTICE (GeoNames CC BY 4.0, OpenStreetMap ODbL-1.0, Natural Earth and OurAirports public domain, and Government Open Data License - India) are identified separately from source-code licenses. The existence of an upstream data attribution does not establish that the dataset is used in ExportFlow production.

Software licenses do not grant carrier API access, automated website access permissions, carrier trademarks, or shipment-data display/reuse rights. Those remain separate subjects in the restricted Carrier Rights & Licensing Ledger.

The build intentionally does not add a root LICENSE to ExportFlow, because this audit does not declare ExportFlow's original source code to be Apache-2.0.


## Explicit repository-license fallback

The npm archive for `boolbase@1.0.0` declares `ISC` in package metadata but contains no license text file. The build therefore copies the ISC license text from [fb55/boolbase LICENSE at commit 54811f01c797a6bb1c263183ae90b7dd627e0638](https://github.com/fb55/boolbase/blob/54811f01c797a6bb1c263183ae90b7dd627e0638/LICENSE). The NPM version metadata reported gitHead `68dff5fbe60c51eb37725ea9e3ed310dcc1e776e`, which GitHub did not resolve; the fallback is explicitly labelled as **not proven to be the exact historical source file for the published release**. This evidence gap is retained in `licenses/manifest.json` and the public notice page.


The upstream NOTICE identifies extracted code from the historical `plhery/delivery-tracker` project. Its current successor, [`plhery/peek-delivery-tracker`](https://github.com/plhery/peek-delivery-tracker), declares Apache-2.0 and its root LICENSE has the same Git blob SHA as the Universal Parcel Scraper root LICENSE. This is corroborating source-license evidence, not a full contributor chain-of-title review.


## Exact source fallback for saxes

The npm archive for `saxes@6.0.0` declares ISC but omits the license text. The npm registry reports `gitHead` `211fa0ebec9b628affc09219199639887174bfc3`; GitHub resolves that exact commit as the 6.0.0 release commit. Its [LICENSE file](https://github.com/lddubeau/saxes/blob/211fa0ebec9b628affc09219199639887174bfc3/LICENSE) (blob `187f3ba399862022f4e670b2a3a1dbc6d7e6a800`) is copied intact, including the historical ISC notice for its `sax` origin and an MIT attribution for a previously used helper. The manifest marks this repository fallback as an exact npm gitHead match.
