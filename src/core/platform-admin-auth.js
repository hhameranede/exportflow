const OWNER_ID_MAX_LENGTH = 128;
const OWNER_ALLOWLIST_MAX_BYTES = 2_048;
const OWNER_ALLOWLIST_MAX_COUNT = 20;
const DEFAULT_MAX_SESSION_AGE_MS = 10 * 60 * 1000;
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000;

export function parsePlatformOwnerIds(raw) {
  if (typeof raw !== "string" || raw.length < 1 || raw.length > OWNER_ALLOWLIST_MAX_BYTES) {
    return new Set();
  }
  const values = raw.split(",");
  if (values.length < 1 || values.length > OWNER_ALLOWLIST_MAX_COUNT) {
    return new Set();
  }
  const ids = values.map((value) => value.trim());
  if (ids.some((value) =>
    value.length < 1 ||
    value.length > OWNER_ID_MAX_LENGTH ||
    !/^[A-Za-z0-9_:@.-]+$/.test(value)
  )) {
    return new Set();
  }
  return new Set(ids);
}

function parseExpectedOrigin(value) {
  try {
    const parsed = new URL(value);
    const secureHttps = parsed.protocol === "https:";
    const localHttp = parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (!secureHttps && !localHttp) return null;
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function asTimestamp(value) {
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

/**
 * Validates a single same-origin owner session for one mutating request.
 *
 * The owner allowlist is deployment configuration, not request data. Better Auth
 * must resolve the session from the supplied request headers on the server.
 * Cookie-cache bypass, a verified email, a recent session, and a non-impersonated
 * session are required. Every failure denies access.
 */
export async function authorizePlatformOwnerRequest(request, {
  ownerUserIds,
  expectedOrigin,
  getSession,
  now = () => Date.now(),
  maxSessionAgeMs = DEFAULT_MAX_SESSION_AGE_MS,
} = {}) {
  const deny = Object.freeze({ allowed: false });
  if (!(request instanceof Request) || request.method !== "POST") return deny;
  if (!(ownerUserIds instanceof Set) || ownerUserIds.size === 0) return deny;
  if (typeof getSession !== "function") return deny;
  if (!Number.isSafeInteger(maxSessionAgeMs) || maxSessionAgeMs < 1 ||
      maxSessionAgeMs > DEFAULT_MAX_SESSION_AGE_MS) return deny;

  const allowedOrigin = parseExpectedOrigin(expectedOrigin);
  if (!allowedOrigin) return deny;

  let requestOrigin;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return deny;
  }
  const origin = request.headers.get("origin");
  if (requestOrigin !== allowedOrigin || origin !== allowedOrigin) return deny;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return deny;

  let session;
  try {
    session = await getSession({
      headers: request.headers,
      query: { disableCookieCache: true },
    });
  } catch {
    return deny;
  }

  const userId = session?.user?.id;
  if (typeof userId !== "string" || !ownerUserIds.has(userId)) return deny;
  if (session.user.emailVerified !== true) return deny;
  if (session.session?.impersonatedBy) return deny;

  let currentTime;
  try {
    const value = now();
    currentTime = value instanceof Date ? value.getTime() : Number(value);
  } catch {
    return deny;
  }
  if (!Number.isFinite(currentTime)) return deny;

  const createdAt = asTimestamp(session.session?.createdAt);
  const expiresAt = asTimestamp(session.session?.expiresAt);
  if (createdAt === null || expiresAt === null || expiresAt <= currentTime) return deny;

  const age = currentTime - createdAt;
  if (age < -CLOCK_SKEW_TOLERANCE_MS || age > maxSessionAgeMs) return deny;

  return Object.freeze({ allowed: true, actorId: userId });
}
