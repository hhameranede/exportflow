# Defuddle parser-only spike

This branch evaluates Defuddle `0.19.6` as a **local HTML-to-Markdown parser**, not as a crawler or HTTP fetching service.

## Architecture boundary

1. `createDefuddleAdapter()` validates the requested URL with ExportFlow's existing egress policy.
2. The default `fetchResource` is ExportFlow's `fetchPublicResource()`, retaining its GET-only behavior, redirect revalidation, 8-second timeout and 1 MiB response cap.
3. Only the bounded HTML body is passed to `parseDefuddleHtml()`; the final URL is passed as document metadata for relative-link resolution.
4. Defuddle's synchronous `parse()` path is used with `useAsync: false`; `parseAsync()` is not used. The parser receives no network client and never owns the fetch stage.
5. The adapter returns Markdown, selected metadata, source URL, retrieval time and HTTP/content-extraction evidence. Markdown is untrusted source content and must not be rendered as trusted HTML.

The adapter is deliberately **not registered** in the shared adapter catalog and no public MCP/HTTP tool is added in this spike. It is an internal candidate only.

## Versions

- `defuddle`: exact pin `0.19.6` (MIT)
- `linkedom`: exact pin `0.18.15` (ISC)

The branch's package install is intentionally an experimental registry install and does not yet contain a committed lockfile. A reproducible lockfile and full transitive license/advisory review remain mandatory before merging or production use.

## Tests

`npm test` runs unit tests for input validation, bounded bytes, content type, result provenance and error handling. The real package/runtime fixture is enabled in CI with `EXPORTFLOW_DEFUDDLE_INTEGRATION=1`; it checks headings, Arabic text, tables, unsafe link/attribute removal, and that parsing makes no extra `fetch()` calls.

Local validation should use Node 24 (the repository engine and CI version):

```sh
npm install --package-lock=false --ignore-scripts --no-audit --no-fund
npm test
npm run check
```

The local tool environment used to prepare this spike had Node `22.16.0` and npm registry DNS failures (`EAI_AGAIN`), so real Defuddle installation and execution could not be claimed locally. The GitHub Actions CI job installs packages and runs the actual integration fixture on Node 24.

## Explicit non-goals

- No use of `defuddle.md` or any other hosted conversion endpoint.
- No copied upstream URL fetcher, redirect logic, API-key billing, KV, Durable Object or Stripe code.
- No automatic registration, public tool exposure, Browser Run, authenticated browsing or JavaScript execution of page content.
- No merge, deployment, Cloudflare binding/secret/DNS/permission change, Production change or paid service activation.
