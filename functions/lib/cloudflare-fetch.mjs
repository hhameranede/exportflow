/**
 * Cloudflare Workers does not implement Fetch's redirect: "error" mode.
 * Passing it to fetch() throws before any network request is sent. Use
 * "manual" instead: a redirect is surfaced as a 3xx response and the
 * upstream tracking engine can classify it without silently following it.
 *
 * Explicit "follow" and "manual" choices from individual carrier adapters
 * are preserved.
 */
export function createCloudflareFetch(fetchImpl = fetch) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required");
  }

  return (input, init = {}) => {
    const requestRedirect = input instanceof Request ? input.redirect : undefined;
    const redirect = init.redirect ?? requestRedirect;

    if (redirect !== "error") {
      return fetchImpl(input, init);
    }

    return fetchImpl(input, { ...init, redirect: "manual" });
  };
}
