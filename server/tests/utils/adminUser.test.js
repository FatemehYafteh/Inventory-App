import { describe, expect, it } from 'vitest';
import { maskEmail, maskUsername } from '../../src/utils/adminUser.js';

describe('maskEmail', () => {
  it('keeps the first letter of the name and the domain, and the ending', () => {
    expect(maskEmail('pat@gmail.com')).toBe('p•••@g•••.com');
    expect(maskEmail('Pat.Pending@mail.co.uk')).toBe('P•••@m•••.uk');
    expect(maskEmail('x@localhost')).toBe('x•••@l•••');
  });

  it('handles missing or odd values', () => {
    expect(maskEmail(null)).toBe(null);
    expect(maskEmail('')).toBe(null);
    expect(maskEmail('@bad')).toBe('•••');
  });
});

describe('maskUsername', () => {
  it('keeps only the first letter', () => {
    expect(maskUsername('pat_tg')).toBe('p•••');
    expect(maskUsername(null)).toBe(null);
  });
});
