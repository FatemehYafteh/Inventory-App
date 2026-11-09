import { MAX_QUANTITY } from '@inventory/shared/schemas';
import { describe, expect, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { changeStock } from '../../src/services/stock.service.js';
import { createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

let counter = 0;

async function product(overrides = {}) {
  counter += 1;
  const category = (await Category.findOne()) ?? (await Category.create({ title: 'General' }));
  return Product.create({
    title: `Widget ${counter}`,
    sku: `LIMIT-${counter}`,
    category: category._id,
    price: 10,
    ...overrides,
  });
}

const staff = () => createUser({ role: 'staff', status: 'active', name: 'Sam Staff' });
const quantityOf = async (item) => (await Product.findById(item._id)).quantity;
const rejection = (promise) =>
  promise.then(
    () => null,
    (error) => error,
  );

describe('the stored total quantity is capped at MAX_QUANTITY', () => {
  it('lets a receive take the total exactly to the limit', async () => {
    const actor = await staff();
    const item = await product({ quantity: MAX_QUANTITY - 10 });

    await changeStock(item._id, actor, { type: 'receive', quantity: 10 });

    expect(await quantityOf(item)).toBe(MAX_QUANTITY);
  });

  it('refuses a receive that would pass the limit, and writes nothing', async () => {
    const actor = await staff();
    const item = await product({ quantity: MAX_QUANTITY - 10 });

    const error = await rejection(changeStock(item._id, actor, { type: 'receive', quantity: 11 }));

    expect(error).toMatchObject({ status: 400, code: 'STOCK_TOTAL_TOO_LARGE' });
    expect(await quantityOf(item)).toBe(MAX_QUANTITY - 10);
    expect(await StockMovement.countDocuments()).toBe(0);
  });

  it('refuses repeated receives once the limit is reached', async () => {
    const actor = await staff();
    const item = await product({ quantity: MAX_QUANTITY - 2 });

    await changeStock(item._id, actor, { type: 'receive', quantity: 1 });
    await changeStock(item._id, actor, { type: 'receive', quantity: 1 });
    const error = await rejection(changeStock(item._id, actor, { type: 'receive', quantity: 1 }));

    expect(error).toMatchObject({ code: 'STOCK_TOTAL_TOO_LARGE' });
    expect(await quantityOf(item)).toBe(MAX_QUANTITY);
    expect(await StockMovement.countDocuments()).toBe(2);
  });

  it('refuses an increment at the limit, but still allows a decrement', async () => {
    const actor = await staff();
    const item = await product({ quantity: MAX_QUANTITY });

    expect(await rejection(changeStock(item._id, actor, { type: 'increment' }))).toMatchObject({
      code: 'STOCK_TOTAL_TOO_LARGE',
    });
    await changeStock(item._id, actor, { type: 'decrement' });

    expect(await quantityOf(item)).toBe(MAX_QUANTITY - 1);
  });

  it('refuses an adjust to a target above the limit, and allows one exactly at it', async () => {
    const actor = await staff();
    const item = await product({ quantity: 5 });

    expect(
      await rejection(changeStock(item._id, actor, { type: 'adjust', quantity: MAX_QUANTITY + 1 })),
    ).toMatchObject({ code: 'STOCK_TOTAL_TOO_LARGE' });
    expect(await quantityOf(item)).toBe(5);

    await changeStock(item._id, actor, { type: 'adjust', quantity: MAX_QUANTITY });
    expect(await quantityOf(item)).toBe(MAX_QUANTITY);
  });

  it('parallel receives never push the total past the limit', async () => {
    const actor = await staff();
    const item = await product({ quantity: MAX_QUANTITY - 5 });

    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        rejection(changeStock(item._id, actor, { type: 'receive', quantity: 1 })),
      ),
    );

    const refused = results.filter(Boolean);
    expect(refused).toHaveLength(7);
    for (const error of refused) expect(error.code).toBe('STOCK_TOTAL_TOO_LARGE');
    expect(await quantityOf(item)).toBe(MAX_QUANTITY);
    expect(await StockMovement.countDocuments()).toBe(5);
  });
});
