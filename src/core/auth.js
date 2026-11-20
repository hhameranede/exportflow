export { authenticateRequest } from "./tenant-auth.js";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 60;
const MAX_TRACKED_CLIENTS = 1_000;

/**
 * Per-isolate burst protection only. Persistent plan quotas are enforced by D1.
 * Callers must key this limiter by the authenticated tenant ID, never by user input.
 */
export function createRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
  now = () => Date.now(),
} = {}) {
  if (!Number.isInteger(windowMs) || windowMs < 1) {
    throw new TypeError("Rate limiter windowMs must be a positive integer.");
  }
  if (!Number.isInteger(maxRequests) || maxRequests < 1) {
    throw new TypeError("Rate limiter maxRequests must be a positive integer.");
  }

  const buckets = new Map();

  return {
    check(key) {
      const currentMs = now();
      if (buckets.size >= MAX_TRACKED_CLIENTS) {
        for (const [entryKey, entry] of buckets.entries()) {
          if (entry.resetAt <= currentMs) buckets.delete(entryKey);
        }
        if (buckets.size >= MAX_TRACKED_CLIENTS) {
          const oldestKey = buckets.keys().next().value;
          if (oldestKey !== undefined) buckets.delete(oldestKey);
        }
      }

      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= currentMs) {
        const next = { count: 1, resetAt: currentMs + windowMs };
        buckets.set(key, next);
        return {
          allowed: true,
          remaining: Math.max(0, maxRequests - 1),
          resetAtMs: next.resetAt,
        };
      }

      if (existing.count >= maxRequests) {
        const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - currentMs) / 1000));
        return {
          allowed: false,
          remaining: 0,
          resetAtMs: existing.resetAt,
          retryAfterSec,
        };
      }

      existing.count += 1;
      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - existing.count),
        resetAtMs: existing.resetAt,
      };
    },
  };
}
