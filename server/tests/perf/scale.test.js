import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { Supplier } from '../../src/models/Supplier.js';
import { listSort } from '../../src/services/products.service.js';
import { randomUUID } from 'node:crypto';
import { buildApp, createUser } from '../helpers/setup.js';

/**
 * Scale check: 1,000 products (100 archived) and 12,000 stock movements. Timings are medians of
 * 5 runs on an in-memory MongoDB, so they say "does it scale", not "how fast is production". The
 * limits are loose on purpose (1 s); the query-plan checks are the exact, repeatable part.
 * Set PERF_REPORT=<file> to write the numbers out.
 */

// One database for the whole file, seeded once (the shared helper empties it after every test).

const PRODUCTS = 1000;
const ARCHIVED_EVERY = 10; // 100 archived
const MOVEMENTS_PER_PRODUCT = 12;
const LIMIT_MS = 1000;

const app = buildApp();
const report = { counts: {}, timings: {}, plans: {} };
let admin;
let staff;
let sampleProduct;

// A small deterministic generator, so a run always builds the same data.
function lcg(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'), { dbName: 'perf_' + randomUUID() });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  const random = lcg(42);
  admin = await createUser({ role: 'admin', status: 'active', name: 'Ada Admin' });
  staff = await createUser({ role: 'staff', status: 'active', name: 'Sam Staff' });

  const categories = await Category.insertMany(
    Array.from({ length: 20 }, (_, i) => ({ title: `Category ${i}` })),
  );
  const suppliers = await Supplier.insertMany(
    Array.from({ length: 20 }, (_, i) => ({ name: `Supplier ${i}` })),
  );

  const now = Date.now();
  const products = Array.from({ length: PRODUCTS }, (_, i) => {
    const quantity = Math.floor(random() * 100);
    return {
      _id: new mongoose.Types.ObjectId(),
      title: `Widget ${i} ${['Pro', 'Mini', 'Max', 'Lite'][i % 4]}`,
      sku: `SKU-${String(i).padStart(5, '0')}`,
      category: categories[i % categories.length]._id,
      supplier: suppliers[i % suppliers.length]._id,
      price: Math.round(random() * 100000) / 100,
      quantity,
      reorderLevel: 10 + (i % 15),
      isArchived: i % ARCHIVED_EVERY === 0,
      createdAt: new Date(now - i * 60_000),
      updatedAt: new Date(now - i * 60_000),
    };
  });
  await Product.collection.insertMany(products);
  sampleProduct = products[1];

  const types = ['receive', 'ship', 'adjust', 'increment', 'decrement'];
  const movements = [];
  for (const product of products) {
    let before = 0;
    for (let n = 0; n < MOVEMENTS_PER_PRODUCT; n += 1) {
      const type = types[n % types.length];
      const change = type === 'ship' || type === 'decrement' ? -1 : 2;
      movements.push({
        _id: new mongoose.Types.ObjectId(),
        product: product._id,
        type,
        quantityChange: change,
        quantityBefore: before,
        quantityAfter: before + change,
        ...(type === 'receive' && { supplier: product.supplier }),
        performedBy: n % 2 ? admin._id : staff._id,
        performedByName: n % 2 ? 'Ada Admin' : 'Sam Staff',
        createdAt: new Date(now - (n * 86_400_000 + random() * 3_600_000)),
        updatedAt: new Date(now),
      });
      before += change;
    }
  }
  await StockMovement.collection.insertMany(movements);
  report.counts = {
    products: PRODUCTS,
    archived: PRODUCTS / ARCHIVED_EVERY,
    movements: movements.length,
  };
}, 120_000);

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function timed(label, user, path, expectedStatus = 200) {
  const runs = [];
  let last;
  for (let i = 0; i < 5; i += 1) {
    const started = performance.now();
    last = await request(app).get(path).set('x-test-user', String(user._id));
    runs.push(performance.now() - started);
    expect(last.status, `${label}: ${last.text.slice(0, 120)}`).toBe(expectedStatus);
  }
  report.timings[label] = { ms: Math.round(median(runs)), bytes: last.text.length };
  expect(median(runs), label).toBeLessThan(LIMIT_MS);
  return last;
}

