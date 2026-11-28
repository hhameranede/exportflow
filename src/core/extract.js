import { fetchPublicResource } from "./http-fetch.js";
import { normalizeResult } from "./result.js";
import { CSV_PARSE_LIMITS, CSV_PARSER_VERSION, CsvParserError, parseCsvText } from "./csv-parser.js";
import { extractPdfText, PDF_PARSE_LIMITS, PdfParserError } from "./pdf-parser.js";

export const EXTRACTION_LIMITS = Object.freeze({
  maxSchemaBytes: 16_384,
  maxProperties: 20,
  maxSourcesPerField: 8,
  maxSourcePathLength: 160,
  maxJsonLdBlocks: 20,
  maxJsonLdBlockBytes: 131_072,
  maxJsonLdNodes: 100,
  maxJsonLdDepth: 12,
});

export class ExtractionError extends Error {
  constructor(code, message, httpStatus = 400, responseBytes = null) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
    this.httpStatus = httpStatus;
    if (Number.isInteger(responseBytes) && responseBytes >= 0) this.responseBytes = responseBytes;
  }
}

const SUPPORTED_TYPES = new Set(["string", "number", "integer", "boolean", "object", "array"]);
const CSV_MIME_TYPES = new Set(["text/csv"]);
const PDF_MIME_TYPES = new Set(["application/pdf", "application/octet-stream"]);
const DEFAULT_SOURCES = Object.freeze({
  title: ["meta:og:title", "meta:twitter:title", "page:title", "jsonld:headline", "jsonld:name"],
  name: ["jsonld:name", "jsonld:headline", "meta:og:site_name", "page:title"],
  headline: ["jsonld:headline", "meta:og:title", "page:title"],
  description: ["jsonld:description", "meta:description", "meta:og:description"],
  url: ["page:canonical", "jsonld:url", "page:url"],
  image: ["meta:og:image", "jsonld:image"],
  price: ["jsonld:offers.price", "jsonld:price"],
  priceCurrency: ["jsonld:offers.priceCurrency", "jsonld:priceCurrency"],
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function validateSourcePath(source) {
  if (typeof source !== "string" || source.length < 1 || source.length > EXTRACTION_LIMITS.maxSourcePathLength) {
    throw new ExtractionError("INVALID_SCHEMA", "Each x-source path must be a non-empty bounded string.");
  }
  const colon = source.indexOf(":");
  const prefix = colon > 0 ? source.slice(0, colon).toLowerCase() : "jsonld";
  const path = colon > 0 ? source.slice(colon + 1) : source;
  if (!["jsonld", "meta", "page", "csv", "pdf"].includes(prefix) || !path) {
    throw new ExtractionError("INVALID_SCHEMA", "x-source must use jsonld:, meta:, page:, csv:, or pdf:.");
  }
  if (prefix === "csv") {
    if (path.trim().length === 0 ||
        path.length > EXTRACTION_LIMITS.maxSourcePathLength ||
        /[\u0000-\u001f\u007f]/.test(path) ||
        ["__proto__", "prototype", "constructor"].includes(path.trim())) {
      throw new ExtractionError("INVALID_SCHEMA", "CSV column names must be bounded and safe.");
    }
    return { sourceType: prefix, path: path.trim(), source };
  }
  if (prefix === "pdf") {
    if (path !== "text") {
      throw new ExtractionError("INVALID_SCHEMA", 'PDF x-source must be exactly "pdf:text".');
    }
    return { sourceType: prefix, path, source };
  }
  const segments = path.split(".");
  const segmentPattern = prefix === "meta"
    ? /^[A-Za-z0-9_@:-]{1,64}$/
    : /^[A-Za-z0-9_@-]{1,64}$/;
  if (segments.length > 12 || segments.some((part) =>
    !segmentPattern.test(part) ||
    ["__proto__", "prototype", "constructor"].includes(part)
  )) {
    throw new ExtractionError("INVALID_SCHEMA", "x-source contains an invalid or unsafe path segment.");
  }
  return { sourceType: prefix, path, source };
}

export function validateExtractionSchema(schema) {
  if (!isPlainObject(schema) || schema.type !== "object" || !isPlainObject(schema.properties)) {
    throw new ExtractionError("INVALID_SCHEMA", "Extraction schema must be an object schema with properties.");
  }

  let serialized;
  try {
    serialized = JSON.stringify(schema);
  } catch {
    throw new ExtractionError("INVALID_SCHEMA", "Extraction schema must be JSON-serializable.");
  }
  if (byteLength(serialized) > EXTRACTION_LIMITS.maxSchemaBytes) {
    throw new ExtractionError("INVALID_SCHEMA", "Extraction schema exceeds the configured size limit.");
  }

  const names = Object.keys(schema.properties);
  if (names.length < 1 || names.length > EXTRACTION_LIMITS.maxProperties) {
    throw new ExtractionError("INVALID_SCHEMA", "Schema must define between 1 and 20 properties.");
  }

  const required = schema.required === undefined ? [] : schema.required;
  if (!Array.isArray(required) || required.length > names.length ||
      required.some((name) => typeof name !== "string" || !Object.hasOwn(schema.properties, name))) {
    throw new ExtractionError("INVALID_SCHEMA", "Schema required must reference declared properties.");
  }

  const fields = [];
  for (const name of names) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) {
      throw new ExtractionError("INVALID_SCHEMA", "Schema property names must be simple identifiers.");
    }
    const definition = schema.properties[name];
    if (!isPlainObject(definition) || !SUPPORTED_TYPES.has(definition.type)) {
      throw new ExtractionError("INVALID_SCHEMA", "Unsupported type for property: " + name);
    }
    if (definition.type === "array" && definition.items !== undefined &&
        (!isPlainObject(definition.items) || !SUPPORTED_TYPES.has(definition.items.type) ||
         definition.items.type === "array")) {
      throw new ExtractionError("INVALID_SCHEMA", "Array items must use a supported scalar, object, or array-free type.");
    }

    const rawSources = definition["x-source"] === undefined
      ? (DEFAULT_SOURCES[name] || ["jsonld:" + name])
      : definition["x-source"];
    const sources = typeof rawSources === "string" ? [rawSources] : rawSources;
    if (!Array.isArray(sources) || sources.length < 1 ||
        sources.length > EXTRACTION_LIMITS.maxSourcesPerField) {
      throw new ExtractionError("INVALID_SCHEMA", "Each property must define between 1 and 8 source paths.");
    }
    fields.push({
      name,
      type: definition.type,
      itemType: definition.items?.type,
      required: required.includes(name),
      explicitSources: definition["x-source"] !== undefined,
      sources: sources.map(validateSourcePath),
    });
  }

  return { fields, required: [...required] };
}

