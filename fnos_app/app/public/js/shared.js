export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let audioContext;

export function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ||= new AudioContextClass();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

export async function api(url, options = {}) {
  const request = { ...options };
  if (request.body && typeof request.body !== "string" && !(request.body instanceof Blob)) {
    request.body = JSON.stringify(request.body);
    request.headers = { "Content-Type": "application/json", ...(request.headers || {}) };
  }
  const response = await fetch(url, request);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
  return data;
}

export function playChime(strength = 1) {
  const audio = getAudioContext();
  if (!audio) return;
  const now = audio.currentTime;
  [261.63, 392, 523.25, 783.99].forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(Math.max(0.0001, 0.09 * strength / (index + 1)), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8 + index * 0.22);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now + index * 0.012);
    oscillator.stop(now + 2.6);
  });
}

export function pop(element) {
  if (!element) return;
  element.classList.remove("pop");
  void element.offsetWidth;
  element.classList.add("pop");
}

export function animate(element, className, duration = 900) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), duration);
}

export function formatClock(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createRequestId(prefix = "activity") {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