describe('1,000 products and 12,000 movements: response times', () => {
  it('product list, every sort, page, filter and search', async () => {
    const list = await timed('products: default list', admin, '/api/products');
    expect(list.body.total).toBe(PRODUCTS - PRODUCTS / ARCHIVED_EVERY);
    await timed('products: sort by quantity', admin, '/api/products?sortBy=quantity&order=desc');
    await timed('products: sort by price', admin, '/api/products?sortBy=price');
    await timed('products: page 45 of 45', admin, '/api/products?page=45');
    await timed('products: search "widget 77"', admin, '/api/products?search=widget%2077');
    await timed('products: search by SKU "sku-005"', admin, '/api/products?search=sku-005');
    await timed('products: status low_stock', admin, '/api/products?status=low_stock');
    await timed('products: status in_stock', admin, '/api/products?status=in_stock');
    await timed('products: status out_of_stock', admin, '/api/products?status=out_of_stock');
    await timed('products: archived included (admin)', admin, '/api/products?archived=true');
    // Not category 0: its products are exactly the archived ones in this data set.
    const category = (await Category.findOne({ title: 'Category 1' }))._id;
    await timed('products: one category', admin, `/api/products?category=${category}`);
    await timed('products: as staff', staff, '/api/products');
  });

  it('movements, product history, dashboard, lists and the CSV export', async () => {
    await timed('movements: default page', admin, '/api/movements');
    await timed('movements: type=ship', admin, '/api/movements?type=ship');
    await timed('movements: one product', admin, `/api/movements?product=${sampleProduct._id}`);
    await timed('movements: one performer', admin, `/api/movements?user=${admin._id}`);
    const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
    await timed('movements: last 7 days', admin, `/api/movements?from=${encodeURIComponent(from)}`);
    await timed('movements: as staff (hides archived products)', staff, '/api/movements');
    await timed('movements: performers list', admin, '/api/movements/performers');
    await timed('product history (12 rows)', admin, `/api/products/${sampleProduct._id}/movements`);
    await timed('dashboard (admin)', admin, '/api/dashboard');
    await timed('dashboard (staff)', staff, '/api/dashboard');
    await timed('categories (20, with counts)', admin, '/api/categories');
    await timed('suppliers (20, with counts)', admin, '/api/suppliers');
    await timed('users list', admin, '/api/users');
    const csv = await timed('products CSV export (900 rows)', admin, '/api/products/export');
    expect(csv.text.split('\r\n').length).toBeGreaterThan(PRODUCTS - PRODUCTS / ARCHIVED_EVERY);
  });
});

/** Every stage name in an explain plan, however deeply nested. */
function stagesOf(plan) {
  return [...JSON.stringify(plan).matchAll(/"stage":"([A-Z_]+)"/g)].map((match) => match[1]);
}

async function plan(label, query) {
  const explained = await query.explain('executionStats');
  const stats = explained.executionStats;
  const stages = stagesOf(explained.queryPlanner.winningPlan);
  report.plans[label] = {
    stages: [...new Set(stages)].join(' > '),
    examined: stats.totalDocsExamined,
    keysExamined: stats.totalKeysExamined,
    returned: stats.nReturned,
  };
  return { stages, stats };
}

