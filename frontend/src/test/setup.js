import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { clearAll as clearApiCache } from '../api/cache';

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
