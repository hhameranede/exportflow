# ExportFlow — upstream connector code-license audit

**Reviewed:** 2026-11-09  
**Purpose:** classify licenses for the upstream carrier adapter source code used by ExportFlow, separately from carrier API, website, trademark and shipment-data permissions.  
**Status:** Source-license inventory completed for two immutable upstream snapshots. This is not a formal legal opinion or a full copyright-provenance audit.

## Executive conclusion

The upstream project's root `LICENSE` and package metadata declare its core code under **Apache-2.0**. The audit found no separate code-license file in any carrier adapter folder that replaces the root license. Therefore the 743 dedicated adapter implementations inherit the project's Apache-2.0 source-code license, subject to the license conditions and the separately identified embedded material.

There is one nested license inside a carrier folder: `carriers/correios-br/model/LICENSE`. It applies to the embedded Correios CAPTCHA model only; the `correios-br` adapter implementation itself remains under the root Apache-2.0 classification.

The optional TRAWL browser service is separately **AGPL-3.0**. It is not one of the 743 adapter folders, is excluded from the upstream package `files` list and is not copied into the core `dist` by the upstream build script. ExportFlow's current Production configuration did not contain `EXPORTFLOW_TRAWL_URL`. Do not include or enable TRAWL without a separate AGPL review.

**Conclusion for your question:** owning the source code is not required; the Apache-2.0 license grants permission to use, modify and commercially distribute the covered adapter code if its obligations are followed. It does not grant permission to use carrier APIs, automate carrier websites, use trademarks, or redisplay shipment/customer data. Those are separate legal/contractual questions.

## Exact snapshots examined

