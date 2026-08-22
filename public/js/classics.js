import { $, $$, api, getAudioContext, animate, pop, todayKey } from "./shared.js";

const BURN_MS = 180000;
const AUTO_SPEED = 19;
const TAU = Math.PI * 2;
const INCENSE_END_KEY = "zen-incense-end";

let initialized = false;

export async function initClassics() {
  if (initialized) return;

  const fish = $("#fish");
  const incense = $("#incense");
  const fishCount = $("#fishCount");
  const incenseCount = $("#incenseCount");
  const fishFloat = $("#fishFloat");
  const incenseFloat = $("#incenseFloat");
  const burnStatus = $("#burnStatus");
  const toy = $("#cicadaToy");
  const canvas = $("#cicadaCanvas");
  const waaCount = $("#waaCount");
  const autoButton = $("#autoCicada");
  const sensorButton = $("#sensorCicada");
  const cicadaStatus = $("#cicadaStatus");
  if (
    !fish || !incense || !fishCount || !incenseCount || !fishFloat || !incenseFloat
    || !burnStatus || !toy || !canvas || !waaCount || !autoButton || !cicadaStatus
  ) return;

  const context = canvas.getContext("2d");
  if (!context) return;
  initialized = true;

  const state = {
    page: "home",
    fish: 0,
    incense: 0,
    pendingFish: 0,
    fishLoaded: false,
    fishSaving: false,
    fishTimer: 0,
    burnTimer: 0,
  };

  let audioContext;

  function tone(type) {
    try {
      audioContext = getAudioContext();
      if (!audioContext) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = type === "fish" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(type === "fish" ? 500 : 820, now);
      oscillator.frequency.exponentialRampToValueAtTime(type === "fish" ? 140 : 410, now + 0.25);
      gain.gain.setValueAtTime(type === "fish" ? 0.34 : 0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.4);
    } catch {
      // Audio is decorative; interaction and persistence should still work.
    }
  }

  function scheduleFishFlush(delay = 700) {
    window.clearTimeout(state.fishTimer);
    state.fishTimer = window.setTimeout(() => {
      state.fishTimer = 0;
      void flushFish();
    }, delay);
  }

  async function flushFish() {
    if (!state.fishLoaded || state.fishSaving || state.pendingFish <= 0) return;
    const increment = state.pendingFish;
    state.pendingFish = 0;
    state.fishSaving = true;
    try {
      const response = await api("/api/knock", {
        method: "POST",
        keepalive: true,
        body: { increment },
      });
      const serverCount = Math.max(0, Math.trunc(Number(response?.count) || 0));
      state.fish = serverCount + state.pendingFish;
      fishCount.textContent = String(state.fish);
    } catch {
      state.pendingFish += increment;
      scheduleFishFlush(2000);
    } finally {
      state.fishSaving = false;
      if (state.pendingFish > 0 && !state.fishTimer) scheduleFishFlush();
    }
  }

  function actFish() {
    tone("fish");
    state.fish += 1;
    state.pendingFish += 1;
    fishCount.textContent = String(state.fish);
    pop(fishCount);
    fishFloat.textContent = ["功德 +1", "善哉", "随喜", "阿弥陀佛"][Math.floor(Math.random() * 4)];
    animate(fish, "hit");
    scheduleFishFlush();
  }

  async function loadFish() {
    try {
      const response = await api("/api/count");
      const serverCount = Math.max(0, Math.trunc(Number(response?.count) || 0));
      state.fish = serverCount + state.pendingFish;
      fishCount.textContent = String(state.fish);
    } catch {
      // Keep optimistic local taps visible and retry them through the pending queue.
    } finally {
      state.fishLoaded = true;
      if (state.pendingFish > 0) scheduleFishFlush();
    }
  }

  const originalSticks = [
    { y: 77, height: 105 },
    { y: 68, height: 114 },
    { y: 77, height: 105 },
  ];

  function renderBurn() {
    const end = Number(localStorage.getItem(INCENSE_END_KEY) || 0);
    const left = Math.max(0, end - Date.now());
    const ratio = left / BURN_MS;
    if (!left) {
      incense.classList.remove("burning");
      burnStatus.textContent = "香已燃尽 · 点击重新上香";
      window.clearInterval(state.burnTimer);
      state.burnTimer = 0;
      localStorage.removeItem(INCENSE_END_KEY);
      return;
    }

    incense.classList.add("burning");
    const sticks = $$(".stick", incense);
    const stickGroups = $$("[data-stick]", incense);
    const smokeGroups = $$("[data-smoke]", incense);
    sticks.forEach((element, index) => {
      const original = originalSticks[index];
      if (!original) return;
      const height = Math.max(3, original.height * ratio);
      const y = 182 - height;
      element.setAttribute("y", String(y));
      element.setAttribute("height", String(height));
      const ember = $(".ember", stickGroups[index]);
      ember?.setAttribute("y", String(y - 2));
      smokeGroups[index]?.setAttribute("transform", `translate(0 ${y - original.y})`);
    });
    const seconds = Math.ceil(left / 1000);
    burnStatus.textContent = `燃烧中 · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function resumeBurn() {
    if (Number(localStorage.getItem(INCENSE_END_KEY) || 0) > Date.now()) {
      renderBurn();
      window.clearInterval(state.burnTimer);
      state.burnTimer = window.setInterval(renderBurn, 250);
    } else {
      renderBurn();
    }
  }

  async function postIncense() {
    try {
      const response = await api("/api/incense", {
        method: "POST",
        body: { increment: 1 },
      });
      state.incense = Math.max(0, Math.trunc(Number(response?.count) || state.incense));
      incenseCount.textContent = String(state.incense);
    } catch {
      // Preserve the immediate interaction when the local service is temporarily unavailable.
    }
  }

  function actIncense() {
    tone("incense");
    localStorage.setItem(INCENSE_END_KEY, String(Date.now() + BURN_MS));
    state.incense += 1;
    incenseCount.textContent = String(state.incense);
    pop(incenseCount);
    incenseFloat.textContent = ["三炷清香", "一念清净", "心安", "自在"][Math.floor(Math.random() * 4)];
    animate(incense, "relit");
    void postIncense();
    resumeBurn();
  }

  async function loadIncense() {
    try {
      const response = await api("/api/incense");
      state.incense = Math.max(0, Math.trunc(Number(response?.count) || 0));
      incenseCount.textContent = String(state.incense);
    } catch {
      // The incense timer remains available through localStorage while offline.
    }
  }

  const dateKey = todayKey();
  const waaKey = `zen-cicada-${dateKey}`;
  const [year, month, day] = dateKey.split("-").map(Number);
  const legacyWaaKey = `zen-cicada-${year}-${month}-${day}`;
  const readLocalWaa = (key) => {
    const value = Number(localStorage.getItem(key) || 0);
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  };
  let waa = Math.max(
    readLocalWaa(waaKey),
    readLocalWaa(legacyWaaKey),
  );
  let toyAngle = 0.5;
  let toySpeed = 0;
  let lastFrame = performance.now();
  let dragging = false;
  let pointerId = null;
  let lastPointerAngle = 0;
  let manualArc = 0;
  let autoCicada = false;
  let sensorCicada = false;
  let sensorListening = false;
  let sensorSource = "";
  let sensorSpeed = 0;
  let sensorLastAt = 0;
  let sensorLastAcceleration = null;
  let sensorLastOrientation = null;
  let sensorEventSeen = false;
  let sensorRequestId = 0;
  let sensorProbeTimer = 0;
  let sensorNotice = "";
  let sensorNoticeUntil = 0;
  let cicadaOscillator;
  let cicadaGain;
  let cicadaFilter;
  waaCount.textContent = String(waa);

  function writeCicadaLocal() {
    localStorage.setItem(waaKey, String(waa));
    if (legacyWaaKey !== waaKey) localStorage.removeItem(legacyWaaKey);
  }

  async function postCicada(count) {
    return api("/api/cicada", {
      method: "POST",
      keepalive: true,
      body: { count },
    });
  }

  async function loadCicada() {
    try {
      const response = await api("/api/cicada");
      const serverCount = Math.max(0, Math.trunc(Number(response?.count) || 0));
      waa = Math.max(waa, serverCount);
      writeCicadaLocal();
      waaCount.textContent = String(waa);
      if (waa > serverCount) await postCicada(waa);
    } catch {
      writeCicadaLocal();
    }
  }

  function saveCicada() {
    writeCicadaLocal();
    void postCicada(waa).catch(() => {});
  }

  function ensureCicadaAudio() {
    try {
      audioContext = getAudioContext();
      if (!audioContext || cicadaOscillator) return;
      cicadaOscillator = audioContext.createOscillator();
      cicadaGain = audioContext.createGain();
      cicadaFilter = audioContext.createBiquadFilter();
      cicadaOscillator.type = "sawtooth";
      cicadaOscillator.frequency.value = 72;
      cicadaFilter.type = "bandpass";
      cicadaFilter.frequency.value = 980;
      cicadaFilter.Q.value = 2.8;
      cicadaGain.gain.value = 0.0001;
      cicadaOscillator.connect(cicadaFilter).connect(cicadaGain).connect(audioContext.destination);
      cicadaOscillator.start();
    } catch {
      // Canvas interaction remains available when Web Audio is unsupported.
    }
  }

  function muteCicada() {
    if (!cicadaGain || !audioContext) return;
    const now = audioContext.currentTime;
    cicadaGain.gain.cancelScheduledValues(now);
    cicadaGain.gain.setValueAtTime(0.0001, now);
  }

  function countWaa(delta) {
    manualArc += Math.abs(delta);
    while (manualArc >= TAU) {
      manualArc -= TAU;
      waa += 1;
      waaCount.textContent = String(waa);
      pop(waaCount);
      saveCicada();
    }
  }

  function pointerAngle(event) {
    const bounds = canvas.getBoundingClientRect();
    return Math.atan2(
      event.clientY - (bounds.top + bounds.height / 2),
      event.clientX - (bounds.left + bounds.width / 2),
    );
  }

  function sensorAvailable() {
    return window.isSecureContext !== false
      && (typeof window.DeviceMotionEvent !== "undefined"
      || typeof window.DeviceOrientationEvent !== "undefined");
  }

  function sensorControlRelevant() {
    return Number(navigator.maxTouchPoints || 0) > 0
      || window.matchMedia?.("(pointer: coarse)")?.matches === true;
  }

  function updateSensorButton() {
    if (!sensorButton) return;
    const relevant = sensorControlRelevant();
    sensorButton.hidden = !relevant;
    if (!relevant) return;
    const available = sensorAvailable();
    sensorButton.disabled = !available;
    sensorButton.classList.toggle("active", sensorCicada);
    sensorButton.setAttribute("aria-pressed", String(sensorCicada));
    sensorButton.textContent = sensorCicada
      ? "关闭晃动"
      : available
        ? "开启晃动"
        : window.isSecureContext === false
          ? "需要 HTTPS"
          : "设备不支持";
    sensorButton.title = !available && window.isSecureContext === false
      ? "手机浏览器通常只会在 HTTPS 页面开放动作传感器"
      : "";
  }

  function resetSensorSamples() {
    sensorLastAt = 0;
    sensorLastAcceleration = null;
    sensorLastOrientation = null;
    sensorSource = "";
  }

  function showSensorNotice(message, duration = 3500) {
    sensorNotice = message;
    sensorNoticeUntil = performance.now() + duration;
    updateCicadaStatus();
  }

  function markSensorEvent() {
    sensorEventSeen = true;
    window.clearTimeout(sensorProbeTimer);
    sensorProbeTimer = 0;
  }

  function detachSensorListeners() {
    if (typeof window.removeEventListener === "function") {
      window.removeEventListener("devicemotion", handleDeviceMotion);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
    }
    window.clearTimeout(sensorProbeTimer);
    sensorProbeTimer = 0;
    sensorListening = false;
  }

  function stopSensor() {
    sensorRequestId += 1;
    sensorCicada = false;
    detachSensorListeners();
    sensorSpeed = 0;
    resetSensorSamples();
    updateSensorButton();
    updateCicadaStatus();
  }

  function clampSensorSpeed(value) {
    return Math.max(-24, Math.min(24, value));
  }

  function finiteSensorValue(value) {
    if (value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function dominantAxis(values) {
    return values.reduce((current, value) => (
      Math.abs(value) > Math.abs(current) ? value : current
    ), 0);
  }

  function handleDeviceMotion(event) {
    if (!sensorCicada || state.page !== "cicada") return;
    const now = performance.now();
    let velocity = 0;
    const rates = event.rotationRate;
    if (rates) {
      const rateValues = [rates.alpha, rates.beta, rates.gamma].map(finiteSensorValue);
      if (rateValues.every((value) => value !== null)) {
        markSensorEvent();
        const dominant = dominantAxis(rateValues);
        if (Math.abs(dominant) > 0.8) {
          // rotationRate is expressed in degrees per second; convert to the
          // canvas' radians per second and add a little tactile sensitivity.
          velocity = clampSensorSpeed(dominant * Math.PI / 180 * 1.25);
          sensorSource = "motion";
        }
      }
    }

    if (!velocity) {
      const acceleration = event.acceleration;
      const accelerationValues = acceleration
        ? [acceleration.x, acceleration.y, acceleration.z].map(finiteSensorValue)
        : [];
      if (accelerationValues.length === 3 && accelerationValues.every((value) => value !== null)) {
        markSensorEvent();
        const magnitude = Math.hypot(...accelerationValues);
        if (magnitude > 0.35) {
          velocity = clampSensorSpeed(dominantAxis(accelerationValues) * 1.35);
          sensorSource = "motion";
        }
      } else {
        // A few browsers expose only accelerationIncludingGravity. Comparing
        // consecutive samples removes the static gravity component and keeps
        // a gentle shake useful as a fallback.
        const includingGravity = event.accelerationIncludingGravity;
        const values = includingGravity
          ? [includingGravity.x, includingGravity.y, includingGravity.z].map(finiteSensorValue)
          : [];
        if (values.length === 3 && values.every((value) => value !== null)) {
          markSensorEvent();
          if (sensorLastAcceleration) {
            const delta = values.map((value, index) => value - sensorLastAcceleration[index]);
            const magnitude = Math.hypot(...delta);
            if (magnitude > 0.55) {
              velocity = clampSensorSpeed(dominantAxis(delta) * 1.6);
              sensorSource = "motion";
            }
          }
          sensorLastAcceleration = values;
        }
      }
    }

    if (velocity) {
      sensorSpeed = sensorSpeed * 0.62 + velocity * 0.38;
      sensorLastAt = now;
    } else if (!sensorLastAt) {
      sensorLastAt = now;
    }
    updateCicadaStatus();
  }

  function orientationDelta(next, previous, wraps) {
    let delta = next - previous;
    if (!wraps) return delta;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  }

  function handleDeviceOrientation(event) {
    if (!sensorCicada || state.page !== "cicada") return;
    const now = performance.now();
    const values = {
      alpha: finiteSensorValue(event.alpha),
      beta: finiteSensorValue(event.beta),
      gamma: finiteSensorValue(event.gamma),
    };
    if (Object.values(values).every((value) => value === null)) return;
    markSensorEvent();
    const previous = sensorLastOrientation;
    sensorLastOrientation = { values, at: now };
    // DeviceMotion is preferred when it is available; orientation is a
    // fallback for browsers that omit rotationRate.
    if (sensorSource === "motion" && now - sensorLastAt < 250) return;
    if (!previous) return;
    const elapsed = Math.max(0.016, (now - previous.at) / 1000);
    const deltas = Object.entries(values)
      .filter(([axis, value]) => value !== null && previous.values[axis] !== null)
      .map(([axis, value]) => orientationDelta(value, previous.values[axis], axis === "alpha"));
    if (!deltas.length) return;
    const delta = dominantAxis(deltas);
    if (Math.abs(delta) < 0.25) return;
    sensorSpeed = sensorSpeed * 0.58 + clampSensorSpeed(delta * Math.PI / 180 / elapsed * 1.2) * 0.42;
    sensorSource = "orientation";
    sensorLastAt = now;
    updateCicadaStatus();
  }

  async function requestSensorPermission() {
    const permissionClasses = [window.DeviceMotionEvent, window.DeviceOrientationEvent]
      .filter((EventClass) => typeof EventClass?.requestPermission === "function");
    if (!permissionClasses.length) return true;
    const results = await Promise.all(permissionClasses.map(async (EventClass) => {
      try {
        return await EventClass.requestPermission();
      } catch {
        return "denied";
      }
    }));
    return results.some((result) => result === "granted");
  }

  async function toggleSensor() {
    if (sensorCicada) {
      stopSensor();
      return;
    }
    if (!sensorAvailable()) {
      updateSensorButton();
      showSensorNotice(
        window.isSecureContext === false
          ? "手机晃动控制需要通过 HTTPS 打开"
          : "当前设备不支持晃动控制 · 可用鼠标或手指画圈",
      );
      return;
    }
    setAuto(false);
    const requestId = ++sensorRequestId;
    if (sensorButton) sensorButton.disabled = true;
    const permitted = await requestSensorPermission();
    if (requestId !== sensorRequestId || state.page !== "cicada") {
      updateSensorButton();
      return;
    }
    if (!permitted) {
      updateSensorButton();
      showSensorNotice("未获得传感器权限 · 可用鼠标或手指画圈");
      return;
    }

    resetSensorSamples();
    sensorNotice = "";
    sensorNoticeUntil = 0;
    sensorEventSeen = false;
    sensorCicada = true;
    if (!sensorListening && typeof window.addEventListener === "function") {
      window.addEventListener("devicemotion", handleDeviceMotion, { passive: true });
      window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
      sensorListening = true;
    }
    sensorProbeTimer = window.setTimeout(() => {
      if (!sensorCicada || sensorEventSeen || requestId !== sensorRequestId) return;
      stopSensor();
      showSensorNotice(
        window.isSecureContext === false
          ? "浏览器未开放传感器 · 请使用 HTTPS，或用手指画圈"
          : "未检测到手机传感器 · 可用鼠标或手指画圈",
        5000,
      );
    }, 3000);
    ensureCicadaAudio();
    updateSensorButton();
    cicadaStatus.textContent = "晃动或转动手机，竹知了随之回旋";
  }

  function updateCicadaStatus() {
    const turns = Math.abs(toySpeed) / TAU;
    const level = Math.min(5, Math.max(0, Math.floor(turns * 1.65)));
    $$("#speedBars i").forEach((bar, index) => bar.classList.toggle("on", index < level));
    if (sensorNotice && performance.now() < sensorNoticeUntil) {
      cicadaStatus.textContent = sensorNotice;
      return;
    }
    sensorNotice = "";
    cicadaStatus.textContent = sensorCicada
      ? sensorSource === "orientation"
        ? "转动手机，竹知了随之回旋"
        : "晃动或转动手机，竹知了随之回旋"
      : autoCicada
        ? "自动高速回旋 · 自动模式不计数"
      : turns < 0.55
        ? "按住画圈，越快越响"
        : turns < 1.5
          ? "竹声初起 · 再快一些"
          : turns < 2.8
            ? "哇——哇—— 正得劲"
            : "高能回旋 · 注意音量";
  }

  function setAuto(enabled) {
    if (enabled && sensorCicada) stopSensor();
    if (enabled) ensureCicadaAudio();
    autoCicada = enabled;
    autoButton.classList.toggle("active", enabled);
    autoButton.textContent = enabled ? "停止自动" : "自动甩";
    if (!enabled && state.page !== "cicada") muteCicada();
    updateCicadaStatus();
  }

  function moveToy(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    const angle = pointerAngle(event);
    const now = performance.now();
    const raw = Math.atan2(Math.sin(angle - lastPointerAngle), Math.cos(angle - lastPointerAngle));
    lastPointerAngle = angle;
    const elapsed = Math.max(0.008, (now - lastFrame) / 1000);
    toySpeed = toySpeed * 0.55 + (raw / elapsed) * 0.45;
    toyAngle += raw;
    countWaa(raw);
    updateCicadaStatus();
    event.preventDefault();
  }

  function releaseToy(event) {
    if (event && pointerId !== null && event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    toy.classList.remove("dragging");
    saveCicada();
  }

  function toggleAuto() {
    setAuto(!autoCicada);
  }

  function roundedRect(x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
    context.stroke();
  }

  function drawCicada() {
    context.clearRect(0, 0, 560, 500);
    const anchorX = 280;
    const anchorY = 245;
    const radiusX = 142;
    const radiusY = 122;
    const toyX = anchorX + Math.cos(toyAngle) * radiusX;
    const toyY = anchorY + Math.sin(toyAngle) * radiusY;

    context.save();
    context.strokeStyle = "rgba(103,213,201,.14)";
    context.lineWidth = 2;
    context.setLineDash([8, 12]);
    context.beginPath();
    context.ellipse(anchorX, anchorY, radiusX, radiusY, 0, 0, TAU);
    context.stroke();
    context.restore();

    context.strokeStyle = "#d5b16b";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(anchorX, anchorY);
    context.quadraticCurveTo(
      (anchorX + toyX) / 2 + Math.sin(toyAngle) * 18,
      (anchorY + toyY) / 2 - Math.cos(toyAngle) * 18,
      toyX,
      toyY,
    );
    context.stroke();

    context.save();
    context.translate(anchorX, anchorY);
    context.rotate(-0.18);
    context.fillStyle = "#9b642e";
    context.strokeStyle = "#e0ad5e";
    context.lineWidth = 3;
    roundedRect(-62, -15, 124, 30, 14);
    context.fillStyle = "#42c7ba";
    context.beginPath();
    context.arc(0, 0, 6, 0, TAU);
    context.fill();
    context.restore();

    context.save();
    context.translate(toyX, toyY);
    context.rotate(toyAngle + Math.PI / 2);
    const gradient = context.createLinearGradient(-42, -62, 42, 62);
    gradient.addColorStop(0, "#e7b760");
    gradient.addColorStop(0.48, "#a9682e");
    gradient.addColorStop(1, "#4f2d17");
    context.fillStyle = gradient;
    context.strokeStyle = "#edc779";
    context.lineWidth = 3;
    roundedRect(-42, -61, 84, 122, 25);
    context.fillStyle = "#24170f";
    context.beginPath();
    context.ellipse(0, -47, 31, 9, 0, 0, TAU);
    context.fill();
    context.strokeStyle = "#42cfc0";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, -24);
    context.lineTo(0, 31);
    context.stroke();
    context.fillStyle = "#67d9ca";
    context.beginPath();
    context.ellipse(0, 4, 13, 22, 0, 0, TAU);
    context.fill();
    context.strokeStyle = "#cba05b";
    context.lineWidth = 3;
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(side * 7, -8);
      context.quadraticCurveTo(side * 30, -19, side * 30, 9);
      context.quadraticCurveTo(side * 28, 28, side * 7, 20);
      context.stroke();
    }
    context.restore();
  }

  function cicadaLoop(now) {
    const elapsed = Math.min(0.04, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    if (autoCicada) {
      toySpeed += (AUTO_SPEED - toySpeed) * Math.min(1, elapsed * 4);
    } else if (sensorCicada) {
      const sensorFresh = sensorLastAt && now - sensorLastAt < 360;
      const target = sensorFresh ? sensorSpeed : 0;
      toySpeed += (target - toySpeed) * Math.min(1, elapsed * 9);
      if (!sensorFresh) sensorSpeed *= Math.pow(0.8, elapsed * 60);
    } else if (!dragging) {
      toySpeed *= Math.pow(0.9, elapsed * 60);
    }
    if (autoCicada || sensorCicada) {
      const delta = toySpeed * elapsed;
      toyAngle += delta;
      if (sensorCicada) countWaa(delta);
    }
    drawCicada();

    const turns = Math.abs(toySpeed) / TAU;
    const audible = state.page === "cicada" && turns > 0.5;
    if (cicadaGain && audioContext) {
      const nowAudio = audioContext.currentTime;
      const target = audible ? Math.min(0.18, (turns - 0.5) * 0.075) : 0.0001;
      cicadaGain.gain.setTargetAtTime(target, nowAudio, 0.06);
      cicadaOscillator.frequency.setTargetAtTime(64 + Math.min(110, turns * 24), nowAudio, 0.05);
      cicadaFilter.frequency.setTargetAtTime(
        850 + Math.sin(toyAngle) * 320 + Math.min(850, turns * 180),
        nowAudio,
        0.04,
      );
    }
    if (Math.floor(now / 150) !== Math.floor((now - elapsed * 1000) / 150)) updateCicadaStatus();
    window.requestAnimationFrame(cicadaLoop);
  }

  function sendBeacon(url, payload) {
    const body = JSON.stringify(payload);
    if (typeof navigator.sendBeacon === "function") {
      return navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    }
    try {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  function beaconFish() {
    if (state.pendingFish <= 0) return;
    const increment = state.pendingFish;
    state.pendingFish = 0;
    if (!sendBeacon("/api/knock", { increment })) state.pendingFish += increment;
  }

  function beaconCicada() {
    writeCicadaLocal();
    sendBeacon("/api/cicada", { count: waa });
  }

  function saveBeforeClose() {
    detachSensorListeners();
    window.clearTimeout(state.fishTimer);
    beaconFish();
    beaconCicada();
  }

  fish.addEventListener("click", actFish);
  incense.addEventListener("click", actIncense);
  toy.addEventListener("pointerdown", (event) => {
    setAuto(false);
    if (sensorCicada) stopSensor();
    ensureCicadaAudio();
    dragging = true;
    pointerId = event.pointerId;
    toy.classList.add("dragging");
    lastPointerAngle = pointerAngle(event);
    lastFrame = performance.now();
    toy.setPointerCapture?.(event.pointerId);
  });
  toy.addEventListener("pointermove", moveToy);
  toy.addEventListener("pointerup", releaseToy);
  toy.addEventListener("pointercancel", releaseToy);
  autoButton.addEventListener("click", toggleAuto);
  sensorButton?.addEventListener("click", () => void toggleSensor());

  document.addEventListener("keydown", (event) => {
    if (
      (event.code !== "Space" && event.code !== "Enter")
      || !["fish", "incense", "cicada"].includes(state.page)
    ) return;
    event.preventDefault();
    if (state.page === "fish") actFish();
    else if (state.page === "incense") actIncense();
    else toggleAuto();
  });

  window.addEventListener("zen:pagechange", (event) => {
    state.page = event.detail?.page || "home";
    if (state.page !== "cicada") {
      setAuto(false);
      stopSensor();
      muteCicada();
      if (dragging) releaseToy();
    } else if (sensorControlRelevant() && window.isSecureContext === false) {
      showSensorNotice("手机晃动控制需要通过 HTTPS 打开", 5000);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      stopSensor();
      beaconFish();
      beaconCicada();
    }
  });
  window.addEventListener("pagehide", saveBeforeClose);
  window.addEventListener("beforeunload", saveBeforeClose);

  resumeBurn();
  updateSensorButton();
  drawCicada();
  window.requestAnimationFrame(cicadaLoop);
  await Promise.all([loadFish(), loadIncense(), loadCicada()]);
}
