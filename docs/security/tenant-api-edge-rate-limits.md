# Tenant API edge rate limiting

## Why the application limiter is separate

The pre-authentication limiter runs inside one Worker isolate, so its counters are not shared globally across isolates or Cloudflare data centers. It is supplementary protection, not the authoritative edge limit.

Cloudflare's Free zone tier supports one rate-limiting rule with a 10-second period, IP counting and path matching. It does not support method matching or custom counting expressions based on response status, so it cannot count only failed 401/403 authentication attempts. A Free-tier rule must cap all requests reaching the task path.

When creating a future rule through the Rulesets API, use the zone http_ratelimit phase entrypoint. The API examples include cf.colo.id and ip.src in rate-limit characteristics. Confirm the current plan matrix and rule schema immediately before a change.

## Proposed Free-tier rule (not deployed)

- Expression: http.request.uri.path eq "/api/v1/tasks"
- Counting characteristic: visitor IP
- Period: 10 seconds
- Threshold: choose after measuring legitimate peak traffic and shared-NAT behaviour; none is approved in this patch.
- Action: Block
- Mitigation period: 10 seconds

This path-wide rule may affect multiple tenants behind one public IP and block legitimate bursts. Cloudflare counters are not one global counter across all data centers; retain persistent tenant quota as the product-level enforcement mechanism.

## Current account evidence and release gate

Read-only inspection on 20 November 2026 found no zone http_ratelimit entrypoint ruleset for exportflow.me. The legacy rate_limits API is deprecated; use the Rulesets API and create the rule in the zone's http_ratelimit phase entrypoint.

Do not create or deploy this rule through this patch. Zone WAF configuration affects Production traffic and requires separate owner approval. Inspect existing rules and confirm Free-tier availability and the selected threshold before any future application.

## First-party source references

- Plan-availability matrix: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/waf/rate-limiting-availability-by-plan.mdx
- Rulesets API example: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/waf/rate-limiting-rules/create-api.mdx
- Rate-limiting best practices: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/waf/rate-limiting-rules/best-practices.mdx
- Cloudflare Workerd Durable Object sample: https://github.com/cloudflare/workerd/blob/main/samples/durable-objects-chat/chat.js (reference only; not adopted here).
