import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { EmailToken } from '../../src/models/EmailToken.js';
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

const GENERIC = {
  message:
    'If an account can reset its password with this email, we have sent a link. Check your inbox.',
};
const NEW_PASSWORD = 'amber-meadow-compass';
const INVALID_TOKEN = { message: 'This link is invalid or has expired.', code: 'INVALID_TOKEN' };

function post(app, path, body) {
  return request(app)
    .post(path)
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send(body);
}

function forgot(app, email) {
  return post(app, '/api/auth/forgot-password', { email });
}

function reset(app, token, password = NEW_PASSWORD, confirmPassword = password) {
  return post(app, '/api/auth/reset-password', { token, password, confirmPassword });
}

function login(app, email, password) {
  return post(app, '/api/auth/login', { email, password });
}

/** Waits for background mail and returns the messages sent so far. */
async function sentMail(app) {
  await app.locals.mailer.idle();
  return app.locals.mailer.outbox;
}

function tokenFrom(message) {
  return decodeURIComponent(message.text.match(/reset-password\?token=(\S+)/)[1]);
}

/** Sends a reset link to the user and returns the raw token. */
async function requestLink(app, email) {
  await forgot(app, email);
  const mail = await sentMail(app);
  return tokenFrom(mail.at(-1));
}

/** Moves existing tokens past the 60 s resend cooldown (createdAt is immutable in Mongoose). */
async function skipCooldown() {
  await EmailToken.collection.updateMany(
    {},
    { $set: { createdAt: new Date(Date.now() - 61_000) } },
  );
}

/** An access cookie issued a minute ago, i.e. before any reset in this test. */
function oldAccessCookie(userId) {
  const token = jwt.sign(
    { typ: 'access', iat: Math.floor(Date.now() / 1000) - 60 },
    testConfig.jwt.accessSecret,
    { subject: userId.toString(), expiresIn: '15m', algorithm: 'HS256' },
  );
  return `access_token=${token}`;
}

