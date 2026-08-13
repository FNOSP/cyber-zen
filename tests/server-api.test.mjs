import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test("practice APIs persist and aggregate data", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-zen-api-"));
  process.env.DATA_DIR = dataDir;
  const serverUrl = `${pathToFileURL(path.resolve("server.js")).href}?test=${Date.now()}`;
  const { startServer } = await import(serverUrl);
  const started = await startServer({ port: 0, host: "127.0.0.1" });
  const baseUrl = `http://127.0.0.1:${started.port}`;

  async function request(url, options) {
    const response = await fetch(baseUrl + url, options);
    return { status: response.status, body: await response.json() };
  }

  const post = (url, body, method = "POST") =>
    request(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  try {
    assert.equal((await post("/api/knock", { increment: 2 })).body.count, 2);
    assert.equal((await post("/api/knock", { increment: 1.5 })).status, 400);
    assert.equal((await post("/api/cicada", { count: 1, increment: 1 })).status, 400);

    assert.equal((await request("/api/mala")).body.count, 0);
    assert.equal((await post("/api/mala", { count: 27 })).body.count, 27);
    assert.equal((await post("/api/mala", { count: 20 })).body.count, 27);
    assert.equal((await post("/api/mala", { count: -1 })).status, 400);
    assert.equal((await post("/api/mala", { count: 28, extra: true })).status, 400);

    const timer = (await post("/api/timer", { type: "breathing", durationMinutes: 1 })).body.timer;
    const practicePath = path.join(dataDir, "practice.json");
    const practice = JSON.parse(fs.readFileSync(practicePath, "utf8"));
    const breathingEnd = Date.now() - 1000;
    practice.timer.startedAt = new Date(breathingEnd - 60_000).toISOString();
    practice.timer.endsAt = new Date(breathingEnd).toISOString();
    fs.writeFileSync(practicePath, JSON.stringify(practice));

    const settled = await request("/api/timer");
    assert.equal(settled.body.timer, null);
    assert.equal(settled.body.completed, true);
    const duplicate = await post("/api/timer/complete", { id: timer.id });
    assert.equal(duplicate.body.alreadyCompleted, true);

    assert.equal((await post("/api/timer", { type: "breathing", durationMinutes: 15 })).status, 400);

    const meditationTimer = (await post("/api/timer", { type: "meditation", minutes: 5 })).body.timer;
    const previousDate = new Date();
    previousDate.setDate(previousDate.getDate() - 1);
    previousDate.setHours(0, 2, 0, 0);
    const meditationEnd = previousDate.getTime();
    const crossDayPractice = JSON.parse(fs.readFileSync(practicePath, "utf8"));
    crossDayPractice.timer.startedAt = new Date(meditationEnd - 5 * 60_000).toISOString();
    crossDayPractice.timer.endsAt = new Date(meditationEnd).toISOString();
    fs.writeFileSync(practicePath, JSON.stringify(crossDayPractice));

    const previousKey = dateKey(previousDate);
    fs.writeFileSync(path.join(dataDir, "counts.json"), JSON.stringify({ [previousKey]: 11, [dateKey(new Date())]: 2 }));
    fs.writeFileSync(path.join(dataDir, "incense.json"), JSON.stringify({ [previousKey]: 2 }));
    fs.writeFileSync(path.join(dataDir, "cicada.json"), JSON.stringify({ [previousKey]: 7 }));

    const garden = {
      strokes: [{ points: [{ x: 0.1, y: 0.2 }, { x: 1, y: 0 }], width: 0.02 }],
      stones: [{ x: 0.5, y: 0.6, size: 0.1 }],
    };
    assert.equal((await post("/api/garden", garden, "PUT")).status, 200);
    assert.equal((await request("/api/garden")).body.garden.strokes.length, 1);
    assert.equal((await post("/api/garden", { strokes: [], stones: [{ x: 2, y: 0 }] }, "PUT")).status, 400);

    const activity = { type: "bowl", increment: 3, requestId: "bowl-event-1" };
    assert.equal((await post("/api/activity", activity)).body.count, 3);
    const repeatedActivity = await post("/api/activity", activity);
    assert.equal(repeatedActivity.body.count, 3);
    assert.equal(repeatedActivity.body.duplicate, true);
    const stats = (await request("/api/stats")).body;
    assert.equal(stats.today.woodenfish, 2);
    assert.equal(stats.today.mala, 27);
    assert.equal(stats.today.breathingSessions, 1);
    assert.equal(stats.today.breathingMinutes, 1);
    assert.equal(stats.today.bowlStrikes, 3);
    assert.equal(stats.last7.length, 7);
    const previousStats = stats.last7.find((day) => day.date === previousKey);
    assert.equal(previousStats.woodenfish, 11);
    assert.equal(previousStats.incense, 2);
    assert.equal(previousStats.cicada, 7);
    assert.equal(previousStats.meditationSessions, 1);
    assert.equal(previousStats.meditationMinutes, 5);
    assert.equal(stats.totals.mala, 27);
    assert.equal(stats.totals.woodenfish, 13);
    assert.equal(stats.totals.meditationSessions, 1);
    assert.equal(stats.activeDays, 2);

    const repeatedMeditation = await post("/api/timer/complete", { id: meditationTimer.id });
    assert.equal(repeatedMeditation.body.alreadyCompleted, true);
    const statsAfterDuplicate = (await request("/api/stats")).body;
    assert.equal(statsAfterDuplicate.totals.meditationSessions, 1);

    const malformed = await request("/api/mala", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad",
    });
    assert.equal(malformed.status, 400);
    assert.equal(typeof malformed.body.error, "string");

    const oversized = await post("/api/mala", { count: 1, padding: "x".repeat(1024 * 1024) });
    assert.equal(oversized.status, 413);

    for (const filename of ["counts.json", "practice.json", "garden.json"]) {
      assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(dataDir, filename), "utf8")));
    }
    assert.deepEqual(fs.readdirSync(dataDir).filter((filename) => filename.endsWith(".tmp")), []);
  } finally {
    await new Promise((resolve) => started.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
