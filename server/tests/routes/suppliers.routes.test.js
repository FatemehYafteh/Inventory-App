import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { seedDatabase } from '../../seed/seed.js';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { Supplier } from '../../src/models/Supplier.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function send(app, method, actor, path, body) {
  const start = request(app)[method](`/api/suppliers${path}`);
  const req = start.set('Origin', ORIGIN).set('X-Requested-With', 'XMLHttpRequest');
  if (actor) req.set('x-test-user', actor.id);
  return body === undefined ? req : req.send(body);
}

const admin = () => createUser({ role: 'admin', status: 'active', name: 'Ada Admin' });
const staff = () => createUser({ role: 'staff', status: 'active', name: 'Sam Staff' });

let skuCounter = 0;

async function product(supplier, overrides = {}) {
  const category = (await Category.findOne()) ?? (await Category.create({ title: 'General' }));
  return Product.create({
    title: 'Widget',
    sku: `SKU-${(skuCounter += 1)}`,
    category: category._id,
    price: 1,
    ...(supplier && { supplier: supplier._id }),
    ...overrides,
  });
}

async function movement(item, supplier, performer) {
  return StockMovement.create({
    product: item._id,
    type: 'receive',
    quantityChange: 5,
    quantityBefore: 0,
    quantityAfter: 5,
    supplier: supplier._id,
    performedBy: performer._id,
    performedByName: performer.name,
  });
}

const names = (res) => res.body.items.map((supplier) => supplier.name);

describe('GET /api/suppliers', () => {
  it('lists suppliers by name with product and movement counts, archived products included', async () => {
    const app = buildApp();
    const actor = await staff();
    const acme = await Supplier.create({ name: 'acme', contactPerson: 'Dana' });
    const zed = await Supplier.create({ name: 'Zed' });
    await Supplier.create({ name: 'Bolt' });
    const first = await product(acme);
    await product(acme, { isArchived: true, archivedAt: new Date() });
    await product(zed);
    await movement(first, acme, actor);
    await movement(first, acme, actor);

    const res = await send(app, 'get', actor, '');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 3, page: 1, limit: 20 });
    expect(res.body.items.map((s) => [s.name, s.productCount, s.movementCount])).toEqual([
      ['acme', 2, 2],
      ['Bolt', 0, 0],
      ['Zed', 1, 0],
    ]);
    expect(res.body.items[0]).toMatchObject({ id: acme.id, contactPerson: 'Dana', isActive: true });
  });

  it('refuses anonymous and pending users', async () => {
    const app = buildApp();
    expect((await send(app, 'get', null, '')).status).toBe(401);
    const pending = await createUser({ status: 'pending' });
    expect((await send(app, 'get', pending, '')).status).toBe(403);
  });

  it('searches name, contact person, phone and email case-insensitively', async () => {
    const app = buildApp();
    const actor = await staff();
    await Supplier.create({ name: 'Acme Electronics', contactPerson: 'Dana Whitfield' });
    await Supplier.create({ name: 'Paperline', phone: '+1 555 0111' });
    await Supplier.create({ name: 'CleanCo', email: 'joe@cleanco.example' });

    expect(names(await send(app, 'get', actor, '?search=ELECTRO'))).toEqual(['Acme Electronics']);
    expect(names(await send(app, 'get', actor, '?search=whitf'))).toEqual(['Acme Electronics']);
    expect(names(await send(app, 'get', actor, '?search=555%200111'))).toEqual(['Paperline']);
    expect(names(await send(app, 'get', actor, '?search=Joe@CLEAN'))).toEqual(['CleanCo']);
    expect(names(await send(app, 'get', actor, '?search=nothing'))).toEqual([]);
  });

  it('treats regex characters in the search as plain text', async () => {
    const app = buildApp();
    const actor = await staff();
    await Supplier.create({ name: 'A.B Supplies' });
    await Supplier.create({ name: 'AxB Supplies' });

    expect(names(await send(app, 'get', actor, '?search=A.B'))).toEqual(['A.B Supplies']);
    expect((await send(app, 'get', actor, '?search=(')).status).toBe(200);
  });

  it('filters by active: omitted lists all, true only active, false only inactive', async () => {
    const app = buildApp();
    const actor = await staff();
    await Supplier.create({ name: 'Live' });
    await Supplier.create({ name: 'Dormant', isActive: false });

    expect(names(await send(app, 'get', actor, ''))).toEqual(['Dormant', 'Live']);
    expect(names(await send(app, 'get', actor, '?active=true'))).toEqual(['Live']);
    expect(names(await send(app, 'get', actor, '?active=false'))).toEqual(['Dormant']);
    expect((await send(app, 'get', actor, '?active=maybe')).status).toBe(400);
  });

  it('sorts by name ascending by default, descending on request, and only by name', async () => {
    const app = buildApp();
    const actor = await staff();
    for (const name of ['beta', 'Alpha', 'Gamma']) await Supplier.create({ name });

    expect(names(await send(app, 'get', actor, ''))).toEqual(['Alpha', 'beta', 'Gamma']);
    expect(names(await send(app, 'get', actor, '?sortBy=name&order=desc'))).toEqual([
      'Gamma',
      'beta',
      'Alpha',
    ]);
    expect((await send(app, 'get', actor, '?sortBy=phone')).status).toBe(400);
    expect((await send(app, 'get', actor, '?order=sideways')).status).toBe(400);
  });

  it('pages the results, defaults the limit to 20 and caps it at 100', async () => {
    const app = buildApp();
    const actor = await staff();
    for (let i = 1; i <= 25; i += 1)
      await Supplier.create({ name: `Supplier ${String(i).padStart(2, '0')}` });

    const first = await send(app, 'get', actor, '');
    expect(first.body.items).toHaveLength(20);
    expect(first.body).toMatchObject({ total: 25, page: 1, limit: 20 });

    const second = await send(app, 'get', actor, '?page=2&limit=10');
    expect(second.body.items.map((s) => s.name)[0]).toBe('Supplier 11');
    expect(second.body).toMatchObject({ page: 2, limit: 10 });

    expect((await send(app, 'get', actor, '?limit=101')).status).toBe(400);
    expect((await send(app, 'get', actor, '?page=0')).status).toBe(400);
  });
});

