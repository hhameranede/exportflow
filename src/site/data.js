export const SITE_META = Object.freeze({
  brandName: "ExportFlow",
  tagline: "If AI can plan it, ExportFlow helps it execute it.",
  positioning: "Agent Execution Infrastructure — The Execution Layer for AI.",
  defaultOrigin: "https://exportflow.me",
  stageNote: "Phase 1 Foundation",
});

export const NAV_ITEMS = Object.freeze([
  { href: "/platform", label: "Platform" },
  { href: "/use-cases", label: "Use Cases" },
  { href: "/developers", label: "Developers" },
  { href: "/faq", label: "FAQ" },
]);

export const CAPABILITIES = Object.freeze([
  {
    id: "http-fetch",
    index: "01",
    name: "HTTP Fetch",
    adapterId: "http.fetch.v1",
    maturity: "Local Runtime Verified",
    maturityKey: "local-verified",
    summary:
      "Bounded direct HTTP(S) retrieval for public text, HTML, JSON, and XML sources without headless browser overhead.",
    details:
      "Verified in Node.js 22/24 and local Cloudflare Workerd via authenticated POST /api/v1/tasks when D1 tenant auth and quota tables are configured. Enforces SSRF egress checks, manual redirect revalidation, and streamed byte caps. Production rollout is pending.",
    limits: [
      "GET only on default HTTP/HTTPS ports",
      "Max 1 MiB response body, 8s timeout, 3 redirects",
      "No cookies, credentials, or HTTPS-to-HTTP downgrades",
    ],
  },
  {
    id: "web-search",
    index: "02",
    name: "Web Search & Research",
    adapterId: "web.search.v1 / web.research.v1",
    maturity: "Internal Prototype",
    maturityKey: "prototype",
    summary:
      "Normalized discovery and multi-source synthesis factories with URL revalidation and provenance capture.",
    details:
      "Implemented in Core as injected-binding factories targeting bounded web search and multi-candidate extraction. Not registered in default runtime endpoints until live search bindings and policy limits are enabled.",
    limits: [
      "Capped at 10 deduplicated results per query",
      "Each candidate URL revalidated against egress policy",
      "Returns 501 unsupported on live task endpoints",
    ],
  },
  {
    id: "map-crawl",
    index: "03",
    name: "Mapping & Crawl",
    adapterId: "web.map.v1 / web.crawl.v1",
    maturity: "Internal Prototype",
    maturityKey: "prototype",
    summary:
      "Same-origin URL discovery via robots.txt, sitemaps, and bounded breadth-first page traversal.",
    details:
      "Implemented and unit-tested in internal Core modules using ExportFlowBot/0.1 and RFC 9309 robots rules. Rejected with 501 OPERATION_NOT_ENABLED on the task API while Phase 1 remains scoped to single-resource fetch.",
    limits: [
      "Same-origin links and redirects only",
      "Max 5 pages, depth 2, bounded per-page and total bytes",
      "Respects robots.txt; halts on 401/403/429 or 5xx",
    ],
  },
  {
    id: "extract",
    index: "04",
    name: "Structured Extraction",
    adapterId: "web.extract.v1",
    maturity: "Internal Prototype",
    maturityKey: "prototype",
    summary:
      "Deterministic field extraction against a bounded JSON Schema using JSON-LD, OpenGraph, meta tags, and x-source paths.",
    details:
      "Implemented as an internal adapter using deterministic parsing without LLM inference or script execution. Disabled on public HTTP endpoints until Phase 2 contract exposure is approved.",
    limits: [
      "Schema capped at 16 KiB and 20 properties",
      "Max 20 JSON-LD blocks (128 KiB each), 100 nodes",
      "Zero remote @context fetching or page script execution",
    ],
  },
  {
    id: "browser-exec",
    index: "05",
    name: "Browser Execution",
    adapterId: "web.browser.v1 (factory)",
    maturity: "Concept",
    maturityKey: "concept",
    summary:
      "Escalation path for JavaScript-rendered pages and explicitly authorized interactive sessions when direct HTTP is insufficient.",
    details:
      "Router detects requiresJavascript and requiresInteraction signals, and Core contains a render-only factory behind an injected Browser binding. No live browser binding is configured, and user-directed clicks or form interactions remain unimplemented.",
    limits: [
      "Always returns 501 unsupported on current endpoints",
      "Prototype render factory enforces 15s budget and 512 KiB HTML cap",
      "Requires separate egress and DNS-rebinding review before enabling",
    ],
  },
  {
    id: "orchestration",
    index: "06",
    name: "Gateway, Auth & Quotas",
    adapterId: "tenant-task-gateway / Better Auth",
    maturity: "In Development",
    maturityKey: "in-development",
    summary:
      "Unified execution lifecycle, per-tenant D1 API keys, UTC quota windows, Durable Object burst limiting, and Better Auth / OAuth foundations.",
    details:
      "Includes fail-closed D1 tenant API key verification (ef_live_*), atomic UTC request quota reservations, shared Durable Object TenantBurstRateLimiter, and Better Auth account security with TOTP 2FA and OAuth/MCP consent previews. Ephemeral single-task execution runs without durable task queues.",
    limits: [
      "Ephemeral per-request task execution (no stored history yet)",
      "Quota and burst checks fail closed when D1/DO bindings are absent",
      "Usage reports measured latency and bytes; billing cost is null",
    ],
  },
]);

