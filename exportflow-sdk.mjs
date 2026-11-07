const DEFAULT_BASE_URL = "https://exportflow.me";
const SUPPORTED_LANGUAGES = new Set(["en", "ar", "es", "zh", "hi", "pt", "fr", "bn"]);

export class ExportFlowApiError extends Error {
  constructor(message, { status = 0, code = "request_failed" } = {}) {
    super(message);
    this.name = "ExportFlowApiError";
    this.status = status;
    this.code = code;
  }
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value || DEFAULT_BASE_URL);
  } catch {
    throw new TypeError("baseUrl must be a valid HTTP or HTTPS URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new TypeError("baseUrl must be an HTTP or HTTPS URL without credentials");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function validateTrackingRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("tracking request must be an object");
  }
  const allowed = new Set(["number", "carrier", "postcode", "language"]);
  if (Object.keys(input).some(key => !allowed.has(key))) {
    throw new TypeError("tracking request contains an unsupported field");
  }
  if (typeof input.number !== "string" || input.number.trim().length < 4 ||
      input.number.trim().length > 40 || !/^[a-zA-Z0-9\s-]+$/.test(input.number.trim())) {
    throw new TypeError("number must be a valid tracking number");
  }
  if (input.carrier !== undefined &&
      (typeof input.carrier !== "string" || !/^[a-z0-9-]{2,80}$/i.test(input.carrier))) {
    throw new TypeError("carrier must be a carrier ID");
  }
  if (input.postcode !== undefined &&
      (typeof input.postcode !== "string" || input.postcode.length > 24 || !/^[a-z0-9 -]+$/i.test(input.postcode))) {
    throw new TypeError("postcode is invalid");
  }
  if (input.language !== undefined &&
      (typeof input.language !== "string" || !SUPPORTED_LANGUAGES.has(input.language.toLowerCase()))) {
    throw new TypeError("language is not supported");
  }
  return {
    number: input.number.trim(),
    ...(input.carrier ? { carrier: input.carrier } : {}),
    ...(input.postcode ? { postcode: input.postcode } : {}),
    ...(input.language ? { language: input.language.toLowerCase() } : {})
  };
}

function validateBatch(shipments) {
  if (!Array.isArray(shipments) || shipments.length < 1 || shipments.length > 5) {
    throw new TypeError("batch must contain between 1 and 5 shipments");
  }
  const ids = new Set();
  return shipments.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(item.id)) {
      throw new TypeError("each shipment requires a unique ID");
    }
    if (ids.has(item.id)) throw new TypeError("shipment IDs must be unique");
    ids.add(item.id);
    return { id: item.id, ...validateTrackingRequest({
      number: item.number,
      ...(item.carrier !== undefined ? { carrier: item.carrier } : {}),
      ...(item.postcode !== undefined ? { postcode: item.postcode } : {}),
      ...(item.language !== undefined ? { language: item.language } : {})
    }) };
  });
}

export function createExportFlowClient({
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 30_000
} = {}) {
  const base = normalizeBaseUrl(baseUrl);
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 120_000) {
    throw new RangeError("timeoutMs must be between 500 and 120000");
  }

  async function request(path, { method = "GET", body } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response;
      try {
        response = await fetchImpl(base + path, {
          method,
          headers: {
            Accept: "application/json",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {})
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal
        });
      } catch (error) {
        if (controller.signal.aborted || error?.name === "AbortError") {
          throw new ExportFlowApiError("ExportFlow request timed out", { code: "timeout" });
        }
        throw new ExportFlowApiError("ExportFlow could not be reached", { code: "network_error" });
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new ExportFlowApiError("ExportFlow returned an invalid response", {
          status: response.status,
          code: "invalid_response"
        });
      }
      if (!response.ok) {
        const code = typeof data?.error === "string" && /^[a-z0-9_]{1,64}$/i.test(data.error)
          ? data.error
          : "request_failed";
        throw new ExportFlowApiError("ExportFlow request failed (" + response.status + ")", {
          status: response.status,
          code
        });
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  return Object.freeze({
    track(input) {
      return request("/api/track", { method: "POST", body: validateTrackingRequest(input) });
    },
    batchTrack(shipments) {
      return request("/api/batch-track", { method: "POST", body: { shipments: validateBatch(shipments) } });
    },
    listCarriers() {
      return request("/api/carriers");
    },
    getCoverage() {
      return request("/api/coverage");
    },
    getOpenApi() {
      return request("/api/openapi");
    }
  });
}

export default createExportFlowClient;
