import { extractPdfText, PDF_PARSE_LIMITS, PdfParserError } from "../../src/core/pdf-parser.js";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

class RequestBodyError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.httpStatus = status;
  }
}

function cancelReaderBestEffort(reader) {
  try {
    const result = reader.cancel();
    if (result && typeof result.catch === "function") void result.catch(() => {});
  } catch {
    // A stream may already be closed or errored.
  }
}

async function readBoundedBody(request, maxBytes) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) {
      throw new RequestBodyError("INVALID_CONTENT_LENGTH", "Content-Length must be decimal digits only.", 400);
    }
    if (Number(declaredLength) > maxBytes) {
      throw new RequestBodyError("PDF_TOO_LARGE", "PDF input exceeds the 1 MiB extraction limit.", 413);
    }
  }
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  let chunkCount = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunkCount += 1;
      if (chunkCount > 1024 || value.byteLength > maxBytes - totalBytes) {
        cancelReaderBestEffort(reader);
        throw new RequestBodyError("PDF_TOO_LARGE", "PDF request body exceeds a bounded stream limit.", 413);
      }
      totalBytes += value.byteLength;
      chunks.push(value);
    }
  } catch (error) {
    cancelReaderBestEffort(reader);
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("INVALID_BODY", "Could not read the PDF request body.", 400);
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        status: "ok",
        parser: "unpdf",
        parserVersion: "2.2.3",
        maxInputBytes: PDF_PARSE_LIMITS.maxInputBytes,
        maxPages: PDF_PARSE_LIMITS.maxPages,
      });
    }

    if (request.method !== "POST" || url.pathname !== "/parse") {
      return json({ error: { code: "NOT_FOUND", message: "Not found." } }, 404);
    }

    // Fail closed: a remotely deployed compatibility Worker must have its own
    // secret configured. Never commit a reusable token or accept open parsing.
    const expectedToken = typeof env.PDF_PARSER_SMOKE_TOKEN === "string"
      ? env.PDF_PARSER_SMOKE_TOKEN
      : "";
    if (expectedToken.length < 32) {
      return json({
        error: { code: "PARSER_AUTH_NOT_CONFIGURED", message: "PDF parser smoke authentication is not configured." },
      }, 503);
    }
    if (request.headers.get("authorization") !== "Bearer " + expectedToken) {
      return json({
        error: { code: "UNAUTHORIZED", message: "A valid bearer token is required." },
      }, 401);
    }

    const contentType = String(request.headers.get("content-type") || "")
      .split(";")[0].trim().toLowerCase();
    if (!["application/pdf", "application/octet-stream"].includes(contentType)) {
      return json({
        error: { code: "UNSUPPORTED_CONTENT_TYPE", message: "Expected PDF bytes." },
      }, 415);
    }

    try {
      const bytes = await readBoundedBody(request, PDF_PARSE_LIMITS.maxInputBytes);
      const result = await extractPdfText(bytes, { contentType });
      return json({ ok: true, ...result });
    } catch (error) {
      const known = error instanceof PdfParserError || error instanceof RequestBodyError;
      return json({
        error: {
          code: known ? error.code : "PDF_PARSE_FAILED",
          message: known ? error.message : "PDF content could not be parsed.",
        },
      }, known ? error.httpStatus : 422);
    }
  },
};
