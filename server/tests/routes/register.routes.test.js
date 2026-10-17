import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { EmailToken } from '../../src/models/EmailToken.js';
import { User } from '../../src/models/User.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

const GENERIC = {
  message: 'If this email can be used, we have sent a verification link. Check your inbox.',
};
const PASSWORD = 'violet-harbor-lantern';

function post(app, path, body) {
  return request(app)
    .post(path)
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send(body);
}

function register(app, overrides = {}) {
  return post(app, '/api/auth/register', {
    name: 'Nora New',
    email: 'nora@example.com',
    password: PASSWORD,
    confirmPassword: PASSWORD,
    ...overrides,
  });
}

/** Waits for background mail and returns the messages sent so far. */
async function sentMail(app) {
  await app.locals.mailer.idle();
  return app.locals.mailer.outbox;
}

/** Moves existing tokens past the 60 s resend cooldown (createdAt is immutable in Mongoose). */
async function skipCooldown() {
  await EmailToken.collection.updateMany(
    {},
    { $set: { createdAt: new Date(Date.now() - 61_000) } },
  );
}

function tokenFrom(message) {
  const match = message.text.match(/verify-email\?token=(\S+)/);
  return decodeURIComponent(match[1]);
}

describe('POST /api/auth/register', () => {
  it('creates an unverified staff/pending user and emails a verification link', async () => {
    const app = buildApp();

    const res = await register(app, { email: '  Nora@Example.COM ' });

    expect(res.status).toBe(202);
    expect(res.body).toEqual(GENERIC);
    expect(res.headers['set-cookie']).toBeUndefined();

    const user = await User.findOne({ email: 'nora@example.com' }).select('+passwordHash');
    expect(user).toMatchObject({
      name: 'Nora New',
      role: 'staff',
      status: 'pending',
      emailVerified: false,
    });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);

    const mail = await sentMail(app);
    expect(mail).toHaveLength(1);
    expect(mail[0].to).toBe('nora@example.com');
    expect(mail[0].text).toContain('http://localhost:5173/verify-email?token=');
    expect(mail[0].html).toContain('Verify email');

    const stored = await EmailToken.findOne({ user: user._id });
    expect(stored.type).toBe('verify_email');
    expect(stored.tokenHash).not.toBe(tokenFrom(mail[0]));
    const ttl = stored.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(23.9 * 60 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it('gives the same response for an email that is already registered and verified', async () => {
    const app = buildApp();
    await createUser({ email: 'taken@example.com', name: 'Original' });

    const res = await register(app, { email: 'taken@example.com', name: 'Impostor' });

    expect(res.status).toBe(202);
    expect(res.body).toEqual(GENERIC);
    expect(await User.countDocuments({ email: 'taken@example.com' })).toBe(1);
    expect((await User.findOne({ email: 'taken@example.com' })).name).toBe('Original');
    expect(await sentMail(app)).toHaveLength(0);
  });

  it('re-sends the link (once per minute) when the email is registered but unverified', async () => {
    const app = buildApp();
    await register(app);
    await register(app);
    expect(await sentMail(app)).toHaveLength(1);

    await skipCooldown();
    await register(app);
    expect(await sentMail(app)).toHaveLength(2);
    expect(await User.countDocuments({ email: 'nora@example.com' })).toBe(1);
  });

  it('validates with the shared schema', async () => {
    const app = buildApp();
    const res = await register(app, {
      name: ' ',
      email: 'nope',
      password: 'short',
      confirmPassword: 'different',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({
      name: 'Name is required',
      email: 'Enter a valid email address',
      password: 'Password must be at least 10 characters',
      confirmPassword: 'Passwords do not match',
    });
  });

  it('rejects common passwords and mismatched confirmation', async () => {
    const app = buildApp();
    const common = await register(app, {
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    expect(common.body.errors.password).toBe('This password is too common. Choose another one.');

    const mismatch = await register(app, { confirmPassword: 'violet-harbor-lantern!' });
    expect(mismatch.body.errors).toEqual({ confirmPassword: 'Passwords do not match' });
  });

  it('rate limits per email', async () => {
    const app = buildApp();
    const statuses = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await register(app)).status);
    expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
  });
});

describe('POST /api/auth/verify-email', () => {
  it('verifies the email so the user can log in, and stays pending', async () => {
    const app = buildApp();
    await register(app);
    const [mail] = await sentMail(app);

    const loginBefore = await post(app, '/api/auth/login', {
      email: 'nora@example.com',
      password: PASSWORD,
    });
    expect(loginBefore.status).toBe(401);

    const res = await post(app, '/api/auth/verify-email', { token: tokenFrom(mail) });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Your email is verified. You can now log in.');

    const login = await post(app, '/api/auth/login', {
      email: 'nora@example.com',
      password: PASSWORD,
    });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ emailVerified: true, status: 'pending' });
  });

  it('accepts each link only once', async () => {
    const app = buildApp();
    await register(app);
    const token = tokenFrom((await sentMail(app))[0]);

    expect((await post(app, '/api/auth/verify-email', { token })).status).toBe(200);
    const again = await post(app, '/api/auth/verify-email', { token });
    expect(again.status).toBe(400);
    expect(again.body).toEqual({
      message: 'This link is invalid or has expired.',
      code: 'INVALID_TOKEN',
    });
  });

  it('rejects expired and unknown tokens', async () => {
    const app = buildApp();
    await register(app);
    const token = tokenFrom((await sentMail(app))[0]);
    await EmailToken.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });

    expect((await post(app, '/api/auth/verify-email', { token })).status).toBe(400);
    expect((await post(app, '/api/auth/verify-email', { token: 'made-up' })).status).toBe(400);
    expect((await User.findOne({ email: 'nora@example.com' })).emailVerified).toBe(false);
  });

  it('invalidates the previous link when a new one is sent', async () => {
    const app = buildApp();
    await register(app);
    const first = tokenFrom((await sentMail(app))[0]);
    await skipCooldown();

    await post(app, '/api/auth/resend-verification', { email: 'nora@example.com' });
    const second = tokenFrom((await sentMail(app))[1]);

    expect((await post(app, '/api/auth/verify-email', { token: first })).status).toBe(400);
    expect((await post(app, '/api/auth/verify-email', { token: second })).status).toBe(200);
  });

  it('requires a token', async () => {
    const res = await post(buildApp(), '/api/auth/verify-email', {});
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ token: 'Token is required' });
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('gives the same response for unknown, verified and unverified emails', async () => {
    const app = buildApp();
    await createUser({ email: 'verified@example.com' });
    await register(app, { email: 'unverified@example.com' });
    await skipCooldown();

    const responses = await Promise.all(
      ['nobody@example.com', 'verified@example.com', 'unverified@example.com'].map((email) =>
        post(app, '/api/auth/resend-verification', { email }),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(202);
      expect(res.body).toEqual(GENERIC);
    }
    const mail = await sentMail(app);
    expect(mail.map((m) => m.to)).toEqual(['unverified@example.com', 'unverified@example.com']);
  });

  it('does not send more than one email per minute', async () => {
    const app = buildApp();
    await register(app);
    await post(app, '/api/auth/resend-verification', { email: 'nora@example.com' });
    expect(await sentMail(app)).toHaveLength(1);
  });
});
