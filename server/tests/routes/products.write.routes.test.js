import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
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
  return body === undefined ? req : req.send(body);
}

const post = (app, actor, body, options) =>
  send(app, 'post', actor, '/api/products', body, options);
const patch = (app, actor, id, body) => send(app, 'patch', actor, `/api/products/${id}`, body);

const admin = () => createUser({ role: 'admin', status: 'active', name: 'Ada Admin' });
const staff = () => createUser({ role: 'staff', status: 'active', name: 'Sam Staff' });

let counter = 0;

const category = (title = `Category ${(counter += 1)}`) => Category.create({ title });

async function existing(cat, overrides = {}) {
  counter += 1;
  return Product.create({
    title: `Widget ${counter}`,
    sku: `SKU-${counter}`,
    category: cat._id,
    price: 10,
    ...overrides,
  });
}

describe('POST /api/products', () => {
  it('creates a product with quantity 0 for staff and for admins', async () => {
    const app = buildApp();
    const cat = await category('Tools');
    const supplier = await Supplier.create({ name: 'Acme' });
    const body = {
      title: '  Hammer ',
      sku: ' ham-1 ',
      description: 'Claw hammer',
      category: cat.id,
      supplier: supplier.id,
      price: 12.345,
      reorderLevel: 4,
    };

    const res = await post(app, await staff(), body);

    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({
      title: 'Hammer',
      sku: 'HAM-1',
      description: 'Claw hammer',
      category: { id: cat.id, title: 'Tools' },
      supplier: { id: supplier.id, name: 'Acme' },
      price: 12.35,
      quantity: 0,
      reorderLevel: 4,
      stockStatus: 'out_of_stock',
      isArchived: false,
    });
    expect(await Product.countDocuments()).toBe(1);
    expect(await StockMovement.countDocuments()).toBe(0);

    const asAdmin = await post(app, await admin(), {
      title: 'Saw',
      sku: 'saw-1',
      category: cat.id,
      price: 5,
    });
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.product).toMatchObject({ supplier: null, reorderLevel: 0, quantity: 0 });
  });

  it('treats an empty supplier or description as none', async () => {
    const app = buildApp();
    const cat = await category();
    const res = await post(app, await staff(), {
      title: 'Plain',
      sku: 'plain',
      category: cat.id,
      price: 1,
      supplier: '',
      description: '',
    });
    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({ supplier: null, description: '' });
  });

  it('rejects invalid input with field-level messages', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    const ok = { title: 'T', sku: 'S-1', category: cat.id, price: 1 };
    const cases = [
      [{ ...ok, title: ' ' }, 'title'],
      [{ ...ok, title: undefined }, 'title'],
      [{ ...ok, sku: '' }, 'sku'],
      [{ ...ok, category: undefined }, 'category'],
      [{ ...ok, category: 'nope' }, 'category'],
      [{ ...ok, supplier: 'nope' }, 'supplier'],
      [{ ...ok, price: -1 }, 'price'],
      [{ ...ok, price: undefined }, 'price'],
      [{ ...ok, price: '5' }, 'price'],
      [{ ...ok, reorderLevel: 1.5 }, 'reorderLevel'],
      [{ ...ok, reorderLevel: -1 }, 'reorderLevel'],
    ];
    for (const [body, field] of cases) {
      const res = await post(app, actor, body);
      expect(res.status, field).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors[field], field).toBeTruthy();
    }
    expect(await Product.countDocuments()).toBe(0);
  });

  it('does not accept quantity, initialQuantity, isArchived or other unknown fields', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    for (const extra of [
      { quantity: 5 },
      { initialQuantity: 5 },
      { isArchived: true },
      { foo: 1 },
    ]) {
      const res = await post(app, actor, {
        title: 'T',
        sku: 'S-1',
        category: cat.id,
        price: 1,
        ...extra,
      });
      expect(res.status, JSON.stringify(extra)).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
    expect(await Product.countDocuments()).toBe(0);
  });

  it('returns 409 DUPLICATE_SKU for an existing SKU in any letter case', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    await existing(cat, { sku: 'AB-100' });

    const res = await post(app, actor, {
      title: 'Other',
      sku: 'ab-100',
      category: cat.id,
      price: 1,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_SKU');
    expect(res.body.errors.sku).toBeTruthy();
    expect(await Product.countDocuments()).toBe(1);
  });

  it('requires an existing category', async () => {
    const app = buildApp();
    const res = await post(app, await staff(), {
      title: 'T',
      sku: 'S-1',
      category: '64b7f0f0f0f0f0f0f0f0f0f0',
      price: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.category).toBeTruthy();
    expect(await Product.countDocuments()).toBe(0);
  });

  it('requires an existing, active supplier', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    const inactive = await Supplier.create({ name: 'Old Mill', isActive: false });
    const base = { title: 'T', sku: 'S-1', category: cat.id, price: 1 };

    const asInactive = await post(app, actor, { ...base, supplier: inactive.id });
    expect(asInactive.status).toBe(400);
    expect(asInactive.body.errors.supplier).toBeTruthy();

    const asMissing = await post(app, actor, { ...base, supplier: '64b7f0f0f0f0f0f0f0f0f0f0' });
    expect(asMissing.status).toBe(400);
    expect(asMissing.body.errors.supplier).toBeTruthy();
    expect(await Product.countDocuments()).toBe(0);
  });

  it('refuses unauthenticated, pending and cross-site requests', async () => {
    const app = buildApp();
    const cat = await category();
    const body = { title: 'T', sku: 'S-1', category: cat.id, price: 1 };
    expect((await post(app, null, body)).status).toBe(401);
    expect((await post(app, await createUser({ status: 'pending' }), body)).status).toBe(403);
    expect((await post(app, await staff(), body, { csrf: false })).status).toBe(403);
    expect(await Product.countDocuments()).toBe(0);
  });
});

