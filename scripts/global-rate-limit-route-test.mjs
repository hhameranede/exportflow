import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/track.js";

const hmacSecret = "synthetic-global-limiter-secret-which-is-long-enough";
const deniedResult = {
  allowed: false,
  limit: 12,
  remaining: 0,
  resetAt: Math.floor(Date.now() / 1000) + 30,
  resetAfterSeconds: 30,
  retryAfterSeconds: 30
};

function namespace({ result = deniedResult, throwOnFetch = false } = {}) {
  const calls = [];
  return {
    calls,
    binding: {
      idFromName(name) { return { name }; },
      get(id) {
        return {
          async fetch(url, init) {
            calls.push({ url, init, name: id.name });
            if (throwOnFetch) throw new Error("synthetic DO outage");
            return Response.json(result);
          }
        };
      }
    }
  };
}

function trackRequest(ip, body = { number: "EF-GLOBAL-0001" }) {
  return new Request("https://preview.exportflow-aja.pages.dev/api/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
      "Origin": "https://preview.exportflow-aja.pages.dev"
    },
    body: JSON.stringify(body)
  });
}

async function main() {
  const limited = namespace();
  const response = await onRequestPost({
    request: trackRequest("198.51.100.41"),
    env: {
      GLOBAL_RATE_LIMITER: limited.binding,
      GLOBAL_RATE_LIMITER_HMAC_SECRET: hmacSecret,
      EXPORTFLOW_ENV: "preview"
    }
  });
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error, "rate_limited");
  assert.equal(response.headers.get("RateLimit-Limit"), "12");
  assert.equal(response.headers.get("RateLimit-Remaining"), "0");
  assert.equal(response.headers.get("RateLimit-Reset"), "30");
  assert.equal(response.headers.get("Retry-After"), "30");
  assert.equal(response.headers.get("X-RateLimit-Scope"), "global-client");
  assert.equal(limited.calls.length, 1, "A denied global quota must be checked before calling the carrier engine.");
  assert.equal(limited.calls[0].init.body.includes("198.51.100.41"), false);

  const unavailable = namespace({ throwOnFetch: true });
  const unavailableResponse = await onRequestPost({
    request: trackRequest("198.51.100.42"),
    env: {
      GLOBAL_RATE_LIMITER: unavailable.binding,
      GLOBAL_RATE_LIMITER_HMAC_SECRET: hmacSecret,
      EXPORTFLOW_ENV: "preview"
    }
  });
  assert.equal(unavailableResponse.status, 503);
  assert.equal((await unavailableResponse.json()).error, "global_rate_limiter_unavailable");
  assert.equal(unavailable.calls.length, 1);

  const invalid = namespace();
  const invalidResponse = await onRequestPost({
    request: trackRequest("198.51.100.43", { number: "x", unknown: "field" }),
    env: {
      GLOBAL_RATE_LIMITER: invalid.binding,
      GLOBAL_RATE_LIMITER_HMAC_SECRET: hmacSecret,
      EXPORTFLOW_ENV: "preview"
    }
  });
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalid.calls.length, 0, "Invalid user input must be rejected before consuming the global budget.");

  // Carrier-documented display formats must reach the trusted lookup boundary.
  // The fake DO denies these requests before any upstream carrier receives a number.
  const supportedDisplayFormats = [
    "99.34.123456.12345678",
    "P/1234/LABC/2026",
    "(00) 3 7012345 678901234 7",
    "AB_123456789"
  ];
  for (const [index, number] of supportedDisplayFormats.entries()) {
    const reachedLimiter = namespace();
    const acceptedFormatResponse = await onRequestPost({
      request: trackRequest("198.51.100." + (50 + index), { number }),
      env: {
        GLOBAL_RATE_LIMITER: reachedLimiter.binding,
        GLOBAL_RATE_LIMITER_HMAC_SECRET: hmacSecret,
        EXPORTFLOW_ENV: "preview"
      }
    });
    assert.equal(acceptedFormatResponse.status, 429, "Supported format should pass input validation: " + number);
    assert.equal(reachedLimiter.calls.length, 1, "Supported format should reach the global limiter: " + number);
  }

  const unsafePunctuation = namespace();
  const unsafeResponse = await onRequestPost({
    request: trackRequest("198.51.100.60", { number: "AB12;1234" }),
    env: {
      GLOBAL_RATE_LIMITER: unsafePunctuation.binding,
      GLOBAL_RATE_LIMITER_HMAC_SECRET: hmacSecret,
      EXPORTFLOW_ENV: "preview"
    }
  });
  assert.equal(unsafeResponse.status, 400, "Unsupported punctuation must still be rejected.");
  assert.equal(unsafePunctuation.calls.length, 0, "Unsafe punctuation must be rejected before rate limiting.");


  console.log("Global rate-limit tracking route tests passed.");
}

await main();
