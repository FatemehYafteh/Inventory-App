import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { Supplier } from '../../src/models/Supplier.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function get(app, actor, path) {
  const req = request(app)
    .get(path)
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
    ...overrides,
  });
}

function movement(item, performer, overrides = {}) {
  const quantityChange = overrides.quantityChange ?? 1;
  return StockMovement.create({
    product: item._id,
    type: 'receive',
    quantityChange,
    quantityBefore: 100,
    quantityAfter: 100 + quantityChange,
    performedBy: performer._id,
    performedByName: performer.name,
    ...overrides,
  });
}

const ids = (res) => res.body.items.map((row) => row.id);
const iso = (value) => encodeURIComponent(value);
const range = (from, to) => `/api/movements?from=${iso(from)}&to=${iso(to)}`;

describe('GET /api/movements', () => {
  it('lists movements newest first with product, supplier and performer details', async () => {
    const app = buildApp();
    const actor = await admin();
    const supplier = await Supplier.create({ name: 'Acme' });
    const item = await product();
    const old = await movement(item, actor, { createdAt: new Date('2026-10-01T10:00:00Z') });
    const recent = await movement(item, actor, {
      createdAt: new Date('2026-10-02T10:00:00Z'),
      supplier: supplier._id,
      note: 'Truck',
    });

    const res = await get(app, actor, '/api/movements');

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([recent.id, old.id]);
    expect(res.body).toMatchObject({ total: 2, page: 1, limit: 20 });
    expect(res.body.items[0]).toMatchObject({
      product: { id: item.id, title: item.title, sku: item.sku },
      type: 'receive',
      supplier: { id: supplier.id, name: 'Acme' },
      note: 'Truck',
      performedBy: { id: actor.id, name: 'Ada Admin', role: 'admin' },
    });
    expect(res.body.items[1].supplier).toBeNull();
  });

  it('breaks ties by id and pages without repeating a row', async () => {
    const app = buildApp();
    const actor = await admin();
    const item = await product();
    const at = new Date('2026-10-01T10:00:00Z');
    for (let i = 0; i < 5; i += 1) await movement(item, actor, { createdAt: at });

    const pages = [];
    for (const page of [1, 2, 3]) {
      pages.push(await get(app, actor, `/api/movements?limit=2&page=${page}`));
    }

    const all = pages.flatMap(ids);
    expect(all).toHaveLength(5);
    expect(new Set(all).size).toBe(5);
    expect(pages[0].body.total).toBe(5);
  });

  it('shows the performer current role while keeping the stored name', async () => {
    const app = buildApp();
    const actor = await staff({ name: 'Old Name' });
    const item = await product();
    await movement(item, actor);
    actor.role = 'admin';
    actor.name = 'New Name';
    await actor.save();

    const res = await get(app, actor, '/api/movements');

    expect(res.body.items[0].performedBy).toEqual({
      id: actor.id,
      name: 'Old Name',
      role: 'admin',
    });
  });

  it('filters by product, type, supplier and user, alone and together', async () => {
    const app = buildApp();
    const ada = await admin();
    const sam = await staff();
    const supplier = await Supplier.create({ name: 'Acme' });
    const a = await product();
    const b = await product();
    const m1 = await movement(a, ada, { supplier: supplier._id });
    const m2 = await movement(b, sam, { type: 'ship', quantityChange: -1 });
    const m3 = await movement(b, ada, { type: 'increment' });

    expect(ids(await get(app, ada, `/api/movements?product=${b.id}`)).sort()).toEqual(
      [m2.id, m3.id].sort(),
    );
    expect(ids(await get(app, ada, '/api/movements?type=ship'))).toEqual([m2.id]);
    expect(ids(await get(app, ada, `/api/movements?supplier=${supplier.id}`))).toEqual([m1.id]);
    expect(ids(await get(app, ada, `/api/movements?user=${sam.id}`))).toEqual([m2.id]);
    const combined = `/api/movements?user=${ada.id}&type=increment&product=${b.id}`;
    expect(ids(await get(app, ada, combined))).toEqual([m3.id]);
  });

  it('treats from as inclusive and to as exclusive', async () => {
    const app = buildApp();
    const actor = await admin();
    const item = await product();
    const times = [
      '2026-10-14T20:29:59.000Z',
      '2026-10-14T20:30:00.000Z',
      '2026-10-15T20:29:59.999Z',
      '2026-10-15T20:30:00.000Z',
    ];
    const rows = [];
    for (const time of times) rows.push(await movement(item, actor, { createdAt: new Date(time) }));

    // One local day in Tehran (UTC+03:30): 15 October.
    const day = await get(app, actor, range('2026-10-14T20:30:00.000Z', '2026-10-15T20:30:00.000Z'));
    expect(ids(day)).toEqual([rows[2].id, rows[1].id]);

    const open = await get(app, actor, `/api/movements?from=${iso('2026-10-15T20:30:00.000Z')}`);
    expect(ids(open)).toEqual([rows[3].id]);
  });

  it('measures a New York day on a daylight-saving change as 25 hours', async () => {
    const app = buildApp();
    const actor = await admin();
    const item = await product();
    // 1 November 2026 in New York runs from 04:00Z (EDT) to 05:00Z the next day (EST).
    const early = await movement(item, actor, { createdAt: new Date('2026-11-01T04:00:00Z') });
    const late = await movement(item, actor, { createdAt: new Date('2026-11-02T04:59:00Z') });
    await movement(item, actor, { createdAt: new Date('2026-11-02T05:00:00Z') });

    const res = await get(app, actor, range('2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z'));

    expect(ids(res)).toEqual([late.id, early.id]);
  });

  it('answers a Jalali month end and a Gregorian year end like any other instants', async () => {
    const app = buildApp();
    const actor = await admin();
    const item = await product();
    // 30 Shahrivar and 1 Mehr 1405 are 21 and 23 September 2026 (days start at 20:30Z).
    const shahrivar = await movement(item, actor, { createdAt: new Date('2026-09-22T20:00:00Z') });
    const mehr = await movement(item, actor, { createdAt: new Date('2026-09-23T21:00:00Z') });
    const lastDay = await movement(item, actor, { createdAt: new Date('2026-12-31T23:59:59Z') });
    await movement(item, actor, { createdAt: new Date('2027-01-01T00:00:00Z') });

    const month = await get(app, actor, range('2026-09-21T20:30:00.000Z', '2026-09-22T20:30:00.000Z'));
    const twoDays = await get(app, actor, range('2026-09-21T20:30:00.000Z', '2026-09-23T20:30:00.000Z'));
    const year = await get(app, actor, range('2026-12-31T00:00:00.000Z', '2027-01-01T00:00:00.000Z'));

    expect(ids(month)).toEqual([shahrivar.id]);
    expect(ids(twoDays)).toEqual([shahrivar.id]);
    expect(ids(year)).toEqual([lastDay.id]);
    expect(mehr.id).toBeDefined();
  });

  it('rejects bad filters with catalogue codes', async () => {
    const app = buildApp();
    const actor = await admin();
    const check = async (query, field, code) => {
      const res = await get(app, actor, `/api/movements?${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errorCodes[field], query).toBe(code);
    };
    await check('from=2026-10-14', 'from', 'DATE_TIME_INVALID');
    await check('from=2026-10-14T00:00:00.000Z&to=2026-10-15', 'to', 'DATE_TIME_INVALID');
    await check('to=2026-10-14T00:00:00.000Z', 'from', 'DATE_RANGE_START_REQUIRED');
    await check(
      'from=2026-10-15T00:00:00.000Z&to=2026-10-14T00:00:00.000Z',
      'to',
      'DATE_RANGE_ORDER',
    );
    await check(
      'from=2026-10-14T00:00:00.000Z&to=2026-10-14T00:00:00.000Z',
      'to',
      'DATE_RANGE_ORDER',
    );
    await check('type=sell', 'type', 'MOVEMENT_TYPE_INVALID');
    await check('product=abc', 'product', 'PRODUCT_FILTER_INVALID');
    await check('supplier=abc', 'supplier', 'SUPPLIER_INVALID');
    await check('user=abc', 'user', 'USER_FILTER_INVALID');
  });

  it('hides movements of archived products from staff and shows them to admins', async () => {
    const app = buildApp();
    const ada = await admin();
    const sam = await staff();
    const live = await product();
    const archived = await product({ isArchived: true, archivedAt: new Date() });
    const visible = await movement(live, ada);
    const hidden = await movement(archived, ada);

    const asStaff = await get(app, sam, '/api/movements');
    const asAdmin = await get(app, ada, '/api/movements');
    const filtered = await get(app, sam, `/api/movements?product=${archived.id}`);

    expect(ids(asStaff)).toEqual([visible.id]);
    expect(asStaff.body.total).toBe(1);
    expect(ids(asAdmin).sort()).toEqual([visible.id, hidden.id].sort());
    expect(filtered.status).toBe(200);
    expect(filtered.body.items).toEqual([]);
  });

  it('refuses unauthenticated, pending, rejected and incomplete users', async () => {
    const app = buildApp();
    expect((await get(app, null, '/api/movements')).status).toBe(401);
    const pending = await staff({ status: 'pending' });
    expect((await get(app, pending, '/api/movements')).status).toBe(403);
    const rejected = await staff({ status: 'rejected' });
    expect((await get(app, rejected, '/api/movements')).status).toBe(403);
    const incomplete = await staff({ emailVerified: false });
    expect((await get(app, incomplete, '/api/movements')).status).toBe(403);
  });
});
