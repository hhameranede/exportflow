export const TENANT_REQUEST_MIN_INTERVAL_MS = 2_500;

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function getRequestIntervalWaitMs(lastRequestAt, now, minimumIntervalMs = TENANT_REQUEST_MIN_INTERVAL_MS) {
  return Math.max(0, minimumIntervalMs - (now - lastRequestAt));
}

export function createRequestPacer({
  minimumIntervalMs = TENANT_REQUEST_MIN_INTERVAL_MS,
  now = () => Date.now(),
  sleep = defaultSleep,
} = {}) {
  if (!Number.isInteger(minimumIntervalMs) || minimumIntervalMs < 1) {
    throw new TypeError("minimumIntervalMs must be a positive integer.");
  }
  if (typeof now !== "function" || typeof sleep !== "function") {
    throw new TypeError("now and sleep must be functions.");
  }

  let lastRequestAt = 0;
  return async function waitForSlot() {
    const waitMs = getRequestIntervalWaitMs(lastRequestAt, now(), minimumIntervalMs);
    if (waitMs > 0) await sleep(waitMs);
    lastRequestAt = now();
  };
}
