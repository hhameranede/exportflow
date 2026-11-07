import { createExportFlowClient } from "./exportflow-sdk.mjs";

const STORAGE_KEY = "exportflow:merchant-watchlist:v1";
const MAX_WATCHLIST = 10;
const client = createExportFlowClient();
const form = document.getElementById("merchantForm");
const orderReference = document.getElementById("orderReference");
const trackingNumber = document.getElementById("trackingNumber");
const carrierId = document.getElementById("carrierId");
const postcode = document.getElementById("postcode");
const language = document.getElementById("language");
const watchlist = document.getElementById("watchlist");
const summary = document.getElementById("watchlistSummary");
const formStatus = document.getElementById("formStatus");
const refreshStatus = document.getElementById("refreshStatus");
const refreshButton = document.getElementById("refreshAll");
const deleteAllButton = document.getElementById("deleteAll");
const exportButton = document.getElementById("exportCsv");
const metricTotal = document.getElementById("metricTotal");
const metricTracked = document.getElementById("metricTracked");
const metricDelivered = document.getElementById("metricDelivered");
const metricAttention = document.getElementById("metricAttention");

let items = [];
let idCounter = 0;
let storageAvailable = true;
let refreshing = false;

function setStatus(target, message) {
  target.textContent = message;
}

function safeStoredItem(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.id !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(value.id)) return null;
  if (typeof value.number !== "string" || value.number.length < 4 || value.number.length > 40 ||
      !/^[a-zA-Z0-9\s-]+$/.test(value.number)) return null;
  if (typeof value.reference !== "string" || value.reference.length > 64) return null;
  return {
    id: value.id,
    reference: value.reference,
    number: value.number,
    ...(typeof value.carrier === "string" ? { carrier: value.carrier } : {}),
    ...(typeof value.postcode === "string" ? { postcode: value.postcode } : {}),
    language: ["en", "ar", "es", "zh", "hi", "pt", "fr", "bn"].includes(value.language) ? value.language : "en",
    ...(value.lastResult && typeof value.lastResult === "object" ? { lastResult: {
      status: typeof value.lastResult.status === "string" ? value.lastResult.status.slice(0, 64) : "",
      error: typeof value.lastResult.error === "string" ? value.lastResult.error.slice(0, 64) : "",
      carrier: typeof value.lastResult.carrier === "string" ? value.lastResult.carrier.slice(0, 80) : "",
      expectedDelivery: typeof value.lastResult.expectedDelivery === "string" ? value.lastResult.expectedDelivery.slice(0, 80) : "",
      latestEvent: typeof value.lastResult.latestEvent === "string" ? value.lastResult.latestEvent.slice(0, 240) : ""
    } } : {}),
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {})
  };
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(safeStoredItem).filter(Boolean).slice(0, MAX_WATCHLIST);
  } catch {
    storageAvailable = false;
    return [];
  }
}

function persistItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    storageAvailable = true;
    return true;
  } catch {
    storageAvailable = false;
    setStatus(formStatus, "This browser could not save local data. Check storage settings or available space.");
    return false;
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function formatUpdated(value) {
  if (!value) return "Not refreshed yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Updated time unavailable" : "Updated " + date.toLocaleString();
}

function updateMetrics() {
  const refreshed = items.filter(item => item.lastResult);
  const delivered = refreshed.filter(item => item.lastResult?.status?.toLowerCase().startsWith("delivered"));
  const attention = refreshed.filter(item => item.lastResult?.error || /exception|failed|hold|delay/i.test(item.lastResult?.status || ""));
  metricTotal.textContent = String(items.length);
  metricTracked.textContent = String(refreshed.length);
  metricDelivered.textContent = String(delivered.length);
  metricAttention.textContent = String(attention.length);
}

function render() {
  updateMetrics();
  watchlist.replaceChildren();
  summary.textContent = items.length + " / " + MAX_WATCHLIST + " shipments saved on this device";

  if (items.length === 0) {
    watchlist.append(element("p", "merchant-notice", "Your watchlist is empty. Add an order above to begin."));
  }

  for (const item of items) {
    const card = element("article", "merchant-item");
    const details = element("div");
    details.append(element("h3", "", item.reference));
    details.append(element("p", "", "Tracking number: " + item.number));
    details.append(element("p", "", "Carrier: " + (item.lastResult?.carrier || item.carrier || "Auto-detect")));
    details.append(element("p", "", item.lastResult?.error ? "Lookup issue: " + item.lastResult.error : "Status: " + (item.lastResult?.status || "Not refreshed yet")));
    if (item.lastResult?.expectedDelivery) {
      details.append(element("p", "", "Carrier-reported delivery: " + item.lastResult.expectedDelivery));
    }
    if (item.lastResult?.latestEvent) {
      details.append(element("p", "", "Latest scan: " + item.lastResult.latestEvent));
    }
    details.append(element("p", "merchant-status", formatUpdated(item.updatedAt)));

    const actions = element("div", "merchant-actions");
    const remove = element("button", "", "Remove");
    remove.type = "button";
    remove.disabled = refreshing;
    remove.setAttribute("aria-label", "Remove " + item.reference);
    remove.addEventListener("click", () => {
      items = items.filter(entry => entry.id !== item.id);
      persistItems();
      render();
      setStatus(formStatus, "Shipment removed from this device.");
    });
    actions.append(remove);
    card.append(details, actions);
    watchlist.append(card);
  }

  refreshButton.disabled = refreshing || items.length === 0;
  deleteAllButton.disabled = refreshing || items.length === 0;
  exportButton.disabled = items.length === 0;
}

function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replaceAll("-", "");
  }
  idCounter += 1;
  return Date.now().toString(36) + idCounter.toString(36);
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const reference = orderReference.value.trim();
  const number = trackingNumber.value.trim();
  const carrier = carrierId.value.trim();
  const zip = postcode.value.trim();

  if (!reference || reference.length > 64) {
    setStatus(formStatus, "Enter an order reference of up to 64 characters.");
    orderReference.focus();
    return;
  }
  if (number.length < 4 || number.length > 40 || !/^[a-zA-Z0-9\s-]+$/.test(number)) {
    setStatus(formStatus, "Enter a valid tracking number (4–40 letters, numbers, spaces or hyphens).");
    trackingNumber.focus();
    return;
  }
  if (carrier && !/^[a-z0-9-]{2,80}$/i.test(carrier)) {
    setStatus(formStatus, "Carrier ID may contain only letters, numbers and hyphens.");
    carrierId.focus();
    return;
  }
  if (zip && (zip.length > 24 || !/^[a-z0-9 -]+$/i.test(zip))) {
    setStatus(formStatus, "The postcode format is invalid.");
    postcode.focus();
    return;
  }
  if (items.length >= MAX_WATCHLIST) {
    setStatus(formStatus, "The local watchlist is full. Remove a shipment before adding another.");
    return;
  }
  if (items.some(item => item.number.toUpperCase() === number.toUpperCase() && (item.carrier || "") === carrier)) {
    setStatus(formStatus, "This tracking number and carrier are already saved.");
    return;
  }

  items.unshift({
    id: makeId(),
    reference,
    number,
    ...(carrier ? { carrier } : {}),
    ...(zip ? { postcode: zip } : {}),
    language: language.value
  });
  if (!persistItems()) {
    items.shift();
    return;
  }
  form.reset();
  language.value = "en";
  render();
  setStatus(formStatus, "Saved in this browser only. No tracking request has been sent yet.");
  orderReference.focus();
});