describe('POST /api/suppliers', () => {
  it('lets an admin create a supplier, trimming fields and lowercasing the email', async () => {
    const app = buildApp();
    const actor = await admin();

    const res = await send(app, 'post', actor, '', {
      name: '  Acme  ',
      contactPerson: 'Dana',
      phone: '+1 555 0100',
      email: 'Orders@Acme.example',
      address: '1 Main St',
      notes: 'Net 30',
    });

    expect(res.status).toBe(201);
    expect(res.body.supplier).toMatchObject({
      name: 'Acme',
      contactPerson: 'Dana',
      phone: '+1 555 0100',
      email: 'orders@acme.example',
      isActive: true,
      productCount: 0,
      movementCount: 0,
    });
    expect(await Supplier.countDocuments({ name: 'Acme' })).toBe(1);
  });

  it('treats empty optional fields as none, including an empty email', async () => {
    const app = buildApp();
    const res = await send(app, 'post', await admin(), '', {
      name: 'Acme',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });

    expect(res.status).toBe(201);
    const stored = (await Supplier.findOne({ name: 'Acme' })).toObject();
    for (const field of ['contactPerson', 'phone', 'email', 'address', 'notes']) {
      expect(stored[field]).toBeUndefined();
    }
  });

  it('rejects invalid fields with field errors', async () => {
    const app = buildApp();
    const actor = await admin();
    const cases = [
      [{}, 'name'],
      [{ name: '   ' }, 'name'],
      [{ name: 'x'.repeat(121) }, 'name'],
      [{ name: 'Acme', email: 'not-an-email' }, 'email'],
      [{ name: 'Acme', phone: '1'.repeat(41) }, 'phone'],
      [{ name: 'Acme', notes: 'n'.repeat(1001) }, 'notes'],
    ];

    for (const [body, field] of cases) {
      const res = await send(app, 'post', actor, '', body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors[field]).toBeTruthy();
    }
    expect(await Supplier.countDocuments()).toBe(0);
  });

  it('accepts a phone of exactly 40 free-text characters', async () => {
    const app = buildApp();
    const res = await send(app, 'post', await admin(), '', {
      name: 'Acme',
      phone: `ext. ${'1'.repeat(35)}`,
    });
    expect(res.status).toBe(201);
  });

  it('rejects a duplicate name in any letter case with DUPLICATE_NAME', async () => {
    const app = buildApp();
    const actor = await admin();
    await Supplier.create({ name: 'Acme' });

    const res = await send(app, 'post', actor, '', { name: 'aCME' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'DUPLICATE_NAME',
      errors: { name: 'A supplier with this name already exists' },
    });
    expect(await Supplier.countDocuments()).toBe(1);
  });
});

