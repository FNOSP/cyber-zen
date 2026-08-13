import { $, $$, api, getAudioContext, playChime, formatClock } from './shared.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
let breathingInitialized = false;
let meditationInitialized = false;

function requestOptions(method, body) {
  const options = { method };
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  return options;
}

function timestamp(value) {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric > 0 && numeric < 10_000_000_000 ? numeric * SECOND : numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unwrapTimer(payload) {
  const value = payload?.timer ?? payload?.active ?? payload;
  if (!value || typeof value !== 'object' || !value.type) return null;
  const durationMinutes = Math.max(1, Number(value.minutes ?? value.durationMinutes ?? value.duration ?? 0) || 0);
  const startAt = timestamp(value.startAt ?? value.startedAt ?? value.startTime);
  const suppliedEnd = timestamp(value.endAt ?? value.endsAt ?? value.endTime);
  const endAt = suppliedEnd || (startAt && durationMinutes ? startAt + durationMinutes * MINUTE : 0);
  if (!endAt) return null;
  return {
    ...value,
    id: value.id ?? value.timerId,
    durationMinutes,
    startAt: startAt || endAt - durationMinutes * MINUTE,
    endAt,
  };
}

function setChoice(buttons, selected, disabled = false) {
  buttons.forEach((button) => {
    const active = Number(button.dataset.breathMinutes ?? button.dataset.meditationMinutes) === selected;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = disabled;
  });
}

export function initBreathing() {
  if (breathingInitialized) return;

  const lotus = $('#breathLotus');
  const timeElement = $('#breathTime');
  const phaseElement = $('#breathPhase');
  const startButton = $('#breathStart');
  const choiceButtons = $$('[data-breath-minutes]');
  if (!lotus || !timeElement || !phaseElement || !startButton) return;
  breathingInitialized = true;

  let selectedMinutes = 3;
  let timer = null;
  let ticker = 0;
  let busy = false;
  let completingId = null;

  function setLotusPhase(phase, phaseProgress = 0, timerProgress = 0) {
    const inhaling = phase === 'inhale';
    const exhaling = phase === 'exhale';
    lotus.classList.toggle('inhale', inhaling);
    lotus.classList.toggle('exhale', exhaling);
    lotus.classList.toggle('is-inhaling', inhaling);
    lotus.classList.toggle('is-exhaling', exhaling);
    lotus.style.setProperty('--phase-progress', String(Math.max(0, Math.min(1, phaseProgress))));
    lotus.style.setProperty('--breath-progress', String(Math.max(0, Math.min(1, timerProgress))));
  }

  function clearTicker() {
    clearInterval(ticker);
    ticker = 0;
  }

  function showIdle(message = '静候一息，随莲花缓缓开合') {
    clearTicker();
    timer = null;
    completingId = null;
    timeElement.textContent = formatClock(selectedMinutes * MINUTE);
    phaseElement.textContent = message;
    startButton.textContent = '开始呼吸';
    startButton.classList.remove('active');
    setChoice(choiceButtons, selectedMinutes, false);
    setLotusPhase('idle', 0, 0);
  }

  async function complete(activeTimer) {
    if (!activeTimer || completingId === activeTimer.id) return;
    completingId = activeTimer.id;
    timer = null;
    clearTicker();
    try {
      await api('/api/timer/complete', requestOptions('POST', { id: activeTimer.id }));
    } catch {
      // The server also settles expired timers while restoring, so completion is safe to retry later.
    }
    timeElement.textContent = '00:00';
    phaseElement.textContent = '一呼一吸，身心清明';
    startButton.textContent = '再次呼吸';
    startButton.classList.remove('active');
    setChoice(choiceButtons, selectedMinutes, false);
    setLotusPhase('idle', 1, 1);
    playChime();
  }

  function render() {
    if (!timer) return;
    const now = Date.now();
    const remaining = Math.max(0, timer.endAt - now);
    const total = Math.max(SECOND, timer.endAt - timer.startAt);
    const elapsed = Math.max(0, Math.min(total, now - timer.startAt));
    const cycle = elapsed % (10 * SECOND);
    const inhaling = cycle < 4 * SECOND;
    const phaseProgress = inhaling ? cycle / (4 * SECOND) : (cycle - 4 * SECOND) / (6 * SECOND);
    const timerProgress = elapsed / total;

    timeElement.textContent = formatClock(remaining);
    phaseElement.textContent = inhaling ? '吸气 · 莲花盛开' : '呼气 · 莲花合拢';
    setLotusPhase(inhaling ? 'inhale' : 'exhale', phaseProgress, timerProgress);
    if (remaining <= 0) void complete(timer);
  }

  function activate(rawTimer) {
    const normalized = unwrapTimer(rawTimer);
    if (!normalized || normalized.type !== 'breathing') {
      showIdle();
      return;
    }
    timer = normalized;
    selectedMinutes = [1, 3, 5].includes(Number(timer.durationMinutes)) ? Number(timer.durationMinutes) : selectedMinutes;
    startButton.textContent = '取消呼吸';
    startButton.classList.add('active');
    setChoice(choiceButtons, selectedMinutes, true);
    clearTicker();
    render();
    if (timer) ticker = window.setInterval(render, 120);
  }

  async function startOrCancel() {
    if (busy) return;
    busy = true;
    startButton.disabled = true;
    try {
      if (timer) {
        await api('/api/timer', requestOptions('DELETE'));
        showIdle('本次呼吸已放下');
      } else {
        getAudioContext();
        const response = await api('/api/timer', requestOptions('POST', {
          type: 'breathing',
          durationMinutes: selectedMinutes,
        }));
        const started = unwrapTimer(response);
        if (!started) throw new Error('Timer response is invalid');
        activate(started);
        window.dispatchEvent(new CustomEvent('zen:timer-started', {
          detail: { type: 'breathing', timer: started },
        }));
      }
    } catch {
      phaseElement.textContent = timer ? '暂时无法取消，请稍后再试' : '暂时无法开始，请检查连接';
    } finally {
      busy = false;
      startButton.disabled = false;
    }
  }

  choiceButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (timer) return;
      const minutes = Number(button.dataset.breathMinutes);
      if (![1, 3, 5].includes(minutes)) return;
      selectedMinutes = minutes;
      setChoice(choiceButtons, selectedMinutes, false);
      timeElement.textContent = formatClock(selectedMinutes * MINUTE);
    });
  });
  startButton.addEventListener('click', () => void startOrCancel());

  window.addEventListener('zen:timer-started', (event) => {
    if (event.detail?.type === 'breathing') return;
    if (timer) showIdle('另一项静心练习已开始');
  });

  async function restore() {
    try {
      const response = await api('/api/timer');
      const active = unwrapTimer(response);
      if (active?.type === 'breathing') activate(active);
      else showIdle();
    } catch {
      showIdle('暂时无法读取上次练习');
    }
  }

  showIdle();
  void restore();
}

