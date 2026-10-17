import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { seedDatabase } from '../../seed/seed.js';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function send(app, method, actor, path, body) {
  const req = request(app)
    [method](`/api/categories${path}`)
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest');
  if (actor) req.set('x-test-user', actor.id);
  return body === undefined ? req : req.send(body);
}

const admin = () => createUser({ role: 'admin', status: 'active', name: 'Ada Admin' });
const staff = () => createUser({ role: 'staff', status: 'active', name: 'Sam Staff' });

async function product(category, overrides = {}) {
  return Product.create({
    title: 'Widget',
    sku: `SKU-${Math.random().toString(36).slice(2, 10)}`,
    category: category._id,
    price: 1,
    ...overrides,
  });
}

describe('GET /api/categories', () => {
  it('lists every category by title with its product count, archived products included', async () => {
    const app = buildApp();
    const actor = await staff();
    const tools = await Category.create({ title: 'tools', description: 'Hand tools' });
    const books = await Category.create({ title: 'Books' });
    await Category.create({ title: 'Empty' });
    await product(tools);
    await product(tools, { isArchived: true, archivedAt: new Date() });
    await product(books);

    const res = await send(app, 'get', actor, '');

    expect(res.status).toBe(200);
    expect(res.body.items.map((c) => [c.title, c.productCount])).toEqual([
      ['Books', 1],
      ['Empty', 0],
      ['tools', 2],
    ]);
    expect(res.body.items[2]).toMatchObject({ id: tools.id, description: 'Hand tools' });
  });

  it('refuses anonymous and pending users', async () => {
    const app = buildApp();
    expect((await send(app, 'get', null, '')).status).toBe(401);
    const pending = await createUser({ status: 'pending' });
    expect((await send(app, 'get', pending, '')).status).toBe(403);
  });
});

describe('POST /api/categories', () => {
  it('lets an admin create a category, trimming the title', async () => {
    const app = buildApp();
    const actor = await admin();

    const res = await send(app, 'post', actor, '', {
      title: '  Tools  ',
      description: 'Hand tools',
    });

    expect(res.status).toBe(201);
    expect(res.body.category).toMatchObject({
      title: 'Tools',
      description: 'Hand tools',
      productCount: 0,
    });
    expect(await Category.countDocuments({ title: 'Tools' })).toBe(1);
  });

  it('treats an empty description as none', async () => {
    const app = buildApp();
    const res = await send(app, 'post', await admin(), '', { title: 'Tools', description: '' });

    expect(res.status).toBe(201);
    expect((await Category.findOne({ title: 'Tools' })).description).toBeUndefined();
  });

  it('rejects a missing, blank or too long title with field errors', async () => {
    const app = buildApp();
    const actor = await admin();

    for (const body of [{}, { title: '   ' }, { title: 'x'.repeat(101) }]) {
      const res = await send(app, 'post', actor, '', body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.title).toBeTruthy();
    }
  });

  it('rejects a duplicate title in any letter case with DUPLICATE_NAME', async () => {
    const app = buildApp();
    const actor = await admin();
    await Category.create({ title: 'Tools' });

    const res = await send(app, 'post', actor, '', { title: 'tOOLS' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'DUPLICATE_NAME',
      errors: { title: 'A category with this title already exists' },
    });
    expect(await Category.countDocuments()).toBe(1);
  });
});

