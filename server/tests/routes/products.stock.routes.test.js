import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { Supplier } from '../../src/models/Supplier.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function send(app, method, actor, path, body, { csrf = true } = {}) {
  const req = request(app)[method](path).set('Origin', ORIGIN);
  if (csrf) req.set('X-Requested-With', 'XMLHttpRequest');
  if (actor) req.set('x-test-user', actor.id);
  return body ? req.send(body) : req;
}

const stock = (app, actor, id, body, options) =>
  send(app, 'post', actor, `/api/products/${id}/stock`, body, options);
const movements = (app, actor, id, query = '') =>
  send(app, 'get', actor, `/api/products/${id}/movements${query}`);

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

const quantityOf = async (item) => (await Product.findById(item._id)).quantity;

describe('POST /api/products/:id/stock', () => {
  it('receives stock, records the supplier and the acting user, and returns both', async () => {
    const app = buildApp();
    const actor = await staff();
    const supplier = await Supplier.create({ name: 'Acme' });
    const item = await product({ quantity: 2, supplier: supplier._id });

    const res = await stock(app, actor, item.id, { type: 'receive', quantity: 5, note: ' Truck ' });

    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({ id: item.id, quantity: 7 });
    expect(res.body.movement).toMatchObject({
      type: 'receive',
      quantityChange: 5,
      quantityBefore: 2,
      quantityAfter: 7,
      supplier: { id: supplier.id, name: 'Acme' },
      note: 'Truck',
      performedBy: { id: actor.id, name: 'Sam Staff' },
    });
    expect(await StockMovement.countDocuments({ product: item._id })).toBe(1);
  });

  it('ships, adjusts, increments and decrements', async () => {
    const app = buildApp();
    const actor = await admin();
    const item = await product({ quantity: 10 });

    await stock(app, actor, item.id, { type: 'ship', quantity: 4 });
    expect(await quantityOf(item)).toBe(6);
    await stock(app, actor, item.id, { type: 'adjust', quantity: 20 });
    expect(await quantityOf(item)).toBe(20);
    await stock(app, actor, item.id, { type: 'increment' });
    await stock(app, actor, item.id, { type: 'increment' });
    await stock(app, actor, item.id, { type: 'decrement' });
    expect(await quantityOf(item)).toBe(21);

    const types = (await StockMovement.find({ product: item._id }).sort({ createdAt: 1 })).map(
      (m) => m.type,
    );
    expect(types).toEqual(['ship', 'adjust', 'increment', 'increment', 'decrement']);
  });

  it('ignores a quantity sent with increment and decrement', async () => {
    const app = buildApp();
    const item = await product({ quantity: 5 });

    const res = await stock(app, await staff(), item.id, { type: 'increment', quantity: 99 });

    expect(res.status).toBe(201);
    expect(res.body.product.quantity).toBe(6);
  });

  it('ignores a performedBy in the body', async () => {
    const app = buildApp();
    const actor = await staff();
    const other = await admin();
    const item = await product({ quantity: 1 });

    const res = await stock(app, actor, item.id, {
      type: 'receive',
      quantity: 1,
      performedBy: other.id,
      performedByName: 'Someone Else',
    });

    expect(res.status).toBe(201);
    expect(res.body.movement.performedBy).toEqual({ id: actor.id, name: 'Sam Staff' });
  });

  it('refuses shipping more than is available and changes nothing', async () => {
    const app = buildApp();
    const item = await product({ quantity: 3 });

    const res = await stock(app, await staff(), item.id, { type: 'ship', quantity: 4 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    expect(await quantityOf(item)).toBe(3);
    expect(await StockMovement.countDocuments()).toBe(0);
  });

  it('refuses decrementing at zero', async () => {
    const app = buildApp();
    const item = await product({ quantity: 0 });

    const res = await stock(app, await staff(), item.id, { type: 'decrement' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });

  it('refuses an adjust to the current quantity', async () => {
    const app = buildApp();
    const item = await product({ quantity: 4 });

    const res = await stock(app, await staff(), item.id, { type: 'adjust', quantity: 4 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_CHANGE');
    expect(res.body.errors.quantity).toBeTruthy();
  });

  it('refuses an archived product', async () => {
    const app = buildApp();
    const item = await product({ quantity: 4, isArchived: true });

    const res = await stock(app, await admin(), item.id, { type: 'receive', quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PRODUCT_ARCHIVED');
    expect(await quantityOf(item)).toBe(4);
  });

  it('rejects invalid bodies with field messages', async () => {
    const app = buildApp();
    const actor = await staff();
    const item = await product({ quantity: 4 });
    const bad = async (body) => (await stock(app, actor, item.id, body)).body;

    expect((await bad({})).errors.type).toBeTruthy();
    expect((await bad({ type: 'steal', quantity: 1 })).errors.type).toBeTruthy();
    expect((await bad({ type: 'receive' })).errors.quantity).toBe('Enter a quantity');
    expect((await bad({ type: 'receive', quantity: 0 })).errors.quantity).toBeTruthy();
    expect((await bad({ type: 'ship', quantity: -2 })).errors.quantity).toBeTruthy();
    expect((await bad({ type: 'ship', quantity: 1.5 })).errors.quantity).toBeTruthy();
    expect((await bad({ type: 'ship', quantity: '3' })).errors.quantity).toBeTruthy();
    expect((await bad({ type: 'adjust', quantity: -1 })).errors.quantity).toBeTruthy();
    expect(
      (await bad({ type: 'receive', quantity: 1, note: 'x'.repeat(501) })).errors.note,
    ).toBeTruthy();
    expect(await StockMovement.countDocuments()).toBe(0);
  });

  it('allows adjusting down to zero', async () => {
    const app = buildApp();
    const item = await product({ quantity: 4 });

    const res = await stock(app, await staff(), item.id, { type: 'adjust', quantity: 0 });

    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({ quantity: 0, stockStatus: 'out_of_stock' });
  });

  it('answers 404 for an unknown or malformed id', async () => {
    const app = buildApp();
    const actor = await staff();
    const body = { type: 'receive', quantity: 1 };

    expect((await stock(app, actor, '64b000000000000000000000', body)).status).toBe(404);
    expect((await stock(app, actor, 'not-an-id', body)).status).toBe(404);
  });

  it('refuses unauthenticated, pending and cross-site requests', async () => {
    const app = buildApp();
    const item = await product({ quantity: 4 });
    const body = { type: 'receive', quantity: 1 };

    expect((await stock(app, null, item.id, body)).status).toBe(401);
    expect((await stock(app, await createUser({ status: 'pending' }), item.id, body)).status).toBe(
      403,
    );
    expect((await stock(app, await staff(), item.id, body, { csrf: false })).status).toBe(403);
    expect(await quantityOf(item)).toBe(4);
  });
});

describe('GET /api/products/:id/movements', () => {
  it('lists a product’s movements newest first with the performer, and only its own', async () => {
    const app = buildApp();
    const actor = await staff();
    const item = await product({ quantity: 0 });
    const other = await product({ quantity: 0 });
    await stock(app, actor, item.id, { type: 'receive', quantity: 5 });
    await stock(app, actor, item.id, { type: 'ship', quantity: 2, note: 'Order 7' });
    await stock(app, actor, other.id, { type: 'receive', quantity: 9 });

    const res = await movements(app, await staff(), item.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, limit: 20 });
    expect(res.body.items.map((m) => m.type)).toEqual(['ship', 'receive']);
    expect(res.body.items[0]).toMatchObject({
      quantityChange: -2,
      quantityBefore: 5,
      quantityAfter: 3,
      note: 'Order 7',
      supplier: null,
      performedBy: { id: actor.id, name: 'Sam Staff' },
    });
  });

  it('pages without repeating or skipping rows', async () => {
    const app = buildApp();
    const actor = await staff();
    const item = await product({ quantity: 0 });
    for (let i = 0; i < 5; i += 1) {
      await stock(app, actor, item.id, { type: 'increment' });
    }

    const first = await movements(app, actor, item.id, '?page=1&limit=2');
    const last = await movements(app, actor, item.id, '?page=3&limit=2');
    const all = await movements(app, actor, item.id, '?limit=100');

    expect(first.body.items.map((m) => m.id)).toEqual(all.body.items.slice(0, 2).map((m) => m.id));
    expect(last.body.items).toHaveLength(1);
    expect(last.body.total).toBe(5);
  });

  it('returns an empty page for a product with no movements', async () => {
    const app = buildApp();
    const item = await product();

    const res = await movements(app, await staff(), item.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], total: 0 });
  });

  it('rejects an invalid page or limit', async () => {
    const app = buildApp();
    const item = await product();

    expect((await movements(app, await staff(), item.id, '?page=0')).status).toBe(400);
    expect((await movements(app, await staff(), item.id, '?limit=101')).status).toBe(400);
  });

  it('hides an archived product’s history from staff but not from admins', async () => {
    const app = buildApp();
    const item = await product({ quantity: 1, isArchived: true });

    expect((await movements(app, await staff(), item.id)).status).toBe(404);
    expect((await movements(app, await admin(), item.id)).status).toBe(200);
  });

  it('answers 404 for an unknown or malformed id', async () => {
    const app = buildApp();
    const actor = await staff();

    expect((await movements(app, actor, '64b000000000000000000000')).status).toBe(404);
    expect((await movements(app, actor, 'not-an-id')).status).toBe(404);
  });

  it('refuses unauthenticated and pending users', async () => {
    const app = buildApp();
    const item = await product();

    expect((await movements(app, null, item.id)).status).toBe(401);
    expect((await movements(app, await createUser({ status: 'pending' }), item.id)).status).toBe(
      403,
    );
  });
});
