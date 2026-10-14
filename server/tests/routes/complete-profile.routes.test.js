import request from 'supertest';
import { describe, expect, it } from 'vitest';
import express from 'express';
import { authenticate } from '../../src/middleware/auth.js';
import { errorHandler } from '../../src/middleware/error.js';
import { requireProfile } from '../../src/middleware/requireProfile.js';
import { EmailSend } from '../../src/models/EmailSend.js';
import { User } from '../../src/models/User.js';
import { startSession } from '../../src/services/auth.service.js';
import {
  ORIGIN,
  buildApp,
  createUser,
  parseCookies,
  testConfig,
  useTestDatabase,
} from '../helpers/setup.js';

useTestDatabase();

const GENERIC = {
  message: 'If this email can be used, we have sent a verification link. Check your inbox.',
};

/** A Telegram signup that has not entered an email yet. */
function createPlaceholder(overrides = {}) {
  return createUser({
    name: 'Nina Novak',
    email: undefined,
    emailVerified: false,
    password: null,
    telegramId: '555000111',
    telegramUsername: 'nina_n',
    status: 'pending',
    ...overrides,
  });
}

function asUser(user, req) {
  return req
    .set('x-test-user', user.id)
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest');
}

function completeProfile(app, user, body) {
  return asUser(user, request(app).post('/api/auth/profile/complete')).send({
    name: 'Nina N.',
    email: 'nina@example.com',
    ...body,
  });
}

function me(app, user) {
  return asUser(user, request(app).get('/api/auth/me'));
}

function verify(app, token) {
  return request(app)
    .post('/api/auth/verify-email')
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ token });
}

/** Waits for background mail and returns the messages sent so far. */
async function sentMail(app) {
  await app.locals.mailer.idle();
  return app.locals.mailer.outbox;
}

/** Moves earlier sends past the 60 s resend cooldown (createdAt is immutable in Mongoose). */
async function skipCooldown() {
  await EmailSend.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 61_000) } });
}

function resend(app, user) {
  return asUser(user, request(app).post('/api/auth/profile/resend-verification')).send({});
}

function tokenFrom(message) {
  return decodeURIComponent(message.text.match(/verify-email\?token=(\S+)/)[1]);
}