describe('PATCH /api/products/:id', () => {
  it('updates only the fields sent and leaves quantity alone', async () => {
    const app = buildApp();
    const cat = await category();
    const item = await existing(cat, {
      title: 'Old',
      quantity: 7,
      reorderLevel: 2,
      description: 'keep',
    });

    const res = await patch(app, await staff(), item.id, {
      title: 'New',
      price: 19.999,
      sku: 'new-sku',
    });

    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({
      id: item.id,
      title: 'New',
      sku: 'NEW-SKU',
      price: 20,
      description: 'keep',
      quantity: 7,
      reorderLevel: 2,
    });
    expect((await Product.findById(item.id)).quantity).toBe(7);
  });

  it('changes category and supplier, and clears the supplier and description', async () => {
    const app = buildApp();
    const actor = await staff();
    const a = await category();
    const b = await category('Other');
    const supplier = await Supplier.create({ name: 'Acme' });
    const item = await existing(a, { description: 'words' });

    const set = await patch(app, actor, item.id, { category: b.id, supplier: supplier.id });
    expect(set.body.product).toMatchObject({
      category: { id: b.id, title: 'Other' },
      supplier: { id: supplier.id, name: 'Acme' },
    });

    const cleared = await patch(app, actor, item.id, { supplier: null, description: '' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.product).toMatchObject({ supplier: null, description: '' });
    const stored = await Product.findById(item.id);
    expect(stored.supplier).toBeUndefined();
    expect(stored.description).toBeUndefined();

    expect((await patch(app, actor, item.id, { supplier: '' })).body.product.supplier).toBeNull();
  });

  it('lets a product keep an inactive supplier it already has, but not pick a new one', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    const oldMill = await Supplier.create({ name: 'Old Mill', isActive: false });
    const other = await Supplier.create({ name: 'Dormant', isActive: false });
    const item = await existing(cat, { supplier: oldMill._id });

    const keep = await patch(app, actor, item.id, { title: 'Renamed', supplier: oldMill.id });
    expect(keep.status).toBe(200);
    expect(keep.body.product.supplier).toMatchObject({ id: oldMill.id });

    const pick = await patch(app, actor, item.id, { supplier: other.id });
    expect(pick.status).toBe(400);
    expect(pick.body.errors.supplier).toBeTruthy();
    expect((await Product.findById(item.id)).supplier.equals(oldMill._id)).toBe(true);
  });

  it('rejects a missing category and invalid values', async () => {
    const app = buildApp();
    const actor = await staff();
    const item = await existing(await category());

    const missing = await patch(app, actor, item.id, { category: '64b7f0f0f0f0f0f0f0f0f0f0' });
    expect(missing.status).toBe(400);
    expect(missing.body.errors.category).toBeTruthy();

    for (const [body, field] of [
      [{ title: '' }, 'title'],
      [{ price: -2 }, 'price'],
      [{ reorderLevel: 0.5 }, 'reorderLevel'],
      [{ category: 'nope' }, 'category'],
    ]) {
      const res = await patch(app, actor, item.id, body);
      expect(res.status, field).toBe(400);
      expect(res.body.errors[field], field).toBeTruthy();
    }
    const empty = await patch(app, actor, item.id, {});
    expect(empty.status).toBe(400);
  });

  it('does not accept quantity, isArchived or other unknown fields', async () => {
    const app = buildApp();
    const actor = await staff();
    const item = await existing(await category(), { quantity: 3 });
    for (const body of [
      { quantity: 99 },
      { isArchived: true },
      { archivedAt: null },
      { title: 'X', foo: 1 },
    ]) {
      const res = await patch(app, actor, item.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const stored = await Product.findById(item.id);
    expect(stored.quantity).toBe(3);
    expect(stored.isArchived).toBe(false);
  });

  it('returns 409 DUPLICATE_SKU when the SKU belongs to another product, but allows a case change of its own', async () => {
    const app = buildApp();
    const actor = await staff();
    const cat = await category();
    await existing(cat, { sku: 'TAKEN-1' });
    const item = await existing(cat, { sku: 'MINE-1' });

    const clash = await patch(app, actor, item.id, { sku: 'taken-1' });
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe('DUPLICATE_SKU');
    expect(clash.body.errors.sku).toBeTruthy();

    const own = await patch(app, actor, item.id, { sku: 'mine-1' });
    expect(own.status).toBe(200);
    expect(own.body.product.sku).toBe('MINE-1');
  });

  it('returns 404 for an unknown or malformed id', async () => {
    const app = buildApp();
    const actor = await staff();
    expect((await patch(app, actor, 'not-an-id', { title: 'X' })).status).toBe(404);
    expect((await patch(app, actor, '64b7f0f0f0f0f0f0f0f0f0f0', { title: 'X' })).status).toBe(404);
  });

  it('lets admins edit an archived product but hides it from staff with 404', async () => {
    const app = buildApp();
    const cat = await category();
    const item = await existing(cat, { isArchived: true, archivedAt: new Date() });

    const asStaff = await patch(app, await staff(), item.id, { title: 'Nope' });
    expect(asStaff.status).toBe(404);
    expect(asStaff.body.code).toBe('NOT_FOUND');

    const asAdmin = await patch(app, await admin(), item.id, { title: 'Fixed' });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.product).toMatchObject({ title: 'Fixed', isArchived: true });
  });

  it('refuses unauthenticated and pending users', async () => {
    const app = buildApp();
    const item = await existing(await category());
    expect((await patch(app, null, item.id, { title: 'X' })).status).toBe(401);
    expect(
      (await patch(app, await createUser({ status: 'pending' }), item.id, { title: 'X' })).status,
    ).toBe(403);
  });
});

describe('product writes racing a category or supplier delete', () => {
  const ATTEMPTS = 8;

  it('never leaves a product pointing at a deleted category', async () => {
    const app = buildApp();
    const editor = await staff();
    const owner = await admin();
    let created = 0;
    let deleted = 0;

    for (let i = 0; i < ATTEMPTS; i += 1) {
      const cat = await category(`Race ${i}`);
      const [make, remove] = await Promise.all([
        post(app, editor, { title: `P${i}`, sku: `RACE-${i}`, category: cat.id, price: 1 }),
        send(app, 'delete', owner, `/api/categories/${cat.id}`),
      ]);

      // Exactly one side wins: the product exists and the delete is refused, or the reverse.
      expect([201, 400]).toContain(make.status);
      expect([204, 409]).toContain(remove.status);
      expect(make.status === 201).toBe(remove.status === 409);
      const stillThere = await Category.exists({ _id: cat._id });
      expect(Boolean(stillThere)).toBe(make.status === 201);
      expect(await Product.countDocuments({ sku: `RACE-${i}` })).toBe(make.status === 201 ? 1 : 0);
      if (make.status === 201) created += 1;
      else deleted += 1;
    }
    expect(created + deleted).toBe(ATTEMPTS);
  });

  it('never leaves a product pointing at a deleted supplier', async () => {
    const app = buildApp();
    const editor = await staff();
    const owner = await admin();
    const cat = await category();

    for (let i = 0; i < ATTEMPTS; i += 1) {
      const supplier = await Supplier.create({ name: `Racer ${i}` });
      const [make, remove] = await Promise.all([
        post(app, editor, {
          title: `P${i}`,
          sku: `SUP-${i}`,
          category: cat.id,
          supplier: supplier.id,
          price: 1,
        }),
        send(app, 'delete', owner, `/api/suppliers/${supplier.id}`),
      ]);

      expect([201, 400]).toContain(make.status);
      expect([204, 409]).toContain(remove.status);
      expect(make.status === 201).toBe(remove.status === 409);
      expect(Boolean(await Supplier.exists({ _id: supplier._id }))).toBe(make.status === 201);
    }
  });

  it('never leaves an edited product pointing at a deleted supplier', async () => {
    const app = buildApp();
    const editor = await staff();
    const owner = await admin();
    const cat = await category();

    for (let i = 0; i < ATTEMPTS; i += 1) {
      const supplier = await Supplier.create({ name: `Assigned ${i}` });
      const item = await existing(cat);
      const [assign, remove] = await Promise.all([
        patch(app, editor, item.id, { supplier: supplier.id }),
        send(app, 'delete', owner, `/api/suppliers/${supplier.id}`),
      ]);

      expect([200, 400]).toContain(assign.status);
      expect([204, 409]).toContain(remove.status);
      expect(assign.status === 200).toBe(remove.status === 409);
      expect(Boolean(await Supplier.exists({ _id: supplier._id }))).toBe(assign.status === 200);
      const stored = await Product.findById(item.id);
      if (assign.status === 200) expect(stored.supplier.equals(supplier._id)).toBe(true);
      else expect(stored.supplier).toBeUndefined();
    }
  });

  it('never leaves an edited product pointing at a deleted category', async () => {
    const app = buildApp();
    const editor = await staff();
    const owner = await admin();
    const home = await category('Home');

    for (let i = 0; i < ATTEMPTS; i += 1) {
      const target = await category(`Target ${i}`);
      const item = await existing(home);
      const [move, remove] = await Promise.all([
        patch(app, editor, item.id, { category: target.id }),
        send(app, 'delete', owner, `/api/categories/${target.id}`),
      ]);

      expect([200, 400]).toContain(move.status);
      expect([204, 409]).toContain(remove.status);
      expect(move.status === 200).toBe(remove.status === 409);
      expect(Boolean(await Category.exists({ _id: target._id }))).toBe(move.status === 200);
    }
  });
});

describe('a staff edit overlapping an admin archive of the same product', () => {
  const archiveAs = (app, actor, id) => send(app, 'patch', actor, `/api/products/${id}/archive`);

  /**
   * Holds the edit inside its transaction, after it has read the product and just before it
   * saves, until `release()` is called. This makes the overlap deterministic: the archive runs
   * to completion while the edit is mid-flight.
   */
  function pauseNextSave() {
    let entered;
    let release;
    const reachedSave = new Promise((resolve) => (entered = resolve));
    const gate = new Promise((resolve) => (release = resolve));
    const original = Product.prototype.save;
    const spy = vi.spyOn(Product.prototype, 'save').mockImplementationOnce(function held(...args) {
      entered();
      return gate.then(() => original.apply(this, args));
    });
    return { reachedSave, release, restore: () => spy.mockRestore() };
  }

  it('does not edit a product that was archived while the staff edit was in flight', async () => {
    const app = buildApp();
    const editor = await staff();
    const owner = await admin();
    const item = await existing(await category(), { title: 'Before', quantity: 6, price: 4 });
    const hold = pauseNextSave();

    try {
      const edit = patch(app, editor, item.id, { title: 'Staff edit', price: 99 }).then(
        (res) => res,
      );
      await hold.reachedSave;
      const archived = await archiveAs(app, owner, item.id);
      expect(archived.status).toBe(200);
      hold.release();
      const result = await edit;

      // The edit started before the archive, but it must not slip an edit past it: staff
      // cannot see archived products, so the retried edit finds nothing.
      expect(result.status).toBe(404);
      expect(result.body.code).toBe('NOT_FOUND');
    } finally {
      hold.release();
      hold.restore();
    }

    const stored = await Product.findById(item.id);
    expect(stored.isArchived).toBe(true);
    expect(stored.archivedAt).toBeInstanceOf(Date);
    expect(stored.title).toBe('Before');
    expect(stored.price).toBe(4);
    expect(stored.quantity).toBe(6);
  });

  it('keeps a finished staff edit and the archive when the edit lands first', async () => {
    const app = buildApp();
    const item = await existing(await category(), { quantity: 2 });

    const edit = await patch(app, await staff(), item.id, { title: 'Edited first' });
    const archived = await archiveAs(app, await admin(), item.id);

    expect(edit.status).toBe(200);
    expect(archived.status).toBe(200);
    expect(archived.body.product).toMatchObject({
      title: 'Edited first',
      isArchived: true,
      quantity: 2,
    });
  });

  it('never loses the archive or the stock when real requests overlap at different offsets', async () => {
    const app = buildApp();
    const editor = await staff();
    const owner = await admin();
    const cat = await category();

    for (let i = 0; i < 10; i += 1) {
      const item = await existing(cat, { title: `Start ${i}`, quantity: 5 });
      const edit = patch(app, editor, item.id, { title: `Edit ${i}` });
      await new Promise((resolve) => setTimeout(resolve, i * 3));
      const [editResult, archived] = await Promise.all([edit, archiveAs(app, owner, item.id)]);

      expect(archived.status).toBe(200);
      expect([200, 404]).toContain(editResult.status);
      const stored = await Product.findById(item.id);
      expect(stored.isArchived).toBe(true);
      expect(stored.quantity).toBe(5);
      expect(stored.title).toBe(editResult.status === 200 ? `Edit ${i}` : `Start ${i}`);
    }
  });
});
