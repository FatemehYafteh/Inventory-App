import { describe, expect, it } from 'vitest';
import { isDemoUser } from './demo';

describe('isDemoUser', () => {
  it('matches the demo email, ignoring case and spaces', () => {
    expect(isDemoUser({ email: 'Admin@Example.com' }, ' admin@example.com ')).toBe(true);
  });

  it('is false for another user, no user, or no demo email', () => {
    expect(isDemoUser({ email: 'ana@example.com' }, 'admin@example.com')).toBe(false);
    expect(isDemoUser(undefined, 'admin@example.com')).toBe(false);
    expect(isDemoUser({ email: null }, 'admin@example.com')).toBe(false);
    expect(isDemoUser({ email: 'admin@example.com' }, undefined)).toBe(false);
    expect(isDemoUser({ email: 'admin@example.com' }, '')).toBe(false);
  });
});
