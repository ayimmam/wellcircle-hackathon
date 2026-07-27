import { useEffect, useState } from 'react';

export function useTelegramBackButton(onBack) {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg?.BackButton) {
      setIsAvailable(true);
      tg.BackButton.show();
      if (onBack) {
        tg.onEvent('backButtonClicked', onBack);
      }
      return () => {
        if (onBack) {
          tg.offEvent('backButtonClicked', onBack);
        }
        tg.BackButton.hide();
      };
    }
  }, [onBack]);

  return { isAvailable };
}
