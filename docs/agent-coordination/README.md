# ExportFlow agent coordination

## Purpose

Coordinate ChatGPT and GitHub Copilot around one shared, auditable project record without giving either agent production access.

## Important limitation

This is an asynchronous GitHub-backed handoff, not a direct live connection between the ChatGPT conversation and a running Copilot session. Both agents exchange work through GitHub Issues, pull requests, commit history, and the progress report. ChatGPT cannot remotely control or resume a Copilot session.

A custom remote MCP server is a possible later extension, but it is not required for the first working coordination loop. ChatGPT custom MCP write access is plan/workspace dependent; do not assume it is available on Free. Do not deploy or host a bridge as part of this phase.

## Roles

- **Project owner:** approves scope, risky operations, and final merges/deployments.
- **ChatGPT coordinator/reviewer:** turns goals into bounded issues, checks evidence, reviews diffs and CI, records decisions, and prepares the next task.
- **Copilot coding agent:** implements one assigned issue on its own branch, runs repository tests, and opens a pull request.
- **GitHub:** the shared control plane and durable audit log.

## Standard loop

1. ChatGPT creates or updates a narrowly scoped GitHub Issue using the task contract.
2. The owner assigns the issue to Copilot coding agent when available. If Copilot agent assignment is unavailable, use the issue body as the task prompt in the Copilot agent UI.
3. Copilot works on a dedicated branch and opens a PR linked to the issue.
4. Copilot posts a completion report with changed files, commands, test results, limitations, and deployment status.
5. ChatGPT reviews the PR diff, workflow checks, and report. It requests focused fixes through PR comments or a follow-up issue.
6. The owner decides whether to merge. Production deployment remains a separate, explicitly approved activity.

## Issue and PR state

Use these labels where repository labels are available:

- `agent:queued` — ready for an agent, not started
- `agent:in-progress` — agent has begun
- `agent:review` — PR is ready for review
- `agent:blocked` — a concrete blocker requires owner input
- `agent:done` — accepted and closed

Do not mark work done solely because an agent says it is done. Require evidence and review.

## Scope for the current phase

- Repository and GitHub-only work.
- No Cloudflare API, remote D1, Wrangler remote operations, Vercel, secrets, production changes, or deployments.
- No direct pushes to `main`, no merging, and no branch-protection bypass.
- Use the existing repository's actual scripts and tests; do not invent test results.
- Keep tracking numbers, credentials, and private shipment data out of issues and logs.

## Future MCP extension

GitHub supports repository-level MCP configuration for Copilot cloud agent. Configure only the minimum required tools, prefer read-only tools, and review every tool exposed to the agent. GitHub's documentation warns that configured MCP tools can be used autonomously without per-call approval. Do not expose wildcard write access.

A future shared MCP service for ChatGPT would need a supported ChatGPT plan/workspace and a reachable authenticated endpoint (or supported secure tunnel). Build and connect that only after the owner explicitly approves the hosting target and access model. It is intentionally not part of this repository-only phase.

## Source of truth

- Current task: GitHub Issue
- Implementation: PR branch and commits
- Verification: CI checks plus reproducible commands in the PR report
- Decisions and blockers: issue/PR comments
- Overall progress: `docs/agent-coordination/progress.md`
