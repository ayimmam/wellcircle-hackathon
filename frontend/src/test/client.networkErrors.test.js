import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// These tests need live (non-mock) mode so the request actually reaches
// `fetch`, which vitest's default VITE_USE_MOCK='true' env (vite.config.js)
// disables. USE_MOCK is read from import.meta.env once at module load, so
// each test stubs the env, resets the module cache, and re-imports fresh.
describe('client.js network-noise wrapping', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.stubEnv('VITE_USE_MOCK', 'false');
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('a timed-out request rejects with an empty message and isNetworkNoise, and logs', async () => {
    const logMock = vi.fn();
    vi.doMock('../utils/log', () => ({ logIssue: logMock }));
    global.fetch = vi.fn(() => {
      const err = new Error('The operation was aborted.');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const { getProviders } = await import('../api/client');
    await expect(getProviders()).rejects.toMatchObject({ message: '', isNetworkNoise: true });

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0][0]).toBe('timeout');
  });

  it('an offline/failed-fetch request rejects with an empty message and isNetworkNoise, and logs', async () => {
    const logMock = vi.fn();
    vi.doMock('../utils/log', () => ({ logIssue: logMock }));
    global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

    const { getProviders } = await import('../api/client');
    await expect(getProviders()).rejects.toMatchObject({ message: '', isNetworkNoise: true });

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0][0]).toBe('offline');
  });

  it('never produces the old diagnostic strings', async () => {
    vi.doMock('../utils/log', () => ({ logIssue: vi.fn() }));
    global.fetch = vi.fn(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const { getProviders } = await import('../api/client');
    try {
      await getProviders();
      expect.unreachable('expected getProviders() to reject');
    } catch (err) {
      expect(err.message).not.toMatch(/taking longer than usual/i);
      expect(err.message).not.toMatch(/couldn't connect/i);
    }
  });

  it('a genuine server error (not a network failure) is left untouched — real message, no noise flag', async () => {
    vi.doMock('../utils/log', () => ({ logIssue: vi.fn() }));
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({ detail: 'Provider not found' }),
    }));

    const { getProviders } = await import('../api/client');
    await expect(getProviders()).rejects.toMatchObject({
      message: 'Provider not found',
      status: 404,
    });
  });
});