export const VALUE_PILLARS = Object.freeze([
  {
    number: "01",
    title: "Consistent execution interface",
    description:
      "Agents submit one predictable task contract rather than stitching together custom HTTP clients, parser flags, and ad-hoc retry loops.",
  },
  {
    number: "02",
    title: "Multiple execution engine types",
    description:
      "The router selects the lightest suitable path first—direct HTTP retrieval before any heavier rendering engine is considered.",
  },
  {
    number: "03",
    title: "Controlled task boundaries",
    description:
      "Every task operates under explicit byte limits, timeouts, redirect ceilings, fail-closed authentication, and outbound egress filtering.",
  },
  {
    number: "04",
    title: "Structured outputs",
    description:
      "Execution returns a normalized status envelope alongside predictable data and sanitized error codes instead of raw exception traces.",
  },
  {
    number: "05",
    title: "Source evidence & provenance",
    description:
      "Responses capture requested URL, final resolved URL, redirect hops, retrieval timestamp, HTTP status, and byte counts.",
  },
  {
    number: "06",
    title: "Provider-neutral architecture",
    description:
      "Capabilities sit behind ExportFlow-owned adapter contracts so underlying engines can evolve without breaking caller integrations.",
  },
]);

export const PLATFORM_LAYERS = Object.freeze([
  {
    id: "agent-interface",
    step: "Layer 01",
    name: "Agent Interface",
    maturity: "Local Runtime Verified (REST) · Preview (MCP OAuth)",
    responsibility:
      "Entry point where AI systems and developer services submit structured execution requests and inspect platform capabilities.",
    howItWorks:
      "Exposed via versioned HTTP routes (/api/v1/health, /api/v1/platform, /api/v1/router-preview, and authenticated POST /api/v1/tasks), plus a separate MCP preview worker with Better Auth OAuth 2.0 consent and tenant selection. Production public endpoints remain gated.",
    controls: "Strict HTTP method handling, content-type enforcement, fail-closed JSON errors.",
  },
  {
    id: "task-contract",
    step: "Layer 02",
    name: "Task Contract",
    maturity: "Local Runtime Verified",
    responsibility:
      "Schema boundary that validates every incoming payload before quota reservation, routing, or outbound network allocation occurs.",
    howItWorks:
      "Enforces a 32 KiB JSON body ceiling, fatal UTF-8 decoding, an explicit allowlist of top-level keys (goal, url, operation, requiresJavascript, requiresInteraction, limits), and bounded integer constraints on limits.",
    controls: "Unknown properties rejected with 400 INVALID_TASK; unenabled operations fail early with 501.",
  },
  {
    id: "auth-policy",
    step: "Layer 03",
    name: "Authentication, Quotas & Policy",
    maturity: "Local Runtime Verified",
    responsibility:
      "Ensures only authorized tenants execute tasks within burst limits, plan quotas, and safe outbound network boundaries.",
    howItWorks:
      "Checks pre-auth client IP burst rate, verifies D1-backed tenant API keys (ef_live_<keyId>_<secret> via SHA-256) or OAuth tenant claims, enforces a shared Durable Object TenantBurstRateLimiter, reserves D1 UTC quota windows, and applies EGRESS_POLICY before and during redirects.",
    controls: "Fails closed without D1/DO bindings; rejects IP literals, local/reserved hostnames, ExportFlow origins, embedded credentials, non-default ports.",
  },
  {
    id: "execution-router",
    step: "Layer 04",
    name: "Execution Router",
    maturity: "Local Runtime Verified",
    responsibility:
      "Evaluates task requirements and selects the lowest-cost, lowest-risk execution path capable of fulfilling the request.",
    howItWorks:
      "chooseExecutionPath() defaults static retrieval to the http path with escalationAllowed metadata, while flagging requiresJavascript or requiresInteraction tasks for the browser path (which presently halts cleanly with 501 unsupported).",
    controls: "Deterministic pure selection logic; never silently falls back to unconfigured bindings.",
  },
  {
    id: "engine-adapters",
    step: "Layer 05",
    name: "Engine Adapters",
    maturity: "HTTP Live Locally · Extraction/Map/Crawl Internal",
    responsibility:
      "Encapsulates concrete execution implementations behind versioned, ExportFlow-owned contracts.",
    howItWorks:
      "Each adapter declares its id, family, capabilities, limits, and restrictions. http.fetch.v1 handles bounded text HTTP(S) retrieval; web.map.v1, web.crawl.v1, and web.extract.v1 exist internally for future phased activation.",
    controls: "Streaming byte cancellation, manual redirect hop checks, zero cookie/credential forwarding.",
  },
  {
    id: "result-normalization",
    step: "Layer 06",
    name: "Result Normalization",
    maturity: "Local Runtime Verified",
    responsibility:
      "Coerces engine-specific outcomes into one stable response schema consumable by any downstream model or workflow.",
    howItWorks:
      "Wraps outputs via normalizeResult() with uniform status (succeeded, partial, failed, or task state unsupported), standardized error codes from a static safe-message dictionary, lifecycle events, and measured usage telemetry.",
    controls: "Upstream secrets, Set-Cookie headers, and raw stack errors never pass into caller payloads.",
  },
  {
    id: "evidence-provenance",
    step: "Layer 07",
    name: "Evidence & Provenance",
    maturity: "Local Runtime Verified",
    responsibility:
      "Attaches verifiable operational metadata so agents and auditors can trace where every datum originated.",
    howItWorks:
      "Every normalized result attaches sources[] records containing verified HTTP(S) URLs, ISO-8601 retrievedAt timestamps, and evidence entries capturing status codes, MIME types, byte lengths, and redirect counts.",
    controls: "Rejects non-HTTP(S) or invalid source URLs inside normalizeResult() before serialization.",
  },
]);

