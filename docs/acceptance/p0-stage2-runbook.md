# P0 Stage 2 isolated Acceptance run

This run is deliberately limited to the dedicated Task Acceptance environment:

- D1: `exportflow-tenant-acceptance-20261122`
- Platform Worker: `exportflow-task-platform-acceptance-20261124`
- MCP Worker: `exportflow-task-mcp-acceptance-20261124`

It does not reference Production Workers, Production D1, production tenant records, or production credentials.

## One-shot trigger

The Stage 2 job is enabled only for this branch and only when the exact commit subject is:

`acceptance: run isolated P0 Stage 2 six-operation acceptance`

The trigger commit is intentional and records the user's explicit approval to perform this isolated Acceptance run. The PR-only CI path never starts the Stage 2 job. The Production deployment job is separately restricted to an authorized release commit on `main`.

## Runtime scope

The runner creates one run-scoped plan, tenant and short-lived key with only the six task scopes plus `tasks:read`. It submits six operations over REST and six over MCP, expects 12 logical quota reservations, and caps the temporary plan at 20 requests per UTC day.

The runner verifies durable Task lifecycle, status cross-read between REST and MCP, provenance, bounded Map/Crawl behavior, partial Extract, selected Wikipedia Search, and static HTTP-only Research. Cleanup is run even if smoke assertions fail and deletes only the plan, tenant, key, usage and Tasks bearing this workflow run's identifiers.

No migrations, Worker deployment, configuration update, merge or Production action is part of this run.
