import { describe, expect, it } from 'vitest';
import { migrateInitialReason } from '../../src/maintenance/migrateInitialReason.js';
import { syncAllIndexes } from '../../src/maintenance/syncIndexes.js';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

async function movement(fields) {
  const category = await Category.create({ title: `Cat ${Math.random()}` });
  const product = await Product.create({
    title: 'Hammer',
    sku: `SKU-${Math.random().toString(36).slice(2, 8)}`,
    category: category._id,
    price: 1,
    quantity: 5,
  });
  const user = await createUser();
  const [doc] = await StockMovement.create([
    {
      product: product._id,
      type: 'receive',
      quantityChange: 5,
      quantityBefore: 0,
      quantityAfter: 5,
      performedBy: user._id,
      performedByName: user.name,
      ...fields,
    },
  ]);
  return doc;
}

describe('migrateInitialReason', () => {
  it('turns the legacy "Initial stock" note into reason=initial, once', async () => {
    const legacy = await movement({ note: 'Initial stock' });
    const typed = await movement({ note: 'Initial stock', reason: 'initial' });
    const other = await movement({ note: 'Delivery from Acme' });

    expect(await migrateInitialReason()).toBe(1);
    expect(await migrateInitialReason()).toBe(0);

    expect(await StockMovement.findById(legacy._id).lean()).toMatchObject({
      reason: 'initial',
      note: '',
    });
    expect(await StockMovement.findById(typed._id).lean()).toMatchObject({ reason: 'initial' });
    expect((await StockMovement.findById(other._id).lean()).note).toBe('Delivery from Acme');
  });
});

describe('syncAllIndexes', () => {
  it('drops an index the schema no longer defines and keeps the defined ones', async () => {
    await Product.createCollection();
    await Product.collection.createIndex({ price: 1 }, { name: 'price_1' });

    const dropped = await syncAllIndexes([Product]);

    expect(dropped.Product).toContain('price_1');
    const names = (await Product.collection.indexes()).map((index) => index.name);
    expect(names).not.toContain('price_1');
    expect(names).toContain('sku_1');
  });
});
