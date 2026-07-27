import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Manages the Telegram native BackButton visibility + closing confirmation.
 *
 * - On ROOT screens (/home, /explore, /community, /profile):
 *   Hides the native BackButton and enables closing confirmation so
 *   the user gets a "are you sure?" prompt from Telegram instead of
 *   an instant close.
 *
 * - On DETAIL screens (everything else):
 *   Shows the native BackButton. Individual pages use the
 *   useTelegramBackButton hook to wire their own back logic.
 *
 * This replaces the broken popstate approach which Telegram's WebView
 * swallows before JavaScript can handle it.
 */
const ROOT_PATHS = ['/home', '/explore', '/community', '/profile'];

export default function useUniversalBackButton() {
  const location = useLocation();
  const isRoot = ROOT_PATHS.includes(location.pathname);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    if (isRoot) {
      // On root screens: hide back button, enable close confirmation
      tg.BackButton?.hide();
      tg.enableClosingConfirmation?.();
    } else {
      // On detail screens: show back button, disable close confirmation.
      // Each detail page uses useTelegramBackButton() to wire its own
      // specific navigate(-1) or step-back logic.
      tg.BackButton?.show();
      tg.disableClosingConfirmation?.();
    }
  }, [isRoot]);
}