function decodeHtmlEntities(value) {
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    const number = lower.startsWith("#x")
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);
    return Number.isInteger(number) && number >= 0 && number <= 0x10ffff
      ? String.fromCodePoint(number)
      : match;
  });
}

function parseAttributes(source) {
  const attributes = Object.create(null);
  const regex = /([A-Za-z_:][A-Za-z0-9_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = regex.exec(source))) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function parseHtmlMetadataFallback(html) {
  const meta = Object.create(null);
  const jsonLdBlocks = [];
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]*>/g, "").trim()) : null;
  let canonical = null;

  const metaRegex = /<meta\b([^>]*)>/gi;
  let match;
  while ((match = metaRegex.exec(html))) {
    const attributes = parseAttributes(match[1]);
    const key = (attributes.property || attributes.name || attributes.itemprop || "").toLowerCase();
    if (key && attributes.content !== undefined && meta[key] === undefined) {
      meta[key] = attributes.content;
    }
  }

  const linkRegex = /<link\b([^>]*)>/gi;
  while ((match = linkRegex.exec(html))) {
    const attributes = parseAttributes(match[1]);
    const rel = String(attributes.rel || "").toLowerCase().split(/\s+/);
    if (rel.includes("canonical") && attributes.href) {
      canonical = attributes.href;
      break;
    }
  }

  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  while ((match = scriptRegex.exec(html)) && jsonLdBlocks.length < EXTRACTION_LIMITS.maxJsonLdBlocks) {
    const attributes = parseAttributes(match[1]);
    if (String(attributes.type || "").toLowerCase().split(";")[0].trim() === "application/ld+json") {
      jsonLdBlocks.push(match[2]);
    }
  }
  return { title, canonical, meta, jsonLdBlocks };
}

