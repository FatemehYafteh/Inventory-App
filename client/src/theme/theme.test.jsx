import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_COLORS, THEME_STORAGE_KEY, applyTheme, readTheme, resolveTheme } from './theme';
import { useTheme, useThemeSync } from './useTheme';

// css: false in the Vitest config empties CSS imports, so read the files directly.
const css = readFileSync(resolve(import.meta.dirname, '../index.css'), 'utf8');
const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');

/** A controllable stand-in for the OS colour-scheme query. */
function mockSystem(initialDark) {
  const listeners = new Set();
  const query = {
    matches: initialDark,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  };
  window.matchMedia = vi.fn(() => query);
  return {
    set(dark) {
      query.matches = dark;
      listeners.forEach((listener) => listener({ matches: dark }));
    },
  };
}

const root = document.documentElement;

beforeEach(() => {
  window.localStorage.clear();
  root.classList.remove('dark');
  root.style.colorScheme = '';
  document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#F8FAFC" />');
});

afterEach(() => {
  delete window.matchMedia;
  vi.restoreAllMocks();
  document.querySelector('meta[name="theme-color"]')?.remove();
});

describe('readTheme', () => {
  it('defaults to system when nothing is saved', () => {
    expect(readTheme()).toBe('system');
  });

  it.each(['light', 'dark', 'system'])('reads a saved %s', (value) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
    expect(readTheme()).toBe(value);
  });

  it('ignores an invalid saved value', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readTheme()).toBe('system');
  });

  it('falls back to system when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readTheme()).toBe('system');
  });
});

describe('resolveTheme and applyTheme', () => {
  it('resolves system from the OS setting', () => {
    mockSystem(true);
    expect(resolveTheme('system')).toBe('dark');
    mockSystem(false);
    expect(resolveTheme('system')).toBe('light');
  });

  it('resolves system to light where matchMedia is missing', () => {
    expect(resolveTheme('system')).toBe('light');
  });

  it('puts the class, color-scheme and theme-color on the page', () => {
    applyTheme('dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]').content).toBe(THEME_COLORS.dark);

    applyTheme('light');
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]').content).toBe(THEME_COLORS.light);
  });
});

describe('useTheme', () => {
  it('saves and applies a choice, and shares it between switchers', () => {
    mockSystem(false);
    const { result: a } = renderHook(() => useTheme());
    const { result: b } = renderHook(() => useTheme());
    act(() => a.current.setTheme('dark'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(b.current.theme).toBe('dark');
    act(() => a.current.setTheme('system'));
  });

  it('still applies a choice when storage is blocked', () => {
    mockSystem(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('dark'));
    expect(root.classList.contains('dark')).toBe(true);
    expect(result.current.theme).toBe('dark');
    act(() => result.current.setTheme('system'));
  });
});

describe('useThemeSync', () => {
  it('follows the OS setting while the choice is system, and only then', () => {
    const system = mockSystem(false);
    const { result } = renderHook(() => {
      useThemeSync();
      return useTheme();
    });
    act(() => result.current.setTheme('system'));
    act(() => system.set(true));
    expect(root.classList.contains('dark')).toBe(true);
    act(() => system.set(false));
    expect(root.classList.contains('dark')).toBe(false);

    act(() => result.current.setTheme('light'));
    act(() => system.set(true));
    expect(root.classList.contains('dark')).toBe(false);
    act(() => result.current.setTheme('system'));
  });

  it('follows a change made in another tab', () => {
    mockSystem(false);
    const { result } = renderHook(() => {
      useThemeSync();
      return useTheme();
    });
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    });
    expect(result.current.theme).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
    act(() => result.current.setTheme('system'));
  });
});

describe('the three copies of the theme facts agree', () => {
  it('uses the page background of each theme in THEME_COLORS', () => {
    const light = css.match(/:root \{[\s\S]*?--background:\s*(#\w+);/)[1];
    const dark = css.match(/\.dark \{[\s\S]*?--background:\s*(#\w+);/)[1];
    expect(THEME_COLORS.light.toLowerCase()).toBe(light.toLowerCase());
    expect(THEME_COLORS.dark.toLowerCase()).toBe(dark.toLowerCase());
  });

  it('uses the same storage key and colours in the inline script of index.html', () => {
    expect(html).toContain(`getItem('${THEME_STORAGE_KEY}')`);
    expect(html).toContain(THEME_COLORS.light);
    expect(html).toContain(THEME_COLORS.dark);
  });
});
