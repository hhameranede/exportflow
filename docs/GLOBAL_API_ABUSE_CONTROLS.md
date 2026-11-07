# Global API Abuse Controls — Cloudflare Durable Objects

**Implementation state: feature branch / Draft PR. The global quota is not active until the Durable Object Worker is deployed and bound to Cloudflare Pages.**

## Why this exists

The existing `/api/track` in-memory map is a per-Worker-isolate burst guard. It is not globally coordinated: traffic split across locations and isolates can exceed the local count.

This release adds a strongly consistent Durable Object counter per pseudonymous client and environment. The local map remains as a low-cost burst guard. REST tracking, each shipment in a batch, and MCP tools reuse the same `/api/track` handler and therefore share the same global allowance.

## Current policy

- 12 shipment lookup attempts per client per fixed 60-second UTC-aligned window.
- A batch of five consumes five lookup units because each item goes through `/api/track`.
- `preview` and `production` use different Durable Object IDs and therefore isolated allowances.
- The client identifier is HMAC-SHA-256 of Cloudflare's `CF-Connecting-IP`; the raw address is not sent to the Durable Object or written to its SQLite row.
- HMAC secret is read only from `GLOBAL_RATE_LIMITER_HMAC_SECRET` in the Pages environment; it must be stored as an encrypted Cloudflare secret, not a plain variable.
- The object keeps one SQLite row per client and schedules cleanup after 15 minutes of inactivity. The alarm checks activity again and deletes the full object storage when idle; requests during the cleanup window refresh the TTL.
- The Durable Object stores no tracking numbers, postcodes, user agents, URL paths, or request bodies.
- The rate-limit response includes standard `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After` and `X-RateLimit-Scope` metadata.
- A configured Durable Object outage, invalid response, or missing HMAC secret fails closed with HTTP 503. It does not silently downgrade to a per-isolate counter.

## Cloudflare free-tier budget

Official Durable Objects pricing currently lists, on Workers Free, 100,000 Durable Object requests/day and 13,000 GB-s/day; SQLite-backed Durable Objects are the supported backend. Free-plan operations over a limit fail rather than automatically becoming paid usage. Daily free limits reset at 00:00 UTC. Free accounts have a 5 GB total Durable Objects SQLite storage limit.

This implementation uses one Durable Object request for each shipment lookup attempt, not one per batch HTTP request. The local burst guard rejects same-isolate bursts before reaching the Durable Object. Monitor aggregate DO request/compute usage before any volume expansion; do not add a dashboard or polling job without evidence of a need.

Official reference: [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## Repository layout

- `workers/global-rate-limiter/src/index.mjs`: separate SQLite-backed Durable Object Worker.
- `workers/global-rate-limiter/wrangler.toml`: Worker export and SQLite class migration.
- `functions/lib/global-rate-limit-policy.mjs`: shared window, limit and retention policy.
- `functions/lib/global-rate-limiter.mjs`: Pages binding client; HMAC-derived object names; environment scope; response validation and standard headers.
- `functions/api/track.js`: keeps local burst guard, then consumes the shared counter before any upstream carrier call.
- `scripts/global-rate-limiter-test.mjs`: fixed-window, per-client, per-environment, concurrency, error, privacy, and idle cleanup tests.

## Provisioning and activation — deliberately not performed by CI

Cloudflare Pages cannot create and deploy a Durable Object class from inside a Pages project. The Durable Object must be deployed as a separate Worker and then bound to the Pages project. The account had no Durable Object namespace or Worker script at the time of this implementation checkpoint.

1. Deploy the separate Worker from the repository root:
   `npx wrangler@4 deploy --config workers/global-rate-limiter/wrangler.toml`
2. Store a random secret of at least 32 bytes as the encrypted Cloudflare Pages secret `GLOBAL_RATE_LIMITER_HMAC_SECRET` in both Preview and Production. Use a separate value per environment if operationally preferred; each environment already has a distinct object-name scope. Never commit or log the secret.
3. Set `EXPORTFLOW_ENV=preview` for Pages Preview and `EXPORTFLOW_ENV=production` for Pages Production.
4. Bind the Worker's SQLite namespace to Pages as `GLOBAL_RATE_LIMITER` (Cloudflare dashboard or Pages Wrangler configuration):
   ```toml
   [[durable_objects.bindings]]
   name = "GLOBAL_RATE_LIMITER"
   class_name = "GlobalRateLimiter"
   script_name = "exportflow-global-rate-limiter"
   ```
5. Re-deploy Pages after the binding is added. The Durable Object Worker and Pages binding are separate deployment steps.
6. Verify on Preview with synthetic requests: 12 permitted lookups, the 13th returning 429 with reset metadata, recovery after the window, cross-isolate requests sharing the same client counter, Preview/Production isolation, and fail-closed behavior if the Durable Object is unavailable.
7. Only after Preview evidence and a rollback review, deploy the same Worker/binding/secret arrangement to Production. Do not merge this PR before the production binding is ready: requests to `exportflow.me` deliberately return 503 when the global coordinator is missing.

## Rollback

- Do not remove the Durable Object binding or secret while this code is serving Production; the production host fails closed.
- To roll back application code, redeploy the previous Cloudflare Pages production deployment only after checking the previous build and the API behavior.
- If the separate DO Worker has a bad release, deploy the last known-good Worker version; leave its namespace/data intact.
- Never switch a production quota outage to a silent per-isolate bypass. Any emergency degradation policy must be explicitly reviewed and communicated.

## Verification status

- Local test fixtures are added to GitHub Actions and Datadog CI Test Visibility.
- CI dry-run builds the Durable Object Worker with Wrangler 4 and separately compiles the Cloudflare Pages Functions with the existing Wrangler Pages step.
- CI dry-run is not a remote deployment and does not create a namespace or bind it to Pages.
- At this stage, no Worker was deployed, no namespace was created, no HMAC secret was stored in Cloudflare, and no Pages binding was changed. Global enforcement must not be claimed active until the Preview and Production activation gates pass.
