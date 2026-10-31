import { useEffect, useSyncExternalStore } from 'react';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readTheme,
  resolveTheme,
  systemQuery,
  writeTheme,
} from './theme';

// The choice lives here so every switcher on the page (sidebar and mobile menu) agrees, even
// when the browser refuses to store it.
let preference = readTheme();
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function change(theme) {
  if (theme === preference) return;
  preference = theme;
  applyTheme(theme);
  listeners.forEach((listener) => listener());
}

/** Keeps <html> in step with the saved choice, the OS setting and other tabs. Mount once. */
export function useThemeSync() {
  useEffect(() => {
    // Re-read in case storage changed before this mounted.
    const stored = readTheme();
    if (stored !== preference) change(stored);
    else applyTheme(preference);

    const query = systemQuery();
    const onSystem = () => {
      if (preference === 'system') applyTheme('system');
    };
    const onStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) change(readTheme());
    };
    query?.addEventListener('change', onSystem);
    window.addEventListener('storage', onStorage);
    return () => {
      query?.removeEventListener('change', onSystem);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
}

/** The saved choice, what it resolves to now, and a function that changes it. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => preference);
  return {
    theme,
    resolved: resolveTheme(theme),
    setTheme: (next) => {
      writeTheme(next);
      change(next);
    },
  };
}
