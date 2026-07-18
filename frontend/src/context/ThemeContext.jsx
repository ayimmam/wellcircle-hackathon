import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'wellcircle-theme';
const ACCENT_STORAGE_KEY = 'wellcircle-accent';

// Selectable accent palettes — must match the [data-accent="..."] blocks in
// index.css. 'blue' is the Telegram UI Kit default baked into the theme
// blocks, so it needs no data-accent attribute. `swatch` is only for the
// picker UI dot; the real component colors come from the CSS variables.
export const ACCENTS = [
  { key: 'blue', swatch: '#007AFF' },
  { key: 'gold', swatch: '#F5A623' },
  { key: 'green', swatch: '#059669' },
  { key: 'purple', swatch: '#8B5CF6' },
  { key: 'rose', swatch: '#E11D48' },
];

const ACCENT_KEYS = ACCENTS.map((a) => a.key);

const ThemeContext = createContext(null);

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
}

function getInitialAccent() {
  if (typeof window === 'undefined') return 'blue';
  const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
  if (ACCENT_KEYS.includes(saved)) return saved;
  return 'blue';
}

function syncTelegramChrome(theme) {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  const color = theme === 'dark' ? '#0A0A0F' : '#F5F6FA';
  tg.setHeaderColor?.(color);
  tg.setBackgroundColor?.(color);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [accent, setAccentState] = useState(getInitialAccent);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    syncTelegramChrome(theme);
  }, [theme]);

  useEffect(() => {
    if (accent === 'blue') {
      delete document.documentElement.dataset.accent;
    } else {
      document.documentElement.dataset.accent = accent;
    }
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  }, [accent]);

  const toggleTheme = () => setTheme((current) => (current === 'light' ? 'dark' : 'light'));

  const setAccent = (next) => {
    if (ACCENT_KEYS.includes(next)) setAccentState(next);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark', accent, setAccent }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