| Purpose | Version | Immutable commit | Dedicated adapters |
| --- | --- | --- | ---: |
| Actually pinned by ExportFlow `main` | 0.977.1 | [`e64a466772ef25ce68e02d9c7c9f1613eec1208b`](https://github.com/plhery/universal-parcel-scraper/commit/e64a466772ef25ce68e02d9c7c9f1613eec1208b) | 732 |
| Later 743-adapter audit snapshot | 0.1010.2 | [`9c088edaa089135b89658f2b611f8a741d5238c6`](https://github.com/plhery/universal-parcel-scraper/commit/9c088edaa089135b89658f2b611f8a741d5238c6) | 743 |

Both Git trees were complete (not truncated). Both snapshots contain the same seven license/notice-related file paths with identical blob SHAs.

### Historical source repository cross-check

The upstream NOTICE says that Universal Parcel Scraper contains code extracted from `plhery/delivery-tracker`. GitHub now resolves the successor project as [`plhery/peek-delivery-tracker`](https://github.com/plhery/peek-delivery-tracker). Its repository metadata declares Apache-2.0, and its root LICENSE has blob SHA `261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64`, exactly matching the root LICENSE blob in both Universal Parcel Scraper snapshots. This independently corroborates the Apache-2.0 license for the named historical source project. It still does not prove a complete contributor-by-contributor chain of title or rule out separate private agreements.

The attached [`UPSTREAM_ADAPTER_CODE_LICENSE_MATRIX.csv`](UPSTREAM_ADAPTER_CODE_LICENSE_MATRIX.csv) maps every one of the 743 adapter IDs and marks which 732 occur in ExportFlow's actual pinned runtime dependency.

## Per-adapter result

- 743 unique adapter folders were enumerated in the later audit snapshot.
- No carrier adapter folder contains its own `LICENSE`, `LICENCE`, `NOTICE`, `COPYING` or `COPYRIGHT` file except the nested Correios CAPTCHA model license.
- All 743 adapter implementations are therefore classified under the root Apache-2.0 project license; the Correios model is an MIT-licensed subcomponent.
- 732 of these adapter IDs are present in ExportFlow's current pinned dependency; 11 exist only in the later 743-reference snapshot.

## Exact upstream license/notice paths

| Path | License / classification | Scope |
| --- | --- | --- |
| [`LICENSE`](https://github.com/plhery/universal-parcel-scraper/blob/9c088edaa089135b89658f2b611f8a741d5238c6/LICENSE) | Apache-2.0 | Root/core project and adapter implementation code |
| [`NOTICE`](https://github.com/plhery/universal-parcel-scraper/blob/9c088edaa089135b89658f2b611f8a741d5238c6/NOTICE) | Third-party attributions | Records nested model and data licenses |
| [`carriers/correios-br/model/LICENSE`](https://github.com/plhery/universal-parcel-scraper/blob/9c088edaa089135b89658f2b611f8a741d5238c6/carriers/correios-br/model/LICENSE) | MIT | Correios CAPTCHA model only |
| [`core/transport/text-captcha-model/LICENSE`](https://github.com/plhery/universal-parcel-scraper/blob/9c088edaa089135b89658f2b611f8a741d5238c6/core/transport/text-captcha-model/LICENSE) | MIT | Text CAPTCHA model only |
| [`trawl/LICENSE`](https://github.com/plhery/universal-parcel-scraper/blob/9c088edaa089135b89658f2b611f8a741d5238c6/trawl/LICENSE) | AGPL-3.0 | Optional TRAWL browser-service derivative |
| `trawl/license.mjs` | AGPL-3.0 component | TRAWL license-text generation helper |
| `trawl/license.test.mjs` | AGPL-3.0 component | TRAWL license-generation test |

The upstream TRAWL source note identifies it as a derivative of germondai/trawl and says release builds attach the upstream and patch source archives. It also identifies ddddocr (MIT) and RapidOCR (Apache-2.0) components inside that optional image.

## TRAWL and Production

The upstream package manifest lists `dist`, `data`, `README.md`, `LICENSE` and `NOTICE` in its package `files` list; it does not list `trawl/`. The upstream build script copies `carriers`, `providers`, `places` and `core/transport` into `dist`, not the TRAWL folder. ExportFlow's `functions/api/track.js` accepts an optional `EXPORTFLOW_TRAWL_URL`, and the current Cloudflare Production environment configuration inspected on 2026-11-09 did not contain that variable.

Thus there is no evidence that the current Production Worker is using a TRAWL service. If a modified AGPL-3.0 TRAWL service is later exposed over a network, AGPL section 13 must be reviewed; it includes a source-offer obligation for users interacting with the modified version over a network.

## Data licenses named by upstream NOTICE — separate from code licenses

| Material | License | Scope |
| --- | --- | --- |
| GeoNames gazetteer and US ZIP-code areas | CC BY 4.0 | Attribution conditions for the identified data |
| OpenStreetMap facility coordinates | ODbL-1.0 | Attribution and database obligations may apply |
| Natural Earth country label points | Public domain | As identified by upstream NOTICE |
| OurAirports airport data | Public domain | As identified by upstream NOTICE |
| Indian PIN-code towns | Government Open Data License - India | Source attribution and reuse terms apply |

These are data/database licenses, not the license governing adapter source code. The upstream places module is described as Node-only. ExportFlow's Worker build falls back when filesystem-backed place files are unavailable, and ExportFlow's README describes its map as using carrier-supplied scan coordinates rather than geocoding recipient addresses. The presence of these datasets upstream is not proof that they are active in Production.

## ExportFlow locked production npm dependency graph

The current main `package-lock.json` contains 33 production dependency entries with declared license metadata for all 33:

| Declared license | Packages |
| --- | ---: |
| MIT | 18 |
| BSD-2-Clause | 10 |
| ISC | 2 |
| BSD-3-Clause | 1 |
| Unlicense | 1 |
| Apache-2.0 | 1 |
| **Total** | **33** |

No GPL/AGPL/SSPL-style license is declared in those lockfile entries. This is metadata extracted from the lockfile, not a manual review of every dependency's complete license text.

| Package | Locked version | Declared license |
| --- | --- | --- |
| `boolbase` | 1.0.0 | ISC |
| `cheerio` | 1.2.0 | MIT |
| `cheerio-select` | 2.1.0 | BSD-2-Clause |
| `cheerio/node_modules/undici` | 7.30.2 | MIT |
| `css-select` | 5.2.2 | BSD-2-Clause |
| `css-what` | 6.2.2 | BSD-2-Clause |
| `dom-serializer` | 2.0.0 | MIT |
| `domelementtype` | 2.3.0 | BSD-2-Clause |
| `domhandler` | 5.0.3 | BSD-2-Clause |
| `domutils` | 3.2.2 | BSD-2-Clause |
| `encoding-sniffer` | 0.2.1 | MIT |
| `entities` | 4.5.0 | BSD-2-Clause |
| `fetch-cookie` | 3.2.0 | Unlicense |
| `htmlparser2` | 10.1.0 | MIT |
| `htmlparser2/node_modules/entities` | 7.0.1 | BSD-2-Clause |
| `iconv-lite` | 0.6.3 | MIT |
| `luxon` | 3.7.2 | MIT |
| `nth-check` | 2.1.1 | BSD-2-Clause |
| `parse5` | 7.3.0 | MIT |
| `parse5-htmlparser2-tree-adapter` | 7.1.0 | MIT |
| `parse5-parser-stream` | 7.1.2 | MIT |
| `parse5/node_modules/entities` | 6.0.1 | BSD-2-Clause |
| `safer-buffer` | 2.1.2 | MIT |
| `saxes` | 6.0.0 | ISC |
| `set-cookie-parser` | 2.7.3 | MIT |
| `tldts` | 7.4.19 | MIT |
| `tldts-core` | 7.4.20 | MIT |
| `tough-cookie` | 6.0.2 | BSD-3-Clause |
| `undici` | 8.12.4 | MIT |
| `universal-parcel-scraper` | 0.977.1 | Apache-2.0 |
| `whatwg-encoding` | 3.1.1 | MIT |
| `whatwg-mimetype` | 4.0.0 | MIT |
| `xmlchars` | 2.2.0 | MIT |

## Obligations and sources

- **Apache-2.0:** permits use, modification and commercial distribution, subject to conditions. Redistribution requires including a license copy, retaining applicable notices/attributions, marking modified files and reproducing applicable NOTICE attributions appropriately.
- **MIT:** permits use, copying, modification, distribution, sublicensing and sale, provided the copyright and permission notice accompany copies or substantial portions of the covered software.
- **AGPL-3.0:** applies to optional TRAWL, not the 743 core adapter implementations.
- **CC BY / ODbL / Government Open Data License - India:** apply to specifically attributed data assets, not to adapter source code.

Official references: [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0.html), [MIT](https://opensource.org/license/MIT), [AGPL-3.0](https://opensource.org/license/agpl-3-0), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), [Government Open Data License - India](https://data.gov.in/Godl).

## Distribution packaging status — Build and CI verified; Production publication pending

A read-only scan of ExportFlow `main` found no root `LICENSE` or `NOTICE`. No root LICENSE was added: this audit does not relicense ExportFlow's original source code. Instead, Draft PR #59 adds a source-level `THIRD_PARTY_NOTICES.md` and a build step that creates a dedicated third-party notice package.

The build now:
- Reads every `node_modules/*` entry in the frozen package lock (33 entries at the audited lock version), checks the installed package version and declared license against the lockfile, and stops on missing/mismatched metadata.
- Copies every discovered upstream/package LICENSE, LICENCE, UNLICENSE, COPYING and NOTICE file into `dist/licenses/packages/`. A package may not pass unless at least one license-text file is present in its archive or in an explicit provenance-labelled fallback.
- Generates `dist/licenses/manifest.json` with the exact package/version, declared license, source path/provenance, applicable source URL/commit/blob/npm gitHead, whether the source-to-release match is verified, byte length and SHA-256.
- Generates a public `/licenses/` page with canonical URL, the upstream Apache LICENSE and NOTICE, links to each package's license texts, and explicit disclosure for verified/unverified repository fallbacks. The page is linked from the footer and included in the sitemap.
- Preserves the two MIT model LICENSE files nested within the upstream package, as well as the upstream NOTICE's data attributions.
- Adds prominent `Modified by ExportFlow for Cloudflare Workers` comments to every Worker-specific upstream file changed by the build and publishes `/licenses/EXPORTFLOW_MODIFICATIONS.md`. Build-time verification checks the comments exist in all changed source files.

Two npm archives omit a license text file despite declaring ISC in metadata. Both are handled explicitly and remain visible in the generated manifest:
- `boolbase@1.0.0`: repository fallback from commit `54811f01c797a6bb1c263183ae90b7dd627e0638`; the npm-reported gitHead could not be resolved, so exact historical source matching is **not verified**.
- `saxes@6.0.0`: repository fallback from npm gitHead/release commit `211fa0ebec9b628affc09219199639887174bfc3`; exact source commit and LICENSE blob match are verified.

**CI verification:** [Run #532](https://github.com/hhameranede/exportflow/actions/runs/42547420784) completed successfully across frozen npm install, JavaScript syntax, regression tests, license-staging Build, canonical/hreflang/sitemap checks, Wrangler Pages Functions bundle, and public artifact checks. This proves the generated preview Build output in CI contained the expected notices and hashes.

**Publication boundary:** PR #59 remains Draft/open/unmerged. Production remains on the existing `main` commit; `/licenses/` is not claimed to be live on the public site until a separately approved merge and Production deployment.

## Completion status and limitations

**Completed:** immutable tree enumeration for both snapshots; extraction and SHA comparison of all seven license/notice paths; effective license mapping for all 743 IDs; determination of the 732 currently pinned IDs; manual reading of root LICENSE/NOTICE, both nested MIT licenses, TRAWL AGPL license/source note; inspection of package manifest/build-copy rules, ExportFlow tracking function and Production environment variable names; extraction of all 33 production dependency license declarations.

**Not a formal legal sign-off:** the 33 npm package license texts are now copied and SHA-256 checked in the CI Build, but every package's full legal terms and notices have not been manually analysed clause-by-clause. The `boolbase@1.0.0` fallback is explicitly not a proven historical match to that published npm release. The public upstream tree has no CLA/DCO; separate private agreements and contributor-by-contributor chain of title require confirmation from the rights holder. Carrier API access, website automation, trademarks and shipment-data display/reuse remain separate and are not authorized by this source-license report.


### npm archives with missing license text

Two locked packages in the current dependency graph declare a license in npm metadata but omit the license text from their packed tarballs. The build supplies explicit, provenance-labelled repository fallbacks:

- `boolbase@1.0.0` (ISC): the npm archive omits LICENSE. Registry metadata reports gitHead `68dff5fbe60c51eb37725ea9e3ed310dcc1e776e`, which GitHub did not resolve. We include the ISC text from the source repository at commit `54811f01c797a6bb1c263183ae90b7dd627e0638`, but the exact historical match to that npm release is **not verified**.
- `saxes@6.0.0` (ISC): npm registry gitHead `211fa0ebec9b628affc09219199639887174bfc3` resolves in GitHub as the 6.0.0 release commit. Its LICENSE blob `187f3ba399862022f4e670b2a3a1dbc6d7e6a800` is included intact; exact source commit match is verified.

Both fallbacks are explicitly marked in the generated manifest with source URL, source commit, blob SHA, npm gitHead, SHA-256 of the delivered text and a Boolean provenance-match field. The public notices page distinguishes verified from unverified fallbacks.


## Contributor and copyright-chain evidence boundary

The upstream tree at the audited immutable commit contains no file or path matching a Contributor License Agreement (CLA), Developer Certificate of Origin (DCO), or contributor assignment agreement. The root Apache-2.0 License section 5 states that contributions intentionally submitted for inclusion are under Apache-2.0 unless the contributor explicitly states otherwise, and it preserves any separate license agreement already executed with the licensor. This is the public repository's stated contribution basis; it does **not** prove that no private side agreement exists or independently establish every contributor's authority for every historical source file. A final copyright-chain sign-off would require confirmation from the upstream rights holder and review of any separate agreements.