export const USE_CASES = Object.freeze([
  {
    id: "multi-source-research",
    title: "Multi-source Research",
    maturity: "Internal Prototype (Pipeline) · HTTP Fetch Local Verified",
    maturityKey: "prototype",
    summary:
      "An agent gathers facts across multiple public pages while preserving exact source attribution for every retrieved claim.",
    problem:
      "Models frequently blend snippets together without tracking redirect paths, retrieval times, or whether a page failed partway through.",
    agentRole:
      "Formulates the research query or target URL list, evaluates retrieved content for reasoning, and synthesizes the final answer.",
    exportflowRole:
      "Validates candidate URLs against egress rules, executes bounded fetches (and in future stages, orchestrates Search -> Fetch -> Extract), and returns source-linked evidence arrays.",
    sampleJson: {
      taskId: "ef_demo_research_01",
      state: "partial",
      execution: { path: "http", operation: "research (prototype)", adapterId: "web.research.v1" },
      result: {
        status: "partial",
        data: {
          candidateCount: 3,
          fetchedCount: 2,
          extractedSummary: { organization: "Example Standards Body", specification: "RFC 9309" },
        },
        sources: [
          {
            url: "https://example.org/standards/robots",
            retrievedAt: "2026-11-19T12:00:01.000Z",
            evidence: [{ type: "http_response", status: 200, bytes: 14280, redirectCount: 0 }],
          },
        ],
        warnings: ["Third candidate exceeded byte budget; result marked partial."],
      },
    },
  },
  {
    id: "website-intelligence",
    title: "Website Intelligence",
    maturity: "Internal Prototype (web.map.v1 / web.crawl.v1)",
    maturityKey: "prototype",
    summary:
      "An agent maps a public site structure via robots.txt and sitemaps before retrieving targeted pages inside strict crawl bounds.",
    problem:
      "Unbounded scrapers wander off-origin, ignore robots rules, or exhaust compute budgets chasing infinite calendar links.",
    agentRole:
      "Supplies the seed URL and selects which discovered routes merit deeper reading or extraction.",
    exportflowRole:
      "Parses robots.txt under ExportFlowBot/0.1 rules, pins crawl redirects to the seed origin, caps traversal at 5 pages / depth 2, and enforces total byte ceilings.",
    sampleJson: {
      taskId: "ef_demo_crawl_02",
      state: "succeeded",
      execution: { path: "http", operation: "map (prototype)", adapterId: "web.map.v1" },
      result: {
        status: "succeeded",
        data: {
          origin: "https://example.com",
          robots: { fetched: true, allowed: true },
          sitemaps: ["https://example.com/sitemap.xml"],
          urls: ["https://example.com/docs", "https://example.com/changelog"],
        },
        warnings: [],
      },
    },
  },
  {
    id: "browser-execution",
    title: "Browser-based Execution",
    maturity: "Concept / Render Prototype Only (Disabled)",
    maturityKey: "concept",
    summary:
      "An agent requires DOM rendering or bounded interaction on a dynamic web application where raw HTTP returns only an empty shell.",
    problem:
      "Running unmanaged headless browsers exposes internal networks, consumes unpredictable memory, and mixes navigation with untrusted page scripts.",
    agentRole:
      "Marks requiresJavascript or requiresInteraction in the task intent when static retrieval cannot expose required DOM state.",
    exportflowRole:
      "Routes the task to the browser path. Currently returns 501 unsupported cleanly rather than simulating fake results; planned execution isolates sessions under strict navigation budgets.",
    sampleJson: {
      taskId: "ef_demo_browser_03",
      state: "unsupported",
      execution: {
        path: "browser",
        operation: "fetch",
        adapterId: null,
        reason: "The task requires page rendering or user-directed interaction.",
      },
      errors: [
        {
          code: "BROWSER_UNAVAILABLE",
          message: "Browser Run binding is not configured.",
        },
      ],
      usage: { durationMs: 2, requestsAttempted: 0, responseBytes: 0, cost: null },
    },
  },
  {
    id: "long-running-workflows",
    title: "Long-running Workflows",
    maturity: "Concept / Planned Infrastructure",
    maturityKey: "concept",
    summary:
      "Multi-step agent executions requiring durable task IDs, queued state transitions, cancellation signals, and resumption.",
    problem:
      "Synchronous HTTP timeouts break complex agent workflows, leaving callers blind to partial progress or retry safety.",
    agentRole:
      "Submits an async task goal, listens for lifecycle state transitions, or issues an explicit cancellation.",
    exportflowRole:
      "Foundation already models standardized lifecycle events (task.accepted, task.started, task.succeeded / task.failed) and propagates client AbortSignal during live fetch; durable storage and queues are future milestones.",
    sampleJson: {
      taskId: "ef_demo_lifecycle_04",
      state: "planned_async_model",
      events: [
        { type: "task.accepted", at: "2026-11-19T12:05:00.000Z" },
        { type: "task.started", at: "2026-11-19T12:05:00.015Z", executionPath: "http" },
        { type: "task.succeeded", at: "2026-11-19T12:05:00.340Z" },
      ],
      note: "Current Phase 1 executes ephemerally per request; durable persistence is not yet connected.",
    },
  },
  {
    id: "structured-data-collection",
    title: "Structured Data Collection",
    maturity: "Internal Prototype (web.extract.v1)",
    maturityKey: "prototype",
    summary:
      "An agent requests specific typed fields defined by JSON Schema and receives validated values paired with missing-field reporting.",
    problem:
      "Dumping raw HTML into a model context inflates token costs, introduces prompt-injection exposure, and omits field provenance.",
    agentRole:
      "Declares a bounded JSON Schema specifying expected property types and candidate metadata or JSON-LD source paths.",
    exportflowRole:
      "Parses HTML/JSON deterministically (zero LLM inference, zero page script execution), validates extracted values against types, and reports missingRequired plus field-level source records.",
    sampleJson: {
      taskId: "ef_demo_extract_05",
      state: "succeeded",
      execution: { path: "http", operation: "extract (prototype)", adapterId: "web.extract.v1" },
      result: {
        status: "succeeded",
        data: {
          fields: { title: "Technical Specification", publisher: "Example Foundation" },
          missingFields: [],
          missingRequired: [],
        },
        sources: [{ url: "https://example.org/spec", evidence: [{ type: "json_ld", nodeCount: 2 }] }],
      },
    },
  },
]);

