import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { clearAll as clearApiCache } from '../api/cache';

// Node 22+ ships its own `localStorage`/`sessionStorage` globals, but leaves
// them `undefined` unless the process was started with --localstorage-file.
// Those undefined globals shadow the ones happy-dom installs, so on a modern
// Node every component that reads a saved token, theme, or seen-flag throws
// on mount — which takes down almost the whole suite. Install a working
// in-memory implementation when the environment didn't provide one.
function installWebStorage(name) {
  if (globalThis[name]) return;
  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => { store.set(String(key), String(value)); },
    removeItem: (key) => { store.delete(String(key)); },
    clear: () => { store.clear(); },
    key: (index) => [...store.keys()][index] ?? null,
  };
  Object.defineProperty(storage, 'length', { get: () => store.size });
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: storage });
}

installWebStorage('localStorage');
installWebStorage('sessionStorage');

// Unmount React trees between tests to avoid cross-test DOM/state leakage.
afterEach(() => {
  cleanup();
});

// The API response cache outlives a render, so without this a test would start
// holding the previous test's data and AuthProvider would restore that stale
// user instead of authenticating. localStorage is deliberately left alone —
// tests rely on the saved session token carrying between cases.
beforeEach(() => {
  clearApiCache();
});

// jsdom doesn't implement matchMedia or scrollTo; several components touch them.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

window.scrollTo = window.scrollTo || vi.fn();

// IntersectionObserver is used by carousels/lazy UI but absent in jsdom.
if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}
