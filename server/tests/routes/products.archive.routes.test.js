import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { Supplier } from '../../src/models/Supplier.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function send(app, method, actor, path, { csrf = true } = {}) {
  const req = request(app)[method](path).set('Origin', ORIGIN);
  if (csrf) req.set('X-Requested-With', 'XMLHttpRequest');
  if (actor) req.set('x-test-user', actor.id);
  return req;
}

const archive = (app, actor, id, options) =>
  send(app, 'patch', actor, `/api/products/${id}/archive`, options);
const restore = (app, actor, id, options) =>
  send(app, 'patch', actor, `/api/products/${id}/restore`, options);

const admin = () => createUser({ role: 'admin', status: 'active', name: 'Ada Admin' });
const staff = () => createUser({ role: 'staff', status: 'active', name: 'Sam Staff' });

let counter = 0;

async function product(overrides = {}) {
  counter += 1;
  const cat = (await Category.findOne()) ?? (await Category.create({ title: 'General' }));
  return Product.create({
    title: `Widget ${counter}`,
    sku: `SKU-${counter}`,
    category: cat._id,
    price: 10,
    ...overrides,
  });
}

const listTitles = async (app, actor, query = '') => {
  const res = await send(app, 'get', actor, `/api/products${query}`);
  return res.body.items.map((item) => item.title);
};

describe('PATCH /api/products/:id/archive', () => {
  it('archives a product for an admin and keeps every other field, stock included', async () => {
    const app = buildApp();
    const owner = await admin();
    const supplier = await Supplier.create({ name: 'Acme' });
    const item = await product({
      title: 'Hammer',
      quantity: 7,
      reorderLevel: 3,
      supplier: supplier._id,
    });

    const res = await archive(app, owner, item.id);

    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({
      id: item.id,
      title: 'Hammer',
      sku: item.sku,
      quantity: 7,
      reorderLevel: 3,
      supplier: { id: supplier.id, name: 'Acme' },
      isArchived: true,
    });
    expect(new Date(res.body.product.archivedAt).getTime()).not.toBeNaN();
    const stored = await Product.findById(item.id);
    expect(stored.isArchived).toBe(true);
    expect(stored.archivedAt).toBeInstanceOf(Date);
    expect(stored.quantity).toBe(7);
  });

  it('hides the product from the default list, shows it to admins who ask, and hides it from staff', async () => {
    const app = buildApp();
    const owner = await admin();
    const editor = await staff();
    const item = await product({ title: 'Gone' });
    await product({ title: 'Live' });

    await archive(app, owner, item.id);

    expect(await listTitles(app, owner)).toEqual(['Live']);
    expect(await listTitles(app, owner, '?archived=true&sortBy=title')).toEqual(['Gone', 'Live']);
    expect(await listTitles(app, editor)).toEqual(['Live']);
    expect((await send(app, 'get', editor, `/api/products/${item.id}`)).status).toBe(404);
    expect((await send(app, 'get', owner, `/api/products/${item.id}`)).status).toBe(200);
  });

  it('returns 409 ALREADY_ARCHIVED for an archived product and leaves archivedAt alone', async () => {
    const app = buildApp();
    const owner = await admin();
    const item = await product();
    await archive(app, owner, item.id);
    const firstStamp = (await Product.findById(item.id)).archivedAt.getTime();

    const again = await archive(app, owner, item.id);

    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_ARCHIVED');
    expect((await Product.findById(item.id)).archivedAt.getTime()).toBe(firstStamp);
  });

  it('lets exactly one of two simultaneous archives succeed', async () => {
    const app = buildApp();
    const owner = await admin();
    const item = await product();

    const results = await Promise.all([archive(app, owner, item.id), archive(app, owner, item.id)]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect((await Product.findById(item.id)).isArchived).toBe(true);
  });

  it('returns 403 to staff and leaves the product untouched', async () => {
    const app = buildApp();
    const item = await product();

    const res = await archive(app, await staff(), item.id);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    const stored = await Product.findById(item.id);
    expect(stored.isArchived).toBe(false);
    expect(stored.archivedAt).toBeUndefined();
  });

  it('returns 404 for an unknown or malformed id', async () => {
    const app = buildApp();
    const owner = await admin();
    expect((await archive(app, owner, 'not-an-id')).status).toBe(404);
    const missing = await archive(app, owner, '64b7f0f0f0f0f0f0f0f0f0f0');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('NOT_FOUND');
  });

  it('refuses unauthenticated, pending and cross-site requests', async () => {
    const app = buildApp();
    const item = await product();
    expect((await archive(app, null, item.id)).status).toBe(401);
    expect((await archive(app, await createUser({ status: 'pending' }), item.id)).status).toBe(403);
    expect((await archive(app, await admin(), item.id, { csrf: false })).status).toBe(403);
    expect((await Product.findById(item.id)).isArchived).toBe(false);
  });
});

describe('PATCH /api/products/:id/restore', () => {
  it('restores an archived product, clears archivedAt and puts it back in the default list', async () => {
    const app = buildApp();
    const owner = await admin();
    const editor = await staff();
    const item = await product({ title: 'Back', quantity: 4 });
    await archive(app, owner, item.id);

    const res = await restore(app, owner, item.id);

    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({
      id: item.id,
      isArchived: false,
      archivedAt: null,
      quantity: 4,
    });
    const stored = await Product.findById(item.id);
    expect(stored.isArchived).toBe(false);
    expect(stored.archivedAt).toBeUndefined();
    expect(await listTitles(app, editor)).toEqual(['Back']);
    expect((await send(app, 'get', editor, `/api/products/${item.id}`)).status).toBe(200);
  });

  it('restores a product whose supplier has since been deactivated', async () => {
    const app = buildApp();
    const owner = await admin();
    const supplier = await Supplier.create({ name: 'Old Mill' });
    const item = await product({ supplier: supplier._id });
    await archive(app, owner, item.id);
    await Supplier.updateOne({ _id: supplier._id }, { isActive: false });

    const res = await restore(app, owner, item.id);

    expect(res.status).toBe(200);
    expect(res.body.product.supplier).toMatchObject({ id: supplier.id });
  });

  it('returns 409 NOT_ARCHIVED for a product that is not archived', async () => {
    const app = buildApp();
    const item = await product();

    const res = await restore(app, await admin(), item.id);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_ARCHIVED');
    expect((await Product.findById(item.id)).isArchived).toBe(false);
  });

  it('returns 403 to staff and leaves the product archived', async () => {
    const app = buildApp();
    const item = await product({ isArchived: true, archivedAt: new Date() });

    const res = await restore(app, await staff(), item.id);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect((await Product.findById(item.id)).isArchived).toBe(true);
  });

  it('returns 404 for an unknown or malformed id', async () => {
    const app = buildApp();
    const owner = await admin();
    expect((await restore(app, owner, 'not-an-id')).status).toBe(404);
    expect((await restore(app, owner, '64b7f0f0f0f0f0f0f0f0f0f0')).status).toBe(404);
  });

  it('refuses unauthenticated, pending and cross-site requests', async () => {
    const app = buildApp();
    const item = await product({ isArchived: true, archivedAt: new Date() });
    expect((await restore(app, null, item.id)).status).toBe(401);
    expect((await restore(app, await createUser({ status: 'pending' }), item.id)).status).toBe(403);
    expect((await restore(app, await admin(), item.id, { csrf: false })).status).toBe(403);
    expect((await Product.findById(item.id)).isArchived).toBe(true);
  });
});
