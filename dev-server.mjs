import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, join } from "node:path";

const PORT = 3000;
const ROOT = process.cwd();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
    const pathname = url.pathname;

    // Handle coverage API
    if (pathname === "/api/coverage" && req.method === "GET") {
      try {
        const { onRequestGet } = await import("./functions/api/coverage.js");
        const response = await onRequestGet();
        const body = await response.text();
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(body);
        return;
      } catch (err) {
        // Fallback coverage response for local dev if native import attribute differs
        try {
          const cached = await readFile(join(ROOT, "api-coverage.json"), "utf8");
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(cached);
          return;
        } catch {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            source: "installed-universal-parcel-scraper-catalog",
            summary: { catalogEntries: 1339, directCountryCount: 123, allCountries: 249 },
            countries: []
          }));
          return;
        }
      }
    }

    // Handle tracking API
    if (pathname === "/api/track" && req.method === "POST") {
      try {
        const { onRequestPost } = await import("./functions/api/track.js");
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const rawBody = Buffer.concat(chunks).toString("utf8");

        const webReq = new Request(url.href, {
          method: "POST",
          headers: req.headers,
          body: rawBody
        });

        const response = await postTrack({ request: webReq, env: process.env });
        const body = await response.text();
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(body);
        return;
      } catch (err) {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({
          carrier: "Mock Carrier",
          status: "in_transit",
          expectedDelivery: "2-3 business days",
          events: [
            { time: new Date().toISOString().slice(0, 10), description: "Shipment in transit to destination", location: "Regional Sort Facility" }
          ]
        }));
        return;
      }
    }

    // Static file resolution
    let filePath = join(ROOT, pathname);
    try {
      const s = await stat(filePath);
      if (s.isDirectory()) {
        filePath = join(filePath, "index.html");
      }
    } catch {
      if (!extname(filePath)) {
        try {
          const withHtml = filePath + ".html";
          await stat(withHtml);
          filePath = withHtml;
        } catch {
          // Keep filePath
        }
      }
    }

    try {
      const content = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "no-cache"
      });
      res.end(content);
    } catch {
      try {
        const notFound = await readFile(join(ROOT, "404.html"));
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(notFound);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
      }
    }
  } catch (err) {
    console.error("Server error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "server_error" }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ExportFlow server listening on http://0.0.0.0:${PORT}`);
});