export const DEMO_PRESETS = Object.freeze({
  "public-fetch": {
    id: "public-fetch",
    label: "Public Webpage Fetch",
    goal: "Retrieve homepage title, status code, and source evidence",
    url: "https://example.com/",
    operation: "fetch",
    requiresJavascript: false,
    requiresInteraction: false,
    timeoutMs: 8000,
    maxBytes: 1048576,
    maxRedirects: 3,
    illustrativeBody:
      "<!doctype html><html><head><title>Example Domain</title></head><body><h1>Example Domain</h1><p>Illustrative HTML snippet shown in preview mode.</p></body></html>",
    illustrativeTitle: "Example Domain",
    illustrativeStatus: 200,
    illustrativeContentType: "text/html; charset=utf-8",
    illustrativeBytes: 577,
    illustrativeRedirects: [],
  },
  "redirect-trace": {
    id: "redirect-trace",
    label: "Validated Redirect Chain",
    goal: "Follow HTTPS redirect safely and record every hop in provenance",
    url: "https://docs.example.org/latest",
    operation: "fetch",
    requiresJavascript: false,
    requiresInteraction: false,
    timeoutMs: 5000,
    maxBytes: 262144,
    maxRedirects: 2,
    illustrativeBody:
      "<!doctype html><html><head><title>Documentation Index</title></head><body><h1>Documentation v2</h1></body></html>",
    illustrativeTitle: "Documentation Index",
    illustrativeStatus: 200,
    illustrativeContentType: "text/html; charset=utf-8",
    illustrativeBytes: 1840,
    illustrativeRedirects: [
      {
        status: 302,
        from: "https://docs.example.org/latest",
        to: "https://docs.example.org/v2/guide",
      },
    ],
  },
  "ssrf-blocked": {
    id: "ssrf-blocked",
    label: "Policy Block (Private IP)",
    goal: "Attempt access to local metadata endpoint to verify egress defense",
    url: "http://127.0.0.1/admin",
    operation: "fetch",
    requiresJavascript: false,
    requiresInteraction: false,
    timeoutMs: 8000,
    maxBytes: 1048576,
    maxRedirects: 3,
  },
  "size-capped": {
    id: "size-capped",
    label: "Byte Budget Exceeded",
    goal: "Fetch resource with tight 100-byte safety limit",
    url: "https://example.com/",
    operation: "fetch",
    requiresJavascript: false,
    requiresInteraction: false,
    timeoutMs: 8000,
    maxBytes: 100,
    maxRedirects: 3,
    forceOutcome: "RESPONSE_TOO_LARGE",
  },
  "browser-unsupported": {
    id: "browser-unsupported",
    label: "Browser Escalation (501)",
    goal: "Render client-side SPA dashboard requiring JS execution",
    url: "https://app.example.org/dashboard",
    operation: "fetch",
    requiresJavascript: true,
    requiresInteraction: false,
    timeoutMs: 8000,
    maxBytes: 1048576,
    maxRedirects: 3,
  },
});