describe('query plans at 1,000 products and 12,000 movements: lists read an index, not the collection', () => {
  const collation = { locale: 'en', strength: 2 };
  const newestFirst = { createdAt: -1, _id: -1 };

  /** The same query the product list runs, with the real sort. */
  const productList = (sortBy, order, extra = {}) => {
    const find = Product.find({ isArchived: false, ...extra });
    if (sortBy === 'title') find.collation(collation);
    return find.sort(listSort(sortBy, order)).limit(20);
  };

  it.each([
    ['title', 'asc'],
    ['title', 'desc'],
    ['quantity', 'asc'],
    ['quantity', 'desc'],
    ['price', 'asc'],
    ['price', 'desc'],
  ])(
    'product list by %s %s reads 20 index entries and sorts nothing in memory',
    async (sortBy, order) => {
      const label = `product list by ${sortBy} ${order}`;
      const { stages, stats } = await plan(label, productList(sortBy, order));

      expect(stages, label).toContain('IXSCAN');
      expect(stages, label).not.toContain('COLLSCAN');
      expect(stages, label).not.toContain('SORT');
      expect(stats.totalKeysExamined, label).toBeLessThanOrEqual(25);
      expect(stats.totalDocsExamined, label).toBeLessThanOrEqual(25);
    },
  );

  it.each([
    ['movements newest first', () => ({}), 'all'],
    ['movements of one product', () => ({ product: sampleProduct._id }), 'product'],
    ['movements by one performer', () => ({ performedBy: admin._id }), 'performer'],
    ['movements of one type', () => ({ type: 'ship' }), 'type'],
    ['movements of one supplier', () => ({ supplier: sampleProduct.supplier }), 'supplier'],
  ])('%s reads 20 index entries and sorts nothing in memory', async (label, filter) => {
    const query = StockMovement.find(filter()).sort(newestFirst).limit(20);
    const { stages, stats } = await plan(label, query);

    expect(stages, label).toContain('IXSCAN');
    expect(stages, label).not.toContain('COLLSCAN');
    expect(stages, label).not.toContain('SORT');
    expect(stats.totalDocsExamined, label).toBeLessThanOrEqual(25);
  });

  it('the newest-first page over a date range stays on the index', async () => {
    const from = new Date(Date.now() - 7 * 86_400_000);
    const { stages, stats } = await plan(
      'movements, last 7 days',
      StockMovement.find({ createdAt: { $gte: from } })
        .sort(newestFirst)
        .limit(20),
    );
    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('COLLSCAN');
    expect(stages).not.toContain('SORT');
    expect(stats.totalDocsExamined).toBeLessThanOrEqual(25);
  });

  it("staff's movement page (archived products excluded) still reads only a short stretch of the index", async () => {
    const archived = await Product.find({ isArchived: true }).distinct('_id');
    const { stages, stats } = await plan(
      'movements as staff ($nin archived)',
      StockMovement.find({ product: { $nin: archived } })
        .sort(newestFirst)
        .limit(20),
    );
    expect(stages).not.toContain('COLLSCAN');
    expect(stages).not.toContain('SORT');
    // About 1 in 10 products is archived, so a page of 20 needs about 22 documents, not 12,000.
    expect(stats.totalDocsExamined).toBeLessThanOrEqual(100);
  });

  it('records the plans that cannot use an index: search and the derived stock-status filters', async () => {
    const search = await plan(
      'search (regex on title or SKU)',
      Product.find({
        isArchived: false,
        $or: [{ title: /widget 77/i }, { sku: /widget 77/i }],
      }).limit(20),
    );
    const lowStock = await plan(
      'status low_stock ($expr)',
      Product.find({
        isArchived: false,
        $expr: { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$reorderLevel'] }] },
      }).limit(20),
    );
    // They may read every active product (900) once. Fine at this size; it grows with it.
    expect(search.stats.totalDocsExamined).toBeLessThanOrEqual(PRODUCTS);
    expect(lowStock.stats.totalDocsExamined).toBeLessThanOrEqual(PRODUCTS);
  });
});

describe('report', () => {
  it('writes the numbers out when PERF_REPORT is set', () => {
    if (process.env.PERF_REPORT)
      writeFileSync(process.env.PERF_REPORT, JSON.stringify(report, null, 2));
    expect(Object.keys(report.timings).length).toBeGreaterThan(20);
  });
});
