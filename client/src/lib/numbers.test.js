import { describe, expect, it } from 'vitest';
import { normalizeDigits, parseNumberInput } from './numbers';

describe('normalizeDigits', () => {
  it('turns Persian and Arabic-Indic digits into Latin ones', () => {
    expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(normalizeDigits('۱۲ab٣')).toBe('12ab3');
  });

  it('turns the Persian decimal separator into a point and drops thousands separators', () => {
    expect(normalizeDigits('۱٬۲۳۴٫۵۰')).toBe('1234.50');
  });

  it('leaves Latin text unchanged', () => {
    expect(normalizeDigits('12.5')).toBe('12.5');
    expect(normalizeDigits('Claw Hammer')).toBe('Claw Hammer');
  });
});

describe('parseNumberInput', () => {
  it('reads Latin, Persian and Arabic-Indic numbers', () => {
    expect(parseNumberInput('12')).toBe(12);
    expect(parseNumberInput(' ۱۲٫۵ ')).toBe(12.5);
    expect(parseNumberInput('٣')).toBe(3);
    expect(parseNumberInput('0')).toBe(0);
  });

  it('gives NaN for empty or unreadable text, like a number input did', () => {
    expect(parseNumberInput('')).toBeNaN();
    expect(parseNumberInput('   ')).toBeNaN();
    expect(parseNumberInput('abc')).toBeNaN();
  });
});
