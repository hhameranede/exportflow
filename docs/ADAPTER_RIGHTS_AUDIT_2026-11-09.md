# ExportFlow adapter rights and source audit — 2026-11-09

## Scope and evidence boundary

- Repository: hhameranede/exportflow.
- Audited production baseline: main commit f287ec99a31eb0963f6d66ff2499850be7566258.
- Verified Cloudflare Pages Production deployment: 17b27b8f-52ba-4b9b-8bfc-e117e6708972, successful on 2026-11-09; alias https://exportflow.me.
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

**Remediation in this branch:** disable the MySpeedPost-backed india-post route before any upstream request, and remove this ID from ExportFlow's public carrier catalog and coverage response. The upstream dependency itself is retained for audit/provenance purposes. The route may be reconsidered only after written permission for the exact automated and commercial use is evidenced, or after a separately verified official India Post route is implemented.

## Other public-route quarantine findings

The following three public-route candidates still lack evidence of permission for ExportFlow's hosted third-party display. The audit did not find equivalent explicit terms prohibitions in the material reviewed, so these remain **unresolved**, not labelled illegal:

- China Post — guest app API / browser flow; public developer entitlement not established.
- Singapore Post — anonymous JSON tracking endpoint; public API entitlement not established.
- YunExpress — Yuntrack/browser capture route; automated access and public display rights not cleared.

No blanket permission was established for the remaining adapters either. This audit therefore does not certify any of the 732 as rights-cleared for public commercial display.

## What was not done

- No outbound live carrier tests or shipment lookups were performed.
- No real tracking numbers or carrier credentials were used.
- No upstream adapter source was deleted from the third-party dependency.
- No production code, DNS, secrets, permissions, D1 migrations or Cloudflare configuration were changed.
- The India Post route restriction is proposed on an isolated review branch only; Production remains unchanged until an explicitly approved merge and deployment.

## Primary evidence

- ExportFlow source-code licence audit: docs/UPSTREAM_CODE_LICENSE_AUDIT.md.
- Per-adapter licence matrix: docs/UPSTREAM_ADAPTER_CODE_LICENSE_MATRIX.csv.
- Pinned upstream package: https://github.com/plhery/universal-parcel-scraper/tree/e64a466772ef25ce68e02d9c7c9f1613eec1208b.
- India Post route implementation: https://github.com/plhery/universal-parcel-scraper/tree/e64a466772ef25ce68e02d9c7c9f1613eec1208b/carriers/india-post.
- MySpeedPost Terms of Service: https://myspeedpost.com/terms-of-service.
