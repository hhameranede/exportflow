# ExportFlow

ExportFlow is being rebuilt as a model-agnostic agentic web infrastructure platform for AI agents.

## Product foundation
- Web data plane: search, map, direct HTTP fetch, bounded crawl, structured extraction.
- Browser execution plane: render dynamic pages and perform explicitly user-directed interactions.
- Shared runtime: adaptive routing, ExportFlow-owned adapter contracts, normalized results, provenance, bounded execution, and resumable task lifecycle.
- Developer surface: remote MCP first, then a versioned REST API and SDKs.

## Honest implementation status
The first Cloudflare Worker provides a public homepage, health/platform endpoints, routing preview, adapter registry primitives, and result normalization. Live web search, crawl, browser automation, hosted authentication, persistent tasks, and a production MCP server are not connected yet.

## Local development
Requires Node.js 24+.
```sh
npm test
npm run check
npx wrangler dev
```

Cloudflare Workers only. No Cloudflare Pages application or build pipeline is used.
