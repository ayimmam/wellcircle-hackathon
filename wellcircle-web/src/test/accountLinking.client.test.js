import { clearAll as clearApiCache } from '@shared/api/cache';

// Exercise the real request wiring (paths, verbs, bodies, headers) for the
// account-linking helpers. The UI suite mocks these functions, so this file
// is the guard against a typo in the backend contract.
async function loadClient() {
  vi.stubEnv('VITE_USE_MOCK', 'false');
  vi.stubEnv('PROD', true);
  vi.stubEnv('VITE_API_BASE_URL', '');
  vi.stubEnv('VITE_APP_SURFACE', 'web');
  vi.resetModules();
  return import('@shared/api/client');
}

function okJson(body) {
  return { ok: true, status: 200, json: async () => body, headers: new Headers() };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  clearApiCache();
});

it('calls the documented linking endpoints with the signed-in JWT', async () => {
  const api = await loadClient();
  api.setToken('jwt-token');
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(okJson({ identities: [] }))
    .mockResolvedValueOnce(okJson({ challenge_id: 'challenge-1', provider: 'google' }))
    .mockResolvedValueOnce(okJson({ challenge_id: 'challenge-1', provider: 'google', subject: 'sub', email: 'member@example.com' }))
    .mockResolvedValueOnce(okJson({ linked: true, already_linked: false, identities: [] }));
  vi.stubGlobal('fetch', fetchMock);

  await api.getMyIdentities();
  await api.startIdentityLink('google');
  await api.verifyIdentityLink('challenge/1', { google_id_token: 'id-token-value' });
  await api.confirmIdentityLink('challenge/1');

  const base = 'https://wellcircle-hackathon-backend.vercel.app/api';
  expect(fetchMock).toHaveBeenNthCalledWith(1, `${base}/users/me/identities`, expect.objectContaining({
    method: 'GET',
    headers: expect.objectContaining({ Authorization: 'Bearer jwt-token' }),
  }));
  expect(fetchMock).toHaveBeenNthCalledWith(2, `${base}/auth/linking/challenges`, expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ provider: 'google' }),
  }));
  expect(fetchMock).toHaveBeenNthCalledWith(3, `${base}/auth/linking/challenges/challenge%2F1/verify`, expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ google_id_token: 'id-token-value' }),
  }));
  expect(fetchMock).toHaveBeenNthCalledWith(4, `${base}/auth/linking/challenges/challenge%2F1/confirm`, expect.objectContaining({
    method: 'POST',
  }));
});

it('surfaces Retry-After from a rate-limited response', async () => {
  const api = await loadClient();
  api.setToken('jwt-token');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status: 429,
    json: async () => ({ detail: 'Too many attempts' }),
    headers: new Headers({ 'Retry-After': '42' }),
  }));

  await expect(api.startIdentityLink('telegram')).rejects.toMatchObject({
    status: 429,
    retryAfter: 42,
  });
});

it('never persists or logs provider proofs', async () => {
  const api = await loadClient();
  api.setToken('jwt-token');
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(okJson({ challenge_id: 'challenge-2', provider: 'google' }))
    .mockResolvedValueOnce(okJson({ challenge_id: 'challenge-2', provider: 'google', subject: 'sub' }));
  vi.stubGlobal('fetch', fetchMock);

  await api.startIdentityLink('google');
  await api.verifyIdentityLink('challenge-2', { google_id_token: 'super-secret-id-token' });

  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
  expect(log).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});
