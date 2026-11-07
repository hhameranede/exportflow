const PROVIDERS = Object.freeze({
  yalidine: {
    sdkProvider: "yalidine",
    credentials: ["apiId", "apiToken", "fromWilayaId", "fromWilayaName"],
    required: ["apiId", "apiToken"]
  },
  guepex: {
    sdkProvider: "yalidine",
    credentials: ["apiId", "apiToken", "fromWilayaId", "fromWilayaName"],
    required: ["apiId", "apiToken"],
    baseUrl: "https://api.guepex.app/v1"
  },
  zrexpress: {
    sdkProvider: "zrexpress",
    credentials: ["apiKey", "tenant"],
    required: ["apiKey", "tenant"]
  },
  maystro: {
    sdkProvider: "maystro",
    credentials: ["apiToken"],
    required: ["apiToken"]
  },
  ecotrack: {
    sdkProvider: "ecotrack",
    credentials: ["token", "courier"],
    required: ["token", "courier"]
  },
  noest: {
    sdkProvider: "noest",
    credentials: ["apiToken", "userGuid"],
    required: ["apiToken", "userGuid"]
  },
  ecom: {
    sdkProvider: "ecom",
    credentials: ["apiKey", "apiToken"],
    required: ["apiKey", "apiToken"]
  },
  mdm: {
    sdkProvider: "mdm",
    credentials: ["apiKey", "storeId"],
    required: ["apiKey"]
  },
  elogistia: {
    sdkProvider: "elogistia",
    credentials: ["apiKey"],
    required: ["apiKey"]
  }
});

const STATUSES = new Set([
  "pending",
  "created",
  "in_transit",
  "delivered",
  "returned",
  "cancelled",
  "unknown"
]);

const ECOTRACK_COURIERS = new Set([
  "dhd",
  "anderson",
  "andersondelivery",
  "worldexpress",
  "48hrexpress",
  "ecorapid",
  "conexlog",
  "msmgo",
  "packers",
  "rocketdelivery"
]);

const MAX_EVENTS = 60;
const MAX_TRACKING_LENGTH = 80;
const SDK_TIMEOUT_MS = 10_000;

export const ALGERIAN_CARRIER_IDS = Object.freeze(Object.keys(PROVIDERS));

export class AlgerianConnectorError extends Error {
  constructor(code, provider = null) {
    super(code);
    this.name = "AlgerianConnectorError";
    this.code = code;
    this.provider = provider;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeText(value, maxLength = 180) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function safeEventLabel(value) {
  const label = safeText(value, 220);
  if (!label) return null;

  return label
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[redacted]");
}

function validateMerchantId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    throw new AlgerianConnectorError("invalid_merchant_context");
  }
  return value;
}

function validateTrackingNumber(value) {
  if (
    typeof value !== "string" ||
    value.length > MAX_TRACKING_LENGTH ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,78}[A-Za-z0-9]$/.test(value)
  ) {
    throw new AlgerianConnectorError("invalid_tracking_number");
  }
  return value;
}

function providerConfig(provider) {
  if (typeof provider !== "string") {
    throw new AlgerianConnectorError("unsupported_provider");
  }
  const id = provider.trim().toLowerCase();
  if (!Object.hasOwn(PROVIDERS, id)) {
    throw new AlgerianConnectorError("unsupported_provider");
  }
  const config = PROVIDERS[id];
  return { id, config };
}

function credentialValue(value) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function sanitizeAlgerianProviderCredentials(provider, source) {
  const { id, config } = providerConfig(provider);
  if (!isPlainObject(source)) {
    throw new AlgerianConnectorError("credentials_missing", id);
  }

  const credentials = {};
  for (const field of config.credentials) {
    const descriptor = Object.getOwnPropertyDescriptor(source, field);
    // Accept only own data properties, never accessors or inherited values.
    if (!descriptor || !Object.hasOwn(descriptor, "value")) continue;
    const value = credentialValue(descriptor.value);
    if (value !== null) credentials[field] = value;
  }

  for (const required of config.required) {
    if (credentials[required] === undefined) {
      throw new AlgerianConnectorError("credentials_incomplete", id);
    }
  }

  if (id === "ecotrack") {
    const courier = String(credentials.courier || "").toLowerCase();
    if (!ECOTRACK_COURIERS.has(courier)) {
      throw new AlgerianConnectorError("unsupported_courier", id);
    }
    credentials.courier = courier;
  }

  return Object.freeze(credentials);
}

