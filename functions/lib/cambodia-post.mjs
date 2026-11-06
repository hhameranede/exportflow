import {
  ChallengeError,
  InvalidInputError,
  MaintenanceError,
  NotFoundError,
  RateLimitedError,
  SchemaError,
  TransportError
} from "../../node_modules/universal-parcel-scraper/dist/core/errors/index.js";
import { lookupBudget } from "../../node_modules/universal-parcel-scraper/dist/core/adapter/index.js";

export const CAMBODIA_POST_ID = "cambodia-post";
export const CAMBODIA_POST_URL = "https://www.cambodiapost.com.kh/tracking/search";

const MAX_RESPONSE_BYTES = 1_000_000;
const TRACKING_NUMBER = /^[A-Z0-9-]{4,40}$/;
const KH_S10 = /^[A-Z]{2}\d{9}KH$/;

function decodeEntities(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)));
}

function htmlText(value) {
  return decodeEntities(
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(?:div|p|li|td|th|tr|h[1-6])\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeKhmerDigits(value) {
  return value.replace(/[០-៩]/g, digit => String("០១២៣៤៥៦៧៨៩".indexOf(digit)));
}

export function parseCambodiaPostTime(raw) {
  const text = normalizeKhmerDigits(htmlText(raw));
  const match = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i)
    || text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = Number(match[3]);
  const yearFirst = match[1].length === 4;
  const year = yearFirst ? first : third;
  const month = yearFirst ? second : first;
  const day = yearFirst ? third : second;
  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const secondOfMinute = Number(match[6] || 0);
  const meridiem = (match[7] || "").toUpperCase();

  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31
    || hour > 23 || minute > 59 || secondOfMinute > 59) return null;

  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(secondOfMinute).padStart(2, "0")}+07:00`;
  return Number.isFinite(Date.parse(iso)) ? iso : null;
}

export function cambodiaPostStage(value) {
  const text = String(value || "").toLowerCase();
  if (/delivered|delivery completed|received by recipient|បានប្រគល់|បានដឹកជញ្ជូន/.test(text)) return "delivered";
  if (/out for delivery|with delivery courier|courier is delivering/.test(text)) return "out_for_delivery";
  if (/exception|failed|attempted|held|return to sender|customs hold|undeliverable/.test(text)) return "exception";
  if (/in transit|transit|departed|arrived|dispatch|forwarded|customs|sorting|processed|received at/.test(text)) return "in_transit";
  if (/accepted|posted|shipment information|item accepted|pre-advice|collected/.test(text)) return "pending";
  return "unknown";
}

function extractRows(html) {
  const rows = [];
  for (const tableMatch of String(html).matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const table = tableMatch[1];
    for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(match => htmlText(match[1]));
      if (cells.length >= 3 && cells.some(Boolean)) rows.push(cells);
    }
  }
  return rows;
}

export function parseCambodiaPostHtml(html, trackingNumber) {
  const source = String(html || "");
  if (/(?:cloudflare|captcha|verify you are human|just a moment|cf-chl-|access denied)/i.test(source)) {
    throw new ChallengeError("Cambodia Post", "The official tracking page requires an interactive verification.");
  }
  if (/\bnot found\b|មិនឃើញ|រកមិនឃើញ/i.test(htmlText(source))) {
    throw new NotFoundError("Cambodia Post");
  }

  const rows = extractRows(source);
  const events = [];
  for (const cells of rows) {
    const [localTime, country, location, eventType, mailType, nextOffice, extra] = cells;
    const description = [eventType, mailType, nextOffice, extra].filter(Boolean).join(" · ").slice(0, 320);
    const time = parseCambodiaPostTime(localTime);
    if (!description && !location) continue;
    events.push({
      ...(time ? { time } : {}),
      ...( [country, location].filter(Boolean).length ? { location: [country, location].filter(Boolean).join(" · ").slice(0, 180) } : {}),
      description: description || "Shipment update",
      stage: cambodiaPostStage(description)
    });
  }

  if (!events.length) {
    throw new SchemaError("Cambodia Post", "The official tracking page did not contain a recognizable shipment history.");
  }

  events.sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return -1;
    if (!b.time) return 1;
    return Date.parse(a.time) - Date.parse(b.time);
  });

  const latest = events.at(-1);
  return {
    status: latest.stage === "unknown" ? "unknown" : latest.stage,
    current_stage: latest.stage,
    last_status_text: latest.description,
    last_update: latest.time || null,
    service_name: "Cambodia Post",
    events: events.slice(-60)
  };
}

export function isCambodiaPostNumber(value) {
  return typeof value === "string" && KH_S10.test(value.trim().toUpperCase());
}

export function createCambodiaPostAdapter(environment = {}) {
  const fetcher = environment.fetcher || fetch;
  return {
    id: CAMBODIA_POST_ID,
    steps: ["direct"],
    async track(input, context = {}) {
      const number = typeof input?.number === "string" ? input.number.trim().toUpperCase() : "";
      if (!TRACKING_NUMBER.test(number)) throw new InvalidInputError("Cambodia Post");
      const budget = lookupBudget(context, 18_000, "Cambodia Post");
      const url = `${CAMBODIA_POST_URL}/${encodeURIComponent(number)}`;
      let response;
      try {
        response = await fetcher(url, {
          method: "GET",
          redirect: "follow",
          signal: budget.signal,
          headers: {
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en,km;q=0.8",
            "Referer": CAMBODIA_POST_URL,
            "User-Agent": environment.userAgent || "ExportFlow/0.1 (+https://exportflow.me)"
          }
        });
      } catch (error) {
        if (budget.signal.aborted) throw budget.signal.reason;
        throw new TransportError("Cambodia Post", "The official tracking service could not be reached.", { cause: error });
      }

      if (response.status === 404 || response.status === 410) throw new NotFoundError("Cambodia Post");
      if (response.status === 401 || response.status === 403) throw new ChallengeError("Cambodia Post");
      if (response.status === 429) {
        const seconds = Number(response.headers.get("Retry-After"));
        throw new RateLimitedError("Cambodia Post", Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined);
      }
      if (response.status === 503) throw new MaintenanceError("Cambodia Post");
      if (!response.ok) throw new TransportError("Cambodia Post", `The official service returned HTTP ${response.status}.`);

      const declaredLength = Number(response.headers.get("Content-Length") || 0);
      if (declaredLength > MAX_RESPONSE_BYTES) throw new SchemaError("Cambodia Post", "The tracking response exceeded the size limit.");
      const html = await response.text();
      if (html.length > MAX_RESPONSE_BYTES) throw new SchemaError("Cambodia Post", "The tracking response exceeded the size limit.");
      return parseCambodiaPostHtml(html, number);
    }
  };
}
