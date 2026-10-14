import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { categories } from '../../seed/data/categories.js';
import { products } from '../../seed/data/products.js';
import { suppliers } from '../../seed/data/suppliers.js';
import { users } from '../../seed/data/users.js';
import { DEFAULT_SEED_PASSWORD, buildHistory, seedDatabase } from '../../seed/seed.js';
import { Category } from '../../src/models/Category.js';
import { Product, stockStatus } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { Supplier } from '../../src/models/Supplier.js';
import { User } from '../../src/models/User.js';
import { ORIGIN, buildApp, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

const now = new Date('2026-10-12T12:00:00Z');

describe('seedDatabase', () => {
  it('fills every collection from the seed data', async () => {
    const created = await seedDatabase({ now });
    const movementTotal = products.reduce((sum, product) => sum + product.history.length, 0);

    expect(created).toEqual({
      users: users.length,
      categories: categories.length,
      suppliers: suppliers.length,
      products: products.length,
      movements: movementTotal,
    });
    expect(await StockMovement.countDocuments()).toBe(movementTotal);
  });

  it('keeps every product quantity consistent with its movement history', async () => {
    await seedDatabase({ now });

    for (const product of await Product.find()) {
      const movements = await StockMovement.find({ product: product._id }).sort({ createdAt: 1 });
      let quantity = 0;
      for (const movement of movements) {
        expect(movement.quantityBefore).toBe(quantity);
        expect(movement.quantityAfter).toBe(quantity + movement.quantityChange);
        expect(movement.quantityAfter).toBeGreaterThanOrEqual(0);
        quantity = movement.quantityAfter;
      }
      expect(product.quantity).toBe(quantity);
      expect(movements[0]).toMatchObject({ type: 'receive', note: 'Initial stock' });
      expect(product.createdAt.getTime()).toBe(movements[0].createdAt.getTime());
      expect(movements.at(-1).createdAt.getTime()).toBeLessThan(now.getTime());
    }
  });

  it('covers every stock status, archived products and supplier edge cases', async () => {
    await seedDatabase({ now });
    const all = await Product.find().populate('supplier');
    const visible = all.filter((product) => !product.isArchived);

    const statuses = new Set(visible.map((product) => stockStatus(product)));
    expect(statuses).toEqual(new Set(['in_stock', 'low_stock', 'out_of_stock']));
    expect(all.some((product) => product.isArchived && product.archivedAt)).toBe(true);
    expect(all.some((product) => !product.supplier)).toBe(true);
    expect(all.some((product) => product.supplier && !product.supplier.isActive)).toBe(true);

    const emptyCategory = await Category.findOne({ title: 'Seasonal' }).populate('productCount');
    expect(emptyCategory.productCount).toBe(0);
    const unusedSupplier = await Supplier.findOne({ name: 'Northwind Freight' }).populate(
      'productCount',
    );
    expect(unusedSupplier.productCount).toBe(0);
  });

  it('records the supplier on receives only, and only active users as performers', async () => {
    await seedDatabase({ now });
    const movements = await StockMovement.find().populate('product').populate('performedBy');

    for (const movement of movements) {
      if (movement.type === 'receive') {
        expect(String(movement.supplier ?? '')).toBe(String(movement.product.supplier ?? ''));
      } else {
        expect(movement.supplier).toBeUndefined();
      }
      expect(movement.performedBy.status).toBe('active');
      expect(movement.performedBy.emailVerified).toBe(true);
      expect(movement.performedByName).toBe(movement.performedBy.name);
    }
    const types = new Set(movements.map((movement) => movement.type));
    expect(types).toEqual(new Set(['receive', 'ship', 'adjust', 'increment', 'decrement']));
  });

  it('seeds a user for every role and status the app handles', async () => {
    await seedDatabase({ now });
    const seeded = await User.find();
    const states = new Set(seeded.map((user) => `${user.role}/${user.status}`));
    expect(states).toEqual(
      new Set(['admin/active', 'staff/active', 'staff/pending', 'staff/rejected']),
    );
    expect(seeded.some((user) => user.email && !user.emailVerified)).toBe(true);
    expect(seeded.some((user) => user.telegramId && !user.email)).toBe(true);
    const rejected = seeded.find((user) => user.status === 'rejected');
    expect(rejected.statusChangedBy).toBeDefined();
  });

  it('seeds an active Telegram admin with a verified email and no password', async () => {
    await seedDatabase({ now });
    const seeded = await User.find().select('+passwordHash');

    const telegramAdmin = seeded.find((user) => user.role === 'admin' && user.telegramId);
    expect(telegramAdmin).toMatchObject({ status: 'active', emailVerified: true });
    expect(telegramAdmin.email).toBeTruthy();
    expect(telegramAdmin.passwordHash).toBeUndefined();

    const telegramIds = seeded.map((user) => user.telegramId).filter(Boolean);
    expect(new Set(telegramIds).size).toBe(telegramIds.length);
  });

  it('creates accounts that work with the real login', async () => {
    await seedDatabase({ now });
    const app = buildApp();
    const login = (email) =>
      request(app)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email, password: DEFAULT_SEED_PASSWORD });

    expect((await login('admin@example.com')).body.user).toMatchObject({ role: 'admin' });
    expect((await login('pending@example.com')).body.user).toMatchObject({ status: 'pending' });
    expect((await login('unverified@example.com')).status).toBe(401);
    expect((await login('rejected@example.com')).status).toBe(403);
    expect((await login('telegram-nopass@example.com')).status).toBe(401);
  });

  it('seeds a Telegram user who can set a first password through the reset flow', async () => {
    await seedDatabase({ now });
    const app = buildApp();
    const post = (path, body) =>
      request(app)
        .post(path)
        .set('Origin', ORIGIN)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(body);
    const email = 'telegram-nopass@example.com';

    const seeded = await User.findOne({ email }).select('+passwordHash');
    expect(seeded).toMatchObject({ emailVerified: true, status: 'active' });
    expect(seeded.telegramId).toBeDefined();
    expect(seeded.passwordHash).toBeUndefined();
    expect(seeded.sessionsRevokedAt).toBeUndefined();

    expect((await post('/api/auth/forgot-password', { email })).status).toBe(202);
    await app.locals.mailer.idle();
    const [mail] = app.locals.mailer.outbox;
    expect(mail.subject).toBe('Set your password');
    const token = decodeURIComponent(mail.text.match(/reset-password\?token=(\S+)/)[1]);

    const password = 'first-password-for-theo';
    const reset = await post('/api/auth/reset-password', {
      token,
      password,
      confirmPassword: password,
    });
    expect(reset.status).toBe(200);
    expect((await post('/api/auth/login', { email, password })).status).toBe(200);
  });

  it('is safe to run again and keeps changes made since', async () => {
    await seedDatabase({ now });
    await Product.updateOne({ sku: 'EL-LAP-001' }, { title: 'Renamed laptop' });

    const second = await seedDatabase({ now });

    expect(second).toEqual({ users: 0, categories: 0, suppliers: 0, products: 0, movements: 0 });
    expect((await Product.findOne({ sku: 'EL-LAP-001' })).title).toBe('Renamed laptop');
  });

  it('reset wipes and reseeds', async () => {
    await seedDatabase({ now });
    await Product.updateOne({ sku: 'EL-LAP-001' }, { title: 'Renamed laptop' });

    await seedDatabase({ now, reset: true });

    expect((await Product.findOne({ sku: 'EL-LAP-001' })).title).toBe('Laptop 14" i5 16GB');
    expect(await Product.countDocuments()).toBe(products.length);
  });
});

describe('buildHistory', () => {
  const performers = [{ _id: 'u1', name: 'Ada' }];
  const build = (history) =>
    buildHistory({ sku: 'X', history }, { productIndex: 0, now, performers });

  it('computes adjust as the difference to the target', () => {
    const { movements, quantity } = build(['receive 10', 'adjust 4']);
    expect(movements[1]).toMatchObject({ type: 'adjust', quantityChange: -6, quantityAfter: 4 });
    expect(quantity).toBe(4);
  });

  it('rejects data that breaks the stock rules', () => {
    expect(() => build(['ship 1'])).toThrow(/must start with receive/);
    expect(() => build(['receive 2', 'ship 3'])).toThrow(/below zero/);
    expect(() => build(['receive 2', 'adjust 2'])).toThrow(/same as current/);
    expect(() => build(['receive 0'])).toThrow(/positive/);
  });
});
