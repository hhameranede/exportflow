# ExportFlow Carrier Engine

The carrier-integration layer maintained by ExportFlow. This package is intentionally kept separable so it can later be extracted into its own private GitHub repository without changing the website's API contract.

## Runtime boundary

The website calls `functions/lib/exportflow-carrier-engine.mjs`, not an upstream package directly. That boundary owns:

- the ExportFlow tracker factory and stable result contract;
- Cloudflare-compatible network transport;
- the enabled fallback policy (UPU only by default);
- attribution and source-version metadata;
- future first-party adapters and adapter health reporting.

At this stage, the established Universal Parcel Scraper adapter catalog remains the execution source behind the facade. It is pinned to an exact upstream commit in the root `package.json`. This is deliberate: we will not replace a working production engine with a partially copied collection of scrapers.

## Integration-source policy

The `sources.json` file records candidate repositories and their licensing boundaries. The scheduled maintenance workflow checks upstream commit changes and opens a reviewable pull request. It does not blindly copy code or deploy upstream changes directly to production.

Initial source strategy:

1. **Universal Parcel Scraper** — Apache-2.0 core. Existing runtime dependency and first migration target. Preserve `LICENSE`, `NOTICE`, attribution and the exact source revision.
2. **Home Assistant Parcel Integrations** — individual carrier repositories must have their own license checked; no organization-wide license is assumed. They are Python/Home Assistant integrations, so their tracking logic must be reviewed and ported to ExportFlow's worker-compatible adapter contract; do not copy Home Assistant-specific runtime code into Pages Functions.
3. **parcel-tracker-bot** — MIT. A supplementary source for carrier candidates and patterns, subject to per-file review and tests.
4. **Karrio** — LGPL-3.0 for its open-source core and community plugins. Monitored separately; no code from its enterprise-only directory is eligible. Do not merge LGPL code into the first-party adapter package without a deliberate compliance review.

## Adapter acceptance gates

Every adapter must include:

- carrier identity, country/service scope and a confidence-aware detection rule;
- source URL and a documented retrieval method;
- explicit rate-limit, retry, timeout and redirect behavior;
- synthetic fixtures with successful, empty, malformed, rate-limited and changed-page cases;
- normalized events that retain the carrier's original wording and timestamp semantics;
- privacy review (no raw tracking numbers in logs or health reports);
- a license/attribution record and a first-party owner;
- a passing test before it can be marked `verified`.

A catalog entry is not proof of a working integration. Coverage states must distinguish `catalog-only`, `adapter-present`, `canary-passing`, `temporarily-failing` and `unsupported`.

## Periodic maintenance

`.github/workflows/carrier-engine-maintenance.yml` runs daily and on manual dispatch. It:

1. discovers public carrier integrations in the Home Assistant parcel-integration organization;
2. checks upstream default-branch revisions and license metadata;
3. compares them with `upstream-lock.json`;
4. records an auditable report artifact;
5. opens a PR when revisions or source inventory change;
6. proposes a pinned Universal Parcel Scraper update only after the existing test/build suite passes.

Human review remains required before merge. This prevents an upstream breaking change, compromised source or license change from silently entering production.

## Data model

The D1 migration under `/migrations` stores connector/source metadata and aggregate health-check outcomes only. It deliberately does not store parcel IDs, recipient data, addresses or raw tracking responses. Historical shipment tracking will require a separate explicit opt-in and privacy review.

## Extraction to a dedicated repository

This folder is self-contained by design. When the GitHub account has a repository-creation path available, it can be split with `git subtree split --prefix=packages/exportflow-carrier-engine` and pushed as a private repository named `exportflow-carrier-engine`. Until then it remains inside the existing private `hhameranede/exportflow` repository; it is not represented as a separate remote repository.
