import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Manages the Telegram native BackButton visibility + closing confirmation.
 *
 * - On Home (/home, /):
 *   Hides the native BackButton and enables closing confirmation so
 *   the app only exits here.
 *
 * - On all other screens:
 *   Shows the native BackButton.
 */
export default function useUniversalBackButton() {
  const location = useLocation();
  const isHome = location.pathname === '/home' || location.pathname === '/';

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    if (isHome) {
      // Home screen: hide back button, enable close confirmation
      tg.BackButton?.hide();
      tg.enableClosingConfirmation?.();
    } else {
      // Any other screen: show back button, disable close confirmation.
      tg.BackButton?.show();
      tg.disableClosingConfirmation?.();
    }
  }, [isHome]);
}
