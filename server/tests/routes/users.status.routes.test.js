import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { StatusChange } from '../../src/models/StatusChange.js';
import { User } from '../../src/models/User.js';
import { startSession } from '../../src/services/auth.service.js';
import { ORIGIN, buildApp, createUser, testConfig, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function send(app, method, actor, path, body) {
  const start = request(app)[method](`/api/users/${path}`);
  const req = start.set('Origin', ORIGIN).set('X-Requested-With', 'XMLHttpRequest');
  if (actor) req.set('x-test-user', actor.id);
  return req.send(body);
}

const setStatus = (app, actor, user, status, reason) =>
  send(app, 'patch', actor, `${user.id}/status`, { status, reason });
const setRole = (app, actor, user, role) => send(app, 'patch', actor, `${user.id}/role`, { role });

const admin = (overrides) => createUser({ role: 'admin', status: 'active', ...overrides });
const pending = (overrides) => createUser({ status: 'pending', ...overrides });

async function mailSent(app) {
  await app.locals.mailer.idle();
  return app.locals.mailer.outbox;
}

describe('PATCH /api/users/:id/status', () => {
  it('approves a pending user, records who and when, and keeps the history', async () => {
    const app = buildApp();
    const actor = await admin({ name: 'Ada Admin' });
    const user = await pending();

    const res = await setStatus(app, actor, user, 'active');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: user.id,
      status: 'active',
      role: 'staff',
      statusChangedBy: actor.id,
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const stored = await User.findById(user._id);
    expect(stored).toMatchObject({ status: 'active' });
    expect(stored.statusChangedAt).toBeInstanceOf(Date);
    const [change] = await StatusChange.find({ user: user._id });
    expect(change).toMatchObject({
      from: 'pending',
      to: 'active',
      changedByName: 'Ada Admin',
    });
    expect(String(change.changedBy)).toBe(actor.id);
  });

  it.each([
    ['pending', 'rejected'],
    ['active', 'rejected'],
    ['rejected', 'active'],
    ['rejected', 'pending'],
  ])('allows %s to %s', async (from, to) => {
    const app = buildApp();
    const actor = await admin();
    const user = await createUser({ status: from });

    const res = await setStatus(app, actor, user, to);

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe(to);
    expect(await StatusChange.countDocuments({ user: user._id, from, to })).toBe(1);
  });

  it.each([
    ['active', 'pending'],
    ['pending', 'pending'],
    ['active', 'active'],
    ['rejected', 'rejected'],
  ])('refuses %s to %s with INVALID_TRANSITION', async (from, to) => {
    const app = buildApp();
    const actor = await admin();
    const user = await createUser({ status: from });

    const res = await setStatus(app, actor, user, to);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
    expect(await StatusChange.countDocuments()).toBe(0);
  });

  it('stores a trimmed reason, mirrors it on the user and returns it to admins', async () => {
    const app = buildApp();
    const actor = await admin();
    const user = await pending();

    const res = await setStatus(app, actor, user, 'rejected', '  Not on the team  ');

    expect(res.body.user.statusReason).toBe('Not on the team');
    expect((await User.findById(user._id)).statusReason).toBe('Not on the team');
    expect((await StatusChange.findOne({ user: user._id })).reason).toBe('Not on the team');
  });

  it('clears the mirrored reason when the next change gives none', async () => {
    const app = buildApp();
    const actor = await admin();
    const user = await pending();
    await setStatus(app, actor, user, 'rejected', 'Mistake');

    await setStatus(app, actor, user, 'active');

    expect((await User.findById(user._id)).statusReason).toBeUndefined();
    expect(await StatusChange.countDocuments({ user: user._id })).toBe(2);
  });

  it('refuses approval of an incomplete profile but allows rejecting one', async () => {
    const app = buildApp();
    const actor = await admin();
    const waiting = await pending({ emailVerified: false });
    const rejected = await createUser({ status: 'rejected', emailVerified: false });

    const approve = await setStatus(app, actor, waiting, 'active');
    expect(approve.status).toBe(409);
    expect(approve.body.code).toBe('PROFILE_INCOMPLETE');
    const reactivate = await setStatus(app, actor, rejected, 'active');
    expect(reactivate.body.code).toBe('PROFILE_INCOMPLETE');

    expect((await setStatus(app, actor, waiting, 'rejected')).status).toBe(200);
    expect((await setStatus(app, actor, rejected, 'pending')).status).toBe(200);
  });

  it('ends the sessions of a rejected user immediately', async () => {
    const app = buildApp();
    const actor = await admin();
    const user = await createUser({ status: 'active' });
    await startSession(user, {}, testConfig);
    expect(await RefreshToken.countDocuments({ user: user._id, revokedAt: null })).toBe(1);

    await setStatus(app, actor, user, 'rejected');

    expect(await RefreshToken.countDocuments({ user: user._id, revokedAt: null })).toBe(0);
    const me = await request(app).get('/api/auth/me').set('x-test-user', user.id);
    expect(me.status).toBe(403);
    expect(me.body.code).toBe('ACCOUNT_REJECTED');
  });

  it('refuses rejecting yourself, even with other admins around', async () => {
    const app = buildApp();
    const actor = await admin();
    await admin();

    const res = await setStatus(app, actor, actor, 'rejected');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CANNOT_CHANGE_SELF');
    expect((await User.findById(actor._id)).status).toBe('active');
  });

  it('lets only one of two admins who act at the same moment win', async () => {
    const app = buildApp();
    const [a, b] = [await admin(), await admin()];
    const user = await pending();

    const results = await Promise.all([
      setStatus(app, a, user, 'active'),
      setStatus(app, b, user, 'active'),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await StatusChange.countDocuments({ user: user._id })).toBe(1);
  });

  it('never leaves the app without an active admin when two admins reject each other', async () => {
    const app = buildApp();
    const [a, b] = [await admin(), await admin()];

    const results = await Promise.all([
      setStatus(app, a, b, 'rejected'),
      setStatus(app, b, a, 'rejected'),
    ]);

    expect(results.filter((res) => res.status === 200)).toHaveLength(1);
    expect(results.find((res) => res.status !== 200).status).toBeGreaterThanOrEqual(403);
    expect(await User.countDocuments({ role: 'admin', status: 'active' })).toBe(1);
  });

  it('is for admins only', async () => {
    const app = buildApp();
    const staff = await createUser({ role: 'staff' });
    const user = await pending();

    const refused = await setStatus(app, staff, user, 'active');
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('FORBIDDEN');
    expect((await setStatus(app, null, user, 'active')).status).toBe(401);
    expect((await User.findById(user._id)).status).toBe('pending');
  });

  it('validates the body and the id', async () => {
    const app = buildApp();
    const actor = await admin();
    const user = await pending();

    for (const body of [{}, { status: 'banned' }, { status: 'active', reason: 'x'.repeat(501) }]) {
      const res = await send(app, 'patch', actor, `${user.id}/status`, body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
    expect((await send(app, 'patch', actor, 'not-an-id/status', { status: 'active' })).status).toBe(
      404,
    );
    const missing = await send(app, 'patch', actor, `${actor.id.replace(/.$/, '0')}/status`, {
      status: 'active',
    });
    expect([404, 409]).toContain(missing.status);
  });
});

describe('notifications on status changes', () => {
  it('emails and messages a user with both when approved', async () => {
    const app = buildApp();
    const actor = await admin();
    const user = await pending({ email: 'pat@example.com', telegramId: '4242', name: 'Pat' });

    await setStatus(app, actor, user, 'active');

    const [mail] = await mailSent(app);
    expect(mail).toMatchObject({
      to: 'pat@example.com',
      subject: 'Your Inventory account was approved',
    });
    expect(mail.text).toContain('http://localhost:5173/login');
    expect(app.locals.telegram.outbox).toEqual([
      {
        chatId: '4242',
        text: 'Your Inventory account was approved. You can now log in at http://localhost:5173.',
      },
    ]);
  });

  it('puts the reason in the rejection email and never in the bot message', async () => {
    const app = buildApp();
    const actor = await admin();
    const user = await pending({ email: 'pat@example.com', telegramId: '4242' });

    await setStatus(app, actor, user, 'rejected', 'Signed up by mistake');

    const [mail] = await mailSent(app);
    expect(mail.subject).toBe('Your Inventory account request was declined');
    expect(mail.text).toContain('Signed up by mistake');
    const [message] = app.locals.telegram.outbox;
    expect(message.chatId).toBe('4242');
    expect(message.text).not.toContain('Signed up by mistake');
    expect(message.text).toMatch(/was not approved/);
  });

  it('sends only what the user has: email only, or Telegram only', async () => {
    const app = buildApp();
    const actor = await admin();
    const emailOnly = await pending({ email: 'only@example.com' });
    const telegramOnly = await pending({
      email: undefined,
      emailVerified: false,
      telegramId: '999',
    });

    await setStatus(app, actor, emailOnly, 'active');
    await setStatus(app, actor, telegramOnly, 'rejected');

    expect((await mailSent(app)).map((mail) => mail.to)).toEqual(['only@example.com']);
    expect(app.locals.telegram.outbox.map((message) => message.chatId)).toEqual(['999']);
  });

  it('counts reactivation to active as approval and to pending as nothing', async () => {
    const app = buildApp();
    const actor = await admin();
    const back = await createUser({ status: 'rejected', email: 'back@example.com' });
    const waiting = await createUser({ status: 'rejected', email: 'wait@example.com' });

    await setStatus(app, actor, back, 'active');
    await setStatus(app, actor, waiting, 'pending');

    const mail = await mailSent(app);
    expect(mail.map((m) => m.to)).toEqual(['back@example.com']);
    expect(mail[0].subject).toBe('Your Inventory account was approved');
  });

  it('keeps the change when a delivery fails', async () => {
    const app = buildApp();
    app.locals.mailer.sendInBackground = () => {
      throw new Error('smtp down');
    };
    app.locals.telegram.send = () => Promise.reject(new Error('blocked'));
    const actor = await admin();
    const user = await pending({ telegramId: '4242' });

    const res = await setStatus(app, actor, user, 'active');

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).status).toBe('active');
  });
});

describe('PATCH /api/users/:id/role', () => {
  it('promotes and demotes an active user, effective on their next request', async () => {
    const app = buildApp();
    const actor = await admin();
    const user = await createUser({ role: 'staff' });

    const promoted = await setRole(app, actor, user, 'admin');
    expect(promoted.status).toBe(200);
    expect(promoted.body.user.role).toBe('admin');
    expect((await send(app, 'get', user, 'pending-count')).status).toBe(200);

    expect((await setRole(app, actor, user, 'staff')).status).toBe(200);
    expect((await send(app, 'get', user, 'pending-count')).status).toBe(403);
  });

  it('works only for active users and for a different role', async () => {
    const app = buildApp();
    const actor = await admin();
    const waiting = await pending();
    const rejected = await createUser({ status: 'rejected' });
    const staff = await createUser({ role: 'staff' });

    for (const user of [waiting, rejected]) {
      const res = await setRole(app, actor, user, 'admin');
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('USER_NOT_ACTIVE');
    }
    const same = await setRole(app, actor, staff, 'staff');
    expect(same.status).toBe(409);
    expect(same.body.code).toBe('INVALID_TRANSITION');
  });

  it('refuses demoting yourself', async () => {
    const app = buildApp();
    const actor = await admin();
    await admin();

    const res = await setRole(app, actor, actor, 'staff');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CANNOT_CHANGE_SELF');
    expect((await User.findById(actor._id)).role).toBe('admin');
  });

  it('never leaves the app without an active admin when two admins demote each other', async () => {
    const app = buildApp();
    const [a, b] = [await admin(), await admin()];

    const results = await Promise.all([setRole(app, a, b, 'staff'), setRole(app, b, a, 'staff')]);

    expect(results.filter((res) => res.status === 200)).toHaveLength(1);
    expect(await User.countDocuments({ role: 'admin', status: 'active' })).toBe(1);
  });

  it('sends no notification and ends no session', async () => {
    const app = buildApp();
    const actor = await admin();
    const user = await createUser({ role: 'staff', telegramId: '77' });
    await startSession(user, {}, testConfig);

    await setRole(app, actor, user, 'admin');

    expect(await mailSent(app)).toHaveLength(0);
    expect(app.locals.telegram.outbox).toHaveLength(0);
    expect(await RefreshToken.countDocuments({ user: user._id, revokedAt: null })).toBe(1);
  });

  it('is for admins only and validates the role', async () => {
    const app = buildApp();
    const staff = await createUser({ role: 'staff' });
    const actor = await admin();
    const user = await createUser({ role: 'staff' });

    expect((await setRole(app, staff, user, 'admin')).status).toBe(403);
    const invalid = await send(app, 'patch', actor, `${user.id}/role`, { role: 'owner' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');
  });
});
