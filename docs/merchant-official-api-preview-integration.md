# Merchant Workspace — ExportFlow direct-adapter tracking

## Current implementation

The Merchant Workspace uses Google OAuth and revocable D1 merchant sessions. A signed-in merchant selects from the installed ExportFlow direct-adapter catalog and submits a tracking number plus any carrier-specific inputs required by that adapter.

- `GET /api/merchant/carrier-catalog` returns selectable carriers whose installed catalog entry maps to a dedicated direct adapter. Universal-provider and link-only entries are excluded.
- `POST /api/merchant/carriers/{provider}/track` accepts any carrier ID in that direct/selectable catalog, not only UPS and FedEx.
- The route resolves the authenticated merchant session directly. It does not require an encrypted merchant carrier-credential record.
- Each lookup creates a fresh `createTracker({ env, fetcher, trawlUrl?, providers: [] })` instance using ExportFlow's server-side Pages environment.
- `providers: []` disables universal-provider fallbacks. The selected direct adapter alone receives the parcel identifier.
- Adapter-specific `trackingUrl`, `postcode` and `postcodeCountry` inputs are bounded at the API boundary and validated/normalized by the installed adapter catalog before the adapter runs.
- No carrier API key or secret is requested from or returned to the merchant's browser.
- The route returns a bounded, sanitized status/timeline. It does not store parcel identifiers or return raw upstream errors.
- Same-origin checks, authenticated merchant sessions, global rate limiting, a 25-second request budget, bounded JSON input and no-store responses remain enforced.

## Coverage boundaries

- The merchant selection list contains dedicated direct adapters from ExportFlow's pinned installed catalog. It deliberately excludes `universal` fallbacks and `link-only` carriers.
- Direct-adapter metadata is not a guarantee that every carrier is available at every moment. Some carriers require a postcode, carrier-issued capability URL, app-level API configuration, a browser/Trawl route, or may impose upstream verification and rate limits.
- Preview currently has no `EXPORTFLOW_TRAWL_URL`, UPS official API credentials, or FedEx official API credentials configured. UPS retains a direct path, but may be challenged. FedEx requires either its official API credentials or the existing Trawl browser service; a live FedEx response is therefore not claimed until the server-side route is configured and verified.
- Passing route tests proves the selection/dispatch boundary and environment reuse, not a live carrier result.

## Removed merchant credential-entry flow

The user-facing UPS/FedEx API-key forms and their connection-status gating are absent. The legacy credential vault, endpoints and migrations remain isolated for possible future owner-approved use; the current Merchant tracking UI and route do not call or require them.

The separate mock fixture, fixed-reference sandbox credential-check, and Mock/Sandbox buttons remain absent. A successful lookup is the evidence that the selected direct adapter returned tracking data.

## Security and environment boundary

- Merchant OAuth/session identity remains required; private API access is not anonymous.
- Each request is routed only through the selected direct adapter. Universal-provider fallbacks cannot receive the parcel identifier.
- The tracking number and extra carrier inputs are bounded, not written to browser storage, and omitted from diagnostics.
- Merchant D1, session data and global rate-limit bindings remain Preview-only.
- The route uses ExportFlow's existing server-side `EXPORTFLOW_TRAWL_URL` only when configured, without changing Pages settings or secrets.
- No Production D1 binding, Production migration, secret update, DNS change, access-control change or Pages configuration change is part of this change.

## Branch and verification boundary

- Repository: hhameranede/exportflow.
- Review PR: https://github.com/hhameranede/exportflow/pull/67
- Preview OAuth callback:
  `https://integration-merchant-officia.exportflow-aja.pages.dev/api/merchant/auth/google/callback`
- Unit and route tests inject the tracker factory. They verify the app-level adapter environment, dynamic direct-adapter selection, no universal fallback, merchant session isolation, origin checks, rate limiting, carrier-specific input pass-through and safe error responses; they do not claim a live carrier response.
- No production tracking path is changed by this feature branch.
