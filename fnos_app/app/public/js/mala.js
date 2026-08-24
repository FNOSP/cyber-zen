import { $, api, playChime, pop } from './shared.js';

const BEAD_COUNT = 27;
const MANTRA_ROUND = 108;
const TAU = Math.PI * 2;
const BEAD_STEP = TAU / BEAD_COUNT;
const TOUCH_INNER_RADIUS = 0.42;
// Pointer capture lets the finger travel beyond the visible bead ring. Keep
// the band wide enough for a relaxed outer loop while still excluding the
// distant page background.
const TOUCH_OUTER_RADIUS = 4;

let initialized = false;

export function initMala() {
  if (initialized) return;

  const canvas = $('#malaCanvas');
  const countElement = $('#malaCount');
  const roundElement = $('#malaRound');
  const statusElement = $('#malaStatus');
  if (!canvas || !countElement || !roundElement || !statusElement) return;

  const context = canvas.getContext('2d');
  if (!context) return;
  initialized = true;

  const width = canvas.width || 560;
  const height = canvas.height || 500;
  const centerX = width / 2;
  const centerY = height * 0.45;
  const radiusX = Math.min(width * 0.31, 174);
  const radiusY = Math.min(height * 0.34, 170);
  const beads = Array.from({ length: BEAD_COUNT }, (_, index) => {
    const angle = -Math.PI / 2 + index * TAU / BEAD_COUNT;
    return {
      angle,
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    };
  });

  let count = 0;
  let lastSaved = 0;
  let wantedCount = 0;
  let additionsBeforeLoad = 0;
  let loaded = false;
  let saving = false;
  let retryTimer = 0;
  let pointerDown = false;
  let pointerId = null;
  let lastPointerAngle = null;
  let pointerArc = 0;
  let haloUntil = 0;
  let haloFrame = 0;

  function progressInRound() {
    const remainder = count % BEAD_COUNT;
    return count > 0 && remainder === 0 ? BEAD_COUNT : remainder;
  }

  function updateText(message = '') {
    countElement.textContent = String(count);
    const completedRounds = Math.floor(count / BEAD_COUNT);
    const remainder = count % BEAD_COUNT;
    roundElement.textContent = remainder === 0 && count > 0
      ? `已完成 ${completedRounds} 圈 · ${count} 念`
      : `第 ${completedRounds + 1} 圈 · ${remainder}/27`;

    if (message) {
      statusElement.textContent = message;
    } else if (count > 0 && count % MANTRA_ROUND === 0) {
      statusElement.textContent = `一百零八念 · 已圆满 ${count / MANTRA_ROUND} 次`;
    } else {
      statusElement.textContent = '点击念珠，或按住沿宽松环带逐颗拨动';
    }
  }

  function drawCord() {
    context.save();
    context.strokeStyle = 'rgba(211, 174, 100, .55)';
    context.lineWidth = 4;
    context.beginPath();
    context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, TAU);
    context.stroke();
    context.restore();
  }

  function drawTassel() {
    const bottomY = centerY + radiusY;
    context.save();
    context.strokeStyle = '#d9a84f';
    context.lineCap = 'round';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(centerX, bottomY - 2);
    context.quadraticCurveTo(centerX - 10, bottomY + 22, centerX, bottomY + 37);
    context.stroke();
    context.fillStyle = '#b96f39';
    context.beginPath();
    context.roundRect(centerX - 13, bottomY + 32, 26, 18, 7);
    context.fill();
    context.strokeStyle = 'rgba(221, 149, 72, .9)';
    context.lineWidth = 3;
    for (let offset = -10; offset <= 10; offset += 5) {
      context.beginPath();
      context.moveTo(centerX + offset, bottomY + 48);
      context.lineTo(centerX + offset * 1.25, Math.min(height - 7, bottomY + 76));
      context.stroke();
    }
    context.restore();
  }

  function draw(timestamp = performance.now()) {
    context.clearRect(0, 0, width, height);
    const haloActive = timestamp < haloUntil;
    if (haloActive) {
      const pulse = 0.55 + Math.sin(timestamp / 90) * 0.18;
      const halo = context.createRadialGradient(centerX, centerY, radiusX * 0.3, centerX, centerY, radiusX * 1.35);
      halo.addColorStop(0, `rgba(245, 207, 111, ${pulse * 0.18})`);
      halo.addColorStop(0.72, `rgba(85, 218, 198, ${pulse * 0.18})`);
      halo.addColorStop(1, 'rgba(85, 218, 198, 0)');
      context.fillStyle = halo;
      context.fillRect(0, 0, width, height);
    }

    drawCord();
    const lit = progressInRound();
    beads.forEach((bead, index) => {
      const active = index < lit;
      context.save();
      if (active) {
        context.shadowColor = 'rgba(101, 229, 207, .9)';
        context.shadowBlur = 15;
      }
      const gradient = context.createRadialGradient(bead.x - 5, bead.y - 6, 2, bead.x, bead.y, 15);
      gradient.addColorStop(0, active ? '#f7e3a0' : '#d7a765');
      gradient.addColorStop(0.48, active ? '#56d7c4' : '#a86b34');
      gradient.addColorStop(1, active ? '#1c756f' : '#4b2819');
      context.fillStyle = gradient;
      context.strokeStyle = active ? '#a9f1df' : '#d7a45e';
      context.lineWidth = active ? 2.5 : 1.7;
      context.beginPath();
      context.arc(bead.x, bead.y, 13.5, 0, TAU);
      context.fill();
      context.stroke();
      context.fillStyle = 'rgba(28, 19, 13, .72)';
      context.beginPath();
      context.arc(bead.x, bead.y, 2.5, 0, TAU);
      context.fill();
      context.restore();
    });

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(230, 205, 143, .9)';
    context.font = `500 ${Math.max(26, width * 0.055)}px serif`;
    context.fillText('一念', centerX, centerY - 9);
    context.fillStyle = 'rgba(114, 218, 201, .76)';
    context.font = `400 ${Math.max(15, width * 0.029)}px sans-serif`;
    context.fillText('一珠 · 一呼吸', centerX, centerY + 28);
    context.restore();
    drawTassel();

    if (haloActive) haloFrame = requestAnimationFrame(draw);
  }

  function celebrate() {
    haloUntil = performance.now() + 2100;
    cancelAnimationFrame(haloFrame);
    haloFrame = requestAnimationFrame(draw);
    canvas.classList.remove('complete');
    void canvas.offsetWidth;
    canvas.classList.add('complete');
    setTimeout(() => canvas.classList.remove('complete'), 2200);
    playChime();
  }

  function queueSave() {
    if (!loaded) return;
    wantedCount = Math.max(wantedCount, count);
    void flushCount();
  }

  function beaconCount() {
    const body = JSON.stringify({ count });
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/mala', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/mala', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  async function flushCount() {
    if (saving || lastSaved >= wantedCount) return;
    saving = true;
    clearTimeout(retryTimer);
    try {
      while (lastSaved < wantedCount) {
        const target = wantedCount;
        const response = await api('/api/mala', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: target }),
        });
        const serverCount = Number(response?.count);
        lastSaved = Number.isFinite(serverCount) ? Math.max(target, serverCount) : target;
        if (Number.isFinite(serverCount) && serverCount > count) {
          count = serverCount;
          wantedCount = Math.max(wantedCount, count);
          updateText();
          draw();
        }
      }
    } catch {
      statusElement.textContent = '已在本地记录，等待重新连接后保存';
      retryTimer = window.setTimeout(() => void flushCount(), 3000);
    } finally {
      saving = false;
      if (lastSaved < wantedCount && !retryTimer) void flushCount();
    }
  }

  function advance() {
    const previous = count;
    count += 1;
    if (!loaded) additionsBeforeLoad += 1;
    updateText();
    draw();
    pop(countElement);
    if (Math.floor(previous / MANTRA_ROUND) < Math.floor(count / MANTRA_ROUND)) {
      updateText('一百零八念 · 功德圆满');
      celebrate();
    }
    queueSave();
  }

  function canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * width / bounds.width,
      y: (event.clientY - bounds.top) * height / bounds.height,
    };
  }

  function ringPoint(point) {
    const normalizedX = (point.x - centerX) / radiusX;
    const normalizedY = (point.y - centerY) / radiusY;
    return {
      angle: Math.atan2(normalizedY, normalizedX),
      radius: Math.hypot(normalizedX, normalizedY),
    };
  }

  function isTouchPoint(point) {
    const { radius } = ringPoint(point);
    return radius >= TOUCH_INNER_RADIUS && radius <= TOUCH_OUTER_RADIUS;
  }

  function ringAngle(point) {
    return ringPoint(point).angle;
  }

  function shortestAngleDelta(next, previous) {
    let delta = next - previous;
    while (delta > Math.PI) delta -= TAU;
    while (delta < -Math.PI) delta += TAU;
    return delta;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    pointerDown = true;
    pointerId = event.pointerId;
    const point = canvasPoint(event);
    lastPointerAngle = isTouchPoint(point) ? ringAngle(point) : null;
    pointerArc = 0;
    canvas.setPointerCapture?.(event.pointerId);
    advance();
    event.preventDefault();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!pointerDown || event.pointerId !== pointerId) return;
    const point = canvasPoint(event);
    if (!isTouchPoint(point)) {
      // Crossing the central text or leaving the generous outer ring should
      // not create a large angular jump when the pointer re-enters.
      lastPointerAngle = null;
      pointerArc = 0;
      event.preventDefault();
      return;
    }
    const angle = ringAngle(point);
    if (lastPointerAngle === null) {
      lastPointerAngle = angle;
      event.preventDefault();
      return;
    }
    const delta = shortestAngleDelta(angle, lastPointerAngle);
    lastPointerAngle = angle;
    // Pointer events can skip several beads on a fast outer loop; accumulate
    // angular travel and consume every crossed bead instead of requiring one
    // event per bead.
    if (Math.abs(delta) <= Math.PI * 0.75) {
      pointerArc += delta;
      while (Math.abs(pointerArc) >= BEAD_STEP) {
        advance();
        pointerArc -= Math.sign(pointerArc) * BEAD_STEP;
      }
    } else {
      pointerArc = 0;
    }
    event.preventDefault();
  });

  function releasePointer(event) {
    if (event.pointerId !== pointerId) return;
    pointerDown = false;
    pointerId = null;
    lastPointerAngle = null;
    pointerArc = 0;
  }

  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.style.touchAction = 'none';

  async function load() {
    try {
      const response = await api('/api/mala');
      const stored = Math.max(0, Math.trunc(Number(response?.count) || 0));
      count = stored + additionsBeforeLoad;
      lastSaved = stored;
      wantedCount = count;
    } catch {
      statusElement.textContent = '暂时无法连接，拨动仍会在恢复后保存';
      lastSaved = 0;
      wantedCount = count;
    } finally {
      loaded = true;
      updateText(statusElement.textContent.includes('无法连接') ? statusElement.textContent : '');
      draw();
      queueSave();
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') beaconCount();
  });
  window.addEventListener('pagehide', beaconCount);
  window.addEventListener('beforeunload', beaconCount);

  updateText();
  draw();
  void load();
}
