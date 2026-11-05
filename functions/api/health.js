export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: true,
    service: "exportflow-tracking-api",
    engine: "universal-parcel-scraper"
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
