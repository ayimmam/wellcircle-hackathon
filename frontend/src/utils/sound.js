import tapUrl from '../assets/sounds/tap.wav';
import openUrl from '../assets/sounds/open.wav';
import closeUrl from '../assets/sounds/close.wav';
import successUrl from '../assets/sounds/success.wav';
import errorUrl from '../assets/sounds/error.wav';

const KEY = 'wellcircle-sound';
const urls = { tap: tapUrl, open: openUrl, close: closeUrl, success: successUrl, error: errorUrl };
const listeners = new Set();
const buffers = new Map();
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* private browsing */ }
let context;
let active;
let lastPlay = -Infinity;
let lastKind;
let lastGesture = -Infinity;
let generation = 0;

export const getSoundEnabled = () => enabled;
export function subscribeSound(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSoundEnabled(value) {
  enabled = Boolean(value);
  generation += 1;
  if (!enabled) { active?.stop(); active = null; }
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* optional persistence */ }
  listeners.forEach(listener => listener());
}

// Called only from an activation gesture, never during startup or a route effect.
export function unlockSound() {
  lastGesture = Date.now();
  if (!enabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context ||= new AudioContext();
    if (context.state === 'suspended') context.resume().catch(() => {});
    for (const [name, url] of Object.entries(urls)) {
      if (!buffers.has(name)) {
        buffers.set(name, fetch(url).then(response => {
          if (!response.ok) throw new Error('Sound unavailable');
          return response.arrayBuffer();
        }).then(data => context.decodeAudioData(data)).catch(() => {
          buffers.delete(name);
          return null;
        }));
      }
    }
  } catch { /* Audio support must never affect an action. */ }
}

export async function playSound(name) {
  // Async confirmations are allowed only shortly after an intentional action.
  if (!enabled || !context || document.hidden || Date.now() - lastGesture > 15000) return;
  const requested = Date.now();
  const version = generation;
  const buffer = await buffers.get(name);
  const confirmation = name === 'success' || name === 'error';
  // Drop late downloads rather than producing a delayed click or burst.
  if (!buffer || !enabled || version !== generation || document.hidden
    || context.state !== 'running' || Date.now() - requested > 200
    || (Date.now() - lastPlay < 85 && !(confirmation && lastKind !== name))) return;
  try {
    active?.stop();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
    active = source;
    source.onended = () => { if (active === source) active = null; };
    lastPlay = Date.now();
    lastKind = name;
  } catch { /* Silent fallback in restricted webviews. */ }
}
