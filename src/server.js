import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import worker from "./index.js";
import { createLocalRuntimeEnv } from "./core/local-runtime.js";

const PUBLIC_AISTUDIO_DIR = path.resolve(process.cwd(), "public/assets/aistudio");
const STATIC_ASSET_MIME = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
});

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const REQUEST_TIMEOUT_MS = 15_000;
const HEADERS_TIMEOUT_MS = 5_000;

function parsePort(rawPort, fallback = DEFAULT_PORT) {
  if (rawPort === undefined || rawPort === "") return fallback;
  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new RangeError(`Invalid PORT value: ${rawPort}`);
  }
  return parsed;
}

function toWebHeaders(rawHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  return headers;
}

export function createNodeHandler({
  workerInstance = worker,
  env = process.env,
  internalOrigin = "http://127.0.0.1",
} = {}) {
  return async (req, res) => {
    const controller = new AbortController();
    const onDisconnect = () => {
      if (!res.writableFinished) {
        controller.abort();
      }
    };
    req.on("aborted", onDisconnect);
    res.on("close", onDisconnect);

    try {
      let url;
      try {
        url = new URL(req.url || "/", internalOrigin);
      } catch {
        res.statusCode = 400;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: { code: "INVALID_REQUEST_URL", message: "Invalid request path." } }));
        return;
      }

      if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/assets/aistudio/")) {
        const relName = path.basename(decodeURIComponent(url.pathname.slice("/assets/aistudio/".length)));
        const candidate = path.resolve(PUBLIC_AISTUDIO_DIR, relName);
        if (candidate.startsWith(PUBLIC_AISTUDIO_DIR + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          const ext = path.extname(candidate).toLowerCase();
          const mime = STATIC_ASSET_MIME[ext];
          if (mime) {
            res.statusCode = 200;
            res.setHeader("content-type", mime);
            res.setHeader("cache-control", "public, max-age=3600");
            res.setHeader("x-content-type-options", "nosniff");
            if (req.method === "HEAD") {
              res.end();
              return;
            }
            res.end(fs.readFileSync(candidate));
            return;
          }
        }
      }

      const hasBody = req.method !== "GET" && req.method !== "HEAD";
      const init = {
        method: req.method,
        headers: toWebHeaders(req.headers),
        signal: controller.signal,
      };
      if (hasBody) {
        init.body = Readable.toWeb(req);
        init.duplex = "half";
      }

      const webRequest = new Request(url.href, init);
      const webResponse = await workerInstance.fetch(webRequest, env);

      if (res.destroyed || controller.signal.aborted) return;

      res.statusCode = webResponse.status;
      for (const [key, value] of webResponse.headers.entries()) {
        res.setHeader(key, value);
      }

      if (req.method === "HEAD" || !webResponse.body) {
        res.end();
        return;
      }

      const buffer = Buffer.from(await webResponse.arrayBuffer());
      if (!res.destroyed && !res.writableEnded) {
        res.end(buffer);
      }
    } catch {
      if (!res.headersSent && !res.writableEnded && !res.destroyed) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected server error." } }));
      }
    } finally {
      req.off("aborted", onDisconnect);
      res.off("close", onDisconnect);
    }
  };
}

export function startServer({
  port = parsePort(process.env.PORT, DEFAULT_PORT),
  host = (process.env.HOST || DEFAULT_HOST).trim() || DEFAULT_HOST,
  workerInstance = worker,
  env = process.env,
} = {}) {
  const internalPort = port === 0 ? DEFAULT_PORT : port;
  const server = http.createServer(createNodeHandler({
    workerInstance,
    env,
    internalOrigin: `http://127.0.0.1:${internalPort}`,
  }));
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = parsePort(process.env.PORT, DEFAULT_PORT);
  const host = (process.env.HOST || DEFAULT_HOST).trim() || DEFAULT_HOST;
  createLocalRuntimeEnv({ port, host, baseEnv: process.env })
    .then((localEnv) => startServer({ port, host, env: localEnv }))
    .then((server) => {
      const addr = server.address();
      const boundHost = typeof addr === "object" && addr ? addr.address : host;
      const boundPort = typeof addr === "object" && addr ? addr.port : port;
      console.log(`ExportFlow listening on http://${boundHost}:${boundPort}`);

      const shutdown = () => {
        server.close(() => process.exit(0));
      };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    })
    .catch((error) => {
      console.error("Failed to start ExportFlow server:", error.message);
      process.exitCode = 1;
    });
}