export const DEVELOPER_ERROR_CODES = Object.freeze([
  { code: "AUTH_NOT_CONFIGURED", status: 503, cause: "EXPORTFLOW_AUTH_DB (D1) or TenantBurstRateLimiter (DO) binding is unavailable or uninitialized.", recovery: "Provision D1/DO bindings and run migrations before calling POST /api/v1/tasks." },
  { code: "UNAUTHORIZED / INVALID_TOKEN", status: 401, cause: "Missing, malformed, revoked, expired, or non-matching ef_live_* Bearer API key.", recovery: "Send an active Authorization: Bearer ef_live_<keyId>_<secret> header." },
  { code: "INSUFFICIENT_SCOPE", status: 403, cause: "The presented tenant key or OAuth token lacks the required tasks:fetch scope.", recovery: "Issue a credential with the tasks:fetch scope." },
  { code: "RATE_LIMITED", status: 429, cause: "Pre-auth client IP ceiling or shared Durable Object tenant burst window exceeded.", recovery: "Honor Retry-After header seconds before retrying." },
  { code: "QUOTA_EXCEEDED", status: 429, cause: "Tenant UTC daily or monthly plan request quota in D1 is exhausted.", recovery: "Wait for the x-plan-reset UTC boundary or upgrade tenant plan." },
  { code: "UNSUPPORTED_MEDIA_TYPE", status: 415, cause: "Request Content-Type is not application/json.", recovery: "Set Content-Type: application/json." },
  { code: "PAYLOAD_TOO_LARGE", status: 413, cause: "Task JSON request exceeds 32,768 bytes.", recovery: "Trim goal text or unused fields within 32 KiB." },
  { code: "INVALID_TASK / INVALID_GOAL / INVALID_LIMIT", status: 400, cause: "Unknown keys, invalid goal length, or out-of-range limits.", recovery: "Restrict keys to documented contract and integer limits." },
  { code: "URL_NOT_ALLOWED", status: 400, cause: "Non-HTTP(S), IP literal, embedded credentials, non-default port, or blocked host.", recovery: "Supply a public HTTP(S) DNS domain URL." },
  { code: "OPERATION_NOT_ENABLED / BROWSER_UNAVAILABLE", status: 501, cause: "Operation other than fetch, or requiresJavascript/requiresInteraction requested.", recovery: "Use operation: \"fetch\" for Phase 1; browser and crawl remain unexposed on the task API." },
  { code: "RESPONSE_TOO_LARGE", status: 413, cause: "Upstream content-length or streamed body exceeded maxBytes.", recovery: "Increase limits.maxBytes up to 1,048,576 or target a smaller document." },
  { code: "UPSTREAM_TIMEOUT", status: 504, cause: "Upstream server did not complete within limits.timeoutMs.", recovery: "Retry with backoff or adjust timeoutMs up to 8000." },
  { code: "REDIRECT_NOT_ALLOWED / REDIRECT_DOWNGRADE", status: 502, cause: "Redirect pointed to blocked destination or downgraded HTTPS to HTTP.", recovery: "Inspect target chain; policy intentionally blocks unsafe hops." },
]);

