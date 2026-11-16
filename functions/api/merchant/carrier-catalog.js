import { CARRIERS } from "universal-parcel-scraper";
import { filterPublicCarrierRecords } from "../../lib/public-carrier-policy.mjs";

function publicRequirement(requirement) {
  return {
    field: requirement.field,
    label: requirement.label,
    type: requirement.type,
    optional: requirement.optional === true,
    showsMore: requirement.showsMore === true,
    readsCountry: requirement.readsCountry === true,
    ...(requirement.whenTrackingNumber ? { whenTrackingNumber: requirement.whenTrackingNumber } : {}),
    ...(requirement.placeholder ? { placeholder: requirement.placeholder } : {}),
    ...(requirement.help ? { help: requirement.help } : {}),
    ...(requirement.pattern ? { pattern: requirement.pattern } : {}),
    ...(Number.isInteger(requirement.maxLength) ? { maxLength: requirement.maxLength } : {}),
    ...(requirement.inputMode ? { inputMode: requirement.inputMode } : {}),
    ...(requirement.autoComplete ? { autoComplete: requirement.autoComplete } : {})
  };
}

export async function onRequestGet() {
  const carriers = filterPublicCarrierRecords(Object.values(CARRIERS))
    .filter(carrier =>
      carrier &&
      carrier.id !== "unknown" &&
      carrier.capabilities?.selectable === true &&
      carrier.capabilities?.tracking?.mode === "automatic" &&
      typeof carrier.capabilities.tracking.adapter === "string" &&
      carrier.capabilities.tracking.adapter !== "universal"
    )
    .map(carrier => ({
      id: carrier.id,
      name: carrier.name || carrier.id,
      adapter: carrier.capabilities.tracking.adapter,
      countries: Array.isArray(carrier.countries) ? carrier.countries : [],
      aliases: Array.isArray(carrier.aliases) ? carrier.aliases : [],
      requirements: (carrier.capabilities.tracking.requirements || []).map(publicRequirement)
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));

  return new Response(JSON.stringify({
    source: "installed-exportflow-direct-adapters",
    count: carriers.length,
    carriers
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
