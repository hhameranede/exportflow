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

export function boundPdfText(value) {
  const normalizedText = String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  return Object.freeze({
    text: normalizedText.slice(0, PDF_PARSE_LIMITS.maxOutputCharacters),
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

function cancelReaderBestEffort(reader) {
  try {
    const cancellation = reader.cancel();
    if (cancellation && typeof cancellation.catch === "function") void cancellation.catch(() => {});
  } catch {
    // A stream may already be closed, errored, or locked by the runtime.
  }
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
    const { getDocumentProxy } = await import("unpdf");

    // PDF.js takes ownership of its input buffer. Pass a copy so callers retain
    // their bounded Fetch buffer for accounting and downstream provenance.
    const loadingPromise = getDocumentProxy(bytes.slice(), {
      isEvalSupported: false,
      enableXfa: false,
      useSystemFonts: true,
      useWorkerFetch: false,
      maxImageSize: PDF_PARSE_LIMITS.maxImageSize,
    });

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
      try {
        while (true) {
          const chunk = await withPdfParserTimeout(
            () => reader.read(),
            remainingTimeMs(),
            () => {
              parseTimedOut = true;
              cancelReaderBestEffort(reader);
            },
          );
          if (chunk.done) break;

          const items = Array.isArray(chunk.value?.items) ? chunk.value.items : [];
          for (const item of items) {
            itemCount += 1;
            if (itemCount > PDF_PARSE_LIMITS.maxTextItems) {
              truncated = true;
              break;
            }
            if (typeof item?.str !== "string" || item.str.length === 0) continue;

            const addition = item.str + (item.hasEOL ? "\n" : "");
            const remaining = PDF_PARSE_LIMITS.maxOutputCharacters - text.length;
            if (addition.length > remaining) {
              text += addition.slice(0, remaining);
              truncated = true;
              break;
            }
            text += addition;
          }
          // Once an output/item ceiling is reached, drain this page's stream
          // without retaining further text. PDF.js' message stream must finish
          // naturally before the document loading task is destroyed; cancelling
          // a completed/in-flight text stream can race its controller close.
        }
      } finally {
        // Match PDF.js' own getTextContent() consumption pattern: leave the
        // exhausted reader alone and let the document task own final cleanup.
        // Calling releaseLock() here can race late stream-controller closure.
      }

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
    try {
      await document?.loadingTask?.destroy();
    } catch {
      // Cleanup must not replace the parser's success or typed failure result.
    }
  }
}
