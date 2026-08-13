import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_COUNT = 1_000_000_000;

const PRACTICE_FIELDS = [
  "mala",
  "breathingSessions",
  "breathingMinutes",
  "meditationSessions",
  "meditationMinutes",
  "gardenSaves",
  "bowlStrikes",
];

const STAT_FIELDS = ["woodenfish", "incense", "cicada", ...PRACTICE_FIELDS];
const TIMER_DURATIONS = {
  breathing: new Set([1, 3, 5]),
  meditation: new Set([5, 15, 25, 45]),
};

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

fs.mkdirSync(DATA_DIR, { recursive: true });

class RequestError extends Error {
  constructor(status, message, code = "BAD_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getTodayKey() {
  return getDateKey(new Date());
}

function getCountsPath(kind = "woodenfish") {
  const filenames = {
    woodenfish: "counts.json",
    incense: "incense.json",
    cicada: "cicada.json",
  };
  return path.join(DATA_DIR, filenames[kind] || filenames.woodenfish);
}

function getPracticePath() {
  return path.join(DATA_DIR, "practice.json");
}

function getGardenPath() {
  return path.join(DATA_DIR, "garden.json");
}

function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2));
  try {
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}

function readCounts(kind) {
  const value = readJSON(getCountsPath(kind), {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function writeCounts(data, kind) {
  writeJSON(getCountsPath(kind), data);
}

function emptyPracticeDay() {
  return Object.fromEntries(PRACTICE_FIELDS.map((field) => [field, 0]));
}

function normalizeStoredNumber(value, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(0, Math.floor(value))) : 0;
}

function normalizePracticeDay(value) {
  const day = emptyPracticeDay();
  if (!value || typeof value !== "object" || Array.isArray(value)) return day;
  for (const field of PRACTICE_FIELDS) {
    day[field] = normalizeStoredNumber(value[field], field === "mala" ? MAX_COUNT : Number.MAX_SAFE_INTEGER);
  }
  return day;
}

function readPractice() {
  const stored = readJSON(getPracticePath(), {});
  const days = {};
  if (stored?.days && typeof stored.days === "object" && !Array.isArray(stored.days)) {
    for (const [date, value] of Object.entries(stored.days)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) days[date] = normalizePracticeDay(value);
    }
  }

  const timer = normalizeTimer(stored?.timer);
  const completedTimerIds = Array.isArray(stored?.completedTimerIds)
    ? [...new Set(stored.completedTimerIds.filter((id) => typeof id === "string" && id.length <= 100))].slice(-1000)
    : [];
  const activityIds = Array.isArray(stored?.activityIds)
    ? stored.activityIds
        .filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            item.id.length <= 100 &&
            (item.type === "bowl" || item.type === "garden") &&
            /^\d{4}-\d{2}-\d{2}$/.test(item.date),
        )
        .slice(-2000)
    : [];

  return { days, timer, completedTimerIds, activityIds };
}

function writePractice(practice) {
  writeJSON(getPracticePath(), practice);
}

function getPracticeDay(practice, date = getTodayKey()) {
  practice.days[date] = normalizePracticeDay(practice.days[date]);
  return practice.days[date];
}

function normalizeTimer(timer) {
  if (!timer || typeof timer !== "object" || Array.isArray(timer)) return null;
  const { id, type, startedAt, endsAt } = timer;
  const minutes = timer.minutes ?? timer.durationMinutes;
  const startedAtMs = Date.parse(startedAt);
  const endsAtMs = Date.parse(endsAt);
  if (
    typeof id !== "string" ||
    !id ||
    id.length > 100 ||
    !TIMER_DURATIONS[type]?.has(minutes) ||
    !Number.isFinite(startedAtMs) ||
    !Number.isFinite(endsAtMs) ||
    endsAtMs <= startedAtMs ||
    Math.abs(endsAtMs - startedAtMs - minutes * 60_000) > 1000
  ) {
    return null;
  }
  return { id, type, minutes, durationMinutes: minutes, startedAt, endsAt };
}

