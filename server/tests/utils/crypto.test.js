import { describe, expect, it } from 'vitest';
import { generateSecret } from '../../src/utils/crypto.js';

describe('generateSecret', () => {
  it('returns 32 random bytes as 64 hex characters by default', () => {
    expect(generateSecret()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('honours a custom byte length', () => {
    expect(generateSecret(48)).toMatch(/^[0-9a-f]{96}$/);
  });

  it('returns a different value each call', () => {
    expect(generateSecret()).not.toBe(generateSecret());
  });
});
