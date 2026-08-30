import { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

export function useTelegramHeaderColor(color) {
  const { theme } = useTheme();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.setHeaderColor) return;
    
    try {
      tg.setHeaderColor(color);
    } catch (e) {
      console.warn('Failed to set header color:', e);
    }
    
    return () => {
      try {
        tg.setHeaderColor(theme === 'dark' ? '#0A0A0F' : '#F5F6FA');
      } catch (e) {
        // Ignore fallback errors
      }
    };
  }, [color, theme]);
}
