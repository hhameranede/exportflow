# ExportFlow adapter rights and source audit — 2026-11-09

## Scope and evidence boundary

- Repository: hhameranede/exportflow.
- Audited production baseline: main commit d7d664deb69e28e4026605e57af22b2369cb2ec5.
- Verified Cloudflare Pages Production deployment: 38523e06-e6bb-4515-8dc4-ca967b1120fb, successful on 2026-11-09; alias https://exportflow.me. Live `/api/carriers` and `/api/coverage` returned HTTP 200; India Post was absent from both public outputs.
- Production dependency: universal-parcel-scraper@0.977.1, immutable upstream commit e64a466772ef25ce68e02d9c7c9f1613eec1208b.
- Production has 732 dedicated adapter implementations. The newer complete source-reference audit has 743; 11 of those are not in the production pin.

This is a source, terms and permission evidence audit, not a formal legal opinion. “Not established” and “not assessed” do not mean that a carrier has prohibited every use. Likewise, an open-source code licence does not grant permission to access carrier systems or redistribute shipment data.

## Source-code licence

The 743-row upstream code-license matrix classifies the adapter implementation files under the upstream root Apache-2.0 licence. The nested MIT exception under a carrier folder applies only to the Correios CAPTCHA model, not the whole adapter. Separate MIT model files and optional AGPL-3.0 TRAWL components are documented in docs/UPSTREAM_CODE_LICENSE_AUDIT.md; TRAWL is not part of ExportFlow's current Production package configuration.

Apache-2.0 permits reuse of the covered source code when its conditions are followed. It does not grant carrier API credentials, authorization to automate a carrier's website, carrier trademark rights, or rights to display and commercially redistribute shipment/customer data.

## Current pinned adapter inventory

| Measure | Production-pinned 732 |
|---|---:|
| Adapter directories in active dependency | 732 |
| Adapters with offline test definitions | 729 |
| Adapters without an offline test definition | 3 |
| Adapters with live-test definitions (not executed by this static audit) | 726 |
| Adapters without a live-test definition | 6 |
| Adapters with rights-release status not_cleared | 732 |
| Public recipient-display permission not_established | 732 |
| Commercial/advertising permission not_assessed | 732 |
| Retention/deletion requirements not_assessed | 732 |
| Carrier licence/source rights not independently assessed per adapter | 732 |

The improved 743-row static review classified the 732 production-pinned rows as follows:

| Static review status | Active adapters |
|---|---:|
| Source/route review needed | 630 |
| Unreviewed | 89 |
| Official API/contract evidence needed | 7 |
| Public route quarantined pending rights evidence | 4 |
| Merchant/account delegation needed | 2 |

These are workflow categories, not legal findings. Country variants and adapter aliases do not necessarily represent separate legal entities or separate contracts. The exact contracting entity has not been independently mapped for every adapter.

## Offline and security test inventory

- Offline test definitions exist for 729/732 active adapters; the full upstream inventory also has fixture material and parser/browser-specific tests.
- Live-test definitions exist for 726/732, but those are not executed because doing so would contact carrier systems and may require credentials, real parcel references or authorization. A test definition is not proof of permission or successful Production integration.
- Six adapters have runtime-source strings that match credential-like static patterns. These were treated as redacted manual-review flags, not confirmed valid secrets. No credential values are reproduced in this report.
- Tests and fixtures are classified separately from runtime source to avoid treating test strings as live credentials or live network behavior.

## Exact route restriction found

**India Post (india-post) — MySpeedPost route.**

The pinned upstream README and implementation show that this adapter calls myspeedpost.com/track and myspeedpost.com/livewire/update. The upstream README identifies MySpeedPost as a third-party tracker, not India Post's official tracking system.

MySpeedPost's published Terms of Service prohibit automated access by robots/spiders/other automated processes and restrict commercial reuse or redistribution of its content without prior written permission. No written permission for ExportFlow was evidenced in the reviewed records. This is a route-specific terms conflict; it is not a conclusion that India Post's official service or every India Post integration is prohibited.

**Remediation shipped:** PR #62 was merged into `main` at commit `d7d664deb69e28e4026605e57af22b2369cb2ec5` and Cloudflare Production deployment `38523e06-e6bb-4515-8dc4-ca967b1120fb` succeeded. The MySpeedPost-backed `india-post` route is rejected before any upstream request and is absent from the public catalog/coverage. The dependency remains intact for provenance. Reconsider only after written permission for the exact automated and commercial use, or a separately verified official India Post route.

## Other public-route quarantine findings

The following three public-route candidates still lacked evidence of permission for ExportFlow's hosted third-party display in the initial audit. A follow-up review of current terms clarified the restrictions below. The batch branch now holds all three from public tracking while evidence remains incomplete; this is a precautionary route hold, not a declaration that all carrier integrations are illegal:

- China Post — the pinned route uses the EMS app guest endpoint / browser route. No public developer entitlement or hosted third-party display authorization for ExportFlow was established. **Hold: unresolved rights, not a finding that China Post prohibits all API use.**
- Singapore Post — the adapter calls an anonymous JSON event endpoint. Current SingPost Terms of Use reserve proprietary website content and state no licence is granted to use or reproduce such IP; no API/public third-party display authorization was found. No separate blanket automated-access ban was established in this review. **Hold: display/reproduction rights not evidenced.**
- YunExpress — the current Yuntrack Terms of Use expressly state that site content/data may not be copied, disseminated, displayed, mirrored or downloaded without express written authorization; no ExportFlow authorization was evidenced. **Hold: written authorization required for the current site-data route.**