function buildSdkConfig(providerId, config, source) {
  const sdkConfig = { ...sanitizeAlgerianProviderCredentials(providerId, source) };

  // Only the fixed GuepEx endpoint is accepted. A credential record can never
  // select an arbitrary outbound host.
  if (config.baseUrl) sdkConfig.baseUrl = config.baseUrl;
  sdkConfig.timeoutMs = SDK_TIMEOUT_MS;
  sdkConfig.includeRaw = false;
  return sdkConfig;
}

function upstreamErrorCode(error) {
  const code = typeof error?.code === "string" ? error.code.toUpperCase() : "";
  const status = Number(error?.status ?? error?.httpStatus);

  if (["AUTH_FAILED", "UNAUTHORIZED", "FORBIDDEN", "INVALID_AUTH"].includes(code) || status === 401 || status === 403) {
    return "upstream_auth_failed";
  }
  if (["NOT_FOUND", "TRACKING_NOT_FOUND"].includes(code) || status === 404) {
    return "not_found";
  }
  if (["RATE_LIMITED", "RATE_LIMIT", "QUOTA_EXCEEDED"].includes(code) || status === 429) {
    return "upstream_rate_limited";
  }
  if (["TIMEOUT", "ETIMEDOUT", "ABORT_ERR"].includes(code)) {
    return "upstream_timeout";
  }
  return "upstream_unavailable";
}

function normalizedStatus(value) {
  if (typeof value !== "string") return "unknown";
  const status = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STATUSES.has(status) ? status : "unknown";
}

function projectTrackResult(result, provider, trackingNumber) {
  const parcel = result?.parcel;
  if (!isPlainObject(parcel)) {
    throw new AlgerianConnectorError("invalid_upstream_response", provider);
  }

  const sourceEvents = Array.isArray(result.events) ? result.events.slice(0, MAX_EVENTS) : [];
  const events = sourceEvents.map(event => {
    if (!isPlainObject(event)) return null;
    const label = safeEventLabel(event.label);
    const at = safeText(event.at, 64);
    return {
      status: normalizedStatus(event.status),
      ...(label ? { label } : {}),
      ...(at ? { at } : {})
    };
  }).filter(Boolean);

  return {
    provider,
    trackingNumber,
    status: normalizedStatus(parcel.status),
    events
  };
}

/**
 * Create an internal, read-only adapter boundary around @dz-delivery/core.
 *
 * authorizeMerchantProvider must check that the authenticated merchant owns
 * this provider connection and is permitted to request tracking. resolveCredentials
 * must retrieve that merchant's secrets from a server-side vault. Neither callback
 * may trust a merchant ID or credentials supplied in a request body.
 *
 * createClient is the upstream SDK's createClient function. Dependency injection
 * keeps the global tracking engine independent and makes this boundary mock-testable.
 */
export function createAlgerianCarrierConnector({
  createClient,
  authorizeMerchantProvider,
  resolveCredentials
} = {}) {
  if (typeof createClient !== "function") {
    throw new TypeError("createClient must be a function");
  }
  if (typeof authorizeMerchantProvider !== "function") {
    throw new TypeError("authorizeMerchantProvider must be a function");
  }
  if (typeof resolveCredentials !== "function") {
    throw new TypeError("resolveCredentials must be a function");
  }

  return Object.freeze({
    async track({ merchantId, provider, trackingNumber } = {}) {
      const trustedMerchantId = validateMerchantId(merchantId);
      const number = validateTrackingNumber(trackingNumber);
      const { id: providerId, config } = providerConfig(provider);

      let authorized = false;
      try {
        authorized = await authorizeMerchantProvider({
          merchantId: trustedMerchantId,
          provider: providerId,
          operation: "track"
        });
      } catch {
        throw new AlgerianConnectorError("authorization_unavailable", providerId);
      }
      if (authorized !== true) {
        throw new AlgerianConnectorError("forbidden", providerId);
      }

      let storedCredentials;
      try {
        storedCredentials = await resolveCredentials({
          merchantId: trustedMerchantId,
          provider: providerId
        });
      } catch {
        throw new AlgerianConnectorError("credentials_unavailable", providerId);
      }

      const sdkConfig = buildSdkConfig(providerId, config, storedCredentials);

      let client;
      try {
        // The SDK factory may lazily import a pinned runtime module. Awaiting
        // also preserves compatibility with existing synchronous test factories.
        client = await createClient(config.sdkProvider, sdkConfig);
      } catch {
        throw new AlgerianConnectorError("adapter_unavailable", providerId);
      }
      if (!client || typeof client.track !== "function") {
        throw new AlgerianConnectorError("adapter_unavailable", providerId);
      }

      let result;
      try {
        result = await client.track(number);
      } catch (error) {
        throw new AlgerianConnectorError(upstreamErrorCode(error), providerId);
      }

      return projectTrackResult(result, providerId, number);
    }
  });
}