async function parseHtmlMetadata(html) {
  if (typeof HTMLRewriter === "undefined") return parseHtmlMetadataFallback(html);

  const meta = Object.create(null);
  const jsonLdBlocks = [];
  let title = "";
  let canonical = null;
  const titleHandler = {
    text(chunk) { title += chunk.text; },
  };
  const metaHandler = {
    element(element) {
      const key = (
        element.getAttribute("property") ||
        element.getAttribute("name") ||
        element.getAttribute("itemprop") ||
        ""
      ).toLowerCase();
      const content = element.getAttribute("content");
      if (key && content !== null && meta[key] === undefined) meta[key] = content;
    },
  };
  const linkHandler = {
    element(element) {
      const rel = String(element.getAttribute("rel") || "").toLowerCase().split(/\s+/);
      const href = element.getAttribute("href");
      if (!canonical && rel.includes("canonical") && href) canonical = href;
    },
  };
  let currentBlock = null;
  const jsonLdHandler = {
    element() {
      if (jsonLdBlocks.length >= EXTRACTION_LIMITS.maxJsonLdBlocks) {
        currentBlock = null;
        return;
      }
      currentBlock = { text: "" };
      jsonLdBlocks.push(currentBlock);
    },
    text(chunk) {
      if (currentBlock) currentBlock.text += chunk.text;
    },
  };

  const response = new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  const transformed = new HTMLRewriter()
    .on("title", titleHandler)
    .on("meta", metaHandler)
    .on("link[href]", linkHandler)
    .on('script[type="application/ld+json"]', jsonLdHandler)
    .transform(response);
  await transformed.text();

  return {
    title: title.trim() || null,
    canonical,
    meta,
    jsonLdBlocks: jsonLdBlocks.map((block) => block.text),
  };
}

function collectJsonLdNodes(blocks, warnings) {
  const nodes = [];
  for (let blockIndex = 0; blockIndex < blocks.length &&
       blockIndex < EXTRACTION_LIMITS.maxJsonLdBlocks; blockIndex++) {
    const raw = String(blocks[blockIndex] || "");
    if (!raw.trim()) continue;
    if (byteLength(raw) > EXTRACTION_LIMITS.maxJsonLdBlockBytes) {
      warnings.push("A JSON-LD block exceeded the configured size limit and was skipped.");
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      warnings.push("A JSON-LD block was invalid JSON and was skipped.");
      continue;
    }
    const visit = (value, depth) => {
      if (nodes.length >= EXTRACTION_LIMITS.maxJsonLdNodes ||
          depth > EXTRACTION_LIMITS.maxJsonLdDepth) return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item, depth + 1);
        return;
      }
      if (!isPlainObject(value)) return;
      nodes.push({ value, blockIndex, nodeIndex: nodes.length });
      if (Array.isArray(value["@graph"])) visit(value["@graph"], depth + 1);
    };
    visit(parsed, 0);
  }
  return nodes;
}

function readPath(root, path) {
  const segments = path.split(".");
  const walk = (value, index) => {
    if (index >= segments.length) return value;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, index);
        if (found !== undefined && found !== null) return found;
      }
      return undefined;
    }
    if (!isPlainObject(value) || !Object.hasOwn(value, segments[index])) return undefined;
    return walk(value[segments[index]], index + 1);
  };
  return walk(root, 0);
}

function coerceScalar(value, expectedType) {
  if (expectedType === "string" && isPlainObject(value)) {
    const candidate = value.name ?? value.url ?? value.contentUrl;
    if (typeof candidate === "string") return candidate;
  }
  if (expectedType === "number" || expectedType === "integer") {
    if (typeof value === "string" && value.trim() !== "" &&
        /^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())) {
      value = Number(value);
    }
  }
  if (expectedType === "boolean" && typeof value === "string") {
    if (value.trim().toLowerCase() === "true") value = true;
    else if (value.trim().toLowerCase() === "false") value = false;
  }
  if (expectedType === "array" && !Array.isArray(value)) return undefined;
  if (expectedType === "object" && !isPlainObject(value)) return undefined;
  if (expectedType === "string" && typeof value !== "string") return undefined;
  if (expectedType === "number" && (typeof value !== "number" || !Number.isFinite(value))) return undefined;
  if (expectedType === "integer" && (typeof value !== "number" || !Number.isSafeInteger(value))) return undefined;
  if (expectedType === "boolean" && typeof value !== "boolean") return undefined;
  return value;
}