export function initMeditation() {
  if (meditationInitialized) return;

  const ring = $('#meditationRing');
  const timeElement = $('#meditationTime');
  const statusElement = $('#meditationStatus');
  const startButton = $('#meditationStart');
  const ambientButton = $('#ambientToggle');
  const choiceButtons = $$('[data-meditation-minutes]');
  if (!ring || !timeElement || !statusElement || !startButton || !ambientButton) return;
  meditationInitialized = true;

  let selectedMinutes = 15;
  let timer = null;
  let ticker = 0;
  let busy = false;
  let completingId = null;
  let ambient = null;

  function clearTicker() {
    clearInterval(ticker);
    ticker = 0;
  }

  function setProgress(progress) {
    const value = Math.max(0, Math.min(1, progress));
    ring.style.setProperty('--progress', String(value));
    ring.style.setProperty('--meditation-progress', String(value));
    ring.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  }

  function stopAmbient() {
    if (ambient) {
      try { ambient.source.stop(); } catch {}
      try { ambient.source.disconnect(); } catch {}
      try { ambient.filter.disconnect(); } catch {}
      try { ambient.gain.disconnect(); } catch {}
      ambient = null;
    }
    ambientButton.classList.remove('active');
    ambientButton.setAttribute('aria-pressed', 'false');
  }

  function startAmbient() {
    try {
      const audioContext = getAudioContext();
      if (!audioContext) return false;
      void audioContext.resume?.();
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 3, audioContext.sampleRate);
      const samples = buffer.getChannelData(0);
      let last = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.025 * white) / 1.025;
        samples[index] = last * 3.2;
      }
      const source = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 620;
      filter.Q.value = 0.35;
      gain.gain.value = 0.055;
      source.connect(filter).connect(gain).connect(audioContext.destination);
      source.start();
      ambient = { source, filter, gain };
      ambientButton.classList.add('active');
      ambientButton.setAttribute('aria-pressed', 'true');
      return true;
    } catch {
      stopAmbient();
      return false;
    }
  }

  function showIdle(message = '一段留白，也是一种修行') {
    clearTicker();
    timer = null;
    completingId = null;
    timeElement.textContent = formatClock(selectedMinutes * MINUTE);
    statusElement.textContent = message;
    startButton.textContent = '开始入定';
    startButton.classList.remove('active');
    setChoice(choiceButtons, selectedMinutes, false);
    setProgress(0);
  }

  async function complete(activeTimer) {
    if (!activeTimer || completingId === activeTimer.id) return;
    completingId = activeTimer.id;
    timer = null;
    clearTicker();
    stopAmbient();
    try {
      await api('/api/timer/complete', requestOptions('POST', { id: activeTimer.id }));
    } catch {
      // Expired timers are also settled by the server during the next restore.
    }
    timeElement.textContent = '00:00';
    statusElement.textContent = '此刻澄明 · 入定完成';
    startButton.textContent = '再次入定';
    startButton.classList.remove('active');
    setChoice(choiceButtons, selectedMinutes, false);
    setProgress(1);
    playChime();
  }

  function render() {
    if (!timer) return;
    const now = Date.now();
    const remaining = Math.max(0, timer.endAt - now);
    const total = Math.max(SECOND, timer.endAt - timer.startAt);
    const elapsed = Math.max(0, Math.min(total, now - timer.startAt));
    timeElement.textContent = formatClock(remaining);
    statusElement.textContent = remaining > 0 ? '观照呼吸 · 不逐杂念' : '此刻澄明';
    setProgress(elapsed / total);
    if (remaining <= 0) void complete(timer);
  }

  function activate(rawTimer) {
    const normalized = unwrapTimer(rawTimer);
    if (!normalized || normalized.type !== 'meditation') {
      showIdle();
      return;
    }
    timer = normalized;
    selectedMinutes = [5, 15, 25, 45].includes(Number(timer.durationMinutes)) ? Number(timer.durationMinutes) : selectedMinutes;
    startButton.textContent = '结束入定';
    startButton.classList.add('active');
    setChoice(choiceButtons, selectedMinutes, true);
    clearTicker();
    render();
    if (timer) ticker = window.setInterval(render, 250);
  }

  async function startOrCancel() {
    if (busy) return;
    busy = true;
    startButton.disabled = true;
    try {
      if (timer) {
        await api('/api/timer', requestOptions('DELETE'));
        stopAmbient();
        showIdle('本次入定已结束');
      } else {
        getAudioContext();
        const response = await api('/api/timer', requestOptions('POST', {
          type: 'meditation',
          durationMinutes: selectedMinutes,
        }));
        const started = unwrapTimer(response);
        if (!started) throw new Error('Timer response is invalid');
        activate(started);
        window.dispatchEvent(new CustomEvent('zen:timer-started', {
          detail: { type: 'meditation', timer: started },
        }));
      }
    } catch {
      statusElement.textContent = timer ? '暂时无法结束，请稍后再试' : '暂时无法开始，请检查连接';
    } finally {
      busy = false;
      startButton.disabled = false;
    }
  }

  choiceButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (timer) return;
      const minutes = Number(button.dataset.meditationMinutes);
      if (![5, 15, 25, 45].includes(minutes)) return;
      selectedMinutes = minutes;
      setChoice(choiceButtons, selectedMinutes, false);
      timeElement.textContent = formatClock(selectedMinutes * MINUTE);
    });
  });

  startButton.addEventListener('click', () => void startOrCancel());
  ambientButton.addEventListener('click', () => {
    if (ambient) stopAmbient();
    else if (!startAmbient()) statusElement.textContent = '当前设备暂不支持环境声';
  });

  window.addEventListener('zen:timer-started', (event) => {
    if (event.detail?.type === 'meditation') return;
    stopAmbient();
    if (timer) showIdle('另一项静心练习已开始');
  });
  window.addEventListener('zen:pagechange', (event) => {
    if (event.detail?.page !== 'meditation') stopAmbient();
  });
  window.addEventListener('beforeunload', stopAmbient);

  async function restore() {
    try {
      const response = await api('/api/timer');
      const active = unwrapTimer(response);
      if (active?.type === 'meditation') activate(active);
      else showIdle();
    } catch {
      showIdle('暂时无法读取上次练习');
    }
  }

  showIdle();
  void restore();
}