export const FAQ_ITEMS = Object.freeze([
  {
    id: "what-is-exportflow",
    category: "Overview",
    question: "What is ExportFlow?",
    answer:
      "ExportFlow is Agent Execution Infrastructure—a unified execution layer being built to let AI systems delegate bounded external tasks (such as fetching, mapping, structured extraction, and eventually browser execution) and receive normalized results with source evidence.",
  },
  {
    id: "diff-from-ai-model",
    category: "Architecture",
    question: "How is ExportFlow different from an AI model?",
    answer:
      "AI models are reasoning systems: they interpret prompts, plan next actions, and synthesize answers. They do not natively enforce SSRF boundaries, stream-cap HTTP bodies, manage redirects, or produce standardized source provenance. ExportFlow handles that deterministic execution infrastructure so models can focus on decisions.",
  },
  {
    id: "replace-model",
    category: "Architecture",
    question: "Does ExportFlow replace an AI model?",
    answer:
      "No. ExportFlow is explicitly designed to work underneath AI models and agent frameworks. The model decides what should be retrieved or executed; ExportFlow enforces policy limits, routes to an appropriate engine, and hands structured evidence back to the model.",
  },
  {
    id: "what-is-engine",
    category: "Architecture",
    question: "What is an execution engine?",
    answer:
      "An execution engine is the underlying runtime or capability that carries out a bounded operation—for example, direct Workers HTTP Fetch for static text/HTML/JSON retrieval, a deterministic parser for schema extraction, or a future headless browser environment for JavaScript-dependent apps.",
  },
  {
    id: "what-is-adapter",
    category: "Architecture",
    question: "What is an adapter?",
    answer:
      "An adapter is an ExportFlow-owned contract wrapper (such as http.fetch.v1 or web.extract.v1) that standardizes inputs, limits, security restrictions, and output structure for an underlying engine. Keeping providers behind adapters means engines can be swapped without breaking agent integrations.",
  },
  {
    id: "why-evidence-matters",
    category: "Reliability",
    question: "Why does source evidence matter?",
    answer:
      "AI systems frequently hallucinate or lose track of where facts came from. Attaching requested URL, resolved final URL, HTTP status, redirect chain, retrieval timestamp, and byte count gives downstream agents and human auditors verifiable provenance for every output.",
  },
  {
    id: "ai-provider-support",
    category: "Integration",
    question: "Does ExportFlow support different AI providers?",
    answer:
      "Yes, by design. ExportFlow is model-agnostic: its task contract, HTTP interface, and normalized JSON envelopes do not depend on any single model vendor or proprietary prompt format.",
  },
  {
    id: "public-availability",
    category: "Status",
    question: "Is the platform publicly available?",
    answer:
      "Not as an open public SaaS execution service yet. Phase 1 implemented authenticated POST /api/v1/tasks (bounded HTTP fetch only) backed by D1 tenant keys, UTC quota windows, and Durable Object burst limits, alongside Better Auth account and MCP preview foundations. Public self-serve API keys and billing are not open yet.",
  },
  {
    id: "api-or-mcp",
    category: "Integration",
    question: "Can developers integrate through an API or MCP?",
    answer:
      "In local and acceptance Workers with D1 and Durable Object bindings, callers can exercise POST /api/v1/tasks (with an ef_live_* tenant key) alongside unauthenticated discovery routes (/api/v1/health, /api/v1/platform, /api/v1/router-preview). An MCP preview Worker with Better Auth OAuth 2.0 consent also exists in the repository for staged verification.",
  },
  {
    id: "hosted-browser",
    category: "Capabilities",
    question: "Does ExportFlow require a hosted browser?",
    answer:
      "No. ExportFlow starts with direct HTTP retrieval because most read-only web tasks do not need browser overhead. While Core includes a render-only Browser adapter prototype factory, no browser binding is connected today and browser tasks cleanly return 501 unsupported.",
  },
  {
    id: "ssrf-defense",
    category: "Security",
    question: "How does ExportFlow enforce outbound network safety?",
    answer:
      "Outbound requests pass an application-layer egress policy rejecting non-HTTP(S) schemes, IP literals (including alternate encodings), local/internal suffixes, non-default ports, and ExportFlow-owned hostnames, plus manual hop-by-hop redirect revalidation. In Cloudflare Workers, outbound fetches also traverse Cloudflare's outbound proxy.",
  },
  {
    id: "logistics-retired",
    category: "Overview",
    question: "What happened to any earlier logistics or shipment tracking focus?",
    answer:
      "That direction is retired. ExportFlow is focused exclusively on Agent Execution Infrastructure—coordinating deterministic execution engines, bounded policies, and evidence-backed results for AI systems.",
  },
]);
