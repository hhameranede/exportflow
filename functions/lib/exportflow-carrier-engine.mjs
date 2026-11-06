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
 * Stable first-party factory for ExportFlow's tracking API.
 * Carrier adapters remain pinned upstream for now; new first-party adapters
 * will be registered behind this factory instead of changing api/track.js.
 */
export function createExportFlowCarrierEngine({ trawlUrl = "" } = {}) {
  if (typeof trawlUrl !== "string") {
    throw new TypeError("trawlU\›]\İ™HHİš[™ÈŠNÂˆB‚ˆ™]\›ˆÜ™X]U˜XÚÙ\ŠÂˆ\Ù\YÙ[ˆ‘^Ü›İËÌŒˆ‹ˆ™]Ú\ˆÜ™X]PÛİY›\™Q™]Ú

KˆËÈ™]™\ˆ›ÜØ\™H\˜Ù[Y[YšY\ˆÈÜ[Û˜[\™\\HYÙÜ™YØ]ÜœÂˆËÈÚ]İ]HÙ\\˜][H™]šY]ÙYš]˜XŞH[™›ÙXİXÚ\Ú[Û‹‚ˆ›İšY\œÎˆË‹‹‘VÔ•“Õ×ÑS‘ÒS‘WÓQUQUK™Y˜][[š]™\œØ[˜[˜XÚÜ×Kˆ‹‹Š˜]Û\›š[J
HÈÈ˜]Û\›ˆ˜]Û\›š[J
HHˆßJBˆJNÂŸB