describe('PATCH /api/suppliers/:id', () => {
  it('updates fields, and an empty string clears an optional field', async () => {
    const app = buildApp();
    const actor = await admin();
    const supplier = await Supplier.create({
      name: 'Acme',
      contactPerson: 'Dana',
      email: 'a@acme.example',
      notes: 'Net 30',
    });

    const renamed = await send(app, 'patch', actor, `/${supplier.id}`, {
      name: 'Acme Ltd',
      phone: '555',
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body.supplier).toMatchObject({
      name: 'Acme Ltd',
      phone: '555',
      contactPerson: 'Dana',
    });

    const cleared = await send(app, 'patch', actor, `/${supplier.id}`, {
      contactPerson: '',
      email: '',
      notes: '',
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.supplier).toMatchObject({ contactPerson: '', email: '', notes: '' });
    const stored = (await Supplier.findById(supplier.id)).toObject();
    expect(stored.contactPerson).toBeUndefined();
    expect(stored.email).toBeUndefined();
    expect(stored.notes).toBeUndefined();
    expect(stored.phone).toBe('555');
  });

  it('deactivates and reactivates, and an inactive supplier stays editable', async () => {
    const app = buildApp();
    const actor = await admin();
    const supplier = await Supplier.create({ name: 'Acme' });

    const off = await send(app, 'patch', actor, `/${supplier.id}`, { isActive: false });
    expect(off.body.supplier.isActive).toBe(false);

    const edited = await send(app, 'patch', actor, `/${supplier.id}`, { phone: '555' });
    expect(edited.status).toBe(200);
    expect(edited.body.supplier).toMatchObject({ phone: '555', isActive: false });

    const on = await send(app, 'patch', actor, `/${supplier.id}`, { isActive: true });
    expect(on.body.supplier.isActive).toBe(true);
    expect((await Supplier.findById(supplier.id)).isActive).toBe(true);
  });

  it('allows deactivating a supplier that products use, and reports the counts', async () => {
    const app = buildApp();
    const supplier = await Supplier.create({ name: 'Acme' });
    await product(supplier);

    const res = await send(app, 'patch', await admin(), `/${supplier.id}`, { isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.supplier).toMatchObject({ isActive: false, productCount: 1, movementCount: 0 });
  });

  it('keeps the same name when saving it back, and rejects another supplier name', async () => {
    const app = buildApp();
    const actor = await admin();
    await Supplier.create({ name: 'Acme' });
    const other = await Supplier.create({ name: 'Bolt' });

    expect((await send(app, 'patch', actor, `/${other.id}`, { name: 'bolt' })).status).toBe(200);
    const res = await send(app, 'patch', actor, `/${other.id}`, { name: 'ACME' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_NAME');
  });

  it('rejects invalid updates and an unknown or malformed id', async () => {
    const app = buildApp();
    const actor = await admin();
    const supplier = await Supplier.create({ name: 'Acme' });

    expect((await send(app, 'patch', actor, `/${supplier.id}`, {})).status).toBe(400);
    expect((await send(app, 'patch', actor, `/${supplier.id}`, { email: 'nope' })).status).toBe(
      400,
    );
    expect((await send(app, 'patch', actor, `/${supplier.id}`, { isActive: 'no' })).status).toBe(
      400,
    );
    expect(
      (await send(app, 'patch', actor, '/64b7f0c2a1b2c3d4e5f60718', { name: 'X' })).status,
    ).toBe(404);
    expect((await send(app, 'patch', actor, '/not-an-id', { name: 'X' })).status).toBe(404);
  });
});

describe('DELETE /api/suppliers/:id', () => {
  it('deletes a supplier nothing references', async () => {
    const app = buildApp();
    const supplier = await Supplier.create({ name: 'Northwind' });

    const res = await send(app, 'delete', await admin(), `/${supplier.id}`);

    expect(res.status).toBe(204);
    expect(await Supplier.countDocuments()).toBe(0);
  });

  it.each([
    ['an active product', 'products', 1, 0, 'Used by 1 product. Deactivate it instead.'],
    ['an archived product only', 'archived', 1, 0, 'Used by 1 product. Deactivate it instead.'],
    [
      'movements only, with no products',
      'movements',
      0,
      2,
      'Used by 2 stock movements. Deactivate it instead.',
    ],
    [
      'products and movements',
      'both',
      2,
      3,
      'Used by 2 products and 3 stock movements. Deactivate it instead.',
    ],
  ])(
    'blocks delete for %s with IN_USE and both counts',
    async (_label, kind, products, moves, message) => {
      const app = buildApp();
      const actor = await admin();
      const supplier = await Supplier.create({ name: 'Acme' });
      const carrier = await product(null);
      if (kind === 'products' || kind === 'both') {
        await product(supplier);
        if (kind === 'both') await product(supplier);
      }
      if (kind === 'archived')
        await product(supplier, { isArchived: true, archivedAt: new Date() });
      for (let i = 0; i < moves; i += 1) await movement(carrier, supplier, actor);

      const res = await send(app, 'delete', actor, `/${supplier.id}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('IN_USE');
      expect(res.body.message).toBe(message);
      expect(res.body.details).toEqual({ productCount: products, movementCount: moves });
      expect(await Supplier.countDocuments()).toBe(1);
    },
  );

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
    const supplier = await Supplier.create({ name: 'Acme' });
    const writes = [
      ['post', '', { name: 'New' }],
      ['patch', `/${supplier.id}`, { name: 'Renamed' }],
      ['patch', `/${supplier.id}`, { isActive: false }],
      ['delete', `/${supplier.id}`, undefined],
    ];

    for (const [method, path, body] of writes) {
      expect((await send(app, method, staffer, path, body)).status).toBe(403);
      expect((await send(app, method, null, path, body)).status).toBe(401);
    }
    expect(await Supplier.findById(supplier.id)).toMatchObject({ name: 'Acme', isActive: true });
  });

  it('refuses a write without the CSRF header', async () => {
    const app = buildApp();
    const actor = await admin();

    const res = await request(app)
      .post('/api/suppliers')
      .set('Origin', ORIGIN)
      .set('x-test-user', actor.id)
      .send({ name: 'Acme' });

    expect(res.status).toBe(403);
    expect(await Supplier.countDocuments()).toBe(0);
  });
});

describe('against the seed data', () => {
  it('lists the inactive supplier, deletes the unused one and blocks every one in use', async () => {
    await seedDatabase({ now: new Date('2026-10-12T12:00:00Z') });
    const app = buildApp();
    const actor = await admin();

    const { items } = (await send(app, 'get', actor, '?limit=100')).body;
    const oldMill = items.find((s) => s.name === 'Old Mill Paper Co.');
    expect(oldMill).toMatchObject({ isActive: false });
    expect(oldMill.productCount).toBeGreaterThan(0);

    const northwind = items.find((s) => s.name === 'Northwind Freight');
    expect(northwind).toMatchObject({ productCount: 0, movementCount: 0 });
    const inUse = items.filter((s) => s.name !== 'Northwind Freight');
    expect(inUse.every((s) => s.productCount > 0 || s.movementCount > 0)).toBe(true);

    for (const supplier of inUse) {
      const res = await send(app, 'delete', actor, `/${supplier.id}`);
      expect(res.status).toBe(409);
      expect(res.body.details).toEqual({
        productCount: supplier.productCount,
        movementCount: supplier.movementCount,
      });
    }
    expect((await send(app, 'delete', actor, `/${northwind.id}`)).status).toBe(204);
  });
});
