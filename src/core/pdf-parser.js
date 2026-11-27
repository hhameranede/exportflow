import { extractText, getDocumentProxy } from "unpdf";

export const PDF_PARSE_LIMITS = Object.freeze({
  maxInputBytes: 1_048_576,
  maxPages: 10,
  maxOutputCharacters: 65_536,
  maxImageSize: 16_777_216,
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

/**
 * Extract text from already-fetched PDF bytes.
 *
 * This function never accepts a URL and never configures CMaps, standard-font
 * URLs, WASM URLs, or worker fetches. Parsing stays inside the current Worker.
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
  try {
    // PDF.js takes ownership of its input buffer. Pass a copy so callers retain
    // their bounded Fetch buffer for accounting and downstream provenance.
    document = await getDocumentProxy(bytes.slice(), {
      isEvalSupported: false,
      enableXfa: false,
      useSystemFonts: true,
      useWorkerFetch: false,
      maxImageSize: PDF_PARSE_LIMITS.maxImageSize,
    });

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

    const extracted = await extractText(document, { mergePages: true });
    const rawText = Array.isArray(extracted.text) ? extracted.text.join("\n\n") : extracted.text;
    const normalizedText = String(rawText || "")
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
      totalPages: extracted.totalPages,
      text: normalizedText.slice(0, PDF_PARSE_LIMITS.maxOutputCharacters),
      truncated: normalizedText.length > PDF_PARSE_LIMITS.maxOutputCharacters,
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
