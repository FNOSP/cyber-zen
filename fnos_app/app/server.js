import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");

fs.mkdirSync(DATA_DIR, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCountsPath() {
  return path.join(DATA_DIR, "counts.json");
}

function readCounts() {
  try {
    return JSON.parse(fs.readFileSync(getCountsPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeCounts(data) {
  fs.writeFileSync(getCountsPath(), JSON.stringify(data, null, 2));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // --- API Routes ---
  if (pathname === "/api/count" && req.method === "GET") {
    const counts = readCounts();
    const today = getTodayKey();
    return sendJSON(res, 200, { date: today, count: counts[today] || 0 });
  }

  if (pathname === "/api/knock" && req.method === "POST") {
    const body = await parseBody(req);
    const increment = typeof body.increment === "number" ? Math.max(1, Math.floor(body.increment)) : 1;
    const counts = readCounts();
    const today = getTodayKey();
    counts[today] = (counts[today] || 0) + increment;
    writeCounts(counts);
    return sendJSON(res, 200, { date: today, count: counts[today] });
  }

  if (pathname === "/api/health" && req.method === "GET") {
    return sendJSON(res, 200, { status: "ok" });
  }

  // --- Static file serving ---
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  try {
    const content = await fs.promises.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`🪵 木鱼应用已启动: http://localhost:${PORT}`);
});