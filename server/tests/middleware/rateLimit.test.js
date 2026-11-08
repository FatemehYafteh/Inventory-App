import { describe, expect, it } from 'vitest';
import { emailKey } from '../../src/middleware/rateLimit.js';

describe('emailKey', () => {
  it('keys by the normalized email', () => {
    expect(emailKey({ body: { email: ' Pat@Example.com ' }, ip: '1.2.3.4' })).toBe(
      'email:pat@example.com',
    );
  });

  it('falls back to the IP when there is no email', () => {
    expect(emailKey({ body: {}, ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
    expect(emailKey({ body: { email: '' }, ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
    expect(emailKey({ body: { email: 42 }, ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
    expect(emailKey({ ip: '5.6.7.8' })).toBe('ip:5.6.7.8');
  });
});
