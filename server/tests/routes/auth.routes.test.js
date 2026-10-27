import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { User } from '../../src/models/User.js';
import {
  DEFAULT_PASSWORD,
  ORIGIN,
  buildApp,
  createUser,
  parseCookies,
  testConfig,
  useTestDatabase,
} from '../helpers/setup.js';

useTestDatabase();

const GENERIC_LOGIN_ERROR = { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' };

function post(agentOrApp, path) {
  return agentOrApp.post(path).set('Origin', ORIGIN).set('X-Requested-With', 'XMLHttpRequest');
}

function login(agentOrApp, email, password = DEFAULT_PASSWORD) {
  return post(agentOrApp, '/api/auth/login').send({ email, password });
}

describe('POST /api/auth/login', () => {
  it('logs in and sets both session cookies with the right flags', async () => {
    const app = buildApp();
    const user = await createUser({ email: 'ana@example.com' });

    const res = await login(request(app), '  ANA@Example.com ');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: user.id,
      email: 'ana@example.com',
      role: 'staff',
      status: 'active',
      profileComplete: true,
    });

    const cookies = parseCookies(res);
    expect(cookies.access_token.attributes).toEqual(
      expect.arrayContaining(['path=/', 'httponly', 'samesite=strict']),
    );
    expect(cookies.refresh_token.attributes).toEqual(
      expect.arrayContaining(['path=/api/auth', 'httponly', 'samesite=strict']),
    );

    const body = JSON.stringify(res.body);
    expect(body).not.toContain(cookies.access_token.value);
    expect(body).not.toContain(cookies.refresh_token.value);
    expect(body).not.toContain('passwordHash');

    const stored = await User.findById(user._id);
    expect(stored.lastLoginAt).toBeInstanceOf(Date);
    expect(await RefreshToken.countDocuments({ user: user._id })).toBe(1);
  });

  it('gives a pending user a session', async () => {
    const app = buildApp();
    await createUser({ email: 'pending@example.com', status: 'pending' });
    const res = await login(request(app), 'pending@example.com');
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('pending');
  });

  it('returns the same generic error for wrong password, unknown email and unverified email', async () => {
    const app = buildApp();
    await createUser({ email: 'known@example.com' });
    await createUser({ email: 'unverified@example.com', emailVerified: false });
    await createUser({ email: 'nopassword@example.com', password: null, telegramId: '42' });

    const responses = await Promise.all([
      login(request(app), 'known@example.com', 'wrong-password-123'),
      login(request(app), 'nobody@example.com'),
      login(request(app), 'unverified@example.com'),
      login(request(app), 'nopassword@example.com'),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(GENERIC_LOGIN_ERROR);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('locks the account for 15 minutes after 5 consecutive failures', async () => {
    const app = buildApp();
    const user = await createUser({ email: 'lock@example.com' });

    for (let i = 0; i < 5; i += 1) {
      const res = await login(request(app), 'lock@example.com', 'wrong-password-123');
      expect(res.status).toBe(401);
    }

    const locked = await User.findById(user._id);
    expect(locked.lockedUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);

    const withRightPassword = await login(request(app), 'lock@example.com');
    expect(withRightPassword.status).toBe(401);
    expect(withRightPassword.body).toEqual(GENERIC_LOGIN_ERROR);

    await User.updateOne({ _id: user._id }, { lockedUntil: new Date(Date.now() - 1000) });
    const afterLock = await login(request(app), 'lock@example.com');
    expect(afterLock.status).toBe(200);
  });

  it('resets the failure counter after a successful login', async () => {
    const app = buildApp();
    const user = await createUser({ email: 'reset@example.com' });
    for (let i = 0; i < 4; i += 1) {
      await login(request(app), 'reset@example.com', 'wrong-password-123');
    }
    expect((await User.findById(user._id)).failedLoginCount).toBe(4);

    await login(request(app), 'reset@example.com');
    expect((await User.findById(user._id)).failedLoginCount).toBe(0);
  });

  it('refuses a rejected user without issuing tokens', async () => {
    const app = buildApp();
    await createUser({ email: 'rejected@example.com', status: 'rejected' });
    const res = await login(request(app), 'rejected@example.com');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Access denied', code: 'ACCOUNT_REJECTED' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rate limits attempts per email', async () => {
    const app = buildApp();
    const statuses = [];
    for (let i = 0; i < 11; i += 1) {
      const res = await login(request(app), 'flood@example.com', 'wrong-password-123');
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the session cookies', async () => {
    const app = buildApp();
    await createUser({ email: 'rotate@example.com' });
    const agent = request.agent(app);
    const loginRes = await login(agent, 'rotate@example.com');
    const before = parseCookies(loginRes);

    const res = await post(agent, '/api/auth/refresh');

    expect(res.status).toBe(204);
    const after = parseCookies(res);
    expect(after.refresh_token.value).not.toBe(before.refresh_token.value);
    expect(after.access_token.value).toBeTruthy();
    expect((await post(agent, '/api/auth/refresh')).status).toBe(204);
  });

  it('revokes the family and clears cookies when an old refresh token is reused', async () => {
    const app = buildApp();
    await createUser({ email: 'reuse@example.com' });
    const loginRes = await login(request(app), 'reuse@example.com');
    const stolen = parseCookies(loginRes).refresh_token.value;

    const first = await post(request(app), '/api/auth/refresh').set(
      'Cookie',
      `refresh_token=${stolen}`,
    );
    expect(first.status).toBe(204);
    const fresh = parseCookies(first).refresh_token.value;

    const reuse = await post(request(app), '/api/auth/refresh').set(
      'Cookie',
      `refresh_token=${stolen}`,
    );
    expect(reuse.status).toBe(401);
    expect(parseCookies(reuse).refresh_token.value).toBe('');

    const afterReuse = await post(request(app), '/api/auth/refresh').set(
      'Cookie',
      `refresh_token=${fresh}`,
    );
    expect(afterReuse.status).toBe(401);
  });

  it('returns 401 without a refresh cookie', async () => {
    const res = await post(request(buildApp()), '/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_SESSION');
  });

  it('refuses a user who was rejected after logging in', async () => {
    const app = buildApp();
    const user = await createUser({ email: 'later-rejected@example.com' });
    const agent = request.agent(app);
    await login(agent, 'later-rejected@example.com');
    await User.updateOne({ _id: user._id }, { status: 'rejected' });

    const res = await post(agent, '/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token and clears both cookies', async () => {
    const app = buildApp();
    await createUser({ email: 'bye@example.com' });
    const agent = request.agent(app);
    await login(agent, 'bye@example.com');

    const res = await post(agent, '/api/auth/logout');

    expect(res.status).toBe(204);
    const cookies = parseCookies(res);
    expect(cookies.access_token.value).toBe('');
    expect(cookies.refresh_token.value).toBe('');
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user from the access cookie', async () => {
    const app = buildApp();
    await createUser({ email: 'me@example.com', name: 'Me' });
    const agent = request.agent(app);
    await login(agent, 'me@example.com');

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'me@example.com', name: 'Me' });
  });

  it('reads status from the database, not the token', async () => {
    const app = buildApp();
    const user = await createUser({ email: 'status@example.com', status: 'pending' });
    const agent = request.agent(app);
    await login(agent, 'status@example.com');
    await User.updateOne({ _id: user._id }, { status: 'active' });

    const res = await agent.get('/api/auth/me');
    expect(res.body.user.status).toBe('active');

    await User.updateOne({ _id: user._id }, { status: 'rejected' });
    expect((await agent.get('/api/auth/me')).status).toBe(403);
  });

  it('returns 401 without a session', async () => {
    const res = await request(buildApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NOT_AUTHENTICATED');
  });

  it('accepts the x-test-user header in the test environment', async () => {
    const user = await createUser({ email: 'header@example.com' });
    const res = await request(buildApp()).get('/api/auth/me').set('x-test-user', user.id);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('header@example.com');
  });

  it('ignores the x-test-user header outside the test environment', async () => {
    const user = await createUser({ email: 'prod-header@example.com' });
    const app = createApp({ ...testConfig, nodeEnv: 'development', isTest: false });
    const res = await request(app).get('/api/auth/me').set('x-test-user', user.id);
    expect(res.status).toBe(401);
  });
});
