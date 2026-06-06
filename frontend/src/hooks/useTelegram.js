/**
 * useTelegram — hook for Telegram Mini App SDK.
 * Provides user data, theme params, and SDK methods.
 */
import { useEffect, useState } from 'react';

export function useTelegram() {
  const [webApp, setWebApp] = useState(null);
  const [user, setUser] = useState(null);
  const [initData, setInitData] = useState('');
  const [colorScheme, setColorScheme] = useState('light');
  const [themeParams, setThemeParams] = useState({});

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setWebApp(tg);
      setUser(tg.initDataUnsafe?.user || null);
      setInitData(tg.initData || '');
      setColorScheme(tg.colorScheme || 'light');
      setThemeParams(tg.themeParams || {});
    }
  }, []);

  const close = () => webApp?.close();
  const openLink = (url) => webApp?.openLink(url);
  const showAlert = (msg) => webApp?.showAlert(msg);

  return {
    webApp,
    user,
    initData,
    colorScheme,
    themeParams,
    close,
    openLink,
    showAlert,
    isReady: !!webApp,
  };
}