describe('Complete profile, case 1 (email nobody uses)', () => {
  it('saves the name, emails a link, and verifying it completes the profile', async () => {
    const app = buildApp();
    const user = await createPlaceholder();

    const res = await completeProfile(app, user, { email: ' Nina@Example.com ' });

    expect(res.status).toBe(202);
    expect(res.body).toEqual(GENERIC);
    expect((await me(app, user)).body.user).toMatchObject({
      name: 'Nina N.',
      email: null,
      pendingEmail: 'nina@example.com',
      profileComplete: false,
    });

    const [mail] = await sentMail(app);
    expect(mail.to).toBe('nina@example.com');
    const verified = await verify(app, tokenFrom(mail));

    expect(verified.status).toBe(200);
    expect(verified.body).toEqual({ message: 'Email verified. Return to the app or log in.' });
    expect(verified.headers['set-cookie']).toBeUndefined();
    expect((await me(app, user)).body.user).toMatchObject({
      email: 'nina@example.com',
      emailVerified: true,
      pendingEmail: null,
      profileComplete: true,
      status: 'pending',
    });
    expect((await verify(app, tokenFrom(mail))).status).toBe(400);
  });

  it('replaces the email and invalidates links sent for the earlier one', async () => {
    const app = buildApp();
    const user = await createPlaceholder();
    await completeProfile(app, user, { email: 'first@example.com' });
    await completeProfile(app, user, { email: 'second@example.com' });

    const [first, second] = await sentMail(app);
    expect([first.to, second.to]).toEqual(['first@example.com', 'second@example.com']);
    expect((await me(app, user)).body.user.pendingEmail).toBe('second@example.com');

    const old = await verify(app, tokenFrom(first));
    expect(old.status).toBe(400);
    expect(old.body.code).toBe('INVALID_TOKEN');
    expect((await verify(app, tokenFrom(second))).status).toBe(200);
    expect((await User.findById(user._id)).email).toBe('second@example.com');
  });

  it('fails the link with "invalid or expired" when another User took the email meanwhile', async () => {
    const app = buildApp();
    const user = await createPlaceholder();
    await completeProfile(app, user);
    const [mail] = await sentMail(app);
    await createUser({ email: 'nina@example.com' });

    const res = await verify(app, tokenFrom(mail));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: 'This link is invalid or has expired.',
      code: 'INVALID_TOKEN',
    });
    const stored = await User.findById(user._id);
    expect(stored.email).toBeUndefined();
    expect(stored.emailVerified).toBe(false);
  });

  it('resends the link after the 60 s cooldown, and the newest link works', async () => {
    const app = buildApp();
    const user = await createPlaceholder();
    await completeProfile(app, user);

    expect((await resend(app, user)).body).toEqual(GENERIC);
    expect(await sentMail(app)).toHaveLength(1);

    await skipCooldown();
    const res = await resend(app, user);
    expect(res.status).toBe(202);
    const [first, second] = await sentMail(app);
    expect(second.to).toBe('nina@example.com');
    expect((await verify(app, tokenFrom(first))).status).toBe(400);
    expect((await verify(app, tokenFrom(second))).status).toBe(200);
  });

  it('sends at most 5 Complete-profile emails per hour to one address', async () => {
    const app = buildApp();
    const responses = [];
    for (let i = 0; i < 6; i += 1) {
      const user = await createPlaceholder({ telegramId: `55500011${i}` });
      responses.push(await completeProfile(app, user, { email: 'target@example.com' }));
    }

    expect(responses.map((res) => res.body)).toEqual(Array(6).fill(GENERIC));
    expect(await sentMail(app)).toHaveLength(5);
  });

  it('validates the name and email', async () => {
    const user = await createPlaceholder();
    const res = await completeProfile(buildApp(), user, { name: ' ', email: 'nope' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['email', 'name']);
  });

  it('is only for incomplete profiles and signed-in users', async () => {
    const app = buildApp();
    const complete = await createUser();

    const done = await completeProfile(app, complete);
    expect(done.status).toBe(409);
    expect(done.body.code).toBe('PROFILE_COMPLETE');
    expect((await resend(app, complete)).status).toBe(409);

    const anonymous = await request(app)
      .post('/api/auth/profile/complete')
      .set('Origin', ORIGIN)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ name: 'X', email: 'x@example.com' });
    expect(anonymous.status).toBe(401);
  });
});

describe('Incomplete profile allow-list', () => {
  it('lets an incomplete profile use me, Complete profile, refresh and logout', async () => {
    const app = buildApp();
    const user = await createPlaceholder();

    expect((await me(app, user)).status).toBe(200);
    expect((await completeProfile(app, user)).status).toBe(202);
    expect((await resend(app, user)).status).toBe(202);

    // A real session, as Telegram sign-in gives a Placeholder user.
    const { refreshToken } = await startSession(user, {}, testConfig);
    const withRefresh = (path) =>
      request(app)
        .post(path)
        .set('Origin', ORIGIN)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', `refresh_token=${refreshToken}`);
    const refresh = await withRefresh('/api/auth/refresh');
    expect(refresh.status).toBe(204);
    const rotated = parseCookies(refresh).refresh_token.value;
    const logout = await withRefresh('/api/auth/logout').set('Cookie', `refresh_token=${rotated}`);
    expect(logout.status).toBe(204);
  });

  it('refuses every other authenticated route with PROFILE_INCOMPLETE', async () => {
    // Any route behind `authenticate` + `requireProfile`, as every other route is.
    const app = express();
    app.get('/data', authenticate(testConfig), requireProfile, (_req, res) => res.json({}));
    app.use(errorHandler);
    const placeholder = await createPlaceholder();
    const complete = await createUser();

    const refused = await request(app).get('/data').set('x-test-user', placeholder.id);
    expect(refused.status).toBe(403);
    expect(refused.body).toEqual({
      message: 'Complete your profile to continue.',
      code: 'PROFILE_INCOMPLETE',
    });
    expect((await request(app).get('/data').set('x-test-user', complete.id)).status).toBe(200);
  });
});
