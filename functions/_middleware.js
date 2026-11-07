const SUPPORTED_LOCALES = new Set(["en", "ar", "es", "zh", "hi", "pt", "fr", "bn"]);

const COUNTRY_GROUPS = {
  ar: ["DZ", "BH", "KM", "DJ", "EG", "IQ", "JO", "KW", "LB", "LY", "MR", "MA", "OM", "PS", "QA", "SA", "SO", "SD", "SY", "TD", "TN", "AE", "YE"],
  fr: ["BE", "BJ", "BF", "BI", "CM", "CA", "CF", "CG", "CD", "CI", "FR", "GA", "GN", "HT", "LU", "MG", "ML", "MC", "NE", "RW", "SN", "SC", "CH", "TG", "VU"],
  es: ["AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "SV", "GQ", "GT", "HN", "MX", "NI", "PA", "PY", "PE", "ES", "UY", "VE"],
  pt: ["AO", "BR", "CV", "GW", "MZ", "PT", "ST", "TL"],
  zh: ["CN", "HK", "MO", "SG", "TW"],
  hi: ["IN"],
  bn: ["BD"]
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

const PREFERENCE_SENSITIVE_COUNTRIES = {
  CA: ["fr"],
  BE: ["fr"],
  LU: ["fr"],
  CH: ["fr"],
  SG: ["zh"],
  VU: ["fr"]
};

export function localeForVisitor(countryCode, acceptLanguage) {
  const code = String(countryCode || "").trim().toUpperCase();
  const alternatives = PREFERENCE_SENSITIVE_COUNTRIES[code];
  if (!alternatives) return localeForCountry(code);

  const accepted = String(acceptLanguage || "").split(",")
    .map(value => value.trim().split(";")[0].split("-")[0].toLowerCase())
    .filter(Boolean);
  const matching = accepted.find(locale =>
    SUPPORTED_LOCALES.has(locale) && (locale === "en" || alternatives.includes(locale))
  );
  return matching || localeForCountry(code);
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

  // Let search crawlers read the canonical English entry point and discover locale alternates.
  const userAgent = request.headers.get("User-Agent") || "";
  if (/(bot|crawler|spider|slurp|bingpreview)/i.test(userAgent)) return next();

  const url = new URL(request.url);
  const isHome = url.pathname === "/";
  const isCoverage = url.pathname === "/coverage/" || url.pathname === "/coverage";
  if (!isHome && !isCoverage) return next();

  const savedLocale = cookieValue(request.headers.get("Cookie"), "ef-locale");
  const locale = SUPPORTED_LOCALES.has(savedLocale)
    ? savedLocale
    : localeForVisitor(request.cf?.country, request.headers.get("Accept-Language"));

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
