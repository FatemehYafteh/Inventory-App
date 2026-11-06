import { describe, expect, it } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it('gives two Latin initials for a Latin name', () => {
    expect(initials('Fatemeh Yafteh')).toBe('FY');
    expect(initials('  ada   king lovelace ')).toBe('AK');
    expect(initials('Madonna')).toBe('M');
  });

  it('gives only the first letter of the first word for Persian and Arabic names', () => {
    expect(initials('فاطمه یافته')).toBe('ف');
    expect(initials('محمد علي')).toBe('م');
  });

  it('falls back to a question mark when there is no name', () => {
    expect(initials('')).toBe('?');
    expect(initials(undefined)).toBe('?');
  });
});
