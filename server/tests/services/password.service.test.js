import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  verifyDummyPassword,
  verifyPassword,
} from '../../src/services/password.service.js';

describe('password.service', () => {
  it('hashes with argon2id and never stores the plain password', async () => {
    const hash = await hashPassword('a-long-secret-password');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('a-long-secret-password');
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('a-long-secret-password');
    expect(await verifyPassword(hash, 'a-long-secret-password')).toBe(true);
    expect(await verifyPassword(hash, 'another-password')).toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'whatever')).toBe(false);
  });

  it('dummy verification always fails', async () => {
    expect(await verifyDummyPassword('dummy-password-for-timing')).toBe(false);
  });
});