function completeTimer(practice, timer) {
  if (practice.completedTimerIds.includes(timer.id)) {
    if (practice.timer?.id === timer.id) practice.timer = null;
    return false;
  }

  const completionDate = getDateKey(new Date(timer.endsAt));
  const day = getPracticeDay(practice, completionDate);
  if (timer.type === "breathing") {
    day.breathingSessions += 1;
    day.breathingMinutes += timer.minutes;
  } else {
    day.meditationSessions += 1;
    day.meditationMinutes += timer.minutes;
  }
  practice.completedTimerIds.push(timer.id);
  practice.completedTimerIds = practice.completedTimerIds.slice(-1000);
  if (practice.timer?.id === timer.id) practice.timer = null;
  return true;
}

function settleExpiredTimer(practice, now = Date.now()) {
  const timer = practice.timer;
  if (!timer || Date.parse(timer.endsAt) > now) return null;
  const completed = completeTimer(practice, timer);
  writePractice(practice);
  return { id: timer.id, completed };
}

function emptyGarden() {
  return { strokes: [], stones: [], updatedAt: null };
}

function normalizeGardenForRead(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyGarden();
  try {
    return validateGarden(value);
  } catch {
    return emptyGarden();
  }
}

function validateCoordinate(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RequestError(400, `${label} 必须是 0 到 1 之间的数字`, "INVALID_GARDEN");
  }
  return value;
}

function validateGarden(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestError(400, "沙庭数据格式无效", "INVALID_GARDEN");
  }
  const strokes = value.strokes ?? [];
  const stones = value.stones ?? [];
  if (!Array.isArray(strokes) || strokes.length > 200) {
    throw new RequestError(400, "沙纹最多保存 200 条", "INVALID_GARDEN");
  }
  if (!Array.isArray(stones) || stones.length > 50) {
    throw new RequestError(400, "石头最多摆放 50 块", "INVALID_GARDEN");
  }

  const cleanStrokes = strokes.map((stroke, strokeIndex) => {
    if (!stroke || typeof stroke !== "object" || Array.isArray(stroke) || !Array.isArray(stroke.points)) {
      throw new RequestError(400, `第 ${strokeIndex + 1} 条沙纹格式无效`, "INVALID_GARDEN");
    }
    if (stroke.points.length > 1000) {
      throw new RequestError(400, "每条沙纹最多包含 1000 个点", "INVALID_GARDEN");
    }
    const points = stroke.points.map((point, pointIndex) => {
      if (!point || typeof point !== "object" || Array.isArray(point)) {
        throw new RequestError(400, `沙纹点 ${pointIndex + 1} 格式无效`, "INVALID_GARDEN");
      }
      return {
        x: validateCoordinate(point.x, "沙纹横坐标"),
        y: validateCoordinate(point.y, "沙纹纵坐标"),
      };
    });
    const clean = { points };
    if (stroke.width !== undefined) {
      if (typeof stroke.width !== "number" || !Number.isFinite(stroke.width) || stroke.width <= 0 || stroke.width > 1) {
        throw new RequestError(400, "沙纹宽度必须是 0 到 1 之间的数字", "INVALID_GARDEN");
      }
      clean.width = stroke.width;
    }
    return clean;
  });

  const cleanStones = stones.map((stone, stoneIndex) => {
    if (!stone || typeof stone !== "object" || Array.isArray(stone)) {
      throw new RequestError(400, `第 ${stoneIndex + 1} 块石头格式无效`, "INVALID_GARDEN");
    }
    const clean = {
      x: validateCoordinate(stone.x, "石头横坐标"),
      y: validateCoordinate(stone.y, "石头纵坐标"),
    };
    if (stone.size !== undefined) clean.size = validateCoordinate(stone.size, "石头大小");
    return clean;
  });

  return {
    strokes: cleanStrokes,
    stones: cleanStones,
    updatedAt: typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null,
  };
}

function parseBody(req, { maxBytes = MAX_BODY_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(req.headers["content-length"]);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      req.resume();
      reject(new RequestError(413, "请求体不能超过 1 MB", "PAYLOAD_TOO_LARGE"));
      return;
    }

    let size = 0;
    let settled = false;
    const chunks = [];
    req.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        reject(new RequestError(413, "请求体不能超过 1 MB", "PAYLOAD_TOO_LARGE"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      const body = Buffer.concat(chunks).toString("utf8").trim();
      if (!body) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          reject(new RequestError(400, "请求体必须是 JSON 对象", "INVALID_JSON_BODY"));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new RequestError(400, "请求体必须是有效的 JSON", "INVALID_JSON"));
      }
    });
    req.on("error", () => {
      if (!settled) reject(new RequestError(400, "读取请求体失败", "INVALID_REQUEST"));
    });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendError(res, error) {
  const status = error instanceof RequestError ? error.status : 500;
  const code = error instanceof RequestError ? error.code : "INTERNAL_ERROR";
  const message = error instanceof RequestError ? error.message : "服务器内部错误";
  if (!(error instanceof RequestError)) console.error(error);
  sendJSON(res, status, { error: message, code });
}

