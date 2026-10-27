import { describe, expect, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { Supplier } from '../../src/models/Supplier.js';
import { changeStock } from '../../src/services/stock.service.js';
import { createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

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

const staff = () => createUser({ role: 'staff', status: 'active', name: 'Sam Staff' });
const quantityOf = async (item) => (await Product.findById(item._id)).quantity;
const rejection = (promise) =>
  promise.then(
    () => null,
    (error) => error,
  );

describe('changeStock', () => {
  it('receive adds stock and records one movement with before, after and the performer', async () => {
    const actor = await staff();
    const item = await product({ quantity: 3 });

    const { product: updated, movement } = await changeStock(item._id, actor, {
      type: 'receive',
      quantity: 4,
      note: 'Delivery',
    });

    expect(updated.quantity).toBe(7);
    expect(movement).toMatchObject({
      type: 'receive',
      quantityChange: 4,
      quantityBefore: 3,
      quantityAfter: 7,
      note: 'Delivery',
      performedByName: 'Sam Staff',
    });
    expect(movement.performedBy.equals(actor._id)).toBe(true);
    expect(await StockMovement.countDocuments()).toBe(1);
  });

  it('a receive stores the current supplier, and later supplier changes do not rewrite it', async () => {
    const actor = await staff();
    const acme = await Supplier.create({ name: 'Acme' });
    const other = await Supplier.create({ name: 'Other' });
    const item = await product({ supplier: acme._id });

    const { movement } = await changeStock(item._id, actor, { type: 'receive', quantity: 1 });
    await Product.updateOne({ _id: item._id }, { supplier: other._id });

    expect((await StockMovement.findById(movement._id)).supplier.equals(acme._id)).toBe(true);
  });

  it('only a receive records a supplier', async () => {
    const actor = await staff();
    const acme = await Supplier.create({ name: 'Acme' });
    const item = await product({ supplier: acme._id, quantity: 5 });

    const { movement } = await changeStock(item._id, actor, { type: 'ship', quantity: 1 });

    expect(movement.supplier).toBeUndefined();
  });

  it('ship removes stock, and may take it exactly to zero', async () => {
    const actor = await staff();
    const item = await product({ quantity: 5 });

    const { movement } = await changeStock(item._id, actor, { type: 'ship', quantity: 5 });

    expect(movement).toMatchObject({ quantityChange: -5, quantityBefore: 5, quantityAfter: 0 });
    expect(await quantityOf(item)).toBe(0);
  });

  it('refuses to ship more than is in stock and leaves no movement', async () => {
    const actor = await staff();
    const item = await product({ quantity: 2 });

    const error = await rejection(changeStock(item._id, actor, { type: 'ship', quantity: 3 }));

    expect(error).toMatchObject({ status: 400, code: 'INSUFFICIENT_STOCK' });
    expect(await quantityOf(item)).toBe(2);
    expect(await StockMovement.countDocuments()).toBe(0);
  });

  it('increment and decrement change the quantity by one, and decrement stops at zero', async () => {
    const actor = await staff();
    const item = await product({ quantity: 1 });

    const up = await changeStock(item._id, actor, { type: 'increment' });
    const down = await changeStock(item._id, actor, { type: 'decrement' });
    await changeStock(item._id, actor, { type: 'decrement' });
    const error = await rejection(changeStock(item._id, actor, { type: 'decrement' }));

    expect(up.movement).toMatchObject({ quantityChange: 1, quantityBefore: 1, quantityAfter: 2 });
    expect(down.movement).toMatchObject({ quantityChange: -1, quantityAfter: 1 });
    expect(error).toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(await quantityOf(item)).toBe(0);
    expect(await StockMovement.countDocuments()).toBe(3);
  });

  it('adjust sets an absolute quantity, up or down, with the delta computed from the current one', async () => {
    const actor = await staff();
    const item = await product({ quantity: 10 });

    const down = await changeStock(item._id, actor, { type: 'adjust', quantity: 4 });
    const up = await changeStock(item._id, actor, { type: 'adjust', quantity: 9 });
    const zero = await changeStock(item._id, actor, { type: 'adjust', quantity: 0 });

    expect(down.movement).toMatchObject({
      quantityChange: -6,
      quantityBefore: 10,
      quantityAfter: 4,
    });
    expect(up.movement).toMatchObject({ quantityChange: 5, quantityBefore: 4, quantityAfter: 9 });
    expect(zero.movement).toMatchObject({ quantityChange: -9, quantityAfter: 0 });
  });

  it('rejects an adjust to the current quantity and writes nothing', async () => {
    const actor = await staff();
    const item = await product({ quantity: 6 });

    const error = await rejection(changeStock(item._id, actor, { type: 'adjust', quantity: 6 }));

    expect(error).toMatchObject({ status: 400, code: 'NO_CHANGE' });
    expect(error.errors.quantity).toBeTruthy();
    expect(await StockMovement.countDocuments()).toBe(0);
  });

  it('refuses every type on an archived product', async () => {
    const actor = await staff();
    const item = await product({ quantity: 5, isArchived: true, archivedAt: new Date() });

    const errors = await Promise.all(
      [
        { type: 'receive', quantity: 1 },
        { type: 'ship', quantity: 1 },
        { type: 'adjust', quantity: 1 },
        { type: 'increment' },
        { type: 'decrement' },
      ].map((change) => rejection(changeStock(item._id, actor, change))),
    );

    for (const error of errors) {
      expect(error).toMatchObject({ status: 409, code: 'PRODUCT_ARCHIVED' });
    }
    expect(await quantityOf(item)).toBe(5);
    expect(await StockMovement.countDocuments()).toBe(0);
  });

  it('answers 404 for a product that does not exist', async () => {
    const actor = await staff();
    const missing = '64b000000000000000000000';

    for (const change of [
      { type: 'receive', quantity: 1 },
      { type: 'ship', quantity: 1 },
      { type: 'adjust', quantity: 1 },
    ]) {
      expect(await rejection(changeStock(missing, actor, change))).toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    }
  });

  it('ignores a performedBy passed with the change; the performer is the acting user', async () => {
    const actor = await staff();
    const someoneElse = await createUser({ role: 'admin', status: 'active', name: 'Ada Admin' });
    const item = await product();

    const { movement } = await changeStock(item._id, actor, {
      type: 'receive',
      quantity: 1,
      performedBy: someoneElse._id,
      performedByName: 'Ada Admin',
    });

    expect(movement.performedBy.equals(actor._id)).toBe(true);
    expect(movement.performedByName).toBe('Sam Staff');
  });

  describe('concurrency', () => {
    it('parallel ships never take quantity below zero; movements equal successful updates', async () => {
      const actor = await staff();
      const item = await product({ quantity: 5 });

      const outcomes = await Promise.all(
        Array.from({ length: 20 }, () =>
          rejection(changeStock(item._id, actor, { type: 'ship', quantity: 1 })),
        ),
      );

      const failures = outcomes.filter(Boolean);
      expect(failures).toHaveLength(15);
      for (const error of failures) expect(error.code).toBe('INSUFFICIENT_STOCK');
      expect(await quantityOf(item)).toBe(0);
      expect(await StockMovement.countDocuments({ product: item._id })).toBe(5);
    });

    it('parallel receives and decrements add up, and every movement is consistent', async () => {
      const actor = await staff();
      const item = await product({ quantity: 10 });

      await Promise.all([
        ...Array.from({ length: 6 }, () =>
          changeStock(item._id, actor, { type: 'receive', quantity: 2 }),
        ),
        ...Array.from({ length: 4 }, () => changeStock(item._id, actor, { type: 'decrement' })),
      ]);

      expect(await quantityOf(item)).toBe(10 + 12 - 4);
      const movements = await StockMovement.find({ product: item._id });
      expect(movements).toHaveLength(10);
      for (const movement of movements) {
        expect(movement.quantityAfter - movement.quantityBefore).toBe(movement.quantityChange);
      }
      const net = movements.reduce((sum, movement) => sum + movement.quantityChange, 0);
      expect(net).toBe(8);
    });

    it('an adjust racing with ships ends consistent with its movements', async () => {
      const actor = await staff();
      const item = await product({ quantity: 8 });

      await Promise.all([
        changeStock(item._id, actor, { type: 'adjust', quantity: 20 }),
        changeStock(item._id, actor, { type: 'ship', quantity: 3 }),
        changeStock(item._id, actor, { type: 'ship', quantity: 2 }),
      ]);

      const movements = await StockMovement.find({ product: item._id });
      const total = movements.reduce((sum, movement) => sum + movement.quantityChange, 8);
      expect(movements).toHaveLength(3);
      expect(await quantityOf(item)).toBe(total);
    });

    it('a ship racing with an archive either succeeds before it or is refused after it', async () => {
      const actor = await staff();
      const item = await product({ quantity: 5 });

      const [outcome] = await Promise.all([
        rejection(changeStock(item._id, actor, { type: 'ship', quantity: 1 })),
        Product.updateOne({ _id: item._id }, { isArchived: true, archivedAt: new Date() }),
      ]);

      expect(await StockMovement.countDocuments({ product: item._id })).toBe(outcome ? 0 : 1);
      expect(await quantityOf(item)).toBe(outcome ? 5 : 4);
      if (outcome) expect(outcome.code).toBe('PRODUCT_ARCHIVED');
    });
  });
});
