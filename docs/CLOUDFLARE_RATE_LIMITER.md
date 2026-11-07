# Cloudflare global rate limiter deployment

This document records the infrastructure contract for the Cloudflare Durable Object used by ExportFlow's tracking API rate limiter.

## Components

- Pages project: `exportflow`, connected to `hhameranede/exportflow`.
- Separate Worker: `exportflow-global-rate-limiter`.
- Durable Object class: `GlobalRateLimiter`, backed by SQLite and introduced by migration `v1`.
- Pages binding: `GLOBAL_RATE_LIMITER`, pointing to the external Worker class.
- Scope variable: `EXPORTFLOW_ENV`, set to `preview` or `production`.
- Secret: `GLOBAL_RATE_LIMITER_HMAC_SECRET`, stored as a Pages `secret_text`. Use an independent random value per environment; never commit or log it.

The rate-limiter Worker has its `workers.dev` subdomain disabled. Its default fetch handler returns 404; Pages Functions call the Durable Object through the binding.

## Environment isolation

The Cloudflare Pages project must bind different D1 databases in the two environments:

| Environment | D1 database | Database ID | Jurisdiction |
| --- | --- | --- | --- |
| Preview | `exportflow-intelligence-preview-db` | `9657dfdc-5b80-4a0b-a982-8865152b2c82` | EU |
| Production | `exportflow-intelligence-db` | `3e91ee40-75f8-45b3-9459-a4c306f52b3b` | EU |

The Pages project originally pointed both environments at the Production D1 ID. This was corrected before any new migration was applied. The Preview DB was not empty: it already contained 14 `carrier_integrations` rows and 6 `upstream_sources` rows, along with its health, maintenance and repository-check tables. Those records were preserved.

Migrations `0001` through `0004` were applied to the Preview database only. The new schema now includes the merchant credential vault, merchant identity/session tables, append-only audit tables and `carrier_evidence`. The evidence seed contains 22 Research records; no carrier is Verified. Merchant credentials, merchant users and sessions are still empty. Production D1 was not migrated or modified.

The Durable Object namespace is shared by the Pages environments, but `EXPORTFLOW_ENV` is included in each Durable Object name. This keeps Preview and Production counters logically separate. The HMAC secret is also independent per environment.

## Deployment order and Pages deployment caveat

1. Deploy the external Worker and create its SQLite Durable Object class before deploying Pages code that references the binding.
2. Keep the Worker `workers.dev` subdomain disabled. Do not add public routes to its default fetch handler.
3. Confirm `GLOBAL_RATE_LIMITER` is bound in both Pages environments.
4. Confirm `EXPORTFLOW_ENV` and `GLOBAL_RATE_LIMITER_HMAC_SECRET` exist in both environments; the secret must be encrypted and must not be printed.
5. Use a normal GitHub branch-push Preview deployment to validate per-environment Pages configuration. An ad-hoc deployment or retry can return the Production D1 binding and omit `EXPORTFLOW_ENV`; inspect the deployment record before testing it and discard any mismatched Preview deployment.
6. Validate that the deployed Preview reports the Preview D1 database ID and its `GLOBAL_RATE_LIMITER` binding before running tests.
7. Apply new D1 migrations to Preview first, then validate migration checks, merchant isolation, carrier evidence and API behavior.
8. Apply migrations to Production only as part of a reviewed release after the Preview gate passes.
9. Do not merge the stacked feature PRs or deploy the feature to Production while a required binding, secret, migration, or Preview check is missing.

## Rate-limit behavior and privacy

The current policy is 12 shipment lookup attempts per pseudonymous client per 60-second fixed window. The Pages Function HMACs `CF-Connecting-IP` before deriving the Durable Object name. Raw IP addresses, tracking numbers, credentials and carrier responses must not be written to Durable Object storage or telemetry. Stored counter state is deleted after 15 minutes of inactivity.

Production must fail closed with HTTP 503 if the global coordinator is not configured or unavailable. Do not work around that failure by silently allowing requests.

## Verification evidence

The repository's tests cover fixed-window counting, concurrent requests, preview/production scope separation, HMAC privacy, response headers, failure-closed behavior and idle cleanup. The CI run #376 passed the D1 migration integrity tests, regression tests, Durable Object Worker dry-run, Pages build, locale/SEO validation and Pages Functions bundle. Datadog recorded 24 passing manual regression-test events for that run.

A live end-to-end request through the latest Pages Preview has not yet been verified. Code-level tests and a successful build do not prove that the deployed Pages binding can call the Durable Object. Keep that deployment gate open until a normal GitHub branch-push Preview completes and a safe canary confirms the binding is usable.
