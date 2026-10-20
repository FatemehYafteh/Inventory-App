import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { Supplier } from '../../src/models/Supplier.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function get(app, actor, path = '') {
  const req = request(app).get(`/api/products${path}`).set('Origin', ORIGIN);
  if (actor) req.set('x-test-user', actor.id);
  return req;
}

const admin = () => createUser({ role: 'admin', status: 'active', name: 'Ada Admin' });
const staff = () => createUser({ role: 'staff', status: 'active', name: 'Sam Staff' });

let counter = 0;

async function category(title = `Category ${(counter += 1)}`) {
  return Category.create({ title });
}

async function product(cat, overrides = {}) {
  counter += 1;
  return Product.create({
    title: `Widget ${counter}`,
    sku: `sku-${counter}`,
    category: cat._id,
    price: 10,
    ...overrides,
  });
}

const titles = (res) => res.body.items.map((item) => item.title);

describe('GET /api/products', () => {
  it('lists products with category, supplier, stock status and paging info', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category('Tools');
    const supplier = await Supplier.create({ name: 'Acme' });
    await product(cat, {
      title: 'Hammer',
      sku: 'ham-1',
      supplier: supplier._id,
      price: 12.5,
      quantity: 3,
      reorderLevel: 5,
    });
    await product(cat, { title: 'Saw' });

    const res = await get(app, actor, '?sortBy=title');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, limit: 20 });
    expect(res.body.items[0]).toMatchObject({
      title: 'Hammer',
      sku: 'HAM-1',
      category: { id: cat.id, title: 'Tools' },
      supplier: { id: supplier.id, name: 'Acme' },
      price: 12.5,
      quantity: 3,
      reorderLevel: 5,
      stockStatus: 'low_stock',
      isArchived: false,
    });
    expect(res.body.items[1]).toMatchObject({
      title: 'Saw',
      supplier: null,
      stockStatus: 'out_of_stock',
    });
  });

  it('refuses unauthenticated and pending users', async () => {
    const app = buildApp();
    expect((await get(app, null)).status).toBe(401);
    const pending = await createUser({ status: 'pending' });
    expect((await get(app, pending)).status).toBe(403);
  });

  it('searches title and SKU, case-insensitively, treating regex characters literally', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    await product(cat, { title: 'Blue Pen', sku: 'PEN-BLU' });
    await product(cat, { title: 'Notebook (A5)', sku: 'NB-A5' });
    await product(cat, { title: 'Stapler', sku: 'ST-1' });

    expect(titles(await get(app, actor, '?search=pen'))).toEqual(['Blue Pen']);
    expect(titles(await get(app, actor, '?search=nb-a'))).toEqual(['Notebook (A5)']);
    expect(titles(await get(app, actor, `?search=${encodeURIComponent('(A5)')}`))).toEqual([
      'Notebook (A5)',
    ]);
    expect((await get(app, actor, '?search=.*')).body.total).toBe(0);
  });

  it('filters by category and supplier', async () => {
    const app = buildApp();
    const actor = await staff();
    const a = await category();
    const b = await category();
    const supplier = await Supplier.create({ name: 'Acme' });
    await product(a, { title: 'In A', supplier: supplier._id });
    await product(b, { title: 'In B' });

    expect(titles(await get(app, actor, `?category=${a.id}`))).toEqual(['In A']);
    expect(titles(await get(app, actor, `?category=${b.id}`))).toEqual(['In B']);
    expect(titles(await get(app, actor, `?supplier=${supplier.id}`))).toEqual(['In A']);
  });

  it('filters by stock status following each product reorder level', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    await product(cat, { title: 'Out', quantity: 0, reorderLevel: 5 });
    await product(cat, { title: 'Low edge', quantity: 5, reorderLevel: 5 });
    await product(cat, { title: 'Low', quantity: 2, reorderLevel: 5 });
    await product(cat, { title: 'In', quantity: 6, reorderLevel: 5 });
    await product(cat, { title: 'In no level', quantity: 1, reorderLevel: 0 });
    await product(cat, { title: 'Out no level', quantity: 0, reorderLevel: 0 });

    const status = async (value) => titles(await get(app, actor, `?status=${value}&sortBy=title`));
    expect(await status('out_of_stock')).toEqual(['Out', 'Out no level']);
    expect(await status('low_stock')).toEqual(['Low', 'Low edge']);
    expect(await status('in_stock')).toEqual(['In', 'In no level']);
  });

  it('sorts the whole dataset by title, quantity and price, with a stable page order', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    await product(cat, { title: 'banana', quantity: 5, price: 3 });
    await product(cat, { title: 'Apple', quantity: 9, price: 3 });
    await product(cat, { title: 'cherry', quantity: 1, price: 1 });

    expect(titles(await get(app, actor, '?sortBy=title'))).toEqual(['Apple', 'banana', 'cherry']);
    expect(titles(await get(app, actor, '?sortBy=title&order=desc'))).toEqual([
      'cherry',
      'banana',
      'Apple',
    ]);
    expect(titles(await get(app, actor, '?sortBy=quantity&order=desc'))).toEqual([
      'Apple',
      'banana',
      'cherry',
    ]);
    expect(titles(await get(app, actor, '?sortBy=price&order=asc'))[0]).toBe('cherry');

    // A sort across pages covers the whole set, not just the current page.
    const first = await get(app, actor, '?sortBy=quantity&order=asc&limit=2&page=1');
    const second = await get(app, actor, '?sortBy=quantity&order=asc&limit=2&page=2');
    expect([...titles(first), ...titles(second)]).toEqual(['cherry', 'banana', 'Apple']);
    expect(second.body).toMatchObject({ total: 3, page: 2, limit: 2 });
  });

  it('pages without repeating or skipping rows that share a sort value', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    for (let i = 0; i < 5; i += 1) await product(cat, { price: 7 });

    const seen = [];
    for (const page of [1, 2, 3]) {
      seen.push(
        ...(await get(app, actor, `?sortBy=price&limit=2&page=${page}`)).body.items.map(
          (i) => i.id,
        ),
      );
    }
    expect(new Set(seen).size).toBe(5);
  });

  it('rejects bad query values', async () => {
    const app = buildApp();
    const actor = await staff();
    for (const query of [
      '?sortBy=sku',
      '?order=up',
      '?status=sold_out',
      '?category=nope',
      '?limit=500',
      '?page=0',
      '?archived=maybe',
    ]) {
      const res = await get(app, actor, query);
      expect(res.status, query).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('hides archived products by default and shows them to admins who ask', async () => {
    const app = buildApp();
    const actor = await admin();
    const cat = await category();
    await product(cat, { title: 'Live' });
    await product(cat, { title: 'Gone', isArchived: true, archivedAt: new Date() });

    expect(titles(await get(app, actor))).toEqual(['Live']);
    expect(titles(await get(app, actor, '?archived=false'))).toEqual(['Live']);
    expect(titles(await get(app, actor, '?archived=true&sortBy=title'))).toEqual(['Gone', 'Live']);
  });

  it('returns 403 FORBIDDEN when staff ask for archived products', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    await product(cat, { isArchived: true, archivedAt: new Date() });

    const res = await get(app, actor, '?archived=true');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect((await get(app, actor, '?archived=false')).status).toBe(200);
  });

  it('answers a 10,000-product list well under 300 ms', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    const supplier = await Supplier.create({ name: 'Bulk' });
    await Product.insertMany(
      Array.from({ length: 10_000 }, (_, i) => ({
        title: `Bulk item ${i}`,
        sku: `BULK-${i}`,
        category: cat._id,
        supplier: supplier._id,
        price: (i % 500) + 0.99,
        quantity: i % 40,
        reorderLevel: 10,
        isArchived: i % 50 === 0,
      })),
      { ordered: false },
    );

    const timed = async (query) => {
      const start = performance.now();
      const res = await get(app, actor, query);
      return { res, ms: performance.now() - start };
    };
    const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    for (const query of [
      '?sortBy=title&limit=20',
      '?sortBy=quantity&order=desc',
      '?sortBy=price&status=low_stock',
      `?search=bulk item 99&category=${cat.id}&supplier=${supplier.id}`,
    ]) {
      // An untimed warm-up of this query shape, then the median of three, so one GC pause or
      // load spike cannot fail the test while a real slowdown (all three runs) still does.
      await timed(query);
      const samples = [];
      for (let i = 0; i < 3; i += 1) {
        const { res, ms } = await timed(query);
        expect(res.status, query).toBe(200);
        samples.push(ms);
      }
      expect(median(samples), query).toBeLessThan(300);
    }
  }, 60_000);
});

