import { useEffect, useRef } from 'react';

/**
 * Per-page hook that wires a specific callback to Telegram's BackButton.
 * 
 * Visibility is managed by the universal useUniversalBackButton hook in
 * App.jsx — this hook only handles the event subscription, not show/hide.
 * This way BookingFlow can wire step-back logic, PublicProfile can wire
 * navigate(-1), etc., without conflicting with the global visibility logic.
 */
export function useTelegramBackButton(onBack) {
  const callbackRef = useRef(onBack);
  callbackRef.current = onBack;

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.BackButton) return;

    const handler = () => callbackRef.current?.();
    tg.onEvent('backButtonClicked', handler);

    return () => {
      tg.offEvent('backButtonClicked', handler);
    };
  }, []); // Stable — callbackRef.current updates without re-subscribing

  return { isAvailable: Boolean(window.Telegram?.WebApp?.BackButton) };
}
