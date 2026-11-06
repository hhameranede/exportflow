# Global carrier expansion backlog

This backlog records carriers with an official tracking entry point that were not found as dedicated adapter IDs in the pinned upstream registry checked for ExportFlow's coverage expansion (Universal Parcel Scraper commit `c61efbf18b780f3d3b8764a5847520c69a28f212`).

**Important:** absence from the dedicated-adapter registry does not prove that a shipment cannot be returned by UPU or another enabled fallback. A tracking webpage is not proof of a public API. Every integration must pass live tests before it is counted as direct coverage.

## Priority A — Arab countries

| Country | Operator / service | Official tracking entry point | Integration notes |
| --- | --- | --- | --- |
| Bahrain | Bahrain Post / eGovernment postal tracking | https://services.bahrain.bh/wps/portal/en/BSP/GSX-UI-EServiceDetails?esID=215 | Official eService supports registered mail, parcels and express mail. Public API contract not confirmed; inspect service flow or request government integration access. |
| Oman | Oman Post | https://www.omanpost.om/track-trace | Official tracking form. Public API contract not confirmed; inspect form submission and terms before implementation. |
| Kuwait | Ministry of Communications shipment tracking | https://www.moc.gov.kw/ar/shipment-tracking | Official shipment-tracking service. Confirm which postal/courier services it covers and whether an API is available. |
| Mauritania | MAURIPOST | https://mauripost.mr/ | Official tracking form accepts postal S10-style references and states that parcel tracking uses the UPU network. Prefer UPU handoff validation before building a separate scraper. |

## Priority A — African countries

| Country | Operator | Official tracking entry point | Integration notes |
| --- | --- | --- | --- |
| Zambia | ZAMPOST | https://www.zampost.com.zm/track | Official tracker documents 13-character IDs for EMS (EE), parcels (CP) and registered mail (RR). Candidate for a dedicated adapter. |
| Uganda | Posta Uganda | https://web.ugapost.go.ug/ | Official portal exposes package tracking. Inspect the public request flow and test with a public sample before implementing. |
| Benin | La Poste du Bénin | https://laposte.bj/ | Official site exposes item tracking. No current public developer API specification confirmed; determine if the portal is accessible server-side. |
| Senegal / West Africa | Yobante Express | https://yobante-express--yobante-express-2026-prod.us-central1.hosted.app/en | Current portal advertises real-time tracking and a business API with webhooks. Partner approval and credentials may be required; validate the domain and API contract with the company. |
| Nigeria | Kwik Delivery | https://kwik.delivery/home/developer/ | Official API documentation is published for merchants/businesses. Obtain partner credentials and permission for shipment tracking; do not assume anonymous lookups are supported. |
| Malawi | Malawi Posts Corporation | https://www.malawipost.post/ | National operator candidate. A public tracking endpoint was not confirmed in this research; contact the operator before attempting integration. |

## Priority B — Asian countries

| Country | Operator | Official tracking entry point | Integration notes |
| --- | --- | --- | --- |
| Cambodia | Cambodia Post | https://www.cambodiapost.com.kh/tracking/search | Official tracking form. Test server-side access and inspect terms before writing an adapter. |
| Brunei | PosBru | https://posbru.com.bn/ | Official site exposes Track & Receive. The destination service and public API contract need validation. |
| Sri Lanka | Koombiyo Delivery | https://koombiyodelivery.lk/track | Tracking form requires a tracking ID and the registered mobile number; handle the phone number as recipient data and never log it. |

## Priority B — American countries

| Country | Operator | Official tracking entry point | Integration notes |
| --- | --- | --- | --- |
| Bolivia | Correos de Bolivia / TrackingBO | https://trackingbo.correos.gob.bo/ | Official national and international tracker currently presents a security CAPTCHA. Do not bypass it; request an API or approved partner channel. |
| Costa Rica | Correos de Costa Rica | https://correos.go.cr/ | Official website offers guide-number tracking. Inspect the public submission flow and terms before implementation. |
| Brazil | Sequoia Logística | https://sequoialog.com.br/rastreamento/ | Tracker accepts a tracking/order code or CPF/CNPJ. Avoid collecting or forwarding national ID data without a clear, secure and disclosed requirement. |
| Ecuador | Tramaco Express | https://www.tramaco.com.ec/rastreo.html | Official guide-number tracker. Inspect server-side access and request an API contract if the portal blocks automation. |

## Deferred / access-limited

| Country | Operator | Official entry point | Reason to defer |
| --- | --- | --- | --- |
| Fiji | Post Fiji | https://www.postfiji.com.fj/VPO/Tracking.aspx | The portal was reported as under construction during research; recheck before integration. |

## Implementation gates

1. Confirm that the candidate is absent from the current dedicated-adapter registry and identify whether UPU already returns usable history.
2. Establish an official API, an approved public endpoint, or a stable non-authenticated tracking form. Never reverse-engineer or bypass CAPTCHA, authentication, rate limits, or access controls.
3. Define number formats, required recipient inputs, privacy handling, source attribution, event stage mapping and timestamp timezone.
4. Add offline parser/adapter tests with synthetic fixtures, then run live canaries only with public test references or numbers the operator has authorized.
5. Count a country as **directly covered** only when a selectable carrier has a dedicated automatic adapter for it. Keep UPU/universal fallback-only and link-only support separate in `GET /api/coverage`.

## Current implementation

- ExportFlow continues to use Universal Parcel Scraper as its tracking engine.
- The expansion branch upgrades the pinned engine and adds a country coverage endpoint and a gate requiring at least 100 countries with a dedicated automatic adapter.
- No carrier listed above is claimed as integrated until a dedicated adapter is implemented and verified.
