import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function get(app, actor, path, query = {}) {
  const req = request(app).get(`/api/users${path}`).query(query);
  if (actor) req.set('x-test-user', actor.id);
  return req;
}

const admin = () => createUser({ role: 'admin', status: 'active', name: 'Ada Admin' });
const names = (res) => res.body.items.map((item) => item.name);

describe('GET /api/users', () => {
  it('lists the Pending tab as complete profiles only, oldest signup first', async () => {
    const app = buildApp();
    const actor = await admin();
    const newer = await createUser({ status: 'pending', name: 'Amy Newer' });
    const older = await createUser({ status: 'pending', name: 'Zed Older' });
    await createUser({ status: 'pending', name: 'Ivy Unfinished', emailVerified: false });
    await createUser({ status: 'active', name: 'Not Pending' });
    // createdAt is immutable in Mongoose, so move the older signup back in time directly.
    await older.constructor.collection.updateOne(
      { _id: older._id },
      { $set: { createdAt: new Date(Date.now() - 86_400_000) } },
    );

    const res = await get(app, actor, '', { status: 'pending' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Zed Older', 'Amy Newer']);
    expect(res.body).toMatchObject({ total: 2, page: 1, limit: 20 });
    expect(newer.id).toBeTruthy();
  });

  it('lists unfinished signups under the incomplete filter', async () => {
    const app = buildApp();
    const actor = await admin();
    await createUser({ status: 'pending', name: 'Complete Cora' });
    await createUser({ status: 'pending', name: 'Ivy Unfinished', emailVerified: false });
    await createUser({
      status: 'pending',
      name: undefined,
      email: undefined,
      emailVerified: false,
    });

    const res = await get(app, actor, '', { status: 'pending', incomplete: 'true' });

    expect(res.body.total).toBe(2);
    expect(res.body.items.every((item) => item.profileComplete === false)).toBe(true);
    expect(names(res)).not.toContain('Complete Cora');
  });

  it('lists Active and Rejected by name, ignoring case', async () => {
    const app = buildApp();
    const actor = await admin();
    await createUser({ status: 'active', name: 'zoe' });
    await createUser({ status: 'active', name: 'Bob' });
    await createUser({ status: 'rejected', name: 'Rex Rejected' });

    expect(names(await get(app, actor, '', { status: 'active' }))).toEqual([
      'Ada Admin',
      'Bob',
      'zoe',
    ]);
    expect(names(await get(app, actor, '', { status: 'rejected' }))).toEqual(['Rex Rejected']);
  });

  it('searches name, email and Telegram username, ignoring case', async () => {
    const app = buildApp();
    const actor = await admin();
    await createUser({ name: 'Nina Novak', email: 'n1@example.com' });
    await createUser({ name: 'Other', email: 'finder@example.com' });
    await createUser({ name: 'Third', email: 't@example.com', telegramUsername: 'tg_Finder' });
    await createUser({ name: 'Nobody', email: 'x@example.com' });

    expect(names(await get(app, actor, '', { search: 'NOVAK' }))).toEqual(['Nina Novak']);
    expect(names(await get(app, actor, '', { search: 'finder' }))).toEqual(['Other', 'Third']);
  });

  it('treats the search text literally', async () => {
    const app = buildApp();
    const actor = await admin();
    await createUser({ name: 'abc' });
    await createUser({ name: 'a.c' });

    expect(names(await get(app, actor, '', { search: 'a.c' }))).toEqual(['a.c']);
    const odd = await get(app, actor, '', { search: '(' });
    expect(odd.status).toBe(200);
    expect(odd.body.items).toEqual([]);
  });

  it('pages the result and reports the total', async () => {
    const app = buildApp();
    const actor = await admin();
    for (let i = 1; i <= 5; i += 1) await createUser({ name: `User ${i}` });

    const second = await get(app, actor, '', { status: 'active', page: 2, limit: 2 });

    expect(names(second)).toEqual(['User 2', 'User 3']);
    expect(second.body).toMatchObject({ total: 6, page: 2, limit: 2 });
  });

  it('returns what the table needs and never a password hash', async () => {
    const app = buildApp();
    const actor = await admin();
    await createUser({
      name: 'Lena Linked',
      email: 'linked@example.com',
      telegramId: '100',
      telegramUsername: 'lena_tg',
      lastLoginAt: new Date('2026-10-01T10:00:00Z'),
    });
    await createUser({ name: 'No Password', email: 'np@example.com', password: null });

    const res = await get(app, actor, '', { search: 'l' });
    const linked = res.body.items.find((item) => item.name === 'Lena Linked');

    expect(linked).toMatchObject({
      email: 'linked@example.com',
      emailVerified: true,
      telegramUsername: 'lena_tg',
      hasPassword: true,
      hasTelegram: true,
      role: 'staff',
      status: 'active',
      profileComplete: true,
    });
    expect(linked.createdAt).toBeTruthy();
    expect(linked.lastLoginAt).toBe('2026-10-01T10:00:00.000Z');
    const noPassword = (await get(app, actor, '', { search: 'No Password' })).body.items[0];
    expect(noPassword).toMatchObject({ hasPassword: false, hasTelegram: false });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('lists everyone when no status is given', async () => {
    const app = buildApp();
    const actor = await admin();
    await createUser({ status: 'pending' });
    await createUser({ status: 'rejected' });

    expect((await get(app, actor, '')).body.total).toBe(3);
  });

  it('validates the query', async () => {
    const app = buildApp();
    const actor = await admin();

    for (const query of [{ status: 'banned' }, { limit: 101 }, { page: 0 }, { limit: 'many' }]) {
      const res = await get(app, actor, '', query);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('is for admins only', async () => {
    const app = buildApp();
    const staff = await createUser({ role: 'staff' });
    const waiting = await createUser({ status: 'pending' });

    expect((await get(app, staff, '')).status).toBe(403);
    expect((await get(app, waiting, '')).body.code).toBe('ACCOUNT_PENDING');
    expect((await get(app, null, '')).status).toBe(401);
  });
});

describe('GET /api/users/pending-count', () => {
  it('counts only complete profiles waiting for approval', async () => {
    const app = buildApp();
    const actor = await admin();
    await createUser({ status: 'pending' });
    await createUser({ status: 'pending' });
    await createUser({ status: 'pending', emailVerified: false });
    await createUser({ status: 'rejected' });

    const res = await get(app, actor, '/pending-count');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 2 });
  });

  it('is for admins only', async () => {
    const app = buildApp();
    const staff = await createUser({ role: 'staff' });

    expect((await get(app, staff, '/pending-count')).status).toBe(403);
  });
});
