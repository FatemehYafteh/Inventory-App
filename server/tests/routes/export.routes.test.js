import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { Supplier } from '../../src/models/Supplier.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

const BOM = String.fromCharCode(0xfeff);

function get(app, actor, path) {
  const req = request(app)
    .get(path)
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest');
  return actor ? req.set('x-test-user', actor.id) : req;
}

const admin = (overrides) => createUser({ role: 'admin', name: 'Ada Admin', ...overrides });
const staff = (overrides) => createUser({ role: 'staff', name: 'Sam Staff', ...overrides });

/** A small CSV reader for the tests: the BOM is stripped and quoted cells are unquoted. */
function parseCsv(text) {
  const body = text.startsWith(BOM) ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (quoted) {
      if (char === '"' && body[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\r' && body[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else cell += char;
  }
  return rows;
}

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
    quantityBefore: 100,
    quantityAfter: 101,
    performedBy: performer._id,
    performedByName: performer.name,
    ...overrides,
  });
}

describe('GET /api/movements/export', () => {
  it('downloads a UTF-8 CSV with a BOM, a header and one row per movement, newest first', async () => {
    const actor = await admin();
    const supplier = await Supplier.create({ name: 'Acme, Inc.' });
    const item = await product({ title: 'چکش', sku: 'HAM-1' });
    await movement(item, actor, { createdAt: new Date('2026-10-01T10:00:00Z') });
    await movement(item, actor, {
      createdAt: new Date('2026-10-02T10:00:00Z'),
      type: 'ship',
      quantityChange: -5,
      quantityBefore: 101,
      quantityAfter: 96,
      supplier: supplier._id,
      note: 'Truck "7", dock 2',
    });

    const res = await get(buildApp(), actor, '/api/movements/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="movements-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.text.startsWith(BOM)).toBe(true);
    const rows = parseCsv(res.text);
    expect(rows[0]).toEqual([
      'Date',
      'Product',
      'SKU',
      'Type',
      'Change',
      'Before',
      'After',
      'Supplier',
      'Note',
      'Performed by',
      'Role',
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual([
      '2026-10-02T10:00:00.000Z',
      'چکش',
      'HAM-1',
      'ship',
      '-5',
      '101',
      '96',
      'Acme, Inc.',
      'Truck "7", dock 2',
      'Ada Admin',
      'admin',
    ]);
    expect(rows[2][3]).toBe('receive');
  });

  it('exports exactly the rows the filtered list shows', async () => {
    const app = buildApp();
    const ada = await admin();
    const sam = await staff();
    const item = await product();
    const other = await product();
    await movement(item, ada, { createdAt: new Date('2026-10-14T20:29:59Z') });
    await movement(item, sam, { createdAt: new Date('2026-10-14T20:30:00Z') });
    await movement(item, sam, { createdAt: new Date('2026-10-15T10:00:00Z'), type: 'ship' });
    await movement(other, sam, { createdAt: new Date('2026-10-15T11:00:00Z') });
    await movement(item, sam, { createdAt: new Date('2026-10-15T20:30:00Z') });

    const query = `?user=${sam.id}&product=${item.id}&from=${encodeURIComponent('2026-10-14T20:30:00.000Z')}&to=${encodeURIComponent('2026-10-15T20:30:00.000Z')}`;
    const list = await get(app, ada, `/api/movements${query}`);
    const csv = parseCsv((await get(app, ada, `/api/movements/export${query}`)).text);

    expect(list.body.total).toBe(2);
    expect(csv.length - 1).toBe(list.body.total);
    expect(csv.slice(1).map((row) => row[0])).toEqual(list.body.items.map((row) => row.createdAt));
    const byType = await get(app, ada, '/api/movements/export?type=ship');
    expect(parseCsv(byType.text)).toHaveLength(2);
  });

  it('ignores the page and limit and returns every matching row', async () => {
    const actor = await admin();
    const item = await product();
    for (let i = 0; i < 25; i += 1) await movement(item, actor);

    const res = await get(buildApp(), actor, '/api/movements/export?limit=5&page=3');

    expect(parseCsv(res.text)).toHaveLength(26);
  });

  it('writes only the header when nothing matches', async () => {
    const res = await get(buildApp(), await admin(), '/api/movements/export');
    expect(res.status).toBe(200);
    expect(parseCsv(res.text)).toHaveLength(1);
  });

  it('escapes text that a spreadsheet would run as a formula, but not numbers', async () => {
    const actor = await admin({ name: '@evil' });
    const item = await product({ title: '=SUM(A1)', sku: '+SKU' });
    await movement(item, actor, {
      note: '-2+3',
      type: 'ship',
      quantityChange: -4,
      quantityBefore: 100,
      quantityAfter: 96,
    });

    const [, row] = parseCsv((await get(buildApp(), actor, '/api/movements/export')).text);

    expect(row.slice(1, 3)).toEqual(["'=SUM(A1)", "'+SKU"]);
    expect(row[4]).toBe('-4');
    expect(row[8]).toBe("'-2+3");
    expect(row[9]).toBe("'@evil");
  });

  it('leaves out movements of archived products for staff', async () => {
    const ada = await admin();
    const sam = await staff();
    const live = await product();
    const archived = await product({ isArchived: true, archivedAt: new Date() });
    await movement(live, ada);
    await movement(archived, ada);

    const asStaff = parseCsv((await get(buildApp(), sam, '/api/movements/export')).text);
    const asAdmin = parseCsv((await get(buildApp(), ada, '/api/movements/export')).text);

    expect(asStaff).toHaveLength(2);
    expect(asAdmin).toHaveLength(3);
  });

  it('rejects bad filters like the list does, as JSON', async () => {
    const res = await get(buildApp(), await admin(), '/api/movements/export?from=2026-10-14');
    expect(res.status).toBe(400);
    expect(res.body.errorCodes.from).toBe('DATE_TIME_INVALID');
  });

  it('refuses unauthenticated, pending, rejected and incomplete users', async () => {
    const app = buildApp();
    expect((await get(app, null, '/api/movements/export')).status).toBe(401);
    expect(
      (await get(app, await staff({ status: 'pending' }), '/api/movements/export')).status,
    ).toBe(403);
    expect(
      (await get(app, await staff({ status: 'rejected' }), '/api/movements/export')).status,
    ).toBe(403);
    expect(
      (await get(app, await staff({ emailVerified: false }), '/api/movements/export')).status,
    ).toBe(403);
  });
});

describe('GET /api/products/export', () => {
  it('downloads the products with category, supplier and stock status', async () => {
    const actor = await staff();
    const supplier = await Supplier.create({ name: 'Acme' });
    const category = await Category.create({ title: 'Tools' });
    await product({
      title: 'Claw Hammer',
      sku: 'HAM-1',
      category: category._id,
      supplier: supplier._id,
      price: 12.5,
      quantity: 2,
      reorderLevel: 5,
    });

    const res = await get(buildApp(), actor, '/api/products/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toMatch(
      /filename="products-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const rows = parseCsv(res.text);
    expect(rows[0]).toEqual([
      'Title',
      'SKU',
      'Category',
      'Supplier',
      'Price',
      'Quantity',
      'Reorder level',
      'Stock status',
      'Archived',
      'Created',
    ]);
    expect(rows[1].slice(0, 9)).toEqual([
      'Claw Hammer',
      'HAM-1',
      'Tools',
      'Acme',
      '12.5',
      '2',
      '5',
      'low_stock',
      'false',
    ]);
    expect(rows[1][9]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('respects the search, category, supplier, status and sort of the list', async () => {
    const app = buildApp();
    const actor = await admin();
    const supplier = await Supplier.create({ name: 'Acme' });
    const tools = await Category.create({ title: 'Tools' });
    const paper = await Category.create({ title: 'Paper' });
    await product({ title: 'Hammer', category: tools._id, supplier: supplier._id, quantity: 0 });
    await product({ title: 'Saw', category: tools._id, quantity: 50 });
    await product({ title: 'Paper A4', category: paper._id, quantity: 1, reorderLevel: 10 });

    const titles = async (query) =>
      parseCsv((await get(app, actor, `/api/products/export${query}`)).text)
        .slice(1)
        .map((row) => row[0]);

    expect(await titles('')).toEqual(['Hammer', 'Paper A4', 'Saw']);
    expect(await titles('?search=pap')).toEqual(['Paper A4']);
    expect(await titles(`?category=${tools.id}`)).toEqual(['Hammer', 'Saw']);
    expect(await titles(`?supplier=${supplier.id}`)).toEqual(['Hammer']);
    expect(await titles('?status=out_of_stock')).toEqual(['Hammer']);
    expect(await titles('?status=low_stock')).toEqual(['Paper A4']);
    expect(await titles('?sortBy=quantity&order=desc')).toEqual(['Saw', 'Paper A4', 'Hammer']);
  });

  it('exports exactly the rows the list shows, ignoring paging', async () => {
    const app = buildApp();
    const actor = await admin();
    for (let i = 0; i < 25; i += 1) await product({ quantity: i + 1, reorderLevel: 30 });

    const list = await get(app, actor, '/api/products?status=low_stock&limit=5');
    const csv = parseCsv(
      (await get(app, actor, '/api/products/export?status=low_stock&limit=5')).text,
    );

    expect(list.body.total).toBe(25);
    expect(csv).toHaveLength(26);
  });

  it('hides archived products unless an admin asks, and refuses staff who ask', async () => {
    const app = buildApp();
    const ada = await admin();
    const sam = await staff();
    await product({ title: 'Live' });
    await product({ title: 'Gone', isArchived: true, archivedAt: new Date() });

    const count = async (actor, query = '') =>
      parseCsv((await get(app, actor, `/api/products/export${query}`)).text).length - 1;

    expect(await count(ada)).toBe(1);
    expect(await count(ada, '?archived=true')).toBe(2);
    expect(await count(sam)).toBe(1);
    expect((await get(app, sam, '/api/products/export?archived=true')).status).toBe(403);
  });

  it('escapes formula starts in text cells but keeps numbers raw', async () => {
    const actor = await admin();
    const supplier = await Supplier.create({ name: '@vendor' });
    await product({ title: '=SUM(A1)', sku: '-SKU', supplier: supplier._id, price: 0 });

    const [, row] = parseCsv((await get(buildApp(), actor, '/api/products/export')).text);

    expect(row[0]).toBe("'=SUM(A1)");
    expect(row[1]).toBe("'-SKU");
    expect(row[3]).toBe("'@vendor");
    expect(row[4]).toBe('0');
  });

  it('rejects bad filters as JSON and refuses users who cannot use the app', async () => {
    const app = buildApp();
    const bad = await get(app, await admin(), '/api/products/export?status=weird');
    expect(bad.status).toBe(400);
    expect((await get(app, null, '/api/products/export')).status).toBe(401);
    expect(
      (await get(app, await staff({ status: 'pending' }), '/api/products/export')).status,
    ).toBe(403);
    expect(
      (await get(app, await staff({ emailVerified: false }), '/api/products/export')).status,
    ).toBe(403);
  });
});
