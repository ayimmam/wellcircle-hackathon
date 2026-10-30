import { getTelegramLoginConfig } from '@shared/api/client';
vi.mock('@shared/api/client', () => ({ getTelegramLoginConfig: vi.fn() }));
const USER = { id: 123456789, first_name: 'Member', auth_date: 1700000000, hash: 'signed-by-telegram' };
beforeEach(() => {
  vi.resetModules(); vi.stubEnv('VITE_USE_MOCK', 'false');
  getTelegramLoginConfig.mockReset().mockResolvedValue({ bot_id: 8839515595 });
  window.Telegram = { Login: { auth: vi.fn((_options, callback) => callback(USER)) } };
  document.getElementById('wellcircle-telegram-login-sdk')?.remove();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); delete window.Telegram; document.getElementById('wellcircle-telegram-login-sdk')?.remove(); });
it('uses the backend bot ID and the official SDK callback payload', async () => {
  const { signInWithTelegram } = await import('../utils/telegramLogin');
  expect(await signInWithTelegram()).toEqual(USER);
  expect(window.Telegram.Login.auth).toHaveBeenCalledWith({ bot_id: 8839515595 }, expect.any(Function));
});
it('does not accept cancelled Telegram authorization', async () => {
  window.Telegram.Login.auth.mockImplementation((_options, callback) => callback(false));
  const { signInWithTelegram } = await import('../utils/telegramLogin');
  await expect(signInWithTelegram()).rejects.toThrow('cancelled or expired');
});
it('rejects an invalid backend bot configuration and permits retry', async () => {
  getTelegramLoginConfig.mockResolvedValueOnce({ bot_id: 'stale-or-invalid' });
  const { signInWithTelegram } = await import('../utils/telegramLogin');
  await expect(signInWithTelegram()).rejects.toThrow('unavailable');
  expect(window.Telegram.Login.auth).not.toHaveBeenCalled();
  expect(await signInWithTelegram()).toEqual(USER);
});
it('loads the official SDK when absent and retries after a network failure', async () => {
  delete window.Telegram;
  let script;
  vi.spyOn(document.head, 'appendChild').mockImplementation(node => { script = node; return node; });
  const { prepareTelegramLogin } = await import('../utils/telegramLogin');
  const first = prepareTelegramLogin();
  expect(script.src).toBe('https://telegram.org/js/telegram-widget.js?22');
  script.dispatchEvent(new Event('error'));
  await expect(first).rejects.toThrow('could not load');
  const next = prepareTelegramLogin();
  window.Telegram = { Login: { auth: vi.fn() } };
  script.dispatchEvent(new Event('load'));
  expect(await next).toMatchObject({ botId: 8839515595 });
});
it('does not leave the login waiting forever when a popup is blocked', async () => {
  vi.useFakeTimers();
  window.Telegram.Login.auth.mockImplementation(() => {});
  const { signInWithTelegram } = await import('../utils/telegramLogin');
  const promise = signInWithTelegram();
  const rejection = expect(promise).rejects.toThrow('Allow the login pop-up');
  await vi.advanceTimersByTimeAsync(180000);
  await rejection;
});
