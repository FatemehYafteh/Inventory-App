import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

/** Fakes only Date, so the database driver and supertest keep their real timers. */
function freezeClock() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
}

function advanceClock(ms) {
  vi.setSystemTime(Date.now() + ms);
}

afterEach(() => {
  vi.useRealTimers();
});

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

  it('counts wrong codes and invalidates the code after 3 wrong tries', async () => {
    const app = buildApp();
    const { requestId, startToken } = await startLogin(app);
    const otp = codeIn(await pressStart(startToken));
    const wrong = otp === '000000' ? '111111' : '000000';
    const verify = (code) => post(app, '/api/auth/telegram/verify').send({ requestId, otp: code });

    const first = await verify(wrong);
    expect(first.status).toBe(400);
    expect(first.body).toEqual({ code: 'INVALID_CODE', message: 'Wrong code. 2 tries left.' });
    expect((await getStatus(app, requestId)).body.attemptsLeft).toBe(2);

    expect((await verify(wrong)).body.message).toBe('Wrong code. 1 try left.');
    const third = await verify(wrong);
    expect(third.body).toEqual({ code: 'TOO_MANY_ATTEMPTS', message: 'Too many wrong codes.' });

    // The right code no longer works either.
    const late = await verify(otp);
    expect(late.status).toBe(400);
    expect(late.body.code).toBe('TOO_MANY_ATTEMPTS');
    expect(parseCookies(late).access_token).toBeUndefined();
    expect((await getStatus(app, requestId)).body).toMatchObject({
      status: 'otp_sent',
      attemptsLeft: 0,
    });
  });

  it('rejects a start token after the 10-minute request ends', async () => {
    freezeClock();
    const app = buildApp();
    const { requestId, startToken } = await startLogin(app);

    advanceClock(10 * 60 * 1000);
    expect(await pressStart(startToken)).toBe(
      'This sign-in link has expired. Go back to the sign-in page and start again.',
    );
    expect((await getStatus(app, requestId)).body.status).toBe('expired');
  });

  it('gives parallel guesses no more than 3 tries', async () => {
    const app = buildApp();
    const { requestId, startToken } = await startLogin(app);
    const otp = codeIn(await pressStart(startToken));
    const wrong = otp === '000000' ? '111111' : '000000';

    const guesses = await Promise.all(
      Array.from({ length: 6 }, () =>
        post(app, '/api/auth/telegram/verify').send({ requestId, otp: wrong }),
      ),
    );
    const wrongCodes = guesses.filter((res) => res.body.message?.startsWith('Wrong code.'));
    expect(wrongCodes).toHaveLength(2);

    const res = await post(app, '/api/auth/telegram/verify').send({ requestId, otp });
    expect(res.body.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('expires a code after 2 minutes', async () => {
    freezeClock();
    const app = buildApp();
    const { requestId, startToken } = await startLogin(app);
    const otp = codeIn(await pressStart(startToken));

    expect((await getStatus(app, requestId)).body).toMatchObject({
      codeExpiresIn: 120,
      resendIn: 60,
      attemptsLeft: 3,
    });

    advanceClock(2 * 60 * 1000);
    expect((await getStatus(app, requestId)).body.codeExpiresIn).toBe(0);
    const res = await post(app, '/api/auth/telegram/verify').send({ requestId, otp });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      code: 'INVALID_CODE',
      message: 'This code is invalid or has expired.',
    });
    expect(await User.countDocuments()).toBe(0);
  });

  it('resends a new code 60 s after the last send, invalidating the old one', async () => {
    freezeClock();
    const app = buildApp();
    const { requestId, startToken } = await startLogin(app);
    const oldOtp = codeIn(await pressStart(startToken));
    const resend = () => post(app, '/api/auth/telegram/resend').send({ requestId });
    const verify = (otp) => post(app, '/api/auth/telegram/verify').send({ requestId, otp });

    advanceClock(59 * 1000);
    const early = await resend();
    expect(early.status).toBe(429);
    expect(early.body.code).toBe('RESEND_TOO_SOON');
    expect(app.locals.telegram.outbox).toHaveLength(0);

    // One wrong try, then the resend resets the tries.
    await verify(oldOtp === '000000' ? '111111' : '000000');
    advanceClock(1000);
    const res = await resend();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'otp_sent',
      codeExpiresIn: 120,
      resendIn: 60,
      attemptsLeft: 3,
    });
    const [message] = app.locals.telegram.outbox;
    expect(message.chatId).toBe('555000111');
    expect(message.text).toMatch(/^Your sign-in code is \d{6}\. It expires in 2 minutes\./);
    const newOtp = codeIn(message.text);

    if (newOtp !== oldOtp) {
      expect((await verify(oldOtp)).body.code).toBe('INVALID_CODE');
    }
    expect((await verify(newOtp)).status).toBe(200);
  });

  it('allows a resend after 3 wrong tries', async () => {
    freezeClock();
    const app = buildApp();
    const { requestId, startToken } = await startLogin(app);
    const otp = codeIn(await pressStart(startToken));
    const wrong = otp === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i += 1) {
      await post(app, '/api/auth/telegram/verify').send({ requestId, otp: wrong });
    }

    advanceClock(60 * 1000);
    const res = await post(app, '/api/auth/telegram/resend').send({ requestId });

    expect(res.body).toMatchObject({ status: 'otp_sent', attemptsLeft: 3 });
    const newOtp = codeIn(app.locals.telegram.outbox[0].text);
    const ok = await post(app, '/api/auth/telegram/verify').send({ requestId, otp: newOtp });
    expect(ok.status).toBe(200);
  });

  it('does not extend the 10-minute request when resending', async () => {
    freezeClock();
    const app = buildApp();
    const { requestId, startToken } = await startLogin(app);
    await pressStart(startToken);
    const resend = () => post(app, '/api/auth/telegram/resend').send({ requestId });

    advanceClock(9 * 60 * 1000);
    expect((await resend()).status).toBe(200);
    const before = (await getStatus(app, requestId)).body.expiresAt;

    advanceClock(60 * 1000);
    expect((await getStatus(app, requestId)).body).toMatchObject({
      status: 'expired',
      expiresAt: before,
    });
    const late = await resend();
    expect(late.status).toBe(400);
    expect(late.body.code).toBe('REQUEST_EXPIRED');
  });

  it('refuses to resend for a request that never got a code', async () => {
    const app = buildApp();
    const { requestId } = await startLogin(app);
    const res = await post(app, '/api/auth/telegram/resend').send({ requestId });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REQUEST_EXPIRED');
  });

  it('limits resend to 20 per hour per IP', async () => {
    const app = buildApp();
    for (let i = 0; i < 20; i += 1) {
      await post(app, '/api/auth/telegram/resend').send({ requestId: `unknown-${i}` });
    }
    const res = await post(app, '/api/auth/telegram/resend').send({ requestId: 'unknown' });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
  });

  it('sends at most 5 codes per hour per Telegram ID, counting first sends and resends', async () => {
    freezeClock();
    const app = buildApp();
    const tooMany = 'Too many codes requested. Try again in an hour.';

    // First send on one request, then 3 resends: 4 sends.
    const first = await startLogin(app);
    await pressStart(first.startToken);
    for (let i = 0; i < 3; i += 1) {
      advanceClock(60 * 1000);
      await post(app, '/api/auth/telegram/resend').send({ requestId: first.requestId });
    }
    // A second request for the same Telegram ID makes the 5th send.
    const second = await startLogin(app);
    expect(await pressStart(second.startToken)).toMatch(/^Your sign-in code is/);

    // Over the limit: a resend sends nothing and the request becomes rate_limited.
    advanceClock(60 * 1000);
    const sent = app.locals.telegram.outbox.length;
    const res = await post(app, '/api/auth/telegram/resend').send({
      requestId: second.requestId,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rate_limited');
    expect(app.locals.telegram.outbox).toHaveLength(sent);
    expect((await getStatus(app, second.requestId)).body.status).toBe('rate_limited');

    // A new request for that Telegram ID gets no code either.
    const third = await startLogin(app);
    expect(await pressStart(third.startToken)).toBe(tooMany);
    expect((await getStatus(app, third.requestId)).body).toEqual(
      expect.objectContaining({ status: 'rate_limited' }),
    );
    expect((await getStatus(app, third.requestId)).body).not.toHaveProperty('codeExpiresIn');

    // Another Telegram ID is not affected, and an hour later the first one works again.
    const other = await startLogin(app);
    expect(await pressStart(other.startToken, { telegramId: '555000222' })).toMatch(
      /^Your sign-in code is/,
    );
    advanceClock(60 * 60 * 1000);
    const later = await startLogin(app);
    expect(await pressStart(later.startToken)).toMatch(/^Your sign-in code is/);
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

  it('sends no code to a rejected Telegram user', async () => {
    const app = buildApp();
    const rejected = await createUser({
      telegramId: '555000111',
      telegramUsername: 'old_handle',
      status: 'rejected',
    });

    const { requestId, startToken } = await startLogin(app);
    const reply = await pressStart(startToken, { username: 'new_handle' });

    expect(reply).toBe('Access denied, contact an admin.');
    expect(reply).not.toMatch(/\d{6}/);
    expect((await getStatus(app, requestId)).body.status).toBe('refused');
    const res = await post(app, '/api/auth/telegram/verify').send({ requestId, otp: '123456' });
    expect(res.status).toBe(400);
    expect(parseCookies(res).access_token).toBeUndefined();
    const stored = await User.findById(rejected._id);
    expect(stored.telegramUsername).toBe('old_handle');
  });

  it('refuses a resend once the Telegram user has been rejected', async () => {
    freezeClock();
    const app = buildApp();
    const { requestId, startToken } = await startLogin(app);
    await pressStart(startToken);
    await createUser({ telegramId: '555000111', status: 'rejected' });

    advanceClock(60 * 1000);
    const res = await post(app, '/api/auth/telegram/resend').send({ requestId });

    expect(res.body.status).toBe('refused');
    expect(app.locals.telegram.outbox).toHaveLength(0);
  });

  it('refuses a Telegram user rejected after the code was sent', async () => {
    const app = buildApp();
    const { requestId, startToken } = await startLogin(app);
    const otp = codeIn(await pressStart(startToken, { username: 'new_handle' }));
    const rejected = await createUser({
      telegramId: '555000111',
      telegramUsername: 'old_handle',
      status: 'rejected',
    });
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