function requireInteger(value, name, { min = 0, max = MAX_COUNT } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RequestError(400, `${name} 必须是 ${min} 到 ${max} 之间的整数`, "INVALID_VALUE");
  }
  return value;
}

function requireAllowedFields(body, allowed) {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(body).find((field) => !allowedSet.has(field));
  if (unexpected) {
    throw new RequestError(400, `不支持字段 ${unexpected}`, "UNSUPPORTED_FIELD");
  }
}

function getStatDay(date, counts, incense, cicada, practice) {
  const day = normalizePracticeDay(practice.days[date]);
  return {
    date,
    woodenfish: normalizeStoredNumber(counts[date]),
    incense: normalizeStoredNumber(incense[date]),
    cicada: normalizeStoredNumber(cicada[date]),
    ...day,
  };
}

function addStatFields(target, source) {
  for (const field of STAT_FIELDS) target[field] += source[field] || 0;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // --- Existing API routes ---
  if (pathname === "/api/count" && req.method === "GET") {
    const counts = readCounts();
    const today = getTodayKey();
    return sendJSON(res, 200, { date: today, count: normalizeStoredNumber(counts[today], MAX_COUNT) });
  }

  if (pathname === "/api/knock" && req.method === "POST") {
    const body = await parseBody(req);
    requireAllowedFields(body, ["increment"]);
    const increment = body.increment === undefined ? 1 : requireInteger(body.increment, "increment", { min: 1, max: 1000 });
    const counts = readCounts();
    const today = getTodayKey();
    counts[today] = Math.min(MAX_COUNT, normalizeStoredNumber(counts[today], MAX_COUNT) + increment);
    writeCounts(counts);
    return sendJSON(res, 200, { date: today, count: counts[today] });
  }

  if (pathname === "/api/incense" && req.method === "GET") {
    const counts = readCounts("incense");
    const today = getTodayKey();
    return sendJSON(res, 200, { date: today, count: normalizeStoredNumber(counts[today], MAX_COUNT) });
  }

  if (pathname === "/api/incense" && req.method === "POST") {
    const body = await parseBody(req);
    requireAllowedFields(body, ["increment"]);
    const increment = body.increment === undefined ? 1 : requireInteger(body.increment, "increment", { min: 1, max: 1000 });
    const counts = readCounts("incense");
    const today = getTodayKey();
    counts[today] = Math.min(MAX_COUNT, normalizeStoredNumber(counts[today], MAX_COUNT) + increment);
    writeCounts(counts, "incense");
    return sendJSON(res, 200, { date: today, count: counts[today] });
  }

  if (pathname === "/api/cicada" && req.method === "GET") {
    const counts = readCounts("cicada");
    const today = getTodayKey();
    return sendJSON(res, 200, { date: today, count: normalizeStoredNumber(counts[today], MAX_COUNT) });
  }

  if (pathname === "/api/cicada" && req.method === "POST") {
    const body = await parseBody(req);
    requireAllowedFields(body, ["count", "increment"]);
    if (body.count !== undefined && body.increment !== undefined) {
      throw new RequestError(400, "count 和 increment 不能同时提供", "AMBIGUOUS_VALUE");
    }
    const counts = readCounts("cicada");
    const today = getTodayKey();
    if (body.count !== undefined) {
      const count = requireInteger(body.count, "count");
      counts[today] = Math.max(normalizeStoredNumber(counts[today], MAX_COUNT), count);
    } else {
      const increment = body.increment === undefined ? 1 : requireInteger(body.increment, "increment", { min: 1, max: 1000 });
      counts[today] = Math.min(MAX_COUNT, normalizeStoredNumber(counts[today], MAX_COUNT) + increment);
    }
    writeCounts(counts, "cicada");
    return sendJSON(res, 200, { date: today, count: counts[today] });
  }

  // --- Practice API routes ---
  if (pathname === "/api/mala" && req.method === "GET") {
    const practice = readPractice();
    settleExpiredTimer(practice);
    const date = getTodayKey();
    return sendJSON(res, 200, { date, count: normalizePracticeDay(practice.days[date]).mala });
  }

  if (pathname === "/api/mala" && req.method === "POST") {
    const body = await parseBody(req);
    requireAllowedFields(body, ["count"]);
    const count = requireInteger(body.count, "count");
    const practice = readPractice();
    settleExpiredTimer(practice);
    const date = getTodayKey();
    const day = getPracticeDay(practice, date);
    day.mala = Math.max(day.mala, count);
    writePractice(practice);
    return sendJSON(res, 200, { date, count: day.mala });
  }

  if (pathname === "/api/timer" && req.method === "GET") {
    const practice = readPractice();
    const settled = settleExpiredTimer(practice);
    return sendJSON(res, 200, {
      timer: practice.timer,
      ...(settled ? { completed: settled.completed, completedTimerId: settled.id } : {}),
    });
  }

  if (pathname === "/api/timer" && req.method === "POST") {
    const body = await parseBody(req);
    requireAllowedFields(body, ["type", "minutes", "durationMinutes"]);
    if (body.minutes !== undefined && body.durationMinutes !== undefined && body.minutes !== body.durationMinutes) {
      throw new RequestError(400, "minutes 与 durationMinutes 必须一致", "AMBIGUOUS_TIMER_DURATION");
    }
    const type = body.type;
    const minutes = body.minutes ?? body.durationMinutes;
    if (!TIMER_DURATIONS[type]) {
      throw new RequestError(400, "type 只允许 breathing 或 meditation", "INVALID_TIMER_TYPE");
    }
    if (!TIMER_DURATIONS[type].has(minutes)) {
      const options = [...TIMER_DURATIONS[type]].join("/");
      throw new RequestError(400, `${type} 仅支持 ${options} 分钟`, "INVALID_TIMER_DURATION");
    }

    const practice = readPractice();
    settleExpiredTimer(practice);
    const now = Date.now();
    practice.timer = {
      id: crypto.randomUUID(),
      type,
      minutes,
      durationMinutes: minutes,
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + minutes * 60_000).toISOString(),
    };
    writePractice(practice);
    return sendJSON(res, 200, { timer: practice.timer });
  }

  if (pathname === "/api/timer" && req.method === "DELETE") {
    const practice = readPractice();
    const settled = settleExpiredTimer(practice);
    const cancelled = Boolean(practice.timer);
    if (cancelled) {
      practice.timer = null;
      writePractice(practice);
    }
    return sendJSON(res, 200, {
      timer: null,
      cancelled,
      ...(settled ? { completed: settled.completed, completedTimerId: settled.id } : {}),
    });
  }

  if (pathname === "/api/timer/complete" && req.method === "POST") {
    const body = await parseBody(req);
    requireAllowedFields(body, ["id"]);
    if (typeof body.id !== "string" || !body.id || body.id.length > 100) {
      throw new RequestError(400, "必须提供有效的计时 ID", "INVALID_TIMER_ID");
    }
    const practice = readPractice();
    if (practice.completedTimerIds.includes(body.id)) {
      return sendJSON(res, 200, { timer: practice.timer, completed: true, alreadyCompleted: true, id: body.id });
    }
    if (!practice.timer || practice.timer.id !== body.id) {
      throw new RequestError(404, "未找到匹配的进行中计时", "TIMER_NOT_FOUND");
    }
    if (Date.parse(practice.timer.endsAt) > Date.now()) {
      throw new RequestError(409, "计时尚未结束", "TIMER_NOT_FINISHED");
    }
    const timer = practice.timer;
    completeTimer(practice, timer);
    writePractice(practice);
    return sendJSON(res, 200, { timer: null, completed: true, alreadyCompleted: false, id: timer.id });
  }

  if (pathname === "/api/garden" && req.method === "GET") {
    const garden = normalizeGardenForRead(readJSON(getGardenPath(), null));
    return sendJSON(res, 200, { garden });
  }

  if (pathname === "/api/garden" && req.method === "PUT") {
    const body = await parseBody(req);
    requireAllowedFields(body, body.garden === undefined ? ["strokes", "stones", "updatedAt"] : ["garden"]);
    const garden = validateGarden(body.garden ?? body);
    garden.updatedAt = new Date().toISOString();
    writeJSON(getGardenPath(), garden);
    return sendJSON(res, 200, { garden });
  }

  if (pathname === "/api/activity" && req.method === "POST") {
    const body = await parseBody(req);
    requireAllowedFields(body, ["type", "increment", "requestId", "idempotencyKey"]);
    if (body.requestId && body.idempotencyKey && body.requestId !== body.idempotencyKey) {
      throw new RequestError(400, "requestId 与 idempotencyKey 必须一致", "AMBIGUOUS_REQUEST_ID");
    }
    if (body.type !== "bowl" && body.type !== "garden") {
      throw new RequestError(400, "type 只允许 bowl 或 garden", "INVALID_ACTIVITY_TYPE");
    }
    const increment = requireInteger(body.increment ?? 1, "increment", { min: 1, max: 1000 });
    const requestId = body.requestId ?? body.idempotencyKey ?? null;
    if (requestId !== null && (typeof requestId !== "string" || !requestId || requestId.length > 100)) {
      throw new RequestError(400, "requestId 必须是长度不超过 100 的非空字符串", "INVALID_REQUEST_ID");
    }
    const practice = readPractice();
    settleExpiredTimer(practice);
    if (requestId) {
      const previous = practice.activityIds.find((item) => item.id === requestId);
      if (previous) {
        if (previous.type !== body.type) {
          throw new RequestError(409, "requestId 已用于其他活动", "REQUEST_ID_CONFLICT");
        }
        const previousDay = getPracticeDay(practice, previous.date);
        const previousField = body.type === "bowl" ? "bowlStrikes" : "gardenSaves";
        return sendJSON(res, 200, {
          date: previous.date,
          type: body.type,
          count: previousDay[previousField],
          duplicate: true,
        });
      }
    }
    const date = getTodayKey();
    const day = getPracticeDay(practice, date);
    const field = body.type === "bowl" ? "bowlStrikes" : "gardenSaves";
    day[field] = Math.min(MAX_COUNT, day[field] + increment);
    if (requestId) {
      practice.activityIds.push({ id: requestId, type: body.type, date });
      practice.activityIds = practice.activityIds.slice(-2000);
    }
    writePractice(practice);
    return sendJSON(res, 200, { date, type: body.type, count: day[field], duplicate: false });
  }

  if (pathname === "/api/stats" && req.method === "GET") {
    const counts = readCounts("woodenfish");
    const incense = readCounts("incense");
    const cicada = readCounts("cicada");
    const practice = readPractice();
    settleExpiredTimer(practice);
    const todayDate = new Date();
    const todayKey = getDateKey(todayDate);
    const today = getStatDay(todayKey, counts, incense, cicada, practice);
    const last7 = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(todayDate);
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      last7.push(getStatDay(getDateKey(date), counts, incense, cicada, practice));
    }

    const totals = Object.fromEntries(STAT_FIELDS.map((field) => [field, 0]));
    const allDates = new Set([
      ...Object.keys(counts),
      ...Object.keys(incense),
      ...Object.keys(cicada),
      ...Object.keys(practice.days),
    ]);
    let activeDays = 0;
    for (const date of allDates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const stats = getStatDay(date, counts, incense, cicada, practice);
      addStatFields(totals, stats);
      if (STAT_FIELDS.some((field) => stats[field] > 0)) activeDays += 1;
    }
    return sendJSON(res, 200, { today, last7, totals, activeDays });
  }

  if (pathname === "/api/health" && req.method === "GET") {
    return sendJSON(res, 200, { status: "ok" });
  }

  const newApiPaths = new Set(["/api/mala", "/api/timer", "/api/timer/complete", "/api/garden", "/api/activity", "/api/stats"]);
  if (newApiPaths.has(pathname)) {
    throw new RequestError(405, "请求方法不受支持", "METHOD_NOT_ALLOWED");
  }

  // --- Static file serving ---
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);

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
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    if (!res.headersSent) sendError(res, error);
    else res.end();
  });
});

export function startServer({ port = PORT, host = HOST } = {}) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      console.log(`禅应用已启动: http://${host}:${actualPort}`);
      resolve({ server, port: actualPort, host });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