function compactResult(result) {
  const data = result.data || {};
  const latest = data.truth?.latestTrusted || data.truth?.latestReceived || data.events?.[0] || null;
  const latestEvent = latest
    ? [latest.stage, latest.location, latest.description].filter(Boolean).join(" · ").slice(0, 240)
    : "";
  return {
    status: result.status >= 200 && result.status < 300 && typeof data.status === "string" ? data.status : "",
    carrier: typeof data.carrier === "string" ? data.carrier : "",
    expectedDelivery: typeof data.expectedDelivery === "string" ? data.expectedDelivery : "",
    latestEvent,
    error: typeof data.error === "string" ? data.error : ""
  };
}

async function refreshAll() {
  if (items.length === 0 || refreshing) return;
  refreshing = true;
  render();
  const batches = [];
  for (let offset = 0; offset < items.length; offset += 5) {
    batches.push(items.slice(offset, offset + 5));
  }

  try {
    for (let index = 0; index < batches.length; index += 1) {
      setStatus(refreshStatus, "Refreshing batch " + (index + 1) + " of " + batches.length + "…");
      try {
        const response = await client.batchTrack(batches[index].map(item => ({
          id: item.id,
          number: item.number,
          ...(item.carrier ? { carrier: item.carrier } : {}),
          ...(item.postcode ? { postcode: item.postcode } : {}),
          language: item.language
        })));
        const byId = new Map(response.results.map(result => [result.id, result]));
        for (const item of batches[index]) {
          const result = byId.get(item.id);
          item.lastResult = result
            ? compactResult(result.status >= 200 && result.status < 300 ? { ...result, data: result.data } : { ...result, data: { ...(result.data || {}), error: result.data?.error || "tracking_failed" } })
            : { status: "unknown", error: "missing_batch_result" };
          item.updatedAt = new Date().toISOString();
        }
      } catch (error) {
        for (const item of batches[index]) {
          item.lastResult = { status: "unknown", error: error?.code || "request_failed" };
          item.updatedAt = new Date().toISOString();
        }
      }
      persistItems();
      render();
    }
    setStatus(refreshStatus, "Refresh complete. Results are saved only in this browser.");
  } finally {
    refreshing = false;
    render();
  }
}

refreshButton.addEventListener("click", refreshAll);

exportButton.addEventListener("click", () => {
  const columns = ["order_reference", "tracking_number", "carrier", "postcode", "language", "status", "error", "expected_delivery", "latest_event", "updated_at"];
  const quote = value => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = items.map(item => {
    const result = item.lastResult || {};
    return [item.reference, item.number, item.carrier || result.carrier, item.postcode, item.language, result.status, result.error, result.expectedDelivery, result.latestEvent, item.updatedAt]
      .map(quote).join(",");
  });
  const blob = new Blob([[columns.join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "exportflow-merchant-watchlist.csv";
  link.click();
  URL.revokeObjectURL(url);
  setStatus(formStatus, "CSV export prepared for " + items.length + " shipment(s).");
});
deleteAllButton.addEventListener("click", () => {
  if (!confirm("Remove every saved shipment from this browser? This cannot be undone.")) return;
  items = [];
  persistItems();
  render();
  setStatus(refreshStatus, "The local watchlist has been cleared.");
});

items = loadItems();
render();
if (!storageAvailable) {
  setStatus(formStatus, "Local storage is unavailable in this browser. The watchlist will not persist after this page closes.");
}
