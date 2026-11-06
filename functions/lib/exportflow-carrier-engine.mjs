import { createTracker, TrackingError } from "../../node_modules/universal-parcel-scraper/dist/facade/index.js";
import { createCloudflareFetch } from "./cloudflare-fetch.mjs";

export { TrackingError };

export const EXPORTFLOW_ENGINE_METADATA = Object.freeze({
  name: "ExportFlow Carrier Engine",
  apiVersion: "1",
  upstream: "plhery/universal-parcel-scraper",
  upstreamCommit: "e64a466772ef25ce68e02d9c7c9f1613eec1208b",
  defaultUniversalFallbacks: Object.freeze(["UPU"]),
  trackingNumberRetention: "none-by-default"
});

/**
 * ExportFlow-owned tracking boundary.
 * The upstream adapters stay pinned until each candidate has passed our
 * licensing, Cloudflare compatibility, fixture and live-canary gates.
 */
export function createExportFlowCarrierEngine({ trawlUrl = "" } = {}) {
  if (typeof trawlUrl !== "string") {
    throw new TypeError("trawlUrl must be a string");
  }

  return createTracker({
    userAgent: "ExportFlow/0.2",
    fetcher: createCloudflareFetch(),
    // Do not forward parcel IDs to optional third-party aggregators by default.
    providers: [...EXPORTFLOW_ENGINE_METADATA.defaultUniversalFallbacks],
    ...(trawlUrl.trim() ? { trawlUrl: trawlUrl.trim() } : {})
  });
}
