import { SESSION_EXPIRED_EVENT } from '@shared/utils/platform';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('uses the cPanel backend directly and expires a rejected browser session', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false');
  vi.stubEnv('PROD', true);
  vi.stubEnv('VITE_API_BASE_URL', '');
  vi.resetModules();
  const api = await import('@shared/api/client');
  expect(api.getApiBase()).toBe('https://wellcircle-hackathon-backend.vercel.app/api');
  api.setToken('test-web-token');
  const expired = vi.fn();
  window.addEventListener(SESSION_EXPIRED_EVENT, expired);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: 'Expired' }), headers: new Headers() }));
  await expect(api.getMe({ uncached: true })).rejects.toMatchObject({ status: 401 });
  expect(expired).toHaveBeenCalledTimes(1);
  expired.mockClear();
  await expect(api.authTelegramWidget({})).rejects.toMatchObject({ status: 401 });
  expect(expired).not.toHaveBeenCalled();
  window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
});
