/**
 * server.js
 * Minimal static file server for LOCAL DEVELOPMENT ONLY.
 *
 * This is NOT the "backend" of Lyppe Store — there is no app logic,
 * no database, and no state here. It only serves the static
 * HTML/CSS/JS/asset files from this folder over HTTP so the browser
 * can load them via http://localhost instead of file://, which
 * Supabase JS and fetch() calls require.
 *
 * On a real VPS, replace this with Nginx or Apache (see README.md
 * §4). Do not run this file with a process manager like PM2 in
 * production — it exists purely to unblock local testing.
 *
 * Usage:
 *   node server.js
 *   node server.js 8080          # custom port
 *   PORT=8080 node server.js     # custom port via env var
 *
 * No dependencies required (uses only Node's built-in modules).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".sql": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function safeJoin(root, requestPath) {
  // Strip query string / hash, decode, then resolve against root
  // while preventing path traversal outside the project folder.
  const decoded = decodeURIComponent(requestPath);
  const resolved = path.normalize(path.join(root, decoded));
  if (!resolved.startsWith(root)) {
    return null;
  }
  return resolved;
}

function send404(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404 Not Found");
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send404(res);
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = url.pathname;

  // Directory requests (e.g. "/" or "/manage-x7k/") resolve to index.html
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  const filePath = safeJoin(ROOT, pathname);
  if (!filePath) {
    send404(res);
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      send404(res);
      return;
    }

    if (stats.isDirectory()) {
      // e.g. "/manage-x7k" without trailing slash
      serveFile(res, path.join(filePath, "index.html"));
      return;
    }

    serveFile(res, filePath);
  });
});

server.listen(PORT, () => {
  console.log(`Lyppe Store berjalan di http://localhost:${PORT}`);
  console.log(`Admin:       http://localhost:${PORT}/manage-x7k/`);
  console.log("Tekan Ctrl+C untuk berhenti.");
});
