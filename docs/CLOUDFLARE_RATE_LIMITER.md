# Cloudflare global rate limiter deployment

This document records the infrastructure contract for the optional Cloudflare Durable Object used by ExportFlow's tracking API rate limiter.

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

| Environment | D1 database | Jurisdiction |
| --- | --- | --- |
| Preview | `exportflow-intelligence-preview-db` | EU |
| Production | `exportflow-intelligence-db` | EU |

The Pages project configuration was corrected to use the dedicated Preview database. Both databases were empty when inspected on 2026-11-07; do not assume that migrations have been applied.

The Durable Object namespace is shared by the Pages environments, but `EXPORTFLOW_ENV` is included in each Durable Object's name. This keeps Preview and Production counters logically separate. The HMAC secret is also independent per environment.

## Deployment order

1. Deploy the external Worker and create its SQLite Durable Object class before deploying Pages code that references the binding.
2. Keep the Worker `workers.dev` subdomain disabled. Do not add public routes to its default fetch handler.
3. Confirm `GLOBAL_RATE_LIMITER` is bound in both Pages environments.
4. Confirm `EXPORTFLOW_ENV` and `GLOBAL_RATE_LIMITER_HMAC_SECRET` exist in both environments; the secret must be encrypted and must not be printed.
5. Deploy and test the feature on a Cloudflare Pages Preview deployment first.
6. Apply D1 migrations to the Preview database, then validate migration checks, merchant isolation, carrier evidence and API behavior.
7. Apply migrations to Production only as part of a reviewed release after the Preview gate passes.
8. Do not merge the stacked feature PRs or deploy the feature to Production while a required binding, secret, migration, or Preview check is missing.

## Rate-limit behavior and privacy

The current policy is 12 shipment lookup attempts per pseudonymous client per 60-second fixed window. The Pages Function HMACs `CF-Connecting-IP` before deriving the Durable Object name. Raw IP addresses, tracking numbers, credentials and carrier responses must not be written to Durable Object storage or telemetry. Stored counter state is deleted after 15 minutes of inactivity.

Production must fail closed with HTTP 503 if the global coordinator is not configured or unavailable. Do not work around that failure by silently allowing requests.

## Verification evidence

The repository's tests cover fixed-window counting, concurrent requests, preview/production scope separation, HMAC privacy, response headers, failure-closed behavior and idle cleanup. These are code-level tests; they do not prove that Cloudflare bindings are live. Keep the infrastructure state separate from test results, and record a real Preview canary only after the deployed Pages environment demonstrates the binding is usable.