describe('GET /api/products/:id', () => {
  it('returns one product to any active user', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category('Tools');
    const item = await product(cat, { title: 'Hammer', quantity: 2, reorderLevel: 2 });

    const res = await get(app, actor, `/${item.id}`);

    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({
      id: item.id,
      title: 'Hammer',
      category: { id: cat.id, title: 'Tools' },
      supplier: null,
      stockStatus: 'low_stock',
    });
  });

  it('returns 404 for an unknown or malformed id', async () => {
    const app = buildApp();
    const actor = await staff();
    expect((await get(app, actor, '/not-an-id')).status).toBe(404);
    expect((await get(app, actor, '/64b7f0f0f0f0f0f0f0f0f0f0')).status).toBe(404);
  });

  it('shows an archived product to admins and returns 404 NOT_FOUND to staff', async () => {
    const app = buildApp();
    const cat = await category();
    const item = await product(cat, { isArchived: true, archivedAt: new Date() });

    const asAdmin = await get(app, await admin(), `/${item.id}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.product.isArchived).toBe(true);

    const asStaff = await get(app, await staff(), `/${item.id}`);
    expect(asStaff.status).toBe(404);
    expect(asStaff.body.code).toBe('NOT_FOUND');
  });

  it('refuses unauthenticated users', async () => {
    const res = await get(buildApp(), null, '/64b7f0f0f0f0f0f0f0f0f0f0');
    expect(res.status).toBe(401);
  });
});
