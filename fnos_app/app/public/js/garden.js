import { $, api, createRequestId } from "./shared.js";

let initialized = false;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const copyGarden = (garden) => JSON.parse(JSON.stringify(garden));

export function initGarden() {
  if (initialized) return;

  const canvas = $("#gardenCanvas");
  const rakeButton = $("#gardenRake");
  const stoneButton = $("#gardenStone");
  const undoButton = $("#gardenUndo");
  const clearButton = $("#gardenClear");
  const saveButton = $("#gardenSave");
  const exportButton = $("#gardenExport");
  const status = $("#gardenStatus");
  if (!canvas || !rakeButton || !stoneButton) return;

  initialized = true;
  const context = canvas.getContext("2d");
  const history = [];
  let garden = { strokes: [], stones: [] };
  let mode = "rake";
  let drawing = false;
  let activeStroke = null;

  canvas.style.touchAction = "none";

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function snapshot() {
    history.push(copyGarden(garden));
    if (history.length > 50) history.shift();
  }

  function setMode(nextMode) {
    mode = nextMode;
    rakeButton.classList.toggle("active", mode === "rake");
    stoneButton.classList.toggle("active", mode === "stone");
    rakeButton.setAttribute("aria-pressed", String(mode === "rake"));
    stoneButton.setAttribute("aria-pressed", String(mode === "stone"));
    canvas.style.cursor = mode === "rake" ? "crosshair" : "copy";
    setStatus(mode === "rake" ? "指尖轻划，耙出沙纹" : "轻点沙面，安放山石");
  }

  function pointFromEvent(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / Math.max(1, bounds.width)),
      y: clamp((event.clientY - bounds.top) / Math.max(1, bounds.height)),
    };
  }

  function drawSand() {
    const { width, height } = canvas;
    const sand = context.createLinearGradient(0, 0, width, height);
    sand.addColorStop(0, "#d8bc82");
    sand.addColorStop(0.48, "#b9955e");
    sand.addColorStop(1, "#80653f");
    context.fillStyle = sand;
    context.fillRect(0, 0, width, height);

    context.save();
    context.globalAlpha = 0.11;
    context.strokeStyle = "#fff0c0";
    context.lineWidth = 1;
    for (let y = 13; y < height; y += 16) {
      context.beginPath();
      for (let x = -20; x <= width + 20; x += 12) {
        const waveY = y + Math.sin(x * 0.025 + y * 0.04) * 2.2;
        if (x === -20) context.moveTo(x, waveY);
        else context.lineTo(x, waveY);
      }
      context.stroke();
    }
    context.restore();

    const shade = context.createRadialGradient(
      width * 0.5,
      height * 0.42,
      width * 0.06,
      width * 0.5,
      height * 0.5,
      width * 0.72,
    );
    shade.addColorStop(0, "rgba(255,238,190,0.08)");
    shade.addColorStop(1, "rgba(30,20,12,0.28)");
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
  }

  function tracePoints(points, offsetX, offsetY) {
    if (!points.length) return;
    const { width, height } = canvas;
    context.beginPath();
    context.moveTo(points[0].x * width + offsetX, points[0].y * height + offsetY);
    if (points.length === 1) {
      context.lineTo(points[0].x * width + offsetX + 0.1, points[0].y * height + offsetY + 0.1);
    } else {
      for (let index = 1; index < points.length - 1; index += 1) {
        const current = points[index];
        const next = points[index + 1];
        context.quadraticCurveTo(
          current.x * width + offsetX,
          current.y * height + offsetY,
          ((current.x + next.x) * width) / 2 + offsetX,
          ((current.y + next.y) * height) / 2 + offsetY,
        );
      }
      const last = points[points.length - 1];
      context.lineTo(last.x * width + offsetX, last.y * height + offsetY);
    }
    context.stroke();
  }

  function drawStrokes() {
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of garden.strokes) {
      const width = clamp(Number(stroke.width) || 0.012, 0.005, 0.035) * canvas.width;
      context.lineWidth = Math.max(1, width * 0.14);
      for (let tooth = -2; tooth <= 2; tooth += 1) {
        const offset = tooth * width * 0.42;
        context.strokeStyle = tooth === -2
          ? "rgba(75,53,30,0.35)"
          : "rgba(92,66,38,0.42)";
        tracePoints(stroke.points || [], offset, 0);
        if (tooth === 2) {
          context.strokeStyle = "rgba(247,220,164,0.25)";
          tracePoints(stroke.points || [], offset + 1.5, 1.5);
        }
      }
    }
    context.restore();
  }

  function drawStones() {
    const { width, height } = canvas;
    for (const stone of garden.stones) {
      const x = clamp(Number(stone.x)) * width;
      const y = clamp(Number(stone.y)) * height;
      const size = clamp(Number(stone.size) || 0.065, 0.03, 0.14) * Math.min(width, height);

      context.save();
      context.translate(x, y);
      context.rotate(((x + y) % 19 - 9) * 0.018);
      context.shadowColor = "rgba(22,15,10,0.55)";
      context.shadowBlur = size * 0.42;
      context.shadowOffsetY = size * 0.24;
      const rock = context.createRadialGradient(-size * 0.3, -size * 0.38, 1, 0, 0, size * 1.2);
      rock.addColorStop(0, "#76867c");
      rock.addColorStop(0.5, "#3d514c");
      rock.addColorStop(1, "#182924");
      context.fillStyle = rock;
      context.strokeStyle = "rgba(194,178,127,0.36)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-size * 0.9, size * 0.26);
      context.bezierCurveTo(-size, -size * 0.34, -size * 0.45, -size, size * 0.08, -size * 0.86);
      context.bezierCurveTo(size * 0.7, -size * 0.78, size, -size * 0.16, size * 0.82, size * 0.42);
      context.bezierCurveTo(size * 0.42, size * 0.8, -size * 0.55, size * 0.78, -size * 0.9, size * 0.26);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }
  }

  function render() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawSand();
    drawStrokes();
    drawStones();
  }

  function addPoint(event) {
    if (!drawing || !activeStroke) return;
    const point = pointFromEvent(event);
    const previous = activeStroke.points[activeStroke.points.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.004) {
      activeStroke.points.push(point);
      render();
    }
    event.preventDefault();
  }

  canvas.addEventListener("pointerdown", (event) => {
    const point = pointFromEvent(event);
    snapshot();
    if (mode === "stone") {
      garden.stones.push({ x: point.x, y: point.y, size: 0.052 + Math.random() * 0.035 });
      setStatus("山石已安放");
      render();
      return;
    }

    drawing = true;
    activeStroke = { points: [point], width: 0.012 };
    garden.strokes.push(activeStroke);
    canvas.setPointerCapture(event.pointerId);
    render();
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", addPoint);

  function finishStroke(event) {
    if (!drawing) return;
    addPoint(event);
    drawing = false;
    activeStroke = null;
    setStatus("一痕一念，沙纹已成");
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  canvas.addEventListener("pointerup", finishStroke);
  canvas.addEventListener("pointercancel", finishStroke);

  rakeButton.addEventListener("click", () => setMode("rake"));
  stoneButton.addEventListener("click", () => setMode("stone"));
  undoButton?.addEventListener("click", () => {
    const previous = history.pop();
    if (!previous) {
      setStatus("已经没有可以撤销的动作了");
      return;
    }
    garden = previous;
    render();
    setStatus("已撤销上一步");
  });
  clearButton?.addEventListener("click", () => {
    if (!garden.strokes.length && !garden.stones.length) return;
    snapshot();
    garden = { strokes: [], stones: [] };
    render();
    setStatus("沙庭已清空，可以重新落笔");
  });
  saveButton?.addEventListener("click", async () => {
    saveButton.disabled = true;
    setStatus("正在保存沙庭…");
    try {
      await api("/api/garden", { method: "PUT", body: copyGarden(garden) });
      await api("/api/activity", {
        method: "POST",
        body: { type: "garden", increment: 1, requestId: createRequestId("garden") },
      });
      setStatus("沙庭已保存 · 一方小景留于此刻");
    } catch {
      setStatus("保存失败，请稍后再试");
    } finally {
      saveButton.disabled = false;
    }
  });
  exportButton?.addEventListener("click", () => {
    render();
    const link = document.createElement("a");
    link.download = `zen-garden-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setStatus("沙庭已导出为 PNG");
  });

  async function load() {
    try {
      const response = await api("/api/garden");
      const saved = response?.garden || response;
      garden = {
        strokes: Array.isArray(saved?.strokes) ? saved.strokes : [],
        stones: Array.isArray(saved?.stones) ? saved.stones : [],
      };
      setStatus(garden.strokes.length || garden.stones.length ? "已恢复上一次的沙庭" : "指尖轻划，耙出沙纹");
    } catch {
      setStatus("暂未读取到旧沙庭，可自由创作");
    }
    render();
  }

  setMode("rake");
  render();
  void load();
}
