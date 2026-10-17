import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { StatusChange } from '../../src/models/StatusChange.js';
import { User } from '../../src/models/User.js';
import { handleStart } from '../../src/services/telegramAuth.service.js';
import {
  DEFAULT_PASSWORD,
  ORIGIN,
  createUser,
  testEnv,
  useTestDatabase,
} from '../helpers/setup.js';

useTestDatabase();

const TELEGRAM_ID = '777001';
const config = loadConfig({
  ...testEnv,
  ADMIN_EMAILS: 'boss@example.com',
  ADMIN_TELEGRAM_IDS: TELEGRAM_ID,
});

function post(app, path, user) {
  const req = request(app)
    .post(path)
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest');
  if (user) req.set('x-test-user', user.id);
  return req;
}

async function sentMail(app) {
  await app.locals.mailer.idle();
  return app.locals.mailer.outbox;
}

function tokenFrom(message, page) {
  return decodeURIComponent(message.text.match(new RegExp(`${page}\\?token=(\\S+)`))[1]);
}

async function expectBootstrapped(user) {
  const stored = await User.findById(user._id);
  expect(stored).toMatchObject({ role: 'admin', status: 'active' });
  expect(await StatusChange.countDocuments({ user: user._id, changedBy: null })).toBe(1);
}

function createTelegramSignup() {
  return createUser({
    name: 'Tom Telegram',
    email: undefined,
    emailVerified: false,
    password: null,
    telegramId: TELEGRAM_ID,
    status: 'pending',
  });
}

describe('admin bootstrap when a profile becomes complete', () => {
  it('promotes a listed email that signs up with a password and verifies it', async () => {
    const app = createApp(config);
    await post(app, '/api/auth/register').send({
      name: 'Bea Boss',
      email: 'boss@example.com',
      password: 'violet-harbor-lantern',
      confirmPassword: 'violet-harbor-lantern',
    });
    const user = await User.findOne({ email: 'boss@example.com' });
    expect(user).toMatchObject({ role: 'staff', status: 'pending' });

    const [mail] = await sentMail(app);
    const res = await post(app, '/api/auth/verify-email').send({
      token: tokenFrom(mail, 'verify-email'),
    });

    expect(res.status).toBe(200);
    await expectBootstrapped(user);
  });

  it('promotes a listed Telegram ID once its Complete profile email is verified', async () => {
    const app = createApp(config);
    const user = await createTelegramSignup();
    await post(app, '/api/auth/profile/complete', user).send({
      name: 'Tom Telegram',
      email: 'tom@example.com',
    });
    expect((await User.findById(user._id)).status).toBe('pending');

    const [mail] = await sentMail(app);
    await post(app, '/api/auth/verify-email').send({ token: tokenFrom(mail, 'verify-email') });

    await expectBootstrapped(user);
  });

  it('promotes the account that receives a listed Telegram ID through an Account link', async () => {
    const app = createApp(config);
    const owner = await createUser({
      name: 'Olga Owner',
      email: 'olga@example.com',
      emailVerified: false,
      status: 'pending',
    });
    const placeholder = await createTelegramSignup();
    await post(app, '/api/auth/profile/complete', placeholder).send({
      name: 'Tom Telegram',
      email: 'olga@example.com',
    });
    const [mail] = await sentMail(app);

    const res = await post(app, '/api/auth/link-telegram/confirm').send({
      token: tokenFrom(mail, 'confirm-link'),
      password: DEFAULT_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(await User.findById(owner._id)).toMatchObject({ telegramId: TELEGRAM_ID });
    await expectBootstrapped(owner);
  });

  it('promotes a pending user who connects a listed Telegram ID', async () => {
    const app = createApp(config);
    const user = await createUser({
      name: 'Ema Email',
      email: 'ema@example.com',
      status: 'pending',
    });
    const start = await post(app, '/api/auth/telegram/connect/start', user).send({});
    const startToken = new URL(start.body.deepLink).searchParams.get('start');
    const reply = await handleStart(
      { startToken, telegramId: TELEGRAM_ID, firstName: 'Ema', username: 'ema_tg' },
      config,
    );

    const res = await post(app, '/api/auth/telegram/connect/verify', user).send({
      requestId: start.body.requestId,
      otp: reply.match(/\b(\d{6})\b/)[1],
    });

    expect(res.status).toBe(200);
    await expectBootstrapped(user);
  });

  it('leaves an ordinary user pending after the same steps', async () => {
    const app = createApp(config);
    const user = await createUser({
      name: 'Una User',
      email: 'una@example.com',
      emailVerified: false,
      status: 'pending',
    });
    await post(app, '/api/auth/resend-verification').send({ email: 'una@example.com' });
    const [mail] = await sentMail(app);

    await post(app, '/api/auth/verify-email').send({ token: tokenFrom(mail, 'verify-email') });

    expect(await User.findById(user._id)).toMatchObject({ role: 'staff', status: 'pending' });
    expect(await StatusChange.countDocuments()).toBe(0);
  });
});
