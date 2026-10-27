import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { Supplier } from '../../src/models/Supplier.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function get(app, actor) {
  const req = request(app)
    .get('/api/dashboard')
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest');
  return actor ? req.set('x-test-user', actor.id) : req;
}

const admin = (overrides) => createUser({ role: 'admin', name: 'Ada Admin', ...overrides });
const staff = (overrides) => createUser({ role: 'staff', name: 'Sam Staff', ...overrides });

let counter = 0;

async function product(overrides = {}) {
  counter += 1;
  const category = (await Category.findOne()) ?? (await Category.create({ title: 'General' }));
  return Product.create({
    title: `Widget ${counter}`,
    sku: `SKU-${counter}`,
    category: category._id,
    price: 10,
    quantity: 100,
    reorderLevel: 10,
    ...overrides,
  });
}

function movement(item, performer, overrides = {}) {
  return StockMovement.create({
    product: item._id,
    type: 'receive',
    quantityChange: 1,
    quantityBefore: 0,
    quantityAfter: 1,
    performedBy: performer._id,
    performedByName: performer.name,
    ...overrides,
  });
}

describe('GET /api/dashboard', () => {
  it('answers zeros and empty lists when there is nothing yet', async () => {
    const res = await get(buildApp(), await admin());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      summary: {
        activeProducts: 0,
        totalUnits: 0,
        inventoryValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      },
      lowStock: [],
      recentMovements: [],
    });
  });

  it('adds up the active products and leaves archived ones out', async () => {
    const actor = await admin();
    await product({ price: 2.5, quantity: 4, reorderLevel: 2 }); // in stock, 10.00
    await product({ price: 0.1, quantity: 3, reorderLevel: 3 }); // low, 0.30
    await product({ price: 0.2, quantity: 3, reorderLevel: 5 }); // low, 0.60
    await product({ price: 99, quantity: 0, reorderLevel: 5 }); // out of stock
    await product({ price: 7, quantity: 0, reorderLevel: 0 }); // out of stock, no reorder level
    await product({ price: 1000, quantity: 50, reorderLevel: 1, isArchived: true });
    await product({ price: 5, quantity: 0, reorderLevel: 5, isArchived: true });

    const res = await get(buildApp(), actor);

    expect(res.body.summary).toEqual({
      activeProducts: 5,
      totalUnits: 10,
      inventoryValue: 10.9,
      lowStockCount: 2,
      outOfStockCount: 2,
    });
  });

  it('lists out of stock first, then low stock by the lowest quantity-to-reorder ratio', async () => {
    const supplier = await Supplier.create({ name: 'Acme' });
    const out = await product({
      title: 'B out',
      quantity: 0,
      reorderLevel: 8,
      supplier: supplier._id,
    });
    const outNoLevel = await product({ title: 'A out, no level', quantity: 0, reorderLevel: 0 });
    const tenth = await product({ title: 'tenth', quantity: 1, reorderLevel: 10 }); // 0.1
    const half = await product({ title: 'half', quantity: 5, reorderLevel: 10 }); // 0.5
    const atLevel = await product({ title: 'at level', quantity: 4, reorderLevel: 4 }); // 1
    const same = await product({ title: 'same ratio, fewer units', quantity: 1, reorderLevel: 2 }); // 0.5
    await product({ title: 'fine', quantity: 11, reorderLevel: 10 });
    await product({ title: 'archived', quantity: 0, reorderLevel: 5, isArchived: true });

    const res = await get(buildApp(), await admin());

    expect(res.body.lowStock.map((item) => item.id)).toEqual([
      outNoLevel.id,
      out.id,
      tenth.id,
      same.id,
      half.id,
      atLevel.id,
    ]);
    expect(res.body.lowStock[1]).toMatchObject({
      title: 'B out',
      stockStatus: 'out_of_stock',
      quantity: 0,
      reorderLevel: 8,
      supplier: { id: supplier.id, name: 'Acme' },
    });
    expect(res.body.summary).toMatchObject({ lowStockCount: 4, outOfStockCount: 2 });
  });

  it('shows at most 10 products but counts all of them', async () => {
    for (let i = 1; i <= 12; i += 1) await product({ quantity: i, reorderLevel: 20 });

    const res = await get(buildApp(), await admin());

    expect(res.body.lowStock).toHaveLength(10);
    expect(res.body.lowStock.map((item) => item.quantity)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(res.body.summary.lowStockCount).toBe(12);
  });

  it('returns the last 10 movements, newest first, with who made them', async () => {
    const actor = await admin();
    const item = await product();
    const rows = [];
    for (let i = 0; i < 12; i += 1) {
      rows.push(await movement(item, actor, { createdAt: new Date(Date.UTC(2026, 9, 1 + i)) }));
    }

    const res = await get(buildApp(), actor);

    expect(res.body.recentMovements.map((row) => row.id)).toEqual(
      rows
        .slice(2)
        .reverse()
        .map((row) => row.id),
    );
    expect(res.body.recentMovements[0]).toMatchObject({
      product: { id: item.id, title: item.title, sku: item.sku },
      performedBy: { id: actor.id, name: 'Ada Admin', role: 'admin' },
    });
  });

  it('hides movements of archived products from staff but not the numbers of active ones', async () => {
    const ada = await admin();
    const sam = await staff();
    const live = await product();
    const archived = await product({ isArchived: true, archivedAt: new Date() });
    const visible = await movement(live, ada);
    const hidden = await movement(archived, ada);

    const asStaff = await get(buildApp(), sam);
    const asAdmin = await get(buildApp(), ada);

    expect(asStaff.body.recentMovements.map((row) => row.id)).toEqual([visible.id]);
    expect(asAdmin.body.recentMovements.map((row) => row.id).sort()).toEqual(
      [visible.id, hidden.id].sort(),
    );
    expect(asStaff.body.summary).toEqual(asAdmin.body.summary);
  });

  it('refuses unauthenticated, pending, rejected and incomplete users', async () => {
    const app = buildApp();
    expect((await get(app, null)).status).toBe(401);
    expect((await get(app, await staff({ status: 'pending' }))).status).toBe(403);
    expect((await get(app, await staff({ status: 'rejected' }))).status).toBe(403);
    expect((await get(app, await staff({ emailVerified: false }))).status).toBe(403);
  });
});
