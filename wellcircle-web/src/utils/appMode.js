// App mode detection — generalises the pattern from utils/providerPortal.js.
// Mini App vs web is a capability check, not a hostname check — the Mini App
// is served from the same origin as the web app in some configurations.

export const APP_MODE = {
  MINI_APP: 'mini_app',        // inside Telegram (window.Telegram.WebApp.initData present)
  WEB:      'web',             // app.wellcircle.et (standalone browser)
  PROVIDER: 'provider_portal', // provider.wellcircle.et
};

export function getAppMode() {
  if (typeof window === 'undefined') return APP_MODE.WEB;

  // Provider portal — hostname check
  if (window.location.hostname === 'provider.wellcircle.et') {
    return APP_MODE.PROVIDER;
  }

  // Mini App — capability check, not hostname
  const tg = window.Telegram?.WebApp;
  if (tg?.initData && tg.initData.length > 0) {
    return APP_MODE.MINI_APP;
  }

  // Everything else is the web app
  return APP_MODE.WEB;
}

export const isWebMode = () => getAppMode() === APP_MODE.WEB;
export const isMiniApp = () => getAppMode() === APP_MODE.MINI_APP;
export const isProviderPortal = () => getAppMode() === APP_MODE.PROVIDER;
