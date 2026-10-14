import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailToken } from '../../src/models/EmailToken.js';
import { User } from '../../src/models/User.js';
import * as tokenService from '../../src/services/token.service.js';
import { startSession } from '../../src/services/auth.service.js';
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

afterEach(() => vi.restoreAllMocks());

const GENERIC = {
  message: 'If this email can be used, we have sent a verification link. Check your inbox.',
};

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

/** An email + password account that already exists for the address. */
function createOwner(overrides = {}) {
  return createUser({
    name: 'Olga Owner',
    email: 'olga@example.com',
    role: 'admin',
    status: 'active',
    ...overrides,
  });
}

function post(app, path) {
  return request(app).post(path).set('Origin', ORIGIN).set('X-Requested-With', 'XMLHttpRequest');
}

function completeProfile(app, user, email = 'olga@example.com') {
  return post(app, '/api/auth/profile/complete')
    .set('x-test-user', user.id)
    .send({ name: user.name, email });
}

function confirm(app, token, password = DEFAULT_PASSWORD) {
  return post(app, '/api/auth/link-telegram/confirm').send({ token, password });
}

async function sentMail(app) {
  await app.locals.mailer.idle();
  return app.locals.mailer.outbox;
}

function linkTokenFrom(message) {
  return decodeURIComponent(message.text.match(/confirm-link\?token=(\S+)/)[1]);
}

/** Placeholder asks to use the owner's email; returns the link-confirmation token. */
async function requestLink(app, placeholder) {
  await completeProfile(app, placeholder);
  const mail = (await sentMail(app)).at(-1);
  return linkTokenFrom(mail);
}

describe('Account link (case 2: the email belongs to an email + password account)', () => {
  it('emails the owner a link confirmation naming the Telegram account', async () => {
    const app = buildApp();
    await createOwner();
    const placeholder = await createPlaceholder();

    const res = await completeProfile(app, placeholder);

    expect(res.status).toBe(202);
    expect(res.body).toEqual(GENERIC);
    const [mail] = await sentMail(app);
    expect(mail.to).toBe('olga@example.com');
    expect(mail.subject).toBe('Let a Telegram account sign in to your Inventory account?');
    expect(mail.text).toContain('Nina Novak (@nina_n)');
    expect(mail.text).toMatch(/If you did not ask for this, ignore this email/);
    expect(mail.text).toContain('http://localhost:5173/confirm-link?token=');
    expect(mail.text).not.toContain('verify-email');
  });

  it('moves the Telegram identity into the existing account with its password', async () => {
    const app = buildApp();
    const owner = await createOwner({ emailVerified: false });
    const placeholder = await createPlaceholder();
    const { refreshToken } = await startSession(placeholder, {}, testConfig);
    const token = await requestLink(app, placeholder);

    const res = await confirm(app, token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Telegram is now connected to your account. Log in with Telegram or your email.',
    });
    expect(res.headers['set-cookie']).toBeUndefined();

    const linked = await User.findById(owner._id);
    expect(linked).toMatchObject({
      name: 'Olga Owner',
      email: 'olga@example.com',
      emailVerified: true,
      telegramId: '555000111',
      telegramUsername: 'nina_n',
      role: 'admin',
      status: 'active',
    });
    expect(await User.findById(placeholder._id)).toBeNull();
    expect(await User.countDocuments()).toBe(1);
    expect(await EmailToken.countDocuments({ user: placeholder._id })).toBe(0);

    // The Placeholder user's session is over.
    const refresh = await post(app, '/api/auth/refresh').set(
      'Cookie',
      `refresh_token=${refreshToken}`,
    );
    expect(refresh.status).toBe(401);
    expect(parseCookies(refresh).access_token?.value).toBeFalsy();

    // Single use.
    expect((await confirm(app, token)).status).toBe(400);
  });

  it('counts a wrong password toward the lock, keeps the link usable, and refuses a locked account', async () => {
    const app = buildApp();
    const owner = await createOwner();
    const placeholder = await createPlaceholder();
    const token = await requestLink(app, placeholder);

    const wrong = await confirm(app, token, 'not-the-password');
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual({
      message: 'Incorrect password.',
      code: 'INVALID_PASSWORD',
      errors: { password: 'Incorrect password.' },
    });
    expect((await User.findById(owner._id)).failedLoginCount).toBe(1);

    // Four more wrong passwords make five: the account locks, like email login.
    for (let i = 0; i < 4; i += 1) await confirm(app, token, 'not-the-password');
    expect((await User.findById(owner._id)).lockedUntil).toBeInstanceOf(Date);
    expect((await confirm(app, token)).status).toBe(401);
    expect((await User.findById(owner._id)).telegramId).toBeUndefined();

    // Once the lock ends, the same link still works.
    await User.updateOne({ _id: owner._id }, { $unset: { lockedUntil: 1 } });
    expect((await confirm(app, token)).status).toBe(200);
  });

  it('changes nothing when any step fails', async () => {
    const app = buildApp();
    const owner = await createOwner({ emailVerified: false });
    const placeholder = await createPlaceholder();
    const token = await requestLink(app, placeholder);
    vi.spyOn(tokenService, 'revokeAllForUser').mockRejectedValueOnce(new Error('disk full'));

    const res = await confirm(app, token);

    expect(res.status).toBe(500);
    expect(await User.findById(placeholder._id)).not.toBeNull();
    const unchanged = await User.findById(owner._id);
    expect(unchanged.telegramId).toBeUndefined();
    expect(unchanged.emailVerified).toBe(false);
    expect(await EmailToken.exists({ user: placeholder._id, usedAt: null })).not.toBeNull();
    // Nothing was used up: the link still works.
    expect((await confirm(app, token)).status).toBe(200);
  });

  describe('fails as "invalid or expired", changing nothing, when since the email was sent', () => {
    const cases = {
      'the Placeholder user is gone': (placeholder) => User.deleteOne({ _id: placeholder._id }),
      'its pendingEmail changed': (placeholder) =>
        User.updateOne({ _id: placeholder._id }, { pendingEmail: 'other@example.com' }),
      'the owner gained a Telegram ID': (_placeholder, owner) =>
        User.updateOne({ _id: owner._id }, { telegramId: '999000999' }),
      'the owner was rejected': (_placeholder, owner) =>
        User.updateOne({ _id: owner._id }, { status: 'rejected' }),
    };

    for (const [what, change] of Object.entries(cases)) {
      it(what, async () => {
        const app = buildApp();
        const owner = await createOwner();
        const placeholder = await createPlaceholder();
        const token = await requestLink(app, placeholder);
        await change(placeholder, owner);
        const before = await User.findById(owner._id).lean();

        const res = await confirm(app, token);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
          message: 'This link is invalid or has expired.',
          code: 'INVALID_TOKEN',
        });
        expect(await User.findById(owner._id).lean()).toEqual(before);
      });
    }
  });

  it('limits Confirm to 10 per 15 minutes per IP', async () => {
    const app = buildApp();
    for (let i = 0; i < 10; i += 1) await confirm(app, `unknown-${i}`);
    const res = await confirm(app, 'unknown');
    expect(res.status).toBe(429);
  });
});

