import { $, $$, api, getAudioContext, animate, pop, todayKey } from "./shared.js";

const BURN_MS = 180000;
const AUTO_SPEED = 19;
const SENSOR_MAX_SPEED = 14;
const SENSOR_STALE_MS = 320;
const SENSOR_BASELINE_ALPHA = 0.02;
const SENSOR_DYNAMIC_ALPHA = 0.35;
const SENSOR_SPEED_ALPHA = 0.22;
const SENSOR_ACCEL_DEADZONE = 0.45;
const SENSOR_ACCEL_MULTIPLIER = 2.2;
const SENSOR_ACCEL_WEIGHT_RANGE = 1.5;
const SENSOR_LINEAR_GATE = 1;
const SENSOR_LINEAR_THRESHOLD = 0.9;
const SENSOR_LINEAR_MULTIPLIER = 0.7;
const SENSOR_ROTATION_THRESHOLD = 25;
const SENSOR_ROTATION_MULTIPLIER = 0.7;
const SENSOR_ORIENTATION_FALLBACK_MS = 400;
const SENSOR_ORIENTATION_THRESHOLD = 0.7;
const SENSOR_ORIENTATION_MULTIPLIER = 0.9;
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
  const cicadaEntry = $('[data-open="cicada"]');
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
  let sensorListening = false;
  let sensorPermission = "unknown";
  let sensorSource = "";
  let sensorSpeed = 0;
  let sensorLastAt = 0;
  let sensorLastUsefulMotionAt = 0;
  let sensorLastSampleAt = 0;
  let sensorLastOrientationSampleAt = 0;
  let sensorGravityBaseline = null;
  let sensorDynamicX = 0;
  let sensorDynamicY = 0;
  let sensorPreviousDirection = null;
  let sensorLastOrientation = null;
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
      cicadaFilter.Q.value = 1.6;
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

  function permissionClasses() {
    return [window.DeviceMotionEvent, window.DeviceOrientationEvent]
      .filter((EventClass) => typeof EventClass?.requestPermission === "function");
  }

  function sensorControlRelevant() {
    return Number(navigator.maxTouchPoints || 0) > 0
      || window.matchMedia?.("(pointer: coarse)")?.matches === true;
  }

  function resetSensorMotion() {
    sensorSpeed = 0;
    sensorLastAt = 0;
    sensorLastUsefulMotionAt = 0;
    sensorLastSampleAt = 0;
    sensorLastOrientationSampleAt = 0;
    sensorGravityBaseline = null;
    sensorDynamicX = 0;
    sensorDynamicY = 0;
    sensorPreviousDirection = null;
    sensorLastOrientation = null;
    sensorSource = "";
    manualArc = 0;
  }

  function showSensorNotice(message, duration = 3500) {
    sensorNotice = message;
    sensorNoticeUntil = performance.now() + duration;
    updateCicadaStatus();
  }

  function detachSensorListeners() {
    if (typeof window.removeEventListener === "function") {
      window.removeEventListener("devicemotion", handleDeviceMotion);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
    }
    sensorListening = false;
  }

  function attachSensorListeners() {
    if (sensorListening || typeof window.addEventListener !== "function") return;
    window.addEventListener("devicemotion", handleDeviceMotion, { passive: true });
    window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
    sensorListening = true;
  }

  function armSensorWithoutPrompt() {
    if (!sensorAvailable()) return;
    if (permissionClasses().length) return;
    sensorPermission = "granted";
    attachSensorListeners();
  }

  function finiteSensorValue(value) {
    if (value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function maxAbs(values) {
    return values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  }

  function updateSensorTarget(target, source, now = performance.now()) {
    const next = Math.min(SENSOR_MAX_SPEED, Math.max(0, Number(target) || 0));
    sensorSpeed += (next - sensorSpeed) * SENSOR_SPEED_ALPHA;
    if (sensorSpeed < 0.001) sensorSpeed = 0;
    if (next > 0) {
      sensorLastAt = now;
      sensorSource = source;
      ensureCicadaAudio();
    }
    updateCicadaStatus();
  }

  function handleDeviceMotion(event) {
    if (document.visibilityState === "hidden" || state.page !== "cicada" || autoCicada || dragging) return;
    const now = performance.now();
    if (now - sensorLastSampleAt < 14) return;
    sensorLastSampleAt = now;
    let phaseTarget = 0;
    let linearTarget = 0;
    let rotationTarget = 0;

    const gravity = event.accelerationIncludingGravity;
    const x = finiteSensorValue(gravity?.x);
    const y = finiteSensorValue(gravity?.y);
    if (x !== null && y !== null) {
      if (!sensorGravityBaseline) {
        sensorGravityBaseline = { x, y };
        sensorDynamicX = 0;
        sensorDynamicY = 0;
        sensorPreviousDirection = null;
      } else {
        sensorGravityBaseline.x += (x - sensorGravityBaseline.x) * SENSOR_BASELINE_ALPHA;
        sensorGravityBaseline.y += (y - sensorGravityBaseline.y) * SENSOR_BASELINE_ALPHA;
        const dynamicX = x - sensorGravityBaseline.x;
        const dynamicY = y - sensorGravityBaseline.y;
        sensorDynamicX += (dynamicX - sensorDynamicX) * SENSOR_DYNAMIC_ALPHA;
        sensorDynamicY += (dynamicY - sensorDynamicY) * SENSOR_DYNAMIC_ALPHA;
        const energy = Math.hypot(sensorDynamicX, sensorDynamicY);
        if (energy <= SENSOR_ACCEL_DEADZONE) {
          sensorPreviousDirection = null;
        } else {
          const direction = {
            x: sensorDynamicX / energy,
            y: sensorDynamicY / energy,
            at: now,
          };
          const previousDirection = sensorPreviousDirection;
          sensorPreviousDirection = direction;
          if (previousDirection) {
            const elapsed = Math.max(0.014, (now - previousDirection.at) / 1000);
            const cross = previousDirection.x * direction.y - previousDirection.y * direction.x;
            // asin(cross) intentionally ignores a pure 180° reversal: a
            // straight shake must not be misread as half a turn.
            const angleDelta = Math.abs(Math.asin(Math.max(-1, Math.min(1, cross))));
            const angularSpeed = angleDelta / elapsed;
            const weight = Math.min(1, (energy - SENSOR_ACCEL_DEADZONE) / SENSOR_ACCEL_WEIGHT_RANGE);
            phaseTarget = angularSpeed * SENSOR_ACCEL_MULTIPLIER * weight;
          }

          // A forceful straight shake has little phase rotation. Keep a
          // deliberately high-threshold, low-gain fallback so it still feels
          // responsive without turning ordinary linear jitter into high speed.
          if (energy >= SENSOR_LINEAR_GATE && phaseTarget < 0.75) {
            linearTarget = Math.max(0, energy - SENSOR_LINEAR_THRESHOLD)
              * SENSOR_LINEAR_MULTIPLIER;
          }
        }
      }
    }

    // rotationRate is evaluated on every DeviceMotion event and merged with
    // the filtered acceleration target instead of being skipped when gravity
    // data is available.
    const rates = event.rotationRate;
    const rateValues = rates
      ? [rates.alpha, rates.beta, rates.gamma].map(finiteSensorValue)
      : [];
    if (rateValues.length === 3 && rateValues.every((value) => value !== null)) {
      const rotationRate = maxAbs(rateValues);
      rotationTarget = Math.max(0, rotationRate - SENSOR_ROTATION_THRESHOLD)
        * Math.PI / 180 * SENSOR_ROTATION_MULTIPLIER;
    }

    const motionTarget = Math.max(phaseTarget, linearTarget);
    const target = Math.max(motionTarget, rotationTarget);
    if (target > 0) sensorLastUsefulMotionAt = now;
    const source = motionTarget >= rotationTarget ? "motion" : "rotation";
    // Do not let zero-valued DeviceMotion samples repeatedly damp an active
    // orientation fallback; its own stale timer handles the decay.
    if (target > 0 || sensorSource !== "orientation") updateSensorTarget(target, source, now);
  }

  function orientationDelta(next, previous, wraps) {
    let delta = next - previous;
    if (!wraps) return delta;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  }

  function handleDeviceOrientation(event) {
    if (document.visibilityState === "hidden" || state.page !== "cicada" || autoCicada || dragging) return;
    const now = performance.now();
    if (now - sensorLastUsefulMotionAt < SENSOR_ORIENTATION_FALLBACK_MS) return;
    if (now - sensorLastOrientationSampleAt < 40) return;
    sensorLastOrientationSampleAt = now;
    const values = {
      alpha: finiteSensorValue(event.alpha),
      beta: finiteSensorValue(event.beta),
      gamma: finiteSensorValue(event.gamma),
    };
    if (Object.values(values).every((value) => value === null)) return;
    const previous = sensorLastOrientation;
    sensorLastOrientation = { values, at: now };
    if (!previous) return;
    const elapsed = Math.max(0.016, (now - previous.at) / 1000);
    const deltas = Object.entries(values)
      .filter(([axis, value]) => value !== null && previous.values[axis] !== null)
      .map(([axis, value]) => orientationDelta(value, previous.values[axis], axis === "alpha"));
    if (!deltas.length) return;
    const angularSpeed = maxAbs(deltas) * Math.PI / 180 / elapsed;
    const target = Math.max(0, angularSpeed - SENSOR_ORIENTATION_THRESHOLD)
      * SENSOR_ORIENTATION_MULTIPLIER;
    updateSensorTarget(target, "orientation", now);
  }

  async function requestSensorPermission() {
    const classes = permissionClasses();
    if (!classes.length) return true;
    const results = await Promise.all(classes.map(async (EventClass) => {
      try {
        return await EventClass.requestPermission();
      } catch {
        return "denied";
      }
    }));
    return results.some((result) => result === "granted");
  }

  async function armSensorFromGesture() {
    ensureCicadaAudio();
    if (!sensorAvailable()) {
      if (sensorControlRelevant() && window.isSecureContext === false) {
        showSensorNotice("手机晃动控制需要通过 HTTPS 打开", 5000);
      }
      return;
    }
    if (sensorPermission === "granted") {
      if (state.page === "cicada") attachSensorListeners();
      return;
    }
    if (sensorPermission === "requesting" || sensorPermission === "denied") return;
    if (!permissionClasses().length) {
      sensorPermission = "granted";
      if (state.page === "cicada") attachSensorListeners();
      return;
    }

    sensorPermission = "requesting";
    const permitted = await requestSensorPermission();
    if (!permitted) {
      sensorPermission = "denied";
      showSensorNotice("未获得传感器权限 · 可用鼠标或手指画圈");
      return;
    }
    sensorPermission = "granted";
    sensorNotice = "";
    sensorNoticeUntil = 0;
    if (state.page === "cicada") attachSensorListeners();
  }

  function updateCicadaStatus() {
    const now = performance.now();
    const turns = Math.abs(toySpeed) / TAU;
    const level = Math.min(5, Math.max(0, Math.floor(turns * 1.65)));
    $$("#speedBars i").forEach((bar, index) => bar.classList.toggle("on", index < level));
    if (sensorNotice && performance.now() < sensorNoticeUntil) {
      cicadaStatus.textContent = sensorNotice;
      return;
    }
    sensorNotice = "";
    const sensorDriving = !autoCicada && !dragging && sensorLastAt > 0
      && (now - sensorLastAt < SENSOR_STALE_MS || sensorSpeed >= 0.25 || Math.abs(toySpeed) >= 0.25);
    cicadaStatus.textContent = autoCicada
      ? "自动高速回旋 · 自动模式不计数"
      : sensorDriving
        ? sensorSource === "orientation"
          ? "转动手机 · 竹声随之回旋"
          : "手机一晃 · 竹声回旋"
      : turns < 0.55
        ? "按住画圈，手机晃动也能直接转"
        : turns < 1.5
          ? "竹声初起 · 再快一些"
          : turns < 2.8
            ? "哇——哇—— 正得劲"
            : "高能回旋 · 注意音量";
  }

  function setAuto(enabled) {
    if (enabled) {
      resetSensorMotion();
      ensureCicadaAudio();
    }
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
    let sensorDriving = false;
    if (autoCicada) {
      toySpeed += (AUTO_SPEED - toySpeed) * Math.min(1, elapsed * 4);
    } else if (dragging) {
      // Pointer movement updates the angle directly; the sensor remains armed
      // but must not fight the user's hand while dragging.
    } else if (sensorLastAt) {
      const sensorFresh = now - sensorLastAt < SENSOR_STALE_MS;
      if (sensorFresh) {
        toySpeed += (sensorSpeed - toySpeed) * Math.min(1, elapsed * 5);
      } else {
        sensorSpeed *= Math.pow(0.92, elapsed * 60);
        toySpeed *= Math.pow(0.92, elapsed * 60);
      }
      sensorDriving = sensorFresh || sensorSpeed >= 0.25 || Math.abs(toySpeed) >= 0.25;
      if (!sensorFresh && sensorSpeed < 0.25 && Math.abs(toySpeed) < 0.25) {
        toySpeed = 0;
        resetSensorMotion();
        sensorDriving = false;
      }
    } else if (!dragging) {
      toySpeed *= Math.pow(0.9, elapsed * 60);
    }
    if (autoCicada || sensorDriving) {
      const delta = toySpeed * elapsed;
      toyAngle += delta;
      if (sensorDriving) {
        if (Math.abs(toySpeed) / TAU >= 0.3) countWaa(delta);
        else manualArc = 0;
      }
    }
    drawCicada();

    const turns = Math.abs(toySpeed) / TAU;
    const audible = state.page === "cicada" && turns > 0.12;
    if (cicadaGain && audioContext) {
      const nowAudio = audioContext.currentTime;
      const target = audible
        ? Math.min(sensorDriving ? 0.3 : 0.26, (sensorDriving ? 0.045 : 0.025) + (turns - 0.12) * 0.11)
        : 0.0001;
      cicadaGain.gain.setTargetAtTime(target, nowAudio, 0.045);
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
  const requestSensorFromGesture = () => { void armSensorFromGesture(); };
  cicadaEntry?.addEventListener("pointerdown", requestSensorFromGesture);
  cicadaEntry?.addEventListener("touchstart", requestSensorFromGesture, { passive: true });
  toy.addEventListener("pointerdown", (event) => {
    setAuto(false);
    resetSensorMotion();
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
      resetSensorMotion();
      detachSensorListeners();
      muteCicada();
      if (dragging) releaseToy();
    } else {
      // Navigation is itself normally a user gesture, so prime Web Audio now.
      // iOS sensor permission is still requested on the first touch in-page.
      ensureCicadaAudio();
      if (sensorPermission === "granted") attachSensorListeners();
      else armSensorWithoutPrompt();
      if (sensorControlRelevant() && window.isSecureContext === false) {
        showSensorNotice("手机晃动控制需要通过 HTTPS 打开", 5000);
      }
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      resetSensorMotion();
      detachSensorListeners();
      muteCicada();
      beaconFish();
      beaconCicada();
    } else if (state.page === "cicada") {
      if (sensorPermission === "granted") attachSensorListeners();
      else armSensorWithoutPrompt();
    }
  });
  window.addEventListener("pagehide", saveBeforeClose);
  window.addEventListener("beforeunload", saveBeforeClose);

  resumeBurn();
  drawCicada();
  window.requestAnimationFrame(cicadaLoop);
  await Promise.all([loadFish(), loadIncense(), loadCicada()]);
}
