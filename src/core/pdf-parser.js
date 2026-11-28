export const PDF_PARSE_LIMITS = Object.freeze({
  maxInputBytes: 1_048_576,
  maxPages: 10,
  maxOutputCharacters: 65_536,
  maxTextItems: 100_000,
  maxImageSize: 16_777_216,
  maxParseTimeMs: 5_000,
});

const PDF_MIME_TYPES = new Set(["application/pdf", "application/octet-stream"]);

export class PdfParserError extends Error {
  constructor(code, message, httpStatus = 422, options = {}) {
    super(message, options);
    this.name = "PdfParserError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function toByteArray(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new PdfParserError("PDF_INVALID_INPUT", "PDF input must be an ArrayBuffer or Uint8Array.", 400);
}

function normalizeMime(value) {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

function sliceAtCodePointBoundary(value, maxCodeUnits) {
  const end = Math.max(0, Math.min(value.length, maxCodeUnits));
  if (end > 0 && end < value.length) {
    const previous = value.charCodeAt(end - 1);
    const next = value.charCodeAt(end);
    if (previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      return value.slice(0, end - 1);
    }
  }
  return value.slice(0, end);
}

export function boundPdfText(value) {
  const normalizedText = String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  return Object.freeze({
    text: sliceAtCodePointBoundary(normalizedText, PDF_PARSE_LIMITS.maxOutputCharacters),
    truncated: normalizedText.length > PDF_PARSE_LIMITS.maxOutputCharacters,
  });
}

export function hasPdfSignature(input) {
  const bytes = toByteArray(input);
  const limit = Math.min(bytes.byteLength - 5, 1023);
  for (let index = 0; index <= limit; index += 1) {
    if (
      bytes[index] === 0x25 &&
      bytes[index + 1] === 0x50 &&
      bytes[index + 2] === 0x44 &&
      bytes[index + 3] === 0x46 &&
      bytes[index + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
}

function trimIncompleteTrailingSurrogate(value) {
  let text = value;
  while (text.length > 0) {
    const last = text.charCodeAt(text.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) {
      text = text.slice(0, -1);
      continue;
    }
    if (last >= 0xdc00 && last <= 0xdfff) {
      const previous = text.length > 1 ? text.charCodeAt(text.length - 2) : 0;
      if (previous < 0xd800 || previous > 0xdbff) {
        text = text.slice(0, -1);
        continue;
      }
    }
    break;
  }
  return text;
}

function cancelReaderBestEffort(reader) {
  try {
    const cancellation = reader.cancel();
    if (cancellation && typeof cancellation.catch === "function") void cancellation.catch(() => {});
  } catch {
    // A stream may already be closed, errored, or locked by the runtime.
  }
}

/**
 * Consume one PDF.js text stream without draining it after a parser ceiling.
 * The owning PDF document is destroyed by extractPdfText() after this helper
 * returns, which closes the abandoned stream without racing an explicit
 * reader.cancel() against PDF.js' stream-controller close.
 */
export async function consumePdfTextStream(reader, options = {}) {
  const maxTextItems = options.maxTextItems ?? PDF_PARSE_LIMITS.maxTextItems;
  const maxOutputCharacters = options.maxOutputCharacters ?? PDF_PARSE_LIMITS.maxOutputCharacters;
  const getRemainingTimeMs = options.getRemainingTimeMs ?? (() => PDF_PARSE_LIMITS.maxParseTimeMs);
  const onTimeout = options.onTimeout;
  if (!Number.isInteger(maxTextItems) || maxTextItems < 0 ||
      !Number.isInteger(maxOutputCharacters) || maxOutputCharacters < 0 ||
      typeof getRemainingTimeMs !== "function") {
    throw new PdfParserError("PDF_INVALID_LIMIT", "PDF stream limits are invalid.", 400);
  }

  let text = "";
  let itemCount = 0;
  let truncated = maxTextItems === 0 || maxOutputCharacters === 0;

  while (!truncated) {
    const chunk = await withPdfParserTimeout(
      () => reader.read(),
      getRemainingTimeMs(),
      () => {
        try { onTimeout?.(); } catch {}
        cancelReaderBestEffort(reader);
      },
    );
    if (chunk.done) break;

    const items = Array.isArray(chunk.value?.items) ? chunk.value.items : [];
    for (const item of items) {
      itemCount += 1;
      if (itemCount > maxTextItems) {
        truncated = true;
        break;
      }
      if (typeof item?.str === "string" && item.str.length > 0) {
        const addition = item.str + (item.hasEOL ? "\n" : "");
        const remaining = maxOutputCharacters - text.length;
        if (addition.length > remaining) {
          text += sliceAtCodePointBoundary(addition, remaining);
          truncated = true;
          break;
        }
        text += addition;
      }
      // Stop conservatively at equality: another read is required to know
      // whether the stream has ended, so reaching the ceiling is reported as
      // truncated even when the final chunk may contain exactly all content.
      if (itemCount >= maxTextItems || text.length >= maxOutputCharacters) {
        truncated = true;
        break;
      }
    }
    // Do not call reader.read() again once a ceiling is reached.
    // Document cleanup owns stream shutdown; explicit cancel() can race PDF.js.
  }

  return {
    text: truncated ? trimIncompleteTrailingSurrogate(text) : text,
    itemCount: Math.min(itemCount, maxTextItems),
    truncated,
  };
}

/**
 * Run one PDF.js operation under a bounded wall-clock deadline.
 * onTimeout is used to release a document proxy if one has already loaded.
 */
export function withPdfParserTimeout(operation, timeoutMs = PDF_PARSE_LIMITS.maxParseTimeMs, onTimeout) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > PDF_PARSE_LIMITS.maxParseTimeMs) {
    throw new PdfParserError("PDF_INVALID_TIMEOUT", "PDF parser timeout is outside the supported range.", 400);
  }

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        // Timeout reporting must not suppress the typed timeout error.
      }
      reject(new PdfParserError(
        "PDF_PARSE_TIMEOUT",
        "PDF extraction exceeded the 5-second processing deadline.",
        504,
      ));
    }, timeoutMs);
  });

  return Promise.race([
    Promise.resolve().then(() => (typeof operation === "function" ? operation() : operation)),
    timeout,
  ]).finally(() => clearTimeout(timeoutId));
}

