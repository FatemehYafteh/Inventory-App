import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// css: false in the Vitest config empties CSS imports, so read the file directly.
const css = readFileSync(resolve(import.meta.dirname, '../index.css'), 'utf8').replaceAll(
  '\r\n',
  '\n',
);

function block(selector) {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`Missing ${selector} block in index.css`);
  return css.slice(start, css.indexOf('\n}', start));
}

function parse(selector) {
  const tokens = {};
  for (const [, name, value] of block(selector).matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

const themes = { light: parse(':root'), dark: parse('.dark') };

// Only --overlay (alpha, not a text surface) and --radius are not colours.
const NOT_HEX = new Set(['overlay', 'radius']);

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground token, background token, minimum ratio]. 4.5 = text, 3 = non-text UI (borders, rings).
const PAIRS = [
  ['foreground', 'background', 4.5],
  ['card-foreground', 'card', 4.5],
  ['popover-foreground', 'popover', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'card', 4.5],
  ['muted-foreground', 'muted', 4.5],
  ['secondary-foreground', 'secondary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  // Text on a primary fill is checked here; the fill itself against the card is checked below.
  ['primary-foreground', 'primary', 4.5],
  ['primary-foreground', 'primary-hover', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  // Primary-coloured text (links) must use --primary-text, never --primary.
  ['primary-text', 'card', 4.5],
  ['primary-text', 'background', 4.5],
  ['placeholder', 'card', 4.5],
  ['input', 'card', 3],
  ['input', 'background', 3],
  ['ring', 'card', 3],
  ['ring', 'background', 3],
  ['sidebar-foreground', 'sidebar', 4.5],
  ['sidebar-muted', 'sidebar', 4.5],
  ['sidebar-accent-foreground', 'sidebar-accent', 4.5],
  ['sidebar-ring', 'sidebar', 3],
  ...['success', 'warning', 'danger', 'neutral'].flatMap((s) => [
    [s, `${s}-soft`, 4.5],
    [s, 'card', 4.5],
  ]),
];

describe('design tokens', () => {
  it('defines the same tokens in both themes', () => {
    // --radius is theme-independent, so it only lives in :root.
    const names = (t) =>
      Object.keys(t)
        .filter((n) => n !== 'radius')
        .sort();
    expect(names(themes.dark)).toEqual(names(themes.light));
  });

  describe.each(Object.keys(themes))('%s theme', (theme) => {
    const tokens = themes[theme];

    it('uses 6-digit hex for every colour', () => {
      for (const [name, value] of Object.entries(tokens)) {
        if (NOT_HEX.has(name) || name === 'color-scheme') continue;
        expect(value, `--${name}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it.each(PAIRS)('--%s on --%s is at least %s:1', (fg, bg, min) => {
      expect(tokens[fg], `--${fg}`).toBeDefined();
      expect(tokens[bg], `--${bg}`).toBeDefined();
      expect(ratio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
    });
  });

  // Non-text only: the edge of a primary shape against the card. Never use --primary for text.
  // Known low-margin pair: dark #2563eb on #111b2e is 3.33:1 (WCAG 1.4.11 needs 3:1).
  it.each(Object.keys(themes))(
    '%s --primary against --card is at least 3:1 (non-text only)',
    (theme) => {
      const t = themes[theme];
      expect(ratio(t.primary, t.card)).toBeGreaterThanOrEqual(3);
    },
  );
});
