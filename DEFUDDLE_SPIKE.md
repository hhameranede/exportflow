# Defuddle parser-only spike

This branch evaluates Defuddle `0.19.6` as a **local HTML-to-Markdown parser**, not as a crawler or HTTP fetching service.

## Architecture boundary

1. `createDefuddleAdapter()` validates the requested URL with ExportFlow's existing egress policy.
2. The default `fetchResource` is ExportFlow's `fetchPublicResource()`, retaining GET-only behavior, per-hop redirect revalidation, an 8-second timeout and 1 MiB response cap.
3. Only bounded, already-fetched HTML is passed to the parser; the final URL is metadata for relative-link resolution.
4. Defuddle uses the synchronous full-bundle `parse()` path with `useAsync: false`. A fail-closed injected `fetch` throws if any extractor attempts network access.
5. LinkeDOM compatibility globals are initialized once at module load; incoming page HTML is always parsed into a request-local Document. The parser does not put page HTML into a shared global document.
6. Results contain untrusted Markdown, selected metadata and HTTP/content-extraction provenance. Consumers must never render this Markdown as trusted HTML.

The adapter is deliberately **not registered** in the shared adapter catalog and no public MCP/HTTP tool is added in this spike.

## Versions

- `defuddle`: exact pin `0.19.6` (MIT)
- `linkedom`: exact pin `0.18.15` (ISC)
- `wrangler`: exact dev pin `4.164.0`, only for local Workerd verification

## Verified CI — 17 November 2026

Latest completed run: [Worker CI #688](https://github.com/hhameranede/exportflow/actions/runs/44190599752).

- Node 24 install and tracked-lock `npm ci`: passed. The run created the missing lockfile on the isolated branch and then ran `npm ci` against that same tracked lockfile.
- Full `npm audit`: **0 vulnerabilities** in the installed dependency graph.
- Node test suite: **85 passed, 0 failed, 0 skipped**.
- `npm run check`: passed.
- Wrangler/Workerd local runtime test: passed on compatibility date `2026-11-17`, without `nodejs_compat`, Cloudflare credentials, bindings or deployment.
- Four synthetic fixture categories passed:
  - Article with Arabic + table: 423 words; parser 50 ms / Worker handler 85 ms.
  - Technical docs with code + table: 423 words; parser 16 ms / Worker handler 19 ms.
  - Product detail: 390 words; parser 11 ms / Worker handler 13 ms.
  - JSON-LD `articleBody` fallback with unsafe URI/event-handler payload: 675 words; parser 8 ms / Worker handler 20 ms.
- Regression tests also verify unsafe link/event-handler/template sanitization, redirect-to-loopback rejection before a second request, no additional parser network calls, and stable global DOM state after one-time module initialization.
- These are synthetic single-run measurements, not live-web coverage or a production SLA. Near-limit, concurrency and CPU/memory tests remain open.

## Lockfile and SBOM

- The exact `package-lock.json` is now committed on this branch: blob SHA `534970bc889546c7ed6b41463e8592cfdb919703`; 63,263 bytes; 118 package entries (root excluded).
- The production dependency closure has 21 packages: MIT (9), BSD-2-Clause (8), ISC (3), Apache-2.0 (1).
- The separate Wrangler/dev toolchain includes optional platform packages, including LGPL-3.0-or-later. Keep this toolchain out of the production dependency graph and include it in development-toolchain notices.
- CI generated a CycloneDX 1.5 SBOM with 62 components (workflow artifact `defuddle-spike-build-record`, run #688, artifact ID `14375678937`). Three components do not provide a declared SPDX license identifier in the generated SBOM: `@cloudflare/kv-asset-handler`, `@cloudflare/unenv-preset`, and `wrangler`. Verify their license texts from the package distributions before redistributing the development toolchain.
- The lockfile was bootstrapped on the isolated PR branch; a subsequent independent CI run is required to verify the branch now uses the tracked lock without any bootstrap or regeneration.

## Security advisory review

- [GHSA-jg4p-g6xj-4qmf](https://github.com/advisories/GHSA-jg4p-g6xj-4qmf): affected through `0.19.0`, fixed in `0.19.1`; the pinned `0.19.6` is later than the patch.
- [GHSA-5mq8-78gm-pjmq](https://github.com/advisories/GHSA-5mq8-78gm-pjmq): affected through `0.7.0`, fixed in `0.9.0`; the pinned version is later than the patch.
- [GHSA-6frv-jcwm-xqcj](https://github.com/advisories/GHSA-6frv-jcwm-xqcj): the upstream `0.19.6` changelog explicitly records the Markdown-output sanitization fix; the precise affected range still needs matching against the advisory record.
- [GHSA-3cr7-rgx8-76c3](https://github.com/advisories/GHSA-3cr7-rgx8-76c3): the upstream `0.19.4` changelog records template and unsafe-root sanitization hardening; exact advisory range/fix mapping remains to be confirmed.
- [GHSA-wcqc-p9mh-prvm](https://github.com/advisories/GHSA-wcqc-p9mh-prvm): JSON-LD `articleBody` fallback has a malicious-content regression fixture in this spike; the exact affected and patched version range still needs to be confirmed against the advisory record.
- A zero-vulnerability `npm audit` result does not replace manual review of library-level advisories and output handling.

## Remaining merge gates

1. Verify a fresh CI run from the current branch head using only tracked-lock `npm ci`.
2. Reconcile all upstream GHSA affected ranges, especially the JSON-LD fallback and template sanitization advisories.
3. Confirm the three missing SBOM license identifiers and retain third-party license texts/notices, including dev-only packages.
4. Profile near-limit HTML, concurrent requests, CPU/memory and extraction quality on a broader set of permissible live-page snapshots.
5. Review the final diff before any merge decision.

## Explicit non-goals

- No hosted `defuddle.md` endpoint or upstream URL-fetch wrapper.
- No copied billing, KV, Durable Object, Stripe or browser infrastructure.
- No automatic registration or public tool exposure.
- No merge, deployment, Cloudflare binding/secret/DNS/permission change, Production change or paid service activation.

Current status: promising parser-only candidate with passing Node and local Workerd checks; **not yet approved for merge or production**.
