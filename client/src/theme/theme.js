export const THEME_STORAGE_KEY = 'theme';
export const THEMES = ['light', 'dark', 'system'];

// The page background of each theme, shown by mobile browsers behind their toolbar.
// Keep in step with --background in index.css (checked by theme.test.js).
export const THEME_COLORS = { light: '#F8FAFC', dark: '#0B1220' };

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isTheme(value) {
  return THEMES.includes(value);
}

/** The theme kept in this browser, or 'system' (storage can be blocked, empty or invalid). */
export function readTheme() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function writeTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage is only a convenience; the choice still applies until the page closes.
  }
}

/** The media query list for the OS colour scheme, or null where matchMedia is missing. */
export function systemQuery() {
  return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(DARK_QUERY) : null;
}

/** 'light' or 'dark': what the page shows for a saved choice. */
export function resolveTheme(theme) {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return systemQuery()?.matches ? 'dark' : 'light';
}

/**
 * Puts the theme on <html>: the `dark` class (the token set), `color-scheme` (scrollbars and
 * native controls) and the browser's theme-color. The same steps run in the inline script in
 * index.html before the first paint.
 */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return 'light';
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[resolved]);
  return resolved;
}