function normalizeArray(value, itemType) {
  if (!Array.isArray(value)) return undefined;
  if (!itemType) return value;
  const output = [];
  for (const item of value) {
    const normalized = coerceScalar(item, itemType);
    if (normalized === undefined) return undefined;
    output.push(normalized);
  }
  return output;
}

function resolveFieldValue(field, nodes, metadata, page) {
  for (const source of field.sources) {
    let value;
    let evidence;
    if (source.sourceType === "jsonld") {
      for (const node of nodes) {
        value = readPath(node.value, source.path);
        if (value === undefined || value === null) continue;
        evidence = {
          field: field.name,
          sourceType: "jsonld",
          path: source.path,
          blockIndex: node.blockIndex,
          nodeIndex: node.nodeIndex,
        };
        break;
      }
    } else if (source.sourceType === "meta") {
      value = metadata.meta[source.path.toLowerCase()];
      if (value !== undefined && value !== null) {
        evidence = { field: field.name, sourceType: "meta", path: source.path };
      }
    } else {
      value = page[source.path.toLowerCase()];
      if (value !== undefined && value !== null) {
        evidence = { field: field.name, sourceType: "page", path: source.path };
      }
    }

    if (value === undefined || value === null) continue;
    const normalized = field.type === "array"
      ? normalizeArray(value, field.itemType)
      : coerceScalar(value, field.type);
    if (normalized === undefined) continue;
    return { value: normalized, evidence };
  }
  return null;
}

function buildExtracted({ metadata, nodes, url, contentType, schema, warnings = [] }) {
  const checkedSchema = validateExtractionSchema(schema);
  const data = {};
  const fieldEvidence = [];
  const missingFields = [];
  const missingRequired = [];
  const page = {
    title: metadata.title,
    canonical: metadata.canonical ? safeCanonical(metadata.canonical, url) : null,
    url,
    description: metadata.meta.description || metadata.meta["og:description"] || null,
  };

  for (const field of checkedSchema.fields) {
    const resolved = resolveFieldValue(field, nodes, metadata, page);
    if (!resolved) {
      missingFields.push(field.name);
      if (field.required) missingRequired.push(field.name);
      continue;
    }
    data[field.name] = resolved.value;
    fieldEvidence.push({
      ...resolved.evidence,
      url,
      contentType: contentType || null,
    });
  }

  const status = Object.keys(data).length === 0
    ? "failed"
    : (missingFields.length || missingRequired.length ? "partial" : "succeeded");
  const outputWarnings = [...warnings];
  if (missingFields.length) {
    outputWarnings.push("Some schema fields could not be extracted: " + missingFields.join(", ") + ".");
  }
  if (missingRequired.length) {
    outputWarnings.push("Required schema fields are missing: " + missingRequired.join(", ") + ".");
  }

  return {
    status,
    data,
    fieldEvidence,
    missingFields,
    missingRequired,
    warnings: outputWarnings,
    schemaProperties: checkedSchema.fields.map((field) => field.name),
  };
}


