# Defuddle parser-only spike

This branch evaluates Defuddle `0.19.6` as a **local HTML-to-Markdown parser**, not as a crawler or HTTP fetching service.

## Architecture boundary

1. `createDefuddleAdapter()` validates the requested URL with ExportFlow's existing egress policy.
2. The default `fetchResource` is ExportFlow's `fetchPublicResource()`, retaining GET-only behavior, per-hop redirect revalidation, an 8-second timeout and 1 MiB response cap.
3. Only bounded, already-fetched HTML is passed to the parser; the final URL is metadata for relative-link resolution.
4. Defuddle uses the synchronous full-bundle `parse()` path with `useAsync: false`. A fail-closed injected `fetch` throws if any extractor attempts network access.
5. LinkeDOM compatibility globals are initialized once at module load; incoming page HTML is always parsed into a request-local Document. The parser does not put the page HTML into a shared global document.
6. Results contain untrusted Markdown, selected metadata and HTTP/content-extraction provenance. Consumers must never render this Markdown as trusted HTML.

The adapter is deliberately **not registered** in the shared adapter catalog and no public MCP/HTTP tool is added in this spike.

## Versions

- `defuddle`: exact pin `0.19.6` (MIT)
- `linkedom`: exact pin `0.18.15` (ISC)
- `wrangler`: exact dev pin `4.164.0`, only for local Workerd verification

## Verified CI — 17 November 2026

Latest verified run: [Worker CI #687](https://github.com/hhameranede/exportflow/actions/runs/44189579109), commit `55eb84131fc62c83bc5adb49c63ad4d2d8779218`.

- Node 24 install and `npm ci`: passed.
- Full `npm audit`: **0 vulnerabilities**.
- Node test suite: **85 passed, 0 failed, 0 skipped**.
- `npm run check`: passed.
- Wrangler/Workerd local runtime test: passed on compatibility date `2026-11-17`, without `nodejs_compat`, Cloudflare credentials, bindings or deployment.
- Four synthetic fixture categories passed:
  - Article with Arabic + table: 423 words; parser 39 ms / Worker handler 70 ms.
  - Technical docs with code + table: 423 words; parser 16 ms / Worker handler 19 ms.
  - Product detail: 390 words; parser 10 ms / Worker handler 10 ms.
  - JSON-LD `articleBody` fallback with unsafe URI/event-handler payload: 675 words; parser 5 ms / Worker handler 17 ms.
- Tests also verify unsafe link/event-handler/template sanitization, redirect-to-loopback rejection before a second request, no extra parser network calls, and stable global DOM state after one-time module initialization.
- These are synthetic single-run measurements, not live-web coverage or a production SLA. Near-limit, concurrency and CPU/memory testing remain open.

## Dependency inventory and license notes

The generated lockfile has 118 package entries (excluding the root project). The production dependency closure has 21 packages:
- MIT: 9
- BSD-2-Clause: 8
- ISC: 3
- Apache-2.0: 1

The separate Wrangler/dev toolchain includes optional platform packages with LGPL-3.0-or-later and combined Apache/LGPL/MIT license identifiers. Keep them outside the production dependency graph and account for them in the development SBOM/notices. The full lock inventory is not uniformly MIT-licensed.

CI now bootstraps and commits the lockfile **once** to this isolated PR branch when it is absent. Subsequent runs use tracked-lock `npm ci` directly. It also emits a CycloneDX SBOM artifact for review.

## Security advisory review

- Defuddle `0.19.6` changelog records a fix for unsafe HTML/links/event handlers in Markdown output (GHSA-6frv-jcwm-xqcj).
- `0.19.4` records additional sanitization hardening for templates and unsafe content roots.
- Exact upstream GHSA affected ranges, including the JSON-LD fallback and site-extractor advisories, still require reconciliation against the pinned version and adversarial regression coverage. A zero-vulnerability `npm audit` result does not replace this review.

## Remaining merge gates

1. Verify that the CI bootstrap commit placed the exact generated `package-lock.json` on this branch; then verify a subsequent CI run passes with `npm ci` and does not regenerate the lockfile.
2. Inspect and retain the CycloneDX SBOM and required third-party notices, including dev-toolchain licenses.
3. Reconcile exact upstream GHSA ranges and add adversarial HTML regression/fuzz cases.
4. Profile near-limit HTML, concurrent requests, CPU/memory and extraction quality on a broader set of permissible live-page snapshots.
5. Review the final diff before any merge decision.

## Explicit non-goals

- No hosted `defuddle.md` endpoint or upstream URL-fetch wrapper.
- No copied billing, KV, Durable Object, Stripe or browser infrastructure.
- No automatic registration or public tool exposure.
- No merge, deployment, Cloudflare binding/secret/DNS/permission change, Production change or paid service activation.

Current status: promising parser-only candidate with passing Node and local Workerd checks; **not yet approved for merge or production**.
