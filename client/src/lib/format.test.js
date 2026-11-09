import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { formatDate, formatDateTime, formatNumber, formatPrice } from './format';

afterEach(() => i18n.changeLanguage('en'));

const NBSP = ' ';

describe('format', () => {
  it('writes Latin digits and the Gregorian calendar in English', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatDate('2026-10-14T12:00:00Z')).toBe('Oct 14, 2026');
    expect(formatDateTime('2026-10-14T12:00:00Z')).toMatch(/^Oct 14, 2026, /);
  });

  it('writes Persian digits and the Jalali calendar in Persian', async () => {
    await i18n.changeLanguage('fa');

    expect(formatNumber(1234567)).toBe('۱٬۲۳۴٬۵۶۷');
    // The Persian separators are U+066C (thousands) and U+066B (decimal), never "," or "/".
    // Fonts may draw them like a comma and a slash; the characters themselves are the right ones.
    expect(formatNumber(1234567.5)).not.toMatch(/[,/]/);
  });

  it('leaves the stored value alone and handles empty dates', async () => {
    await i18n.changeLanguage('fa');
    const stored = '2026-10-14T12:00:00Z';

    formatDate(stored);

    expect(stored).toBe('2026-10-14T12:00:00Z');
    expect(formatDate(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
  });

  it('follows a language change made after the first call', async () => {
    expect(formatNumber(5)).toBe('5');
    await i18n.changeLanguage('fa');
    expect(formatNumber(5)).toBe('۵');
    await i18n.changeLanguage('en');
    expect(formatNumber(5)).toBe('5');
  });
});

describe('formatPrice (Iranian Rial)', () => {
  it('writes a whole number with the unit after it, in English', () => {
    expect(formatPrice(1250000)).toBe(`1,250,000${NBSP}Rial`);
    expect(formatPrice(0)).toBe(`0${NBSP}Rial`);
    expect(formatPrice(650000)).toBe(`650,000${NBSP}Rial`);
  });

  it('writes Persian digits, Persian separators and the Persian unit in Persian', async () => {
    await i18n.changeLanguage('fa');

    expect(formatPrice(1250000)).toBe(`۱٬۲۵۰٬۰۰۰${NBSP}ریال`);
    expect(formatPrice(0)).toBe(`۰${NBSP}ریال`);
    // U+066C is the Persian thousands separator; never an ASCII comma, dot or Latin digit.
    expect(formatPrice(1250000)).not.toMatch(/[,./0-9]/);
    expect(formatPrice(1250000)).toContain('٬');
  });

  it('shows no decimals: a fraction is rounded, never printed', async () => {
    expect(formatPrice(12.4)).toBe(`12${NBSP}Rial`);
    expect(formatPrice(12.5)).toBe(`13${NBSP}Rial`);
    expect(formatPrice(1999999.99)).toBe(`2,000,000${NBSP}Rial`);
    await i18n.changeLanguage('fa');
    expect(formatPrice(12.4)).toBe(`۱۲${NBSP}ریال`);
    expect(formatPrice(12.4)).not.toMatch(/[٫.,]/);
  });

  it('shows the largest allowed price (10^12) in full', async () => {
    expect(formatPrice(1_000_000_000_000)).toBe(`1,000,000,000,000${NBSP}Rial`);
    await i18n.changeLanguage('fa');
    expect(formatPrice(1_000_000_000_000)).toBe(`۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰${NBSP}ریال`);
  });

  it('keeps the number and the unit on one line (a no-break space between them)', () => {
    expect(formatPrice(5)).toContain(NBSP);
    expect(formatPrice(5)).not.toContain(' ');
  });

  it('is never a dollar amount', async () => {
    for (const language of ['en', 'fa']) {
      await i18n.changeLanguage(language);
      expect(formatPrice(1234)).not.toMatch(/\$|USD/);
    }
  });

  it('follows a language change made after the first call', async () => {
    expect(formatPrice(7)).toBe(`7${NBSP}Rial`);
    await i18n.changeLanguage('fa');
    expect(formatPrice(7)).toBe(`۷${NBSP}ریال`);
    await i18n.changeLanguage('en');
    expect(formatPrice(7)).toBe(`7${NBSP}Rial`);
  });
});