describe('Complete profile with an email someone else holds', () => {
  it('case 3: links nothing and tells the owner, who already has another Telegram account', async () => {
    const app = buildApp();
    const owner = await createOwner({ telegramId: '777000777', telegramUsername: 'olga_tg' });
    const placeholder = await createPlaceholder();

    const res = await completeProfile(app, placeholder);

    expect(res.body).toEqual(GENERIC);
    const [notice] = await sentMail(app);
    expect(notice.to).toBe('olga@example.com');
    expect(notice.text).toContain('Nina Novak (@nina_n)');
    expect(notice.text).toContain('already connected to a different Telegram account');
    expect(notice.text).not.toMatch(/token=/);
    expect(await EmailToken.countDocuments()).toBe(0);
    expect((await User.findById(owner._id)).telegramId).toBe('777000777');

    // Resend waits 60 s like the other cases.
    await post(app, '/api/auth/profile/resend-verification').set('x-test-user', placeholder.id);
    expect(await sentMail(app)).toHaveLength(1);

    // The Placeholder user can use another email instead.
    await completeProfile(app, placeholder, 'nina@example.com');
    expect((await sentMail(app)).at(-1).to).toBe('nina@example.com');
  });

  it('sends nothing for the email of a rejected User', async () => {
    const app = buildApp();
    await createOwner({ status: 'rejected' });
    const placeholder = await createPlaceholder();

    const res = await completeProfile(app, placeholder);

    expect(res.body).toEqual(GENERIC);
    expect(await sentMail(app)).toHaveLength(0);
  });

  it('looks the same to the Placeholder user in every case', async () => {
    const app = buildApp();
    await createOwner({ email: 'case2@example.com' });
    await createOwner({ email: 'case3@example.com', telegramId: '777000777' });
    await createOwner({ email: 'rejected@example.com', status: 'rejected' });
    const emails = [
      'case1@example.com',
      'case2@example.com',
      'case3@example.com',
      'rejected@example.com',
    ];

    const answers = [];
    for (const [i, email] of emails.entries()) {
      const placeholder = await createPlaceholder({ telegramId: `55500022${i}` });
      const res = await completeProfile(app, placeholder, email);
      const me = await request(app).get('/api/auth/me').set('x-test-user', placeholder.id);
      answers.push({ status: res.status, body: res.body, pendingEmail: me.body.user.pendingEmail });
    }

    expect(answers).toEqual(
      emails.map((email) => ({ status: 202, body: GENERIC, pendingEmail: email })),
    );
  });
});
