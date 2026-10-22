import { describe, expect, it } from 'vitest';

const files = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' });

/** { language: { area: content } } from the glob. */
function byLanguage() {
  const result = {};
  for (const [path, content] of Object.entries(files)) {
    const [, language, area] = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
    (result[language] ??= {})[area] = content;
  }
  return result;
}

/** Flat map of dotted key to text for a nested object. */
function flatten(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]],
  );
}

const placeholders = (text) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
const tags = (text) => [...text.matchAll(/<\/?(\w+)\s*\/?>/g)].map((m) => m[1]).sort();

const { en, fa } = byLanguage();

describe('Translation files', () => {
  it('has the same area files in English and Persian', () => {
    expect(Object.keys(fa).sort()).toEqual(Object.keys(en).sort());
  });

  for (const area of Object.keys(en)) {
    describe(area, () => {
      const english = Object.fromEntries(flatten(en[area]));
      const persian = Object.fromEntries(flatten(fa[area] ?? {}));

      it('has the same keys in both languages', () => {
        expect(Object.keys(persian).sort()).toEqual(Object.keys(english).sort());
      });

      it('has no empty text', () => {
        for (const [key, text] of [...Object.entries(english), ...Object.entries(persian)]) {
          expect(typeof text, key).toBe('string');
          expect(text.trim(), key).not.toBe('');
        }
      });

      it('uses the same placeholders and markup tags in both languages', () => {
        for (const [key, text] of Object.entries(english)) {
          if (persian[key] === undefined) continue;
          expect(placeholders(persian[key]), key).toEqual(placeholders(text));
          expect(tags(persian[key]), key).toEqual(tags(text));
        }
      });

      it('has Persian text, not a copy of the English', () => {
        // Allow brand names, codes and similar that are legitimately the same in both.
        const copies = Object.keys(english).filter(
          (key) => persian[key] === english[key] && /[A-Za-z]{4,}/.test(english[key]),
        );
        expect(copies).toEqual([]);
      });
    });
  }
});
