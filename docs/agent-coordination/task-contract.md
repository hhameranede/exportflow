# Agent task contract

Use this template for every task assigned to Copilot. Keep one issue focused on one independently reviewable outcome.

## Goal

Describe the user-visible or engineering outcome in one or two sentences.

## Context

Link the relevant files, issues, PRs, and prior decisions. Do not repeat completed audits unless new evidence requires it.

## In scope

List the exact files, modules, behaviors, and tests the agent may change.

## Out of scope

Explicitly list unrelated refactors and forbidden systems/actions.

## Constraints

- Work on a dedicated branch; never push directly to `main`.
- Do not merge the PR.
- Do not deploy.
- Do not access Cloudflare, remote D1, Vercel, production systems, or secrets unless a later issue explicitly authorizes a specific action.
- Do not claim carrier support, live tracking, delivery estimates, or metrics without reproducible evidence.
- Do not include real tracking numbers or personal shipment data in fixtures, logs, issues, or screenshots.

## Acceptance criteria

Use observable, testable checkboxes. Each criterion must be verifiable from code, tests, or a reproducible UI check.

## Verification required

List the exact relevant commands. Report commands that could not be run and why. Include full pass/fail counts where available.

## Required handoff report

At completion, comment on the issue and PR with:

1. Branch and PR URL.
2. Summary of implementation.
3. Changed files and purpose.
4. Exact commands executed and results.
5. CI check status.
6. Known limitations and follow-up work.
7. Confirmation that no production deployment or merge occurred.

If blocked, do not wait silently. Add an `agent:blocked` label (if available), explain the exact blocker, and continue independent work only when it does not risk conflicting changes.
