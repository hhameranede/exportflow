# MCP Preview request-body bounds

The Streamable HTTP endpoint rejects an announced `Content-Length` above 65,536 bytes before reading the body. It also enforces the same byte ceiling while consuming the request stream, so requests without a declared length or with a misleading length cannot bypass the limit.

The streaming reader additionally caps the number of chunks at 8,192. This includes empty chunks: a client cannot keep the Worker busy by sending an unbounded stream of zero-byte frames while remaining below the byte limit. The reader rejects either limit with HTTP 413 and initiates best-effort stream cancellation without waiting for a cancellation callback that may never settle.

Accepted bytes are decoded as strict UTF-8 before JSON parsing. Malformed UTF-8 is rejected as an invalid body; it is not silently replaced. Oversized or malformed input is rejected before JSON-RPC tool dispatch, tenant quota reservation, or task execution.

Regression tests cover:
- Announced oversize bodies.
- Chunked oversize bodies without `Content-Length`.
- Too many empty chunks.
- Cancellation callbacks that reject or never settle.
- No task execution on any rejected body.

These are source-level tests. A passing Node test or Wrangler dry-run is not a substitute for validation in the target Cloudflare Worker runtime.
