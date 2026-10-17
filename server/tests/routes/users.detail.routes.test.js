import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { StatusChange } from '../../src/models/StatusChange.js';
import { buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function get(app, actor, id) {
  const req = request(app).get(`/api/users/${id}`);
  if (actor) req.set('x-test-user', actor.id);
  return req;
}

const admin = () => createUser({ role: 'admin', status: 'active', name: 'Ada Admin' });
const daysAgo = (days) => new Date(Date.now() - days * 86_400_000);

describe('GET /api/users/:id', () => {
  it('returns the user with the status history, newest first', async () => {
    const app = buildApp();
    const actor = await admin();
    const user = await createUser({
      name: 'Rory Returned',
      email: 'rory@example.com',
      telegramId: '55',
      telegramUsername: 'rory_tg',
      status: 'active',
    });
    await StatusChange.create([
      {
        user: user._id,
        from: 'pending',
        to: 'rejected',
        changedBy: actor._id,
        changedByName: 'Ada Admin',
        reason: 'Wrong team',
        at: daysAgo(9),
      },
      {
        user: user._id,
        from: 'rejected',
        to: 'active',
        changedBy: actor._id,
        changedByName: 'Ada Admin',
        at: daysAgo(2),
      },
      {
        user: user._id,
        from: 'pending',
        to: 'active',
        changedBy: null,
        changedByName: 'System (admin list)',
        at: daysAgo(30),
      },
    ]);

    const res = await get(app, actor, user.id);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: user.id,
      name: 'Rory Returned',
      email: 'rory@example.com',
      telegramUsername: 'rory_tg',
      hasPassword: true,
      hasTelegram: true,
      status: 'active',
      role: 'staff',
    });
    expect(res.body.history.map((change) => `${change.from}>${change.to}`)).toEqual([
      'rejected>active',
      'pending>rejected',
      'pending>active',
    ]);
    expect(res.body.history[0]).toMatchObject({
      changedBy: actor.id,
      changedByName: 'Ada Admin',
      reason: null,
    });
    expect(res.body.history[0].id).toBeTruthy();
    expect(res.body.history[0].at).toEqual(expect.any(String));
    expect(res.body.history[1].reason).toBe('Wrong team');
    expect(res.body.history[2]).toMatchObject({
      changedBy: null,
      changedByName: 'System (admin list)',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('returns an empty history for a user whose status never changed', async () => {
    const app = buildApp();
    const actor = await admin();
    const user = await createUser({ status: 'pending' });

    const res = await get(app, actor, user.id);

    expect(res.status).toBe(200);
    expect(res.body.history).toEqual([]);
  });

  it('shows only that user history', async () => {
    const app = buildApp();
    const actor = await admin();
    const [one, other] = [await createUser(), await createUser()];
    await StatusChange.create({
      user: other._id,
      from: 'pending',
      to: 'active',
      changedBy: actor._id,
      changedByName: 'Ada Admin',
    });

    expect((await get(app, actor, one.id)).body.history).toEqual([]);
  });

  it('answers 404 for a missing or malformed id', async () => {
    const app = buildApp();
    const actor = await admin();

    const missing = await get(app, actor, '64b000000000000000000000');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('NOT_FOUND');
    expect((await get(app, actor, 'not-an-id')).status).toBe(404);
  });

  it('is for admins only', async () => {
    const app = buildApp();
    const staff = await createUser({ role: 'staff' });
    const user = await createUser();

    expect((await get(app, staff, user.id)).status).toBe(403);
    expect((await get(app, null, user.id)).status).toBe(401);
  });
});