No blanket permission was established for the remaining adapters either. This audit therefore does not certify any of the 732 as rights-cleared for public commercial display.

## What was not done

- No outbound live carrier tests or shipment lookups were performed.
- No real tracking numbers or carrier credentials were used.
- No upstream adapter source was deleted from the third-party dependency.
- No production code, DNS, secrets, permissions, D1 migrations or Cloudflare configuration were changed.
- The India Post restriction is already merged and deployed. The additional China Post, Singapore Post and YunExpress holds are proposed together on isolated branch `fix/batch-quarantine-unlicensed-public-routes-20261109`; they have not been merged or deployed.

## Primary evidence

- ExportFlow source-code licence audit: docs/UPSTREAM_CODE_LICENSE_AUDIT.md.
- Per-adapter licence matrix: docs/UPSTREAM_ADAPTER_CODE_LICENSE_MATRIX.csv.
- Pinned upstream package: https://github.com/plhery/universal-parcel-scraper/tree/e64a466772ef25ce68e02d9c7c9f1613eec1208b.
- India Post route implementation: https://github.com/plhery/universal-parcel-scraper/tree/e64a466772ef25ce68e02d9c7c9f1613eec1208b/carriers/india-post.
- MySpeedPost Terms of Service: https://myspeedpost.com/terms-of-service.


## Batch public-route rights gate — 2026-11-09

### Production verification

- Main commit: `d7d664deb69e28e4026605e57af22b2369cb2ec5`.
- Cloudflare Pages deployment: `38523e06-e6bb-4515-8dc4-ca967b1120fb`, build and deploy succeeded; alias `https://exportflow.me`.
- Live public endpoints `/api/carriers` and `/api/coverage` returned HTTP 200. At this deployed revision, `india-post` is excluded and the coverage response reports `quarantinedCarrierCount: 1`.
- The batch follow-up is on branch `fix/batch-quarantine-unlicensed-public-routes-20261109`. It adds China Post, Singapore Post and YunExpress to the same pre-network quarantine gate as India Post, and updates the synthetic-only tracking and coverage tests. It is not merged or deployed.

### Batch route decisions

| Adapter | Source route / evidence | Decision | Legal characterization |
| --- | --- | --- | --- |
| `india-post` | Pinned adapter calls MySpeedPost; its Terms prohibit automated access and commercial reuse without prior written permission. | Already quarantined in Production. | Explicit route-specific terms conflict; not an India Post-wide finding. |
| `yunexpress` | Current Yuntrack Terms say the Site is `www.yuntrack.com`, require account registration for use of the service, reserve rights to Site content/data, and prohibit copying, disseminating, displaying, mirroring or downloading content without express written authorization. | Add to batch public-route quarantine. | Written permission required for this Site-data route; no ExportFlow authorization found. |
| `singapore-post` | Adapter calls `www.singpost.com/api/services/track-events`. SingPost Terms state no licence is granted to use or reproduce proprietary website IP. The reviewed terms do not establish a blanket ban on all automation. | Add to batch public-route quarantine pending an API/display grant. | Rights not evidenced; precautionary hold, not a proven automation prohibition. |
| `china-post` | Pinned adapter uses the EMS mobile-app guest endpoint and documents a browser/web-preview path. No public developer entitlement or third-party hosted-display authorization for ExportFlow was found. | Add to batch public-route quarantine pending written/API evidence. | Unresolved authorization; not a finding that China Post prohibits all official API use. |

Primary current terms:
- MySpeedPost: https://myspeedpost.com/terms-of-service
- Yuntrack Terms of Use: https://hk.yunexpress.com/terms-of-service/
- SingPost Terms of Use: https://www.singpost.com/terms-use
- China Postal Express & Logistics: https://www.11183.com.cn/english/

### Whole-inventory rights outcome remains unchanged

- Production package remains `universal-parcel-scraper@0.977.1`, pinned at `e64a466772ef25ce68e02d9c7c9f1613eec1208b`, with 732 dedicated adapters.
- Carrier API authorization, public recipient-facing display rights and commercial/advertising rights remain not cleared for all 732 in the current evidence ledger. The quarantined routes are not the only routes awaiting review.
- The Apache-2.0 root code licence covers the applicable software code subject to its conditions and notices; it does not grant access to carrier systems, redistribution of carrier content, trademarks or shipment-data display rights.
- A separate 743-row reference inventory was generated from upstream `universal-parcel-scraper@0.1010.2`, commit `9c088edaa089135b89658f2b611f8a741d5238c6`. It includes all 732 IDs from the pinned ExportFlow version plus 11 newer IDs. Static code indicators from that newer snapshot are a review overlay, not proof of the exact deployed source behavior. Draft PRs #56 and #57 propose further classifier corrections and remain unmerged.
- Six runtime-source credential-like patterns remain redacted manual-review flags, not confirmed live credentials or access violations. No values are reproduced.

This remains an engineering/terms evidence audit, not a formal legal opinion. Do not mark an adapter as licensed until the exact route, legal entity, account scope, automated access, recipient display, commercial use, and retention/deletion rights are documented.
