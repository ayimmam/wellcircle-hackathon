import { getTelegramLoginConfig } from '@shared/api/client';

const SCRIPT_ID = 'wellcircle-telegram-login-sdk';
const SDK_URL = 'https://telegram.org/js/telegram-widget.js?22';
let prepared;
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

function loadSdk() {
  if (window.Telegram?.Login?.auth) return Promise.resolve(window.Telegram.Login);
  return new Promise((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID);
    const created = !script;
    if (!script) { script = document.createElement('script'); script.id = SCRIPT_ID; script.src = SDK_URL; script.async = true; }
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      script.removeEventListener('load', loaded);
      script.removeEventListener('error', failed);
    };
    const failed = () => {
      cleanup();
      script.remove();
      reject(new Error('Telegram sign-in could not load. Check your connection or use Google.'));
    };
    const loaded = () => {
      if (!window.Telegram?.Login?.auth) { failed(); return; }
      cleanup(); resolve(window.Telegram.Login);
    };
    timer = setTimeout(failed, 15000);
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', failed, { once: true });
    if (created) document.head.appendChild(script);
  });
}

export function prepareTelegramLogin() {
  if (USE_MOCK) return Promise.resolve({
    botId: 8839515595,
    sdk: { auth: (_options, callback) => callback({ id: 100000002, first_name: 'Demo', username: 'demo_telegram_user', auth_date: Math.floor(Date.now() / 1000), hash: 'mock' }) },
  });
  if (!prepared) {
    prepared = Promise.all([getTelegramLoginConfig(), loadSdk()]).then(([config, sdk]) => {
      if (!Number.isSafeInteger(config?.bot_id) || config.bot_id <= 0) {
        throw new Error('Telegram sign-in is unavailable. Please use Google or contact support.');
      }
      return { sdk, botId: config.bot_id };
    }).catch(error => { prepared = null; throw error; });
  }
  return prepared;
}

export async function signInWithTelegram() {
  const { sdk, botId } = await prepareTelegramLogin();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Telegram sign-in did not finish. Allow the login pop-up and try again.')), 180000);
    try {
      // The official SDK handles auth_result envelopes, popup source checks,
      // cancellation and the cookie-based callback when the popup closes.
      sdk.auth({ bot_id: botId }, data => {
        clearTimeout(timer);
        if (!data || !Number.isSafeInteger(data.id) || !data.auth_date || !data.hash) {
          reject(new Error('Telegram sign-in was cancelled or expired. Please try again.'));
          return;
        }
        resolve(data);
      });
    } catch {
      clearTimeout(timer);
      reject(new Error('Telegram sign-in could not open. Allow pop-ups or use Google.'));
    }
  });
}
