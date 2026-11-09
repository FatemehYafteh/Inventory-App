import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import {
  DEFAULT_PASSWORD,
  ORIGIN,
  buildApp,
  createUser,
  testConfig,
  useTestDatabase,
} from '../helpers/setup.js';

useTestDatabase();

const post = (app, path) =>
  request(app).post(path).set('Origin', ORIGIN).set('X-Requested-With', 'XMLHttpRequest');
const login = (app, email, password) => post(app, '/api/auth/login').send({ email, password });

/** Sends `count` requests one after another and returns their statuses. */
async function statuses(count, send) {
  const result = [];
  for (let i = 0; i < count; i += 1) result.push((await send(i)).status);
  return result;
}

describe('brute force on login', () => {
  it('locks one account after 5 wrong passwords: the right password is then refused too', async () => {
    const app = buildApp();
    const user = await createUser({ email: 'target@example.com' });

    const wrong = await statuses(5, () => login(app, user.email, 'wrong-password-123'));
    expect(wrong).toEqual([401, 401, 401, 401, 401]);
    expect((await User.findById(user._id)).lockedUntil).toBeInstanceOf(Date);

    const withRightPassword = await login(app, user.email, DEFAULT_PASSWORD);
    expect(withRightPassword.status).toBe(401);
    expect(withRightPassword.body.code).toBe('INVALID_CREDENTIALS');
    expect(withRightPassword.headers['set-cookie']).toBeUndefined();
  });

  it('stops a password guesser at 10 attempts per email, before any 11th guess is checked', async () => {
    const app = buildApp();
    await createUser({ email: 'target@example.com' });

    const result = await statuses(12, () => login(app, 'target@example.com', 'wrong-password-123'));

    expect(result.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(result.slice(10)).toEqual([429, 429]);
  });

  it('stops one IP guessing across many emails at 30 attempts per 15 minutes', async () => {
    const app = buildApp();

    const result = await statuses(32, (i) =>
      login(app, `person${i}@example.com`, 'wrong-password-123'),
    );

    expect(result.slice(0, 30).every((status) => status === 401)).toBe(true);
    expect(result.slice(30)).toEqual([429, 429]);
  }, 60_000);

  it('answers a blocked request with RATE_LIMITED, rate-limit headers and no cookies', async () => {
    const app = buildApp();
    await statuses(10, () => login(app, 'flood@example.com', 'wrong-password-123'));

    const blocked = await login(app, 'flood@example.com', 'wrong-password-123');

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(blocked.headers['ratelimit']).toBeDefined();
    expect(blocked.headers['set-cookie']).toBeUndefined();
  });

  it('a blocked IP cannot sign in even with the right password', async () => {
    const app = buildApp();
    const user = await createUser({ email: 'real@example.com' });
    await statuses(30, (i) => login(app, `x${i}@example.com`, 'wrong-password-123'));

    const res = await login(app, user.email, DEFAULT_PASSWORD);

    expect(res.status).toBe(429);
    expect(res.headers['set-cookie']).toBeUndefined();
  }, 60_000);
});

describe('a spoofed X-Forwarded-For header does not reset a limit', () => {
  it('with no trusted proxy (the default), the header is ignored', async () => {
    const app = buildApp();
    await createUser({ email: 'target@example.com' });

    const result = await statuses(12, (i) =>
      login(app, 'target@example.com', 'wrong-password-123').set('X-Forwarded-For', `9.9.9.${i}`),
    );

    // Per-email limit (10) holds, and the per-IP bucket is the socket address, not the header.
    expect(result.slice(10)).toEqual([429, 429]);
  });

  it('behind one trusted proxy (Vercel), only the proxy-appended address counts', async () => {
    const app = createApp({ ...testConfig, trustProxy: 1 });

    // A client-supplied first entry changes on every request; the last one is the real client.
    const result = await statuses(32, (i) =>
      login(app, `person${i}@example.com`, 'wrong-password-123').set(
        'X-Forwarded-For',
        `6.6.6.${i}, 203.0.113.7`,
      ),
    );

    expect(result.slice(0, 30).every((status) => status === 401)).toBe(true);
    expect(result.slice(30)).toEqual([429, 429]);
  }, 60_000);
});

describe('brute force on password reset', () => {
  const guess = (app) =>
    post(app, '/api/auth/reset-password').send({
      token: 'not-a-real-token-not-a-real-token-0000',
      password: 'a-new-long-password-123',
    });

  it('allows 30 reset-token guesses per IP per 15 minutes, then blocks', async () => {
    const app = buildApp();

    const result = await statuses(32, () => guess(app));

    expect(result.slice(0, 30).every((status) => status === 400)).toBe(true);
    expect(result.slice(30)).toEqual([429, 429]);
  }, 120_000);

  it('limits reset emails to 5 per hour per address and per IP (no mail flood)', async () => {
    const app = buildApp();
    const forgot = (email) => post(app, '/api/auth/forgot-password').send({ email });

    const perEmail = await statuses(7, () => forgot('same@example.com'));
    expect(perEmail.slice(0, 5).every((status) => status === 202)).toBe(true);
    expect(perEmail.slice(5)).toEqual([429, 429]);
  });
});

describe('brute force on refresh', () => {
  it('allows 100 refresh attempts per IP per 15 minutes, then blocks', async () => {
    const app = buildApp();

    const result = await statuses(102, () => post(app, '/api/auth/refresh'));

    expect(result.slice(0, 100).every((status) => status === 401)).toBe(true);
    expect(result.slice(100)).toEqual([429, 429]);
  }, 60_000);

  it('a guessed refresh token is refused and sets no cookie', async () => {
    const app = buildApp();
    const res = await post(app, '/api/auth/refresh').set(
      'Cookie',
      'refresh_token=guessed-token-guessed-token-guessed-token',
    );
    expect(res.status).toBe(401);
    expect(String(res.headers['set-cookie'] ?? '')).not.toMatch(/refresh_token=[^;]+[^;]/);
  });
});
