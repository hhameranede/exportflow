# ExportFlow repository audit

Date: 2026-11-06  
Scope: `main` and PR #24 branch `feat/exportflow-carrier-engine-foundation-20261106`

## Verified working areas

- The existing website is a static, mobile-first frontend with server-side Pages Functions for tracking, carrier catalog, coverage, health, and the PR #24 engine-status endpoint.
- Tracking requests are bounded and validated in `functions/api/track.js`; responses are projected to a small public shape and marked `no-store`.
- The carrier engine facade keeps `universal-parcel-scraper` pinned and enables only the UPU universal fallback by default.
- PR #24 adds separate registry, source, health-check, upstream-audit, and maintenance-alert tables. The migration deliberately does not store parcel identifiers, recipient data, postcodes, or raw tracking responses.
- Existing regression scripts cover the engine facade, Cloudflare fetch compatibility, coordinate validation, coverage data, locale artifacts, and the HTTP smoke surface.
- CI runs install, tests, build, locale checks, and a Pages Functions bundle check.

## Findings

### Fixed in this change

1. `scripts/build.mjs` contained the literal characters `\n\n` between the legal-page copy and locale generation call. `npm run build` therefore failed with a syntax error before producing `dist/`.

### Remaining high-priority gaps

1. The product currently exposes eight locales ending in Russian (`ru`), while the product requirement calls for Bengali (`bn`). This requires coordinated dictionary, selector, routing, middleware, build, sitemap, and test changes; it is not safe to change one surface independently.
2. The carrier engine facade delegates orchestration to the pinned upstream tracker but does not yet provide an ExportFlow-owned normalized truth layer, cross-source comparison, circuit breaker, or provider health state at request time.
3. The registry records integration metadata, but the repository does not yet contain carrier contract fixtures or live-canary evidence sufficient to mark carriers as live verified.
4. The engine-status endpoint reports registry counts but catches all database errors as `schema_not_ready`, which can obscure operational failures.
5. Local database testing is documented only at the migration level; there is no repository test harness that applies all migrations to a local SQLite-compatible database and exercises the endpoint.
6. Shipment persistence, consent, MCP tools, and Apps SDK UI are not present and should not be represented as complete.

## Validation baseline

Before the fix, from a clean checkout:

- `npm test`: blocked because dependencies were not installed.
- `npm run build`: failed with the `scripts/build.mjs` syntax error described above.

After installing the pinned lockfile dependencies and applying the fix, run:

```bash
npm test
npm run build
node scripts/locale-build-test.mjs
```

No Cloudflare APIs, remote D1 databases, deployment commands, production DNS, or secrets are used by this audit.
