# P0 Stage 1 — Request-only Fetch corpus and Acceptance runner

## Scope

This change adds a small, versioned corpus and a manually invoked runtime runner for the existing isolated Task Acceptance Workers. It does not alter Fetch behavior or production configuration.

The corpus intentionally separates three kinds of evidence:

1. **Standards conformance fixtures** — selected URL and IDNA cases from WPT, plus small legacy-encoding byte samples.
2. **Synthetic local regressions** — deterministic unit checks that run in ordinary CI without network access.
3. **Live source probes** — public URLs that must be fetched by the actual Cloudflare Acceptance Workers before they can be reported as passed.

A test of Node's `URL` or `TextDecoder` is not evidence that the Worker fetched a live site correctly. Likewise, a corpus entry is only a target until the runtime runner records a successful result.

## Pinned live targets

The initial live set contains:

- Example Domain and the IANA reserved-domain reference page for static HTML.
- HTTPBingo XML, gzip, deflate, redirect-chain and HTTP 404 endpoints.
- WPT Live Shift_JIS, EUC-JP and EUC-KR pages whose WPT `.headers` fixtures explicitly declare the legacy charset.

The three WPT legacy pages are bounded below ExportFlow's 1 MiB response ceiling based on their pinned upstream blobs. The runtime runner still checks the actual response bytes and does not treat those historical file sizes as live measurements.

The WPT Live host may be unavailable or rate-limited from a Worker region. Such a result is reported as a failed probe and must not be replaced with an unverified claim. The site-specific URLs and expected snippets can be revised only with new source/charset evidence.

## How to run the isolated live Acceptance

From a reviewed checkout of this branch, use Node 22+ and an authenticated Wrangler session with access to the ExportFlow Cloudflare account:

```sh
node scripts/acceptance/stage1-fetch-corpus.mjs
```

The runner first verifies both checked-in Wrangler configs against the dedicated Acceptance Worker names and D1 ID. It then:

1. Creates a unique plan, tenant and run-scoped API key in `exportflow-tenant-acceptance-20261122`.
2. Exercises the live corpus through both REST and MCP.
3. Checks HTTP status, task state, body snippets, content type, final URL, redirect count and source provenance.
4. Verifies a direct loopback URL is rejected before task creation and a public redirect to loopback is rejected before a second Fetch.
5. Deletes only the run-scoped Tasks, usage, API key, tenant and plan in a `finally` cleanup.

The script has fixed Acceptance endpoints. It refuses overridden endpoints and rejects any Production URL or Production D1 identifier. It does not deploy Workers, run migrations, change bindings, secrets, routes, DNS, permissions, or traffic. A successful live run is still Acceptance evidence only; it does not authorize merge or Production release.

If a run is interrupted before cleanup, inspect the dedicated Acceptance D1 for the exact printed run identifier and remove only that run's fixture rows after review. Never clear historical Acceptance fixtures.

## Existing evidence not duplicated

The current source already has unit coverage for response size, redirects, timeout/cancellation, response media types, Windows-1252 decoding, unsupported charsets, HTTP errors, cache mode and egress validation. Earlier real Worker Acceptance evidence already covered Windows-1252, gzip/deflate/Brotli decoding, a safe redirect, HTTP 404 preservation, timeout, byte limits and private-destination rejection. This corpus adds repeatable external source diversity and live legacy charset verification; it does not invalidate or overstate the earlier evidence.

DNS-rebinding observations remain diagnostic/inconclusive where the connected IP cannot be observed. The suite does not create DNS infrastructure or reinterpret resolver observations as a Worker egress verdict.

## Source and license provenance

The selected WPT URL, IDNA and legacy-encoding samples are derived from:

- `web-platform-tests/wpt` commit `6f48032a9675c1d4cd53124d9fb36ccd8d6bd354`.
- `url/resources/urltestdata.json`, `url/resources/IdnaTestV2.json`, and the listed legacy charset fixtures.

WPT's `LICENSE.md` declares the 3-Clause BSD License. The source notice is retained here:

> The 3-Clause BSD License
>
> Copyright © web-platform-tests contributors
>
> Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
>
> 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
> 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
> 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The WHATWG Encoding Standard is referenced as a living standard, not copied wholesale: https://encoding.spec.whatwg.org/
