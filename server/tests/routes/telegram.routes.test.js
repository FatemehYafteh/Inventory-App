import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { User } from '../../src/models/User.js';
import { handleStart } from '../../src/services/telegramAuth.service.js';
import {
  ORIGIN,
  buildApp,
  createUser,
  parseCookies,
  testConfig,
  testEnv,
  useTestDatabase,
} from '../helpers/setup.js';

useTestDatabase();

function post(app, path) {
  return request(app).post(path).set('Origin', ORIGIN).set('X-Requested-With', 'XMLHttpRequest');
}

function getStatus(app, requestId) {
  return request(app)
    .get('/api/auth/telegram/status')
    .query({ requestId })
    .set('X-Requested-With', 'XMLHttpRequest');
}

/** Clicks Continue with Telegram and returns the request id and the raw start token. */
async function startLogin(app) {
  const res = await post(app, '/api/auth/telegram/start').send({});
  expect(res.status).toBe(201);
  const startToken = new URL(res.body.deepLink).searchParams.get('start');
  return { requestId: res.body.requestId, startToken, res };
}

/** Stands in for pressing Start in Telegram (as the bot and tg:start do); returns the reply. */
function pressStart(startToken, from = {}) {
  return handleStart(
    { startToken, telegramId: '555000111', firstName: 'Nina', lastName: 'Novak', ...from },
    testConfig,
  );
}

function codeIn(reply) {
  return reply.match(/\b(\d{6})\b/)[1];
}

describe('Telegram sign-in', () => {
  it('signs a new Telegram user in as a Placeholder user', async () => {
    const app = buildApp();
    const { requestId, startToken, res: startRes } = await startLogin(app);

    expect(startRes.body.deepLink).toMatch(/^https:\/\/t\.me\/test_bot\?start=/);
    expect((await getStatus(app, requestId)).body).toMatchObject({ status: 'pending' });

    const reply = await pressStart(startToken, { username: 'nina_n' });
    expect(reply).toMatch(/Your sign-in code is \d{6}\./);

    const status = await getStatus(app, requestId);
    expect(status.body).toMatchObject({
      status: 'otp_sent',
      telegramUsername: 'nina_n',
      name: 'Nina Novak',
    });

    const res = await post(app, '/api/auth/telegram/verify').send({
      requestId,
      otp: codeIn(reply),
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      name: 'Nina Novak',
      email: null,
      telegramConnected: true,
      telegramUsername: 'nina_n',
      role: 'staff',
      status: 'pending',
      profileComplete: false,
    });
    const cookies = parseCookies(res);
    expect(cookies.access_token).toBeDefined();
    expect(cookies.refresh_token).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain(cookies.access_token.value);

    const users = await User.find({ telegramId: '555000111' });
    expect(users).toHaveLength(1);
    expect((await getStatus(app, requestId)).body.status).toBe('verified');
  });

  it('signs a known Telegram ID in to its existing User, keeping the name', async () => {
    const app = buildApp();
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    const existing = await createUser({
      name: 'Nina From Email',
      telegramId: '555000111',
      telegramUsername: 'old_handle',
      lockedUntil,
    });

    const { requestId, startToken } = await startLogin(app);
    // The person removed their Telegram username since the last login.
    const reply = await pressStart(startToken, { firstName: 'Changed', username: undefined });
    const res = await post(app, '/api/auth/telegram/verify').send({
      requestId,
      otp: codeIn(reply),
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: existing.id,
      name: 'Nina From Email',
      telegramUsername: null,
      status: 'active',
    });
    expect(await User.countDocuments()).toBe(1);
    const stored = await User.findById(existing._id);
    expect(stored.lockedUntil).toEqual(lockedUntil);
    expect(stored.lastLoginAt).toBeInstanceOf(Date);
  });

  it('uses start tokens and codes once, and reads unknown requests as expired', async () => {
    const app = buildApp();
    const { requestId, startToken } = await startLogin(app);
    const reply = await pressStart(startToken);

    expect(await pressStart(startToken)).toBe(
      'This sign-in link has expired. Go back to the sign-in page and start again.',
    );
    expect(await pressStart(undefined)).toBe(
      'To sign in, open the sign-in page and press Continue with Telegram.',
    );

    const otp = codeIn(reply);
    expect((await post(app, '/api/auth/telegram/verify').send({ requestId, otp })).status).toBe(
      200,
    );
    const again = await post(app, '/api/auth/telegram/verify').send({ requestId, otp });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('INVALID_CODE');
    expect(parseCookies(again).access_token).toBeUndefined();

    expect((await getStatus(app, 'no-such-request')).body).toEqual({ status: 'expired' });
  });

  it('rejects a wrong code without signing in', async () => {
    const app = buildApp();
    const { requestId, startToken } = await startLogin(app);
    const otp = codeIn(await pressStart(startToken));
    const wrong = otp === '000000' ? '111111' : '000000';

    const res = await post(app, '/api/auth/telegram/verify').send({ requestId, otp: wrong });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CODE');
    expect(await User.countDocuments()).toBe(0);
  });

  it('validates the verify body', async () => {
    const res = await post(buildApp(), '/api/auth/telegram/verify').send({
      requestId: 'x',
      otp: '12',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('otp');
  });

  it('limits Continue with Telegram to 20 per hour per IP', async () => {
    const app = buildApp();
    for (let i = 0; i < 20; i += 1) await startLogin(app);
    const res = await post(app, '/api/auth/telegram/start').send({});
    expect(res.status).toBe(429);
  });

  it('refuses a rejected Telegram user without touching their account', async () => {
    const app = buildApp();
    const rejected = await createUser({
      telegramId: '555000111',
      telegramUsername: 'old_handle',
      status: 'rejected',
    });

    const { requestId, startToken } = await startLogin(app);
    const otp = codeIn(await pressStart(startToken, { username: 'new_handle' }));
    const res = await post(app, '/api/auth/telegram/verify').send({ requestId, otp });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Access denied', code: 'ACCOUNT_REJECTED' });
    expect(parseCookies(res).access_token).toBeUndefined();
    const stored = await User.findById(rejected._id);
    expect(stored.telegramUsername).toBe('old_handle');
    expect(stored.lastLoginAt).toBeUndefined();
  });

  it('refuses to build a deep link when no bot username is configured', async () => {
    const config = loadConfig({ ...testEnv, TELEGRAM_BOT_USERNAME: '' });
    const res = await post(createApp(config), '/api/auth/telegram/start').send({});

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('TELEGRAM_UNAVAILABLE');
    expect(res.body).not.toHaveProperty('deepLink');
  });
});