describe('POST /api/auth/forgot-password', () => {
  it('emails a 30 minute reset link to a verified account', async () => {
    const app = buildApp();
    const user = await createUser({ email: 'ana@example.com', name: 'Ana' });

    const res = await forgot(app, '  ANA@example.com ');

    expect(res.status).toBe(202);
    expect(res.body).toEqual(GENERIC);
    const mail = await sentMail(app);
    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ to: 'ana@example.com', subject: 'Reset your password' });
    expect(mail[0].text).toContain('http://localhost:5173/reset-password?token=');

    const stored = await EmailToken.findOne({ user: user._id });
    expect(stored.type).toBe('reset_password');
    expect(stored.tokenHash).not.toBe(tokenFrom(mail[0]));
    const ttl = stored.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(29.9 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(30 * 60 * 1000);
  });

  it('gives the same response and sends nothing for unknown, unverified and rejected accounts', async () => {
    const app = buildApp();
    await createUser({ email: 'unverified@example.com', emailVerified: false });
    await createUser({ email: 'rejected@example.com', status: 'rejected' });

    for (const email of ['nobody@example.com', 'unverified@example.com', 'rejected@example.com']) {
      const res = await forgot(app, email);
      expect(res.status).toBe(202);
      expect(res.body).toEqual(GENERIC);
    }
    expect(await sentMail(app)).toHaveLength(0);
  });

  it('sends a link to a pending account', async () => {
    const app = buildApp();
    await createUser({ email: 'pat@example.com', status: 'pending' });

    await forgot(app, 'pat@example.com');

    expect(await sentMail(app)).toHaveLength(1);
  });

  it('says "set" instead of "reset" for an account with no password yet', async () => {
    const app = buildApp();
    await createUser({ email: 'theo@example.com', telegramId: '42', password: null });

    await forgot(app, 'theo@example.com');

    const [mail] = await sentMail(app);
    expect(mail.subject).toBe('Set your password');
    expect(mail.html).toContain('Set password');
  });

  it('sends at most one email per minute, and a new link replaces the old one', async () => {
    const app = buildApp();
    await createUser({ email: 'ana@example.com' });

    await forgot(app, 'ana@example.com');
    const again = await forgot(app, 'ana@example.com');
    expect(again.status).toBe(202);
    expect(again.body).toEqual(GENERIC);
    expect(await sentMail(app)).toHaveLength(1);
    const first = tokenFrom((await sentMail(app))[0]);

    await skipCooldown();
    await forgot(app, 'ana@example.com');
    const mail = await sentMail(app);
    expect(mail).toHaveLength(2);

    expect(await reset(app, first)).toMatchObject({ status: 400, body: INVALID_TOKEN });
    expect((await reset(app, tokenFrom(mail[1]))).status).toBe(200);
  });

  it('validates the email with the shared schema', async () => {
    const res = await forgot(buildApp(), 'not-an-email');
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ email: 'Enter a valid email address' });
  });

  it('allows 5 requests per hour per email', async () => {
    const app = buildApp();
    const statuses = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await forgot(app, 'ana@example.com')).status);
    expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
  });

  it('allows 5 requests per hour per IP across emails', async () => {
    const app = buildApp();
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await forgot(app, `user${i}@example.com`)).status);
    }
    expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('changes the password, ends every session and does not log in', async () => {
    const app = buildApp();
    const user = await createUser({ email: 'ana@example.com', name: 'Ana' });
    const session = await login(app, 'ana@example.com', DEFAULT_PASSWORD);
    const refreshCookie = `refresh_token=${parseCookies(session).refresh_token.value}`;
    const token = await requestLink(app, 'ana@example.com');

    const res = await reset(app, token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Your password has been changed. Log in with your new password.',
    });
    expect(res.headers['set-cookie']).toBeUndefined();

    expect(await RefreshToken.countDocuments({ user: user._id, revokedAt: null })).toBe(0);
    const refresh = await post(app, '/api/auth/refresh').set('Cookie', refreshCookie);
    expect(refresh.status).toBe(401);
    const me = await request(app).get('/api/auth/me').set('Cookie', oldAccessCookie(user._id));
    expect(me.status).toBe(401);

    expect((await login(app, 'ana@example.com', DEFAULT_PASSWORD)).status).toBe(401);
    const fresh = await login(app, 'ana@example.com', NEW_PASSWORD);
    expect(fresh.status).toBe(200);
    // A session started right after the reset (same second) works.
    const freshCookie = `access_token=${parseCookies(fresh).access_token.value}`;
    expect((await request(app).get('/api/auth/me').set('Cookie', freshCookie)).status).toBe(200);

    const mail = await sentMail(app);
    expect(mail.at(-1)).toMatchObject({
      to: 'ana@example.com',
      subject: 'Your password was changed',
    });
    expect(mail.at(-1).text).toContain('http://localhost:5173/forgot-password');
  });

  it('clears a login lock', async () => {
    const app = buildApp();
    await createUser({
      email: 'ana@example.com',
      failedLoginCount: 3,
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
    });
    const token = await requestLink(app, 'ana@example.com');

    expect((await reset(app, token)).status).toBe(200);

    const stored = await User.findOne({ email: 'ana@example.com' });
    expect(stored.failedLoginCount).toBe(0);
    expect(stored.lockedUntil).toBeUndefined();
    expect((await login(app, 'ana@example.com', NEW_PASSWORD)).status).toBe(200);
  });

  it('sets a first password for an account without one', async () => {
    const app = buildApp();
    await createUser({ email: 'theo@example.com', telegramId: '42', password: null });
    const token = await requestLink(app, 'theo@example.com');

    expect((await reset(app, token)).status).toBe(200);

    expect((await login(app, 'theo@example.com', NEW_PASSWORD)).status).toBe(200);
    expect((await sentMail(app)).at(-1).subject).toBe('Your password was set');
  });

  it('accepts each link only once', async () => {
    const app = buildApp();
    await createUser({ email: 'ana@example.com' });
    const token = await requestLink(app, 'ana@example.com');

    expect((await reset(app, token)).status).toBe(200);
    expect(await reset(app, token, 'another-new-password')).toMatchObject({
      status: 400,
      body: INVALID_TOKEN,
    });
  });

  it('rejects expired and unknown links', async () => {
    const app = buildApp();
    await createUser({ email: 'ana@example.com' });
    const token = await requestLink(app, 'ana@example.com');
    await EmailToken.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });

    expect(await reset(app, token)).toMatchObject({ status: 400, body: INVALID_TOKEN });
    expect(await reset(app, 'made-up')).toMatchObject({ status: 400, body: INVALID_TOKEN });
    expect((await login(app, 'ana@example.com', DEFAULT_PASSWORD)).status).toBe(200);
  });

  it('refuses the link if the account was rejected after it was sent', async () => {
    const app = buildApp();
    const user = await createUser({ email: 'ana@example.com', status: 'pending' });
    const token = await requestLink(app, 'ana@example.com');
    await User.updateOne({ _id: user._id }, { status: 'rejected' });

    expect(await reset(app, token)).toMatchObject({ status: 400, body: INVALID_TOKEN });
    const stored = await User.findById(user._id);
    expect(stored.sessionsRevokedAt).toBeUndefined();
  });

  it('validates the new password with the shared schema', async () => {
    const app = buildApp();

    const missing = await post(app, '/api/auth/reset-password', {});
    expect(missing.status).toBe(400);
    expect(missing.body.errors).toMatchObject({ token: 'Token is required' });

    const common = await reset(app, 'some-token', 'password123');
    expect(common.body.errors).toMatchObject({
      password: 'This password is too common. Choose another one.',
    });

    const mismatch = await reset(app, 'some-token', NEW_PASSWORD, 'something-else');
    expect(mismatch.body.errors).toEqual({ confirmPassword: 'Passwords do not match' });
  });
});
