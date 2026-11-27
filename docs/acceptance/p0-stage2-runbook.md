# P0 Stage 2 isolated Acceptance run

This run is deliberately limited to the dedicated Task Acceptance environment:

- D1: `exportflow-tenant-acceptance-20261122`
- Platform Worker: `exportflow-task-platform-acceptance-20261124`
- MCP Worker: `exportflow-task-mcp-acceptance-20261124`

It does not reference Production Workers, Production D1, production tenant records, or production credentials.

## One-shot trigger

The Stage 2 deployment + Acceptance jobs are enabled only for this branch and only when the exact commit subject is:

`acceptance: deploy isolated P0 Stage 2 workers and run six-operation acceptance`

The trigger commit is intentional and records the user's explicit approval to deploy only the two dedicated Task Acceptance Workers and then perform the isolated six-operation REST/MCP Acceptance run. The deploy job targets only `cloudflare/task-acceptance/platform.wrangler.toml` and `cloudflare/task-acceptance/mcp.wrangler.toml`. It does not execute SQL migrations, change bindings/secrets/DNS/permissions, or deploy any Production Worker. The PR-only CI path never starts these jobs. The Production deployment job is separately restricted to an authorized release commit on `main`.

## Runtime scope

The runner creates one run-scoped plan, tenant and short-lived key with only the six task scopes plus `tasks:read`. It submits six operations over REST and six over MCP, expects 12 logical quota reservations, and caps the temporary plan at 20 requests per UTC day.

The runner verifies durable Task lifecycle, status cross-read between REST and MCP, provenance, bounded Map/Crawl behavior, partial Extract, selected Wikipedia Search, and static HTTP-only Research. Cleanup is run even if smoke assertions fail and deletes only the plan, tenant, key, usage and Tasks bearing this workflow run's identifiers.

The run uses the existing isolated Acceptance D1 schema and only the two dedicated Acceptance Worker configs; it does not execute D1 SQL migrations. Worker deployment is restricted to those Acceptance configs by the one-shot deploy job. No configuration-setting mutation, secret/binding/DNS/permission change, merge or Production action is part of this run.
