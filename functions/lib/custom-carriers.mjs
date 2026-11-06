import { AdapterRegistry } from "../../node_modules/universal-parcel-scraper/dist/core/adapter/index.js";
import { trackCarrier } from "../../node_modules/universal-parcel-scraper/dist/core/adapter/track.js";
import { NOOP_RECORDER } from "../../node_modules/universal-parcel-scraper/dist/core/telemetry/index.js";
import { createCambodiaPostAdapter, CAMBODIA_POST_ID } from "./cambodia-post.mjs";

let runtime;

function getRuntime(fetcher) {
  if (!runtime) {
    const environment = {
      fetcher,
      userAgent: "ExportFlow/0.1",
      trawl: null,
      browserExecutablePath: null,
      recorder: NOOP_RECORDER,
      env: {}
    };
    runtime = {
      registry: new AdapterRegistry({
        factories: { [CAMBODIA_POST_ID]: createCambodiaPostAdapter },
        carriers: { [CAMBODIA_POST_ID]: CAMBODIA_POST_ID }
      }, environment)
    };
  }
  return runtime;
}

export async function trackCustomCarrier(carrierId, input, context, fetcher) {
  if (carrierId !== CAMBODIA_POST_ID) throw new RangeError("Unknown ExportFlow custom carrier");
  const current = getRuntime(fetcher);
  return trackCarrier(carrierId, input, {
    ...context,
    registry: current.registry,
    universal: null,
    recorder: NOOP_RECORDER
  });
}

export const CUSTOM_CARRIERS = [
  {
    id: CAMBODIA_POST_ID,
    name: "Cambodia Post",
    country: "KH",
    countryName: "Cambodia",
    adapter: "direct",
    trackingUrl: "https://www.cambodiapost.com.kh/tracking/search"
  }
];