describe('PATCH /api/categories/:id', () => {
  it('updates the title and description, and an empty description clears it', async () => {
    const app = buildApp();
    const actor = await admin();
    const category = await Category.create({ title: 'Tools', description: 'Hand tools' });

    const renamed = await send(app, 'patch', actor, `/${category.id}`, { title: 'Hardware' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.category).toMatchObject({ title: 'Hardware', description: 'Hand tools' });

    const cleared = await send(app, 'patch', actor, `/${category.id}`, { description: '' });
    expect(cleared.body.category.description).toBe('');
    expect((await Category.findById(category.id)).description).toBeUndefined();
  });

  it('keeps the same title when saving it back unchanged', async () => {
    const app = buildApp();
    const category = await Category.create({ title: 'Tools' });

    const res = await send(app, 'patch', await admin(), `/${category.id}`, { title: 'tools' });

    expect(res.status).toBe(200);
  });

  it('rejects a title that another category already has', async () => {
    const app = buildApp();
    const actor = await admin();
    await Category.create({ title: 'Tools' });
    const other = await Category.create({ title: 'Books' });

    const res = await send(app, 'patch', actor, `/${other.id}`, { title: 'TOOLS' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_NAME');
  });

  it('rejects an empty update and an unknown or malformed id', async () => {
    const app = buildApp();
    const actor = await admin();
    const category = await Category.create({ title: 'Tools' });

    expect((await send(app, 'patch', actor, `/${category.id}`, {})).status).toBe(400);
    expect(
      (await send(app, 'patch', actor, '/64b7f0c2a1b2c3d4e5f60718', { title: 'X' })).status,
    ).toBe(404);
    expect((await send(app, 'patch', actor, '/not-an-id', { title: 'X' })).status).toBe(404);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('deletes a category with no products', async () => {
    const app = buildApp();
    const category = await Category.create({ title: 'Seasonal' });

    const res = await send(app, 'delete', await admin(), `/${category.id}`);

    expect(res.status).toBe(204);
    expect(await Category.countDocuments()).toBe(0);
  });

  it.each([
    ['an active product', [{}], 1],
    ['an archived product only', [{ isArchived: true, archivedAt: new Date() }], 1],
    ['active and archived products', [{}, { isArchived: true, archivedAt: new Date() }], 2],
  ])('blocks delete for %s with IN_USE and the count', async (_label, products, count) => {
    const app = buildApp();
    const category = await Category.create({ title: 'Tools' });
    for (const overrides of products) await product(category, overrides);

    const res = await send(app, 'delete', await admin(), `/${category.id}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IN_USE');
    expect(res.body.details).toEqual({ productCount: count });
    expect(res.body.message).toContain(`Used by ${count} product`);
    expect(await Category.countDocuments()).toBe(1);
  });

  it('answers 404 for an unknown or malformed id', async () => {
    const app = buildApp();
    const actor = await admin();
    expect((await send(app, 'delete', actor, '/64b7f0c2a1b2c3d4e5f60718')).status).toBe(404);
    expect((await send(app, 'delete', actor, '/not-an-id')).status).toBe(404);
  });
});

describe('write access', () => {
  it('answers 403 to staff and 401 to anonymous callers on every write', async () => {
    const app = buildApp();
    const staffer = await staff();
    const category = await Category.create({ title: 'Tools' });
    const writes = [
      ['post', '', { title: 'New' }],
      ['patch', `/${category.id}`, { title: 'Renamed' }],
      ['delete', `/${category.id}`, undefined],
    ];

    for (const [method, path, body] of writes) {
      expect((await send(app, method, staffer, path, body)).status).toBe(403);
      expect((await send(app, method, null, path, body)).status).toBe(401);
    }
    expect(await Category.findById(category.id)).toMatchObject({ title: 'Tools' });
  });

  it('refuses a write without the CSRF header', async () => {
    const app = buildApp();
    const actor = await admin();

    const res = await request(app)
      .post('/api/categories')
      .set('Origin', ORIGIN)
      .set('x-test-user', actor.id)
      .send({ title: 'Tools' });

    expect(res.status).toBe(403);
    expect(await Category.countDocuments()).toBe(0);
  });
});

describe('against the seed data', () => {
  it('shows real counts, deletes the empty category and blocks every one in use', async () => {
    await seedDatabase({ now: new Date('2026-10-12T12:00:00Z') });
    const app = buildApp();
    const actor = await admin();

    const { items } = (await send(app, 'get', actor, '')).body;
    const seasonal = items.find((category) => category.title === 'Seasonal');
    const inUse = items.filter((category) => category.title !== 'Seasonal');
    expect(seasonal.productCount).toBe(0);
    expect(inUse.every((category) => category.productCount > 0)).toBe(true);

    for (const category of inUse) {
      const res = await send(app, 'delete', actor, `/${category.id}`);
      expect(res.status).toBe(409);
      expect(res.body.details).toEqual({ productCount: category.productCount });
    }
    expect((await send(app, 'delete', actor, `/${seasonal.id}`)).status).toBe(204);
  });
});
