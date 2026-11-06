const SUPPORTED_LOCALES = new Set(["en", "ar", "es", "zh", "hi", "pt", "fr", "ru"]);

const COUNTRY_GROUPS = {
  ar: ["DZ", "BH", "KM", "DJ", "EG", "IQ", "JO", "KW", "LB", "LY", "MR", "MA", "OM", "PS", "QA", "SA", "SO", "SD", "SY", "TN", "AE", "YE"],
  fr: ["BE", "BJ", "BF", "BI", "CM", "CA", "CF", "TD", "CG", "CD", "CI", "FR", "GA", "GN", "HT", "LU", "MG", "ML", "MC", "NE", "SN", "SC", "CH", "TG", "VU"],
  es: ["AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "SV", "GQ", "GT", "HN", "MX", "NI", "PA", "PY", "PE", "ES", "UY", "VE"],
  pt: ["AO", "BR", "CV", "GW", "MZ", "PT", "ST", "TL"],
  zh: ["CN", "HK", "MO", "SG", "TW"],
  hi: ["IN"],
  ru: ["BY", "KZ", "KG", "RU"]
};

const COUNTRY_TO_LOCALE = new Map(
  Object.entries(COUNTRY_GROUPS).flatMap(([locale, countries]) =>
    countries.map(country => [country, locale])
  )
);

export function localeForCountry(countryCode) {
  const code = String(countryCode || "").trim().toUpperCase();
  return COUNTRY_TO_LOCALE.get(code) || "en";
}

function cookieValue(cookieHeader, name) {
  const prefix = name + "=";
  for (const item of String(cookieHeader || "").split(";")) {
    const value = item.trim();
    if (value.startsWith(prefix)) {
      try { return decodeURIComponent(value.slice(prefix.length)); } catch { return ""; }
    }
  }
  return "";
}

export async function onRequest({ request, next }) {
  if (request.method !== "GET" && request.method !== "HEAD") return next();

  const url = new URL(request.url);
  const isHome = url.pathname === "/";
  const isCoverage = url.pathname === "/coverage/" || url.pathname === "/coverage";
  if (!isHome && !isCoverage) return next();

  const savedLocale = cookieValue(request.headers.get("Cookie"), "ef-locale");
  const locale = SUPPORTED_LOCALES.has(savedLocale)
    ? savedLocale
    : localeForCountry(request.cf?.country);

  // English is the safe fallback and already lives at the unprefixed canonical URL.
  if (locale === "en") return next();

  const target = new URL(url);
  target.pathname = isCoverage ? "/" + locale + "/coverage/" : "/" + locale + "/";
  const headers = new Headers({
    Location: target.toString(),
    "Cache-Control": "private, no-store",
    Vary: "Cookie, CF-IPCountry"
  });
  if (!SUPPORTED_LOCALES.has(savedLocale)) {
    headers.append("Set-Cookie", "ef-locale=" + locale + "; Max-Age=31536000; Path=/; Secure; SameSite=Lax");
  }
  return new Response(null, { status: 302, headers });
}
