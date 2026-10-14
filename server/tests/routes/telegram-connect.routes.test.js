import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailToken } from '../../src/models/EmailToken.js';
import { User } from '../../src/models/User.js';
import { startSession } from '../../src/services/auth.service.js';
import { handleStart } from '../../src/services/telegramAuth.service.js';
import * as tokenService from '../../src/services/token.service.js';
import { ORIGIN, buildApp, createUser, testConfig, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const TELEGRAM_ID = '555000111';

function post(app, path, user) {
  const req = request(app)
    .post(path)
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest');
  if (user) req.set('x-test-user', user.id);
  return req;
}

function getStatus(app, requestId, user) {
  const req = request(app).get('/api/auth/telegram/status').query({ requestId });
  if (user) req.set('x-test-user', user.id);
  return req;
}

async function connectStart(app, user) {
  const res = await post(app, '/api/auth/telegram/connect/start', user).send({});
  const startToken = res.body.deepLink && new URL(res.body.deepLink).searchParams.get('start');
  return { res, requestId: res.body.requestId, startToken };
}

function pressStart(startToken, from = {}) {
  return handleStart(
    { startToken, telegramId: TELEGRAM_ID, firstName: 'Nina', username: 'nina_n', ...from },
    testConfig,
  );
}

function codeIn(reply) {
  return reply.match(/\b(\d{6})\b/)[1];
}

function connectVerify(app, user, requestId, otp) {
  return post(app, '/api/auth/telegram/connect/verify', user).send({ requestId, otp });
}

/** Runs the flow up to an accepted code; returns what verify needs. */
async function codeFor(app, user) {
  const { requestId, startToken } = await connectStart(app, user);
  const reply = await pressStart(startToken);
  return { requestId, otp: codeIn(reply), reply };
}

const OWNED = {
  message: 'This Telegram account belongs to another user. Contact an admin.',
  code: 'TELEGRAM_OWNED',
};

describe('Connect Telegram', () => {
  it('connects the Telegram account to the signed-in user', async () => {
    const app = buildApp();
    const user = await createUser({ name: 'Ema Email' });
    const { requestId, otp, reply } = await codeFor(app, user);

    expect(reply).toMatch(
      /^Your code to connect Telegram to your account is \d{6}\. It expires in 2 minutes\. Only enter it on http:\/\/localhost:5173\. Never share it with anyone\.$/,
    );
    expect((await getStatus(app, requestId, user)).body.status).toBe('otp_sent');

    const res = await connectVerify(app, user, requestId, otp);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: user.id,
      name: 'Ema Email',
      telegramConnected: true,
      telegramUsername: 'nina_n',
    });
    expect(res.headers['set-cookie']).toBeUndefined();
    expect((await User.findById(user._id)).telegramId).toBe(TELEGRAM_ID);
  });

  it('refuses to start when the user already has Telegram', async () => {
    const user = await createUser({ telegramId: '999000999' });
    const { res } = await connectStart(buildApp(), user);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TELEGRAM_ALREADY_CONNECTED');
  });

  it('needs a signed-in user with a complete profile', async () => {
    const app = buildApp();
    expect((await connectStart(app, null)).res.status).toBe(401);
    const placeholder = await createUser({
      email: undefined,
      emailVerified: false,
      telegramId: '999000999',
    });
    expect(
      (
        await post(app, '/api/auth/telegram/connect/verify', placeholder).send({
          requestId: 'x',
          otp: '123456',
        })
      ).status,
    ).toBe(403);
  });

  it('shows status and resends only for the user who started the request', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const app = buildApp();
    const user = await createUser();
    const other = await createUser();
    const { requestId } = await codeFor(app, user);

    // Signed out (an expired access token): 401, so the client refreshes and tries again.
    const signedOut = await getStatus(app, requestId);
    expect(signedOut.status).toBe(401);
    expect(signedOut.body.code).toBe('NOT_AUTHENTICATED');
    expect((await getStatus(app, requestId, other)).body).toEqual({ status: 'expired' });

    vi.setSystemTime(Date.now() + 60 * 1000);
    expect((await post(app, '/api/auth/telegram/resend').send({ requestId })).status).toBe(401);
    const stranger = await post(app, '/api/auth/telegram/resend', other).send({ requestId });
    expect(stranger.status).toBe(400);
    expect(stranger.body.code).toBe('REQUEST_EXPIRED');
    expect(app.locals.telegram.outbox).toHaveLength(0);

    const res = await post(app, '/api/auth/telegram/resend', user).send({ requestId });
    expect(res.body.status).toBe('otp_sent');
    expect(app.locals.telegram.outbox[0].text).toMatch(/^Your code to connect Telegram/);
  });

  it('keeps connect and sign-in codes apart', async () => {
    const app = buildApp();
    const user = await createUser();
    const other = await createUser();
    const { requestId, otp } = await codeFor(app, user);

    const asLogin = await post(app, '/api/auth/telegram/verify').send({ requestId, otp });
    expect(asLogin.status).toBe(400);
    expect((await connectVerify(app, other, requestId, otp)).status).toBe(400);
    expect((await connectVerify(app, user, requestId, otp)).status).toBe(200);
  });

  it('checks who owns the Telegram ID only after the code is accepted', async () => {
    const app = buildApp();
    await createUser({ telegramId: TELEGRAM_ID, status: 'rejected' });
    const user = await createUser();

    // The code is sent as for any Telegram account: nothing reveals the owner yet.
    const { requestId, otp, reply } = await codeFor(app, user);
    expect(reply).toMatch(/^Your code to connect Telegram/);
    expect((await getStatus(app, requestId, user)).body.status).toBe('otp_sent');

    const wrong = await connectVerify(app, user, requestId, otp === '000000' ? '111111' : '000000');
    expect(wrong.body.code).toBe('INVALID_CODE');

    const res = await connectVerify(app, user, requestId, otp);
    expect(res.status).toBe(409);
    expect(res.body).toEqual(OWNED);
    expect((await User.findById(user._id)).telegramId).toBeUndefined();
  });

  it('refuses a Telegram ID held by any other User', async () => {
    const app = buildApp();
    const owner = await createUser({ telegramId: TELEGRAM_ID, telegramUsername: 'owner_tg' });
    const user = await createUser();
    const { requestId, otp } = await codeFor(app, user);

    const res = await connectVerify(app, user, requestId, otp);

    expect(res.status).toBe(409);
    expect(res.body).toEqual(OWNED);
    expect((await User.findById(owner._id)).telegramId).toBe(TELEGRAM_ID);
  });

  it('absorbs a Placeholder user holding the Telegram ID', async () => {
    const app = buildApp();
    const placeholder = await createUser({
      email: undefined,
      emailVerified: false,
      password: null,
      telegramId: TELEGRAM_ID,
      telegramUsername: 'old_handle',
      pendingEmail: 'someone@example.com',
      status: 'pending',
    });
    const { refreshToken } = await startSession(placeholder, {}, testConfig);
    await EmailToken.create({
      user: placeholder._id,
      type: 'verify_email',
      email: 'someone@example.com',
      tokenHash: 'placeholder-token',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const user = await createUser();
    const { requestId, otp } = await codeFor(app, user);

    const res = await connectVerify(app, user, requestId, otp);

    expect(res.status).toBe(200);
    expect(res.body.user.telegramUsername).toBe('nina_n');
    expect((await User.findById(user._id)).telegramId).toBe(TELEGRAM_ID);
    expect(await User.findById(placeholder._id)).toBeNull();
    expect(await EmailToken.countDocuments({ user: placeholder._id })).toBe(0);
    const refresh = await post(app, '/api/auth/refresh').set(
      'Cookie',
      `refresh_token=${refreshToken}`,
    );
    expect(refresh.status).toBe(401);
  });

  it('does not absorb a rejected Placeholder user', async () => {
    const app = buildApp();
    const rejected = await createUser({
      email: undefined,
      emailVerified: false,
      password: null,
      telegramId: TELEGRAM_ID,
      status: 'rejected',
    });
    const user = await createUser();
    const { requestId, otp } = await codeFor(app, user);

    const res = await connectVerify(app, user, requestId, otp);

    expect(res.status).toBe(409);
    expect(res.body).toEqual(OWNED);
    expect(await User.findById(rejected._id)).not.toBeNull();
  });

  it('gives a Telegram ID to only one of two users connecting it at once', async () => {
    const app = buildApp();
    const [first, second] = await Promise.all([createUser(), createUser()]);
    const codes = [await codeFor(app, first), await codeFor(app, second)];

    const results = await Promise.all(
      [first, second].map((user, i) => connectVerify(app, user, codes[i].requestId, codes[i].otp)),
    );

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await User.countDocuments({ telegramId: TELEGRAM_ID })).toBe(1);
  });

  it('changes nothing when absorbing fails part-way', async () => {
    const app = buildApp();
    const placeholder = await createUser({
      email: undefined,
      emailVerified: false,
      password: null,
      telegramId: TELEGRAM_ID,
      status: 'pending',
    });
    const user = await createUser();
    const { requestId, otp } = await codeFor(app, user);
    vi.spyOn(tokenService, 'revokeAllForUser').mockRejectedValueOnce(new Error('disk full'));

    const res = await connectVerify(app, user, requestId, otp);

    expect(res.status).toBe(500);
    expect((await User.findById(placeholder._id)).telegramId).toBe(TELEGRAM_ID);
    expect((await User.findById(user._id)).telegramId).toBeUndefined();
  });

  it('limits connect start to 20 per hour and connect verify to 30 per 15 minutes per IP', async () => {
    const app = buildApp();
    const user = await createUser();
    for (let i = 0; i < 20; i += 1) await connectStart(app, user);
    expect((await connectStart(app, user)).res.status).toBe(429);

    for (let i = 0; i < 30; i += 1) await connectVerify(app, user, `r-${i}`, '123456');
    expect((await connectVerify(app, user, 'r', '123456')).status).toBe(429);
  });
});
