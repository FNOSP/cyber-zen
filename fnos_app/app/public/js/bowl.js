import { $, api, createRequestId, getAudioContext } from "./shared.js";

let initialized = false;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function getMetric(source, ...keys) {
  for (const key of keys) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

export function initBowl() {
  if (initialized) return;

  const canvas = $("#bowlCanvas");
  const countElement = $("#bowlCount");
  const statusElement = $("#bowlStatus");
  if (!canvas) return;

  initialized = true;
  const context = canvas.getContext("2d");
  let todayCount = 0;
  let glow = 0;
  let animationFrame = 0;
  let pressed = false;
  let pointerId = null;
  let lastAngle = 0;
  let lastMoveAt = 0;
  let angularSpeed = 0;
  let rimAudio = null;
  let retryTimer = 0;
  let retryingActivities = false;
  const strikeVoices = new Set();
  const pendingActivities = new Map();

  canvas.style.touchAction = "none";
  canvas.tabIndex ||= 0;

  function setStatus(message) {
    if (statusElement) statusElement.textContent = message;
  }

  function setCount(count) {
    todayCount = Math.max(0, Math.floor(Number(count) || 0));
    if (countElement) countElement.textContent = String(todayCount);
  }

  function draw() {
    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height * 0.52;

    if (glow > 0.01) {
      const aura = context.createRadialGradient(centerX, centerY, width * 0.05, centerX, centerY, width * 0.43);
      aura.addColorStop(0, `rgba(255,220,126,${0.2 * glow})`);
      aura.addColorStop(0.45, `rgba(75,214,196,${0.12 * glow})`);
      aura.addColorStop(1, "rgba(75,214,196,0)");
      context.fillStyle = aura;
      context.fillRect(0, 0, width, height);

      context.save();
      context.strokeStyle = `rgba(112,226,210,${0.35 * glow})`;
      context.lineWidth = 2 + glow * 4;
      context.shadowColor = "#5be0d0";
      context.shadowBlur = 24 * glow;
      context.beginPath();
      context.ellipse(centerX, centerY - height * 0.09, width * (0.33 + glow * 0.025), height * (0.12 + glow * 0.012), 0, 0, TAU);
      context.stroke();
      context.restore();
    }

    context.save();
    context.shadowColor = "rgba(0,0,0,0.58)";
    context.shadowBlur = 32;
    context.shadowOffsetY = 18;
    context.fillStyle = "rgba(17,22,20,0.7)";
    context.beginPath();
    context.ellipse(centerX, centerY + height * 0.24, width * 0.29, height * 0.055, 0, 0, TAU);
    context.fill();
    context.restore();

    const body = context.createLinearGradient(centerX - width * 0.31, centerY, centerX + width * 0.31, centerY + height * 0.22);
    body.addColorStop(0, "#4a765f");
    body.addColorStop(0.18, "#c49a4f");
    body.addColorStop(0.46, "#6c8d70");
    body.addColorStop(0.72, "#d5aa58");
    body.addColorStop(1, "#304d42");
    context.fillStyle = body;
    context.strokeStyle = "rgba(245,211,128,0.7)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(centerX - width * 0.33, centerY - height * 0.1);
    context.bezierCurveTo(
      centerX - width * 0.29,
      centerY + height * 0.18,
      centerX - width * 0.2,
      centerY + height * 0.25,
      centerX,
      centerY + height * 0.27,
    );
    context.bezierCurveTo(
      centerX + width * 0.2,
      centerY + height * 0.25,
      centerX + width * 0.29,
      centerY + height * 0.18,
      centerX + width * 0.33,
      centerY - height * 0.1,
    );
    context.closePath();
    context.fill();
    context.stroke();

    const inner = context.createRadialGradient(centerX, centerY + height * 0.02, width * 0.03, centerX, centerY - height * 0.08, width * 0.34);
    inner.addColorStop(0, "#101d1a");
    inner.addColorStop(0.62, "#274139");
    inner.addColorStop(0.85, "#98773d");
    inner.addColorStop(1, "#edca76");
    context.fillStyle = inner;
    context.strokeStyle = "#e4bf69";
    context.lineWidth = 7;
    context.beginPath();
    context.ellipse(centerX, centerY - height * 0.1, width * 0.33, height * 0.12, 0, 0, TAU);
    context.fill();
    context.stroke();

    context.save();
    context.globalAlpha = 0.38;
    context.strokeStyle = "#d9bd70";
    context.lineWidth = 2;
    for (let index = 0; index < 3; index += 1) {
      context.beginPath();
      context.ellipse(centerX, centerY + height * (0.07 + index * 0.045), width * (0.235 - index * 0.02), height * 0.055, 0, 0.12, Math.PI - 0.12);
      context.stroke();
    }
    context.restore();
  }

  function requestDraw() {
    if (animationFrame) return;
    const animate = () => {
      animationFrame = 0;
      draw();
      if (!pressed) glow *= 0.925;
      if (pressed || glow > 0.012) animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
  }

  function playStrike() {
    try {
      const audio = getAudioContext();
      if (!audio) return;
      void audio.resume?.();
      const now = audio.currentTime;
      const master = audio.createGain();
      const oscillators = [];
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.2, now + 0.018);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 5.8);
      master.connect(audio.destination);

      [196, 297, 426, 594, 786].forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const partial = audio.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.detune.setValueAtTime(index % 2 ? 2.5 : -1.5, now);
        partial.gain.value = 1 / (1 + index * 1.45);
        oscillator.connect(partial).connect(master);
        oscillator.start(now + index * 0.003);
        oscillator.stop(now + 6);
        oscillators.push(oscillator);
      });
      const voice = { audio, master, oscillators };
      strikeVoices.add(voice);
      oscillators.at(-1).addEventListener("ended", () => {
        strikeVoices.delete(voice);
        try { master.disconnect(); } catch {}
      }, { once: true });
    } catch {
      setStatus("当前环境暂不支持声音，可继续静心互动");
    }
  }

  function startRimAudio() {
    if (rimAudio) return rimAudio;
    try {
      const audio = getAudioContext();
      if (!audio) return null;
      void audio.resume?.();
      const gain = audio.createGain();
      const filter = audio.createBiquadFilter();
      const oscillators = [220, 331.5, 472].map((frequency, index) => {
        const oscillator = audio.createOscillator();
        const partial = audio.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        partial.gain.value = 1 / (1.3 + index * 1.8);
        oscillator.connect(partial).connect(filter);
        oscillator.start();
        return oscillator;
      });
      filter.type = "bandpass";
      filter.frequency.value = 700;
      filter.Q.value = 0.8;
      gain.gain.value = 0.0001;
      filter.connect(gain).connect(audio.destination);
      rimAudio = { audio, gain, filter, oscillators };
      return rimAudio;
    } catch {
      return null;
    }
  }

  function stopRimAudio() {
    pressed = false;
    pointerId = null;
    angularSpeed = 0;
    if (!rimAudio) return;
    const { audio, gain, oscillators } = rimAudio;
    try {
      gain.gain.cancelScheduledValues(audio.currentTime);
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      oscillators.forEach((oscillator) => oscillator.stop(audio.currentTime + 0.01));
    } catch {
      // The nodes may already be stopped during a page transition.
    }
    rimAudio = null;
    glow = Math.min(glow, 0.3);
    requestDraw();
  }

  function stopStrikeAudio() {
    for (const voice of strikeVoices) {
      const { audio, master, oscillators } = voice;
      try {
        master.gain.cancelScheduledValues(audio.currentTime);
        master.gain.setValueAtTime(0.0001, audio.currentTime);
        oscillators.forEach((oscillator) => oscillator.stop(audio.currentTime + 0.01));
      } catch {
        // A completed voice may already have stopped while the page is changing.
      }
    }
    strikeVoices.clear();
  }

  function stopAllAudio() {
    stopRimAudio();
    stopStrikeAudio();
  }

  function locationFromEvent(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / Math.max(1, bounds.width);
    const y = (event.clientY - bounds.top) / Math.max(1, bounds.height);
    return {
      angle: Math.atan2((y - 0.42) / 0.24, (x - 0.5) / 0.34),
      rimDistance: Math.abs(Math.hypot((x - 0.5) / 0.34, (y - 0.42) / 0.24) - 1),
    };
  }

  async function registerStrike() {
    setCount(todayCount + 1);
    window.dispatchEvent(new CustomEvent("zen:statschange"));
    const requestId = createRequestId("bowl");
    const payload = { type: "bowl", increment: 1, requestId };
    pendingActivities.set(requestId, payload);
    try {
      const response = await api("/api/activity", {
        method: "POST",
        body: payload,
      });
      pendingActivities.delete(requestId);
      if (Number.isFinite(Number(response?.count))) setCount(response.count);
    } catch {
      setStatus("钵音已响，计数将在网络恢复后重新读取");
      scheduleActivityRetry();
    }
  }

  function scheduleActivityRetry(delay = 3000) {
    if (retryTimer || !pendingActivities.size) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = 0;
      void flushPendingActivities();
    }, delay);
  }

  async function flushPendingActivities() {
    if (retryingActivities || !pendingActivities.size) return;
    retryingActivities = true;
    try {
      for (const [requestId, payload] of [...pendingActivities]) {
        try {
          const response = await api("/api/activity", { method: "POST", body: payload });
          pendingActivities.delete(requestId);
          if (Number.isFinite(Number(response?.count))) setCount(response.count);
        } catch {
          // Keep this idempotent activity queued for the next retry or close beacon.
        }
      }
    } finally {
      retryingActivities = false;
      if (pendingActivities.size) scheduleActivityRetry();
    }
  }

  function savePendingActivities() {
    if (typeof navigator.sendBeacon !== "function") return;
    for (const payload of pendingActivities.values()) {
      navigator.sendBeacon("/api/activity", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    }
  }

  function strike() {
    glow = 1;
    playStrike();
    setStatus("余音渐远，听它自然消散");
    requestDraw();
    void registerStrike();
  }

  canvas.addEventListener("pointerdown", (event) => {
    strike();
    pressed = true;
    pointerId = event.pointerId;
    const location = locationFromEvent(event);
    lastAngle = location.angle;
    lastMoveAt = performance.now();
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!pressed || event.pointerId !== pointerId) return;
    const location = locationFromEvent(event);
    const now = performance.now();
    const delta = Math.atan2(Math.sin(location.angle - lastAngle), Math.cos(location.angle - lastAngle));
    const elapsed = Math.max(0.008, (now - lastMoveAt) / 1000);
    lastAngle = location.angle;
    lastMoveAt = now;
    angularSpeed = angularSpeed * 0.68 + (Math.abs(delta) / elapsed) * 0.32;

    if (location.rimDistance < 0.42 && angularSpeed > 0.35) {
      const sound = startRimAudio();
      if (sound) {
        const strength = clamp((angularSpeed - 0.25) / 6.5, 0, 1);
        const time = sound.audio.currentTime;
        sound.gain.gain.setTargetAtTime(0.018 + strength * 0.11, time, 0.045);
        sound.filter.frequency.setTargetAtTime(520 + strength * 920, time, 0.05);
        sound.oscillators.forEach((oscillator, index) => {
          oscillator.detune.setTargetAtTime(strength * (index + 1) * 5, time, 0.08);
        });
        glow = Math.max(glow, 0.35 + strength * 0.65);
        setStatus(strength > 0.66 ? "钵音充盈 · 慢慢绕行" : "沿钵缘继续绕行");
        requestDraw();
      }
    } else if (rimAudio) {
      rimAudio.gain.gain.setTargetAtTime(0.0001, rimAudio.audio.currentTime, 0.06);
    }
    event.preventDefault();
  });

  function releasePointer(event) {
    if (event && pointerId !== null && event.pointerId !== pointerId) return;
    if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    stopRimAudio();
    setStatus("轻敲听音，或按住沿钵缘缓缓绕行");
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("lostpointercapture", () => stopRimAudio());
  canvas.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    event.preventDefault();
    strike();
  });

  window.addEventListener("zen:pagechange", (event) => {
    if (event.detail?.page !== "bowl") stopAllAudio();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAllAudio();
      savePendingActivities();
    }
  });
  window.addEventListener("pagehide", () => {
    stopAllAudio();
    savePendingActivities();
  });
  window.addEventListener("beforeunload", stopAllAudio);
  window.addEventListener("online", () => void flushPendingActivities());

  async function loadCount() {
    try {
      const response = await api("/api/stats");
      setCount(getMetric(response?.today, "bowlStrikes", "bowl", "singingBowl", "bowlCount"));
    } catch {
      setStatus("轻敲听音，计数暂未读取");
    }
  }

  draw();
  void loadCount();
}