function buildCsvExtracted({ parsed, url, contentType, schema }) {
  const checkedSchema = validateExtractionSchema(schema);
  const data = {};
  const fieldEvidence = [];
  const missingFields = [];
  const missingRequired = [];
  const warnings = parsed.errors.map((error) =>
    "CSV parser reported " + error.code +
    (Number.isInteger(error.row) ? " at row index " + error.row : "") + "."
  );
  const headerIndexes = new Map(parsed.headers.map((header, index) => [header, index]));

  for (const field of checkedSchema.fields) {
    const csvSources = field.sources.filter((source) => source.sourceType === "csv");
    const usesCsvMapping = csvSources.length > 0 || !field.explicitSources;
    if (usesCsvMapping && (field.type !== "array" || field.itemType !== "string")) {
      throw new ExtractionError(
        "CSV_ARRAY_FIELD_REQUIRED",
        "CSV schema fields must be arrays of strings to preserve source values.",
        422,
      );
    }

    const selectedSource = csvSources.find((source) => headerIndexes.has(source.path));
    const columnName = selectedSource?.path ?? (!field.explicitSources ? field.name : null);
    const columnIndex = columnName === null ? undefined : headerIndexes.get(columnName);

    if (!columnName || columnIndex === undefined) {
      missingFields.push(field.name);
      if (field.required) missingRequired.push(field.name);
      continue;
    }

    const values = parsed.rows.map((row) =>
      Object.hasOwn(row, columnName) && typeof row[columnName] === "string"
        ? row[columnName]
        : ""
    );
    data[field.name] = values;
    fieldEvidence.push({
      field: field.name,
      sourceType: "csv",
      path: columnName,
      columnIndex,
      rowCount: values.length,
      url,
      contentType: contentType || null,
    });
  }

  if (parsed.truncated) warnings.push("CSV row output was truncated at the configured row limit.");
  if (missingFields.length) warnings.push("Some CSV columns were not found: " + missingFields.join(", ") + ".");
  if (missingRequired.length) warnings.push("Required CSV columns are missing: " + missingRequired.join(", ") + ".");

  const status = Object.keys(data).length === 0
    ? "failed"
    : (missingFields.length || missingRequired.length || parsed.status === "partial" || parsed.truncated
      ? "partial"
      : "succeeded");

  return {
    status,
    data,
    inputBytes: parsed.inputBytes,
    delimiter: parsed.delimiter,
    headers: parsed.headers,
    rowCount: parsed.rowCount,
    truncated: parsed.truncated,
    parseErrors: parsed.errors,
    fieldEvidence,
    missingFields,
    missingRequired,
    warnings,
    schemaProperties: checkedSchema.fields.map((field) => field.name),
  };
}

function buildPdfExtracted({ parsed, url, contentType, schema }) {
  const checkedSchema = validateExtractionSchema(schema);
  const data = {};
  const fieldEvidence = [];
  const missingFields = [];
  const missingRequired = [];

  for (const field of checkedSchema.fields) {
    const selectedSource = field.sources.find((source) => source.sourceType === "pdf");
    if (!selectedSource) {
      missingFields.push(field.name);
      if (field.required) missingRequired.push(field.name);
      continue;
    }
    if (field.type !== "string") {
      throw new ExtractionError(
        "PDF_STRING_FIELD_REQUIRED",
        "PDF text extraction fields must be declared as strings.",
        422,
      );
    }
    data[field.name] = parsed.text;
    fieldEvidence.push({
      field: field.name,
      sourceType: "pdf",
      path: "text",
      pageCount: parsed.totalPages,
      characters: parsed.text.length,
      truncated: parsed.truncated,
      url,
      contentType: contentType || null,
    });
  }

  const warnings = [];
  if (missingFields.length) warnings.push("PDF text was not mapped to these fields: " + missingFields.join(", ") + ".");
  if (missingRequired.length) warnings.push("Required PDF fields are missing: " + missingRequired.join(", ") + ".");
  if (parsed.truncated) warnings.push("PDF text was truncated at the configured output limit.");
  const status = Object.keys(data).length === 0
    ? "failed"
    : (missingFields.length || missingRequired.length || parsed.truncated ? "partial" : "succeeded");

  return {
    status,
    data,
    fieldEvidence,
    missingFields,
    missingRequired,
    warnings,
    schemaProperties: checkedSchema.fields.map((field) => field.name),
  };
}

