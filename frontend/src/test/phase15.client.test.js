import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function liveClient() {
  vi.resetModules();
  vi.stubEnv('VITE_USE_MOCK', 'false');
  return import('../api/client');
}

describe('Phase 15 API client live contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uploads file and folder as multipart without forcing a JSON content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://cdn.example/receipt.png', public_id: 'receipts/1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = await liveClient();
    client.setToken('test-token');
    const file = new File(['receipt'], 'receipt.png', { type: 'image/png' });

    await client.uploadFile(file, 'receipts');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/uploads');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ Authorization: 'Bearer test-token' });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('file')).toBe(file);
    expect(options.body.get('folder')).toBe('receipts');
  });

  it('normalizes the backend nested 402 detail for paid-circle handling', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: new Headers(),
      json: async () => ({
        detail: {
          message: 'Paid circle — subscription required',
          price_etb: 350,
          circle_id: 'circle-1',
        },
      }),
    }));
    const client = await liveClient();

    await expect(client.joinCircle('circle-1')).rejects.toMatchObject({
      message: 'Paid circle — subscription required',
      status: 402,
      payload: { price_etb: 350, circle_id: 'circle-1' },
    });
  });

  it('uses the filtered Strava response keys when UserResponse omits visibility', async () => {
    const responses = [
      { connected: true, stats: { distance: 12.5, activity_count: 3 } },
      { id: 'user-1', health_app_connected: true },
    ];
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => responses[0] })
      .mockResolvedValueOnce({ ok: true, json: async () => responses[1] }));
    const client = await liveClient();

    await expect(client.getStravaStats()).resolves.toMatchObject({
      connected: true,
      distance: 12.5,
      activity_count: 3,
      visible_stats: ['distance', 'activity_count'],
    });
  });
});
