import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Product } from '../../src/models/Product.js';
import { useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

const fields = (sku, title = 'Widget') => ({
  title,
  sku,
  category: new mongoose.Types.ObjectId(),
  price: 10,
});

const rejection = (promise) =>
  promise.then(
    () => null,
    (error) => error,
  );

describe('Product SKU uniqueness (real inserts against the unique index)', () => {
  it('rejects a second product whose SKU differs only in letter case', async () => {
    await Product.create(fields('AB-100', 'First'));

    const error = await rejection(Product.create(fields('ab-100', 'Second')));

    expect(error).not.toBeNull();
    expect(error.code).toBe(11000);
    expect(await Product.countDocuments()).toBe(1);
    expect((await Product.findOne()).title).toBe('First');
  });

  it('stores the SKU uppercase, whatever case was sent', async () => {
    const created = await Product.create(fields('mixed-Case-1'));
    expect(created.sku).toBe('MIXED-CASE-1');
  });

  it('also rejects a SKU that differs only by surrounding spaces', async () => {
    await Product.create(fields('SPACE-1'));

    const error = await rejection(Product.create(fields('  space-1  ')));

    expect(error?.code).toBe(11000);
    expect(await Product.countDocuments()).toBe(1);
  });

  it('accepts a genuinely different SKU', async () => {
    await Product.create(fields('AB-100'));
    await Product.create(fields('AB-101'));
    expect(await Product.countDocuments()).toBe(2);
  });

  it('lets only one of two simultaneous inserts of the same SKU succeed', async () => {
    const results = await Promise.allSettled([
      Product.create(fields('RACE-1', 'A')),
      Product.create(fields('race-1', 'B')),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await Product.countDocuments()).toBe(1);
  });

  it("keeps an archived product's SKU reserved", async () => {
    await Product.create({ ...fields('ARCH-1'), isArchived: true });

    const error = await rejection(Product.create(fields('arch-1')));

    expect(error?.code).toBe(11000);
  });
});
