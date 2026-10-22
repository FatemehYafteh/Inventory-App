import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { formatDate, formatDateTime, formatNumber, formatPrice } from './format';

afterEach(() => i18n.changeLanguage('en'));

describe('format', () => {
  it('writes Latin digits and the Gregorian calendar in English', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatPrice(1234.5)).toBe('$1,234.50');
    expect(formatDate('2026-10-14T12:00:00Z')).toBe('Oct 14, 2026');
    expect(formatDateTime('2026-10-14T12:00:00Z')).toMatch(/^Oct 14, 2026, /);
  });

  it('writes Persian digits and the Jalali calendar in Persian', async () => {
    await i18n.changeLanguage('fa');

    expect(formatNumber(1234567)).toBe('۱٬۲۳۴٬۵۶۷');
    expect(formatPrice(1234.5)).toMatch(/۱٬۲۳۴٫۵۰/);
    // 14 October 2026 is 22 Mehr 1405.
    expect(formatDate('2026-10-14T12:00:00Z')).toBe('۲۲ مهر ۱۴۰۵');
    expect(formatDateTime('2026-10-14T12:00:00Z')).toMatch(/^۲۲ مهر ۱۴۰۵/);
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
