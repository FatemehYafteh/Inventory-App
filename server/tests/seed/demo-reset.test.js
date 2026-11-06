import { describe, expect, it } from 'vitest';
import { categories } from '../../seed/data/categories.js';
import { products } from '../../seed/data/products.js';
import { suppliers } from '../../seed/data/suppliers.js';
import { resetDemoData, seedDatabase } from '../../seed/seed.js';
import { Category } from '../../src/models/Category.js';
import { EmailToken } from '../../src/models/EmailToken.js';
import { Product } from '../../src/models/Product.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { StatusChange } from '../../src/models/StatusChange.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { Supplier } from '../../src/models/Supplier.js';
import { User } from '../../src/models/User.js';
import { createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

const now = new Date('2026-10-12T12:00:00Z');
const movementTotal = products.reduce((sum, product) => sum + product.history.length, 0);
const nextYear = new Date('2027-01-01T00:00:00Z');

async function snapshot(Model) {
  return JSON.stringify(await Model.find().sort({ _id: 1 }).lean());
}

describe('resetDemoData', () => {
  it('keeps every user, session, email token and status change untouched', async () => {
    const admin = await createUser({
      role: 'admin',
      name: 'Real Admin',
      email: 'real@example.com',
    });
    const staff = await createUser({ role: 'staff', name: 'Real Staff', email: 's@example.com' });
    await RefreshToken.create({
      user: admin._id,
      familyId: 'family-1',
      tokenHash: 'hash-1',
      expiresAt: nextYear,
    });
    await EmailToken.create({
      user: staff._id,
      type: 'verify_email',
      email: 's@example.com',
      tokenHash: 'hash-2',
      expiresAt: nextYear,
    });
    await StatusChange.create({
      user: staff._id,
      from: 'pending',
      to: 'active',
      changedBy: admin._id,
      changedByName: 'Real Admin',
    });
    const users = await snapshot(User);
    const sessions = await snapshot(RefreshToken);
    const emailTokens = await snapshot(EmailToken);
    const changes = await snapshot(StatusChange);

    await resetDemoData({ now });

    expect(await snapshot(User)).toBe(users);
    expect(await snapshot(RefreshToken)).toBe(sessions);
    expect(await snapshot(EmailToken)).toBe(emailTokens);
    expect(await snapshot(StatusChange)).toBe(changes);
    expect(await User.countDocuments()).toBe(2);
    expect(await RefreshToken.countDocuments()).toBe(1);
  });

  it('does not create any user, not even the demo accounts', async () => {
    await createUser({ role: 'admin', name: 'Real Admin', email: 'real@example.com' });

    const result = await resetDemoData({ now });

    expect(await User.countDocuments()).toBe(1);
    expect(result.usersKept).toBe(1);
  });

  it('replaces products, movements, categories and suppliers with the demo catalog', async () => {
    await seedDatabase({ now });
    const usersBefore = await snapshot(User);
    await Product.updateOne({}, { title: 'Hand-edited title' });
    await Category.create({ title: 'My own category' });
    await Supplier.create({ name: 'My own supplier' });

    const result = await resetDemoData({ now });

    expect(result).toMatchObject({
      categories: categories.length,
      suppliers: suppliers.length,
      products: products.length,
      movements: movementTotal,
    });
    expect(await Category.countDocuments()).toBe(categories.length);
    expect(await Supplier.countDocuments()).toBe(suppliers.length);
    expect(await Product.countDocuments()).toBe(products.length);
    expect(await StockMovement.countDocuments()).toBe(movementTotal);
    expect(await Product.exists({ title: 'Hand-edited title' })).toBeNull();
    expect(await Category.exists({ title: 'My own category' })).toBeNull();
    expect(await Supplier.exists({ name: 'My own supplier' })).toBeNull();
    expect(await snapshot(User)).toBe(usersBefore);
  });

  it('attributes the history to existing active, profile-complete users', async () => {
    const pending = await createUser({ role: 'admin', name: 'Pending', status: 'pending' });
    const unverified = await createUser({
      role: 'admin',
      name: 'Unverified',
      emailVerified: false,
    });
    const admin = await createUser({ role: 'admin', name: 'Real Admin' });
    const staff = await createUser({ role: 'staff', name: 'Real Staff' });

    await resetDemoData({ now });

    const performers = (await StockMovement.distinct('performedBy')).map(String).sort();
    expect(performers).toEqual([String(admin._id), String(staff._id)].sort());
    expect(performers).not.toContain(String(pending._id));
    expect(performers).not.toContain(String(unverified._id));
    for (const movement of await StockMovement.find()) {
      expect(['Real Admin', 'Real Staff']).toContain(movement.performedByName);
    }
    for (const product of await Product.find()) {
      const movements = await StockMovement.find({ product: product._id }).sort({ createdAt: 1 });
      expect(product.quantity).toBe(movements.at(-1).quantityAfter);
      expect(movements[0]).toMatchObject({ type: 'receive', reason: 'initial' });
    }
  });

  it('is safe to run twice and leaves the same catalog', async () => {
    await createUser({ role: 'admin', name: 'Real Admin' });

    await resetDemoData({ now });
    await resetDemoData({ now });

    expect(await Product.countDocuments()).toBe(products.length);
    expect(await StockMovement.countDocuments()).toBe(movementTotal);
    expect(await User.countDocuments()).toBe(1);
  });

  it('stops before deleting anything when no user can own the history', async () => {
    await Category.create({ title: 'Existing' });
    await createUser({ role: 'admin', name: 'Pending', status: 'pending' });

    await expect(resetDemoData({ now })).rejects.toThrow(/No active user/);

    expect(await Category.exists({ title: 'Existing' })).not.toBeNull();
  });
});