/**
 * Extract text from already-fetched PDF bytes.
 *
 * Text is consumed from PDF.js' per-page ReadableStream and stopped at the
 * output/item ceilings. This avoids retaining every page's text at once.
 * The parser never accepts a URL or initiates secondary requests.
 */
export async function extractPdfText(input, options = {}) {
  const bytes = toByteArray(input);
  const contentType = normalizeMime(options.contentType ?? "application/pdf");

  if (!PDF_MIME_TYPES.has(contentType)) {
    throw new PdfParserError(
      "UNSUPPORTED_CONTENT_TYPE",
      "PDF extraction requires application/pdf or a signature-checked application/octet-stream response.",
      415,
    );
  }

  if (bytes.byteLength < 5) {
    throw new PdfParserError("PDF_INVALID_SIGNATURE", "The response does not contain a PDF signature.", 415);
  }

  if (bytes.byteLength > PDF_PARSE_LIMITS.maxInputBytes) {
    throw new PdfParserError("PDF_TOO_LARGE", "PDF input exceeds the 1 MiB extraction limit.", 413);
  }

  if (!hasPdfSignature(bytes)) {
    throw new PdfParserError("PDF_INVALID_SIGNATURE", "The response does not contain a PDF signature.", 415);
  }

  let document;
  let parseTimedOut = false;
  const deadline = Date.now() + PDF_PARSE_LIMITS.maxParseTimeMs;
  const remainingTimeMs = () => Math.max(1, deadline - Date.now());

  try {
    if (typeof globalThis.Iterator !== "function") {
      throw new PdfParserError(
        "PDF_RUNTIME_UNSUPPORTED",
        "PDF extraction requires the Iterator global; use Node.js 24+ or a compatible Cloudflare Workers runtime.",
        503,
      );
    }
    const { getDocumentProxy } = await withPdfParserTimeout(
      () => import("unpdf"),
      remainingTimeMs(),
      () => { parseTimedOut = true; },
    );

    // PDF.js takes ownership of its input buffer. Pass a copy so callers retain
    // their bounded Fetch buffer for accounting and downstream provenance.
    // Defer invocation into a microtask so the deadline is armed before any
    // synchronous PDF.js setup work begins.
    const loadingPromise = Promise.resolve().then(() => getDocumentProxy(bytes.slice(), {
      isEvalSupported: false,
      enableXfa: false,
      useSystemFonts: true,
      useWorkerFetch: false,
      maxImageSize: PDF_PARSE_LIMITS.maxImageSize,
    }));

    // If loading finishes after the deadline, the late proxy still needs cleanup.
    loadingPromise.then((lateDocument) => {
      if (parseTimedOut && lateDocument !== document) {
        try {
          const cleanup = lateDocument?.loadingTask?.destroy();
          if (cleanup && typeof cleanup.catch === "function") void cleanup.catch(() => {});
        } catch {
          // Late cleanup is best-effort after the caller has already timed out.
        }
      }
    }).catch(() => {});

    document = await withPdfParserTimeout(
      loadingPromise,
      remainingTimeMs(),
      () => { parseTimedOut = true; },
    );

    if (!Number.isInteger(document.numPages) || document.numPages < 1) {
      throw new PdfParserError("PDF_INVALID_DOCUMENT", "PDF does not contain a readable page tree.", 422);
    }

    if (document.numPages > PDF_PARSE_LIMITS.maxPages) {
      throw new PdfParserError(
        "PDF_PAGE_LIMIT",
        "PDF exceeds the 10-page extraction limit.",
        413,
      );
    }

    let text = "";
    let itemCount = 0;
    let truncated = false;

    for (let pageNumber = 1; pageNumber <= document.numPages && !truncated; pageNumber += 1) {
      const page = await withPdfParserTimeout(
        () => document.getPage(pageNumber),
        remainingTimeMs(),
        () => { parseTimedOut = true; },
      );

      if (typeof page.streamTextContent !== "function") {
        throw new PdfParserError(
          "PDF_RUNTIME_UNSUPPORTED",
          "The PDF.js runtime does not expose streaming text extraction.",
          503,
        );
      }

      const reader = page.streamTextContent().getReader();
      const pageResult = await consumePdfTextStream(reader, {
        maxTextItems: PDF_PARSE_LIMITS.maxTextItems - itemCount,
        maxOutputCharacters: PDF_PARSE_LIMITS.maxOutputCharacters - text.length,
        getRemainingTimeMs: remainingTimeMs,
        onTimeout: () => { parseTimedOut = true; },
      });
      text += pageResult.text;
      itemCount += pageResult.itemCount;
      truncated = pageResult.truncated;

      if (pageNumber < document.numPages && text.length > 0 && !truncated) {
        const remaining = PDF_PARSE_LIMITS.maxOutputCharacters - text.length;
        if (remaining > 0) text += "\n".slice(0, remaining);
      }
    }

    const normalizedText = text
      .replace(/\u0000/g, "")
      .replace(/\r\n?/g, "\n")
      .trim();

    if (!normalizedText) {
      throw new PdfParserError(
        "PDF_NO_TEXT_LAYER",
        "No extractable text layer was found. Scanned-PDF OCR is not supported.",
        422,
      );
    }

    return Object.freeze({
      format: "pdf",
      parser: "unpdf",
      parserVersion: "2.2.3",
      totalPages: document.numPages,
      text: normalizedText,
      truncated,
    });
  } catch (error) {
    if (error instanceof PdfParserError) throw error;
    throw new PdfParserError("PDF_PARSE_FAILED", "PDF content could not be parsed.", 422, { cause: error });
  } finally {
    await cleanupPdfDocument(document, remainingTimeMs);
  }
}

/**
 * Best-effort PDF.js cleanup that cannot outlive the parser's shared deadline.
 * A stalled destroy() must not keep a completed or timed-out extraction pending.
 */
export async function cleanupPdfDocument(document, getRemainingTimeMs) {
  try {
    const cleanup = document?.loadingTask?.destroy?.();
    if (cleanup && typeof cleanup.then === "function") {
      await withPdfParserTimeout(
        cleanup,
        Math.max(1, Math.min(PDF_PARSE_LIMITS.maxParseTimeMs, getRemainingTimeMs())),
      );
    }
  } catch {
    // Cleanup must not replace the parser's success or typed failure result.
  }
}
