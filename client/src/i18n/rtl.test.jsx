import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import i18n, { directionOf } from '@/i18n';
import { renderApp } from '@/test/render';

// Physical utilities that do not flip in a right-to-left page. `left-1/2` is allowed: it centres
// a dialog together with its -translate-x-1/2.
const PHYSICAL = new RegExp(
  [
    /(?<![\w-])(?:ml|mr|pl|pr)-(?:\d|\[|auto|px)/,
    /(?<![\w-])text-(?:left|right)(?![\w-])/,
    /(?<![\w-])border-[lr](?![a-z])/,
    /(?<![\w-])rounded-(?:[lr]|t[lr]|b[lr])(?![a-z])/,
    /(?<![\w-])(?:left|right)-(?!1\/2)[\d[]/,
    /(?<![\w-])space-x-/,
  ]
    .map((pattern) => pattern.source)
    .join('|'),
);

const sources = import.meta.glob(['/src/**/*.jsx', '!/src/**/*.test.jsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('Right-to-left layout', () => {
  it('sets lang and dir on the page from the language', async () => {
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');

    await i18n.changeLanguage('fa');
    expect(document.documentElement).toHaveAttribute('lang', 'fa');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');

    await i18n.changeLanguage('en');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  it("knows each language's direction, and defaults to left to right", () => {
    expect(directionOf('fa')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
    expect(directionOf('xx')).toBe('ltr');
  });

  it('flips the page when the switcher changes the language', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await user.click(await screen.findByRole('button', { name: 'فارسی' }));
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');

    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  it('uses logical (start and end) utilities instead of left and right', () => {
    const offenders = Object.entries(sources).flatMap(([path, text]) =>
      text
        .split('\n')
        .map((line, index) => ({ path, line: index + 1, text: line.trim() }))
        .filter(({ text: line }) => PHYSICAL.test(line)),
    );

    expect(offenders).toEqual([]);
  });
});