function safeCanonical(canonical, baseUrl) {
  try {
    const url = new URL(canonical, baseUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function extractFromStructuredSources({ html, json, url, contentType, schema }) {
  const metadata = typeof html === "string"
    ? parseHtmlMetadataFallback(html)
    : { title: null, canonical: null, meta: {}, jsonLdBlocks: [] };
  const blocks = metadata.jsonLdBlocks.slice();
  if (json !== undefined) blocks.push(JSON.stringify(json));
  const warnings = [];
  const nodes = collectJsonLdNodes(blocks, warnings);
  return buildExtracted({ metadata, nodes, url, contentType, schema, warnings });
}

export async function extractStructuredData(input, options = {}) {
  if (!isPlainObject(input)) {
    throw new ExtractionError("INVALID_INPUT", "Extraction input must be an object.");
  }
  const url = input.url;
  const schema = validateExtractionSchema(input.schema);
  if (input.includeArticle !== undefined && typeof input.includeArticle !== "boolean") {
    throw new ExtractionError("INVALID_INCLUDE_ARTICLE", "includeArticle must be a boolean.");
  }
  const includeArticle = input.includeArticle === true;
  const fetchResource = options.fetchResource || fetchPublicResource;
  const response = await fetchResource(url, {
    maxBytes: options.maxBytes ?? 1_048_576,
    timeoutMs: options.timeoutMs ?? 8_000,
    maxRedirects: options.maxRedirects ?? 3,
    responseMode: "extract",
    cacheMode: input.cacheMode ?? options.cacheMode ?? "default",
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (response.status < 200 || response.status >= 300) {
    return normalizeResult({
      status: "failed",
      data: {
        url: response.finalUrl || url,
        httpStatus: response.status,
        cacheStatus: response.cacheStatus ?? null,
        fields: {},
        missingFields: schema.fields.map((field) => field.name),
        fieldEvidence: [],
      },
      sources: [{
        url: response.finalUrl || url,
        retrievedAt: response.retrievedAt,
        title: null,
        evidence: [{
          type: "http_response",
          status: response.status,
          contentType: response.contentType,
          cacheStatus: response.cacheStatus ?? null,
        }],
      }],
      warnings: ["Source returned HTTP " + response.status + "; extraction was not attempted."],
    });
  }

  const mime = String(response.contentType || "").split(";")[0].trim().toLowerCase();
  if (PDF_MIME_TYPES.has(mime)) {
    if (
      mime === "application/octet-stream" &&
      !(response.bodyBytes instanceof Uint8Array) &&
      !(response.bodyBytes instanceof ArrayBuffer)
    ) {
      throw new ExtractionError(
        "UNSUPPORTED_CONTENT_TYPE",
        "Generic binary responses are not accepted as PDFs without a signature-checkable byte body.",
        415,
      );
    }
    let parsedPdf;
    try {
      parsedPdf = await extractPdfText(response.bodyBytes, { contentType: mime });
    } catch (error) {
      if (error instanceof PdfParserError) {
        throw new ExtractionError(error.code, error.message, error.httpStatus, response.bytes);
      }
      if (error && typeof error === "object") error.responseBytes = response.bytes;
      throw error;
    }
    let extractedPdf;
    try {
      extractedPdf = buildPdfExtracted({
      parsed: parsedPdf,
      url: response.finalUrl || url,
      contentType: response.contentType,
      schema: input.schema,
      });
    } catch (error) {
      if (error && typeof error === "object") error.responseBytes = response.bytes;
      throw error;
    }
    const pdfSource = {
      url: response.finalUrl || url,
      retrievedAt: response.retrievedAt,
      title: null,
      evidence: [
        {
          type: "http_response",
          status: response.status,
          contentType: response.contentType,
          bytes: response.bytes,
          cacheStatus: response.cacheStatus ?? null,
        },
        {
          type: "pdf_document",
          parser: parsedPdf.parser,
          parserVersion: parsedPdf.parserVersion,
          totalPages: parsedPdf.totalPages,
          characters: parsedPdf.text.length,
          truncated: parsedPdf.truncated,
        },
        ...extractedPdf.fieldEvidence.map((item) => ({
          type: "extracted_field",
          field: item.field,
          sourceType: item.sourceType,
          path: item.path,
          pageCount: item.pageCount,
          characters: item.characters,
          truncated: item.truncated,
        })),
      ],
    };
    return normalizeResult({
      status: extractedPdf.status,
      data: {
        url: response.finalUrl || url,
        httpStatus: response.status,
        cacheStatus: response.cacheStatus ?? null,
        format: "pdf",
        parser: parsedPdf.parser,
        parserVersion: parsedPdf.parserVersion,
        inputBytes: response.bytes,
        totalPages: parsedPdf.totalPages,
        characters: parsedPdf.text.length,
        truncated: parsedPdf.truncated,
        fields: extractedPdf.data,
        fieldEvidence: extractedPdf.fieldEvidence,
        missingFields: extractedPdf.missingFields,
        missingRequired: extractedPdf.missingRequired,
        schemaProperties: extractedPdf.schemaProperties,
        ...(includeArticle ? { article: { status: "not_applicable", method: "mozilla-readability" } } : {}),
      },
      sources: [pdfSource],
      warnings: extractedPdf.warnings,
    });
  }

  if (CSV_MIME_TYPES.has(mime)) {
    let parsedCsv;
    try {
      parsedCsv = parseCsvText(response.body);
    } catch (error) {
      if (error instanceof CsvParserError) {
        throw new ExtractionError(error.code, error.message, error.httpStatus);
      }
      throw error;
    }
    const extractedCsv = buildCsvExtracted({
      parsed: parsedCsv,
      url: response.finalUrl || url,
      contentType: response.contentType,
      schema: input.schema,
    });
    const csvSource = {
      url: response.finalUrl || url,
      retrievedAt: response.retrievedAt,
      title: null,
      evidence: [
        {
          type: "http_response",
          status: response.status,
          contentType: response.contentType,
          bytes: response.bytes,
          cacheStatus: response.cacheStatus ?? null,
        },
        {
          type: "csv_table",
          parser: parsedCsv.method,
          parserVersion: CSV_PARSER_VERSION,
          headers: parsedCsv.headers,
          rowCount: parsedCsv.rowCount,
          truncated: parsedCsv.truncated,
        },
        ...extractedCsv.fieldEvidence.map((item) => ({
          type: "extracted_field",
          field: item.field,
          sourceType: item.sourceType,
          path: item.path,
          columnIndex: item.columnIndex,
          rowCount: item.rowCount,
        })),
      ],
    };
    return normalizeResult({
      status: extractedCsv.status,
      data: {
        url: response.finalUrl || url,
        httpStatus: response.status,
        cacheStatus: response.cacheStatus ?? null,
        format: "csv",
        parser: parsedCsv.method,
        parserVersion: CSV_PARSER_VERSION,
        inputBytes: extractedCsv.inputBytes,
        delimiter: extractedCsv.delimiter,
        headers: extractedCsv.headers,
        rowCount: extractedCsv.rowCount,
        truncated: extractedCsv.truncated,
        parseErrors: extractedCsv.parseErrors,
        fields: extractedCsv.data,
        fieldEvidence: extractedCsv.fieldEvidence,
        missingFields: extractedCsv.missingFields,
        missingRequired: extractedCsv.missingRequired,
        schemaProperties: extractedCsv.schemaProperties,
        ...(includeArticle ? { article: { status: "not_applicable", method: "mozilla-readability" } } : {}),
      },
      sources: [csvSource],
      warnings: extractedCsv.warnings,
    });
  }

  if (!["text/html", "application/xhtml+xml", "application/json", "application/ld+json"].includes(mime) &&
      !mime.endsWith("+json")) {
    throw new ExtractionError("UNSUPPORTED_CONTENT_TYPE", "Structured extraction currently supports HTML and JSON responses.", 415);
  }

  let metadata;
  const warnings = [];
  if (mime === "application/json" || mime === "application/ld+json" || mime.endsWith("+json")) {
    let parsed;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      throw new ExtractionError("INVALID_JSON_SOURCE", "The source response was not valid JSON.", 502);
    }
    metadata = {
      title: null,
      canonical: null,
      meta: {},
      jsonLdBlocks: [JSON.stringify(parsed)],
    };
  } else {
    metadata = await parseHtmlMetadata(response.body);
  }
  const nodes = collectJsonLdNodes(metadata.jsonLdBlocks, warnings);
  const extracted = buildExtracted({
    metadata,
    nodes,
    url: response.finalUrl || url,
    contentType: response.contentType,
    schema: input.schema,
    warnings,
  });

  const resultWarnings = [...extracted.warnings];
  const sourceEvidence = [
    {
      type: "http_response",
      status: response.status,
      contentType: response.contentType,
      bytes: response.bytes,
      cacheStatus: response.cacheStatus ?? null,
    },
    ...extracted.fieldEvidence.map((item) => ({
      type: "extracted_field",
      field: item.field,
      sourceType: item.sourceType,
      path: item.path,
      blockIndex: item.blockIndex,
      nodeIndex: item.nodeIndex,
    })),
  ];
  let article;
  if (includeArticle) {
    if (mime === "text/html" || mime === "application/xhtml+xml") {
      try {
        const { extractReadableArticle } = await import("./readability-article.js");
        const parsedArticle = extractReadableArticle(response.body, {
          url: response.finalUrl || url,
          maxTextCharacters: 20_000,
        });
        article = {
          status: parsedArticle.status,
          method: parsedArticle.method,
          title: parsedArticle.title,
          textContent: parsedArticle.textContent,
          length: parsedArticle.length,
          excerpt: parsedArticle.excerpt,
          byline: parsedArticle.byline,
          siteName: parsedArticle.siteName,
          language: parsedArticle.language,
          truncated: parsedArticle.truncated,
        };
        sourceEvidence.push({
          type: "article_text",
          method: parsedArticle.method,
          status: parsedArticle.status,
          characters: parsedArticle.textContent.length,
          truncated: parsedArticle.truncated,
        });
        if (parsedArticle.status === "no_article") {
          resultWarnings.push("No main article text was found in the source HTML.");
        }
      } catch (error) {
        article = {
          status: "unavailable",
          method: "mozilla-readability",
          code: typeof error?.code === "string" && /^[A-Z0-9_]{2,64}$/.test(error.code)
            ? error.code
            : "ARTICLE_EXTRACTION_FAILED",
        };
        resultWarnings.push("Article text was unavailable; structured field extraction still completed.");
      }
    } else {
      article = { status: "not_applicable", method: "mozilla-readability" };
    }
  }

  const source = {
    url: response.finalUrl || url,
    retrievedAt: response.retrievedAt,
    title: typeof article?.title === "string" ? article.title : null,
    evidence: sourceEvidence,
  };
  return normalizeResult({
    status: extracted.status,
    data: {
      url: response.finalUrl || url,
      httpStatus: response.status,
      cacheStatus: response.cacheStatus ?? null,
      fields: extracted.data,
      fieldEvidence: extracted.fieldEvidence,
      missingFields: extracted.missingFields,
      missingRequired: extracted.missingRequired,
      schemaProperties: extracted.schemaProperties,
      ...(includeArticle ? { article } : {}),
    },
    sources: [source],
    warnings: resultWarnings,
  });
}

export const extractAdapter = Object.freeze({
  id: "web.extract.v1",
  family: "web",
  capabilities: ["structured-extraction", "jsonld", "metadata", "csv", "pdf-text", "readability-article-text", "field-evidence"],
  authMode: "none",
  limits: {
    maxSchemaBytes: EXTRACTION_LIMITS.maxSchemaBytes,
    maxProperties: EXTRACTION_LIMITS.maxProperties,
    maxJsonLdBlocks: EXTRACTION_LIMITS.maxJsonLdBlocks,
    maxJsonLdBlockBytes: EXTRACTION_LIMITS.maxJsonLdBlockBytes,
    maxCsvBytes: CSV_PARSE_LIMITS.maxBytes,
    maxCsvRows: CSV_PARSE_LIMITS.maxRows,
    maxCsvColumns: CSV_PARSE_LIMITS.maxColumns,
    maxCsvHeaderCharacters: CSV_PARSE_LIMITS.maxHeaderCharacters,
    maxPdfInputBytes: PDF_PARSE_LIMITS.maxInputBytes,
    maxPdfPages: PDF_PARSE_LIMITS.maxPages,
    maxPdfOutputCharacters: PDF_PARSE_LIMITS.maxOutputCharacters,
    maxPdfParseTimeMs: PDF_PARSE_LIMITS.maxParseTimeMs,
  },
  restrictions: [
    "schema-driven-deterministic-extraction",
    "html-json-csv-and-pdf-text-only",
    "pdf-text-only-no-ocr",
    "optional-readability-article-text-for-html-only",
    "csv-values-preserved-as-strings",
    "csv-formulas-never-executed",
    "no-LLM-inference",
    "untrusted-source-content",
    "field-level-evidence",
    "bounded-input-schema",
  ],
  async execute(input = {}, options = {}) {
    return extractStructuredData(input, options);
  },
});
