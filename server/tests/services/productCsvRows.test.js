import { describe, expect, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { MAX_CSV_ROWS, productCsvRows } from '../../src/services/products.service.js';
import { useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

async function collect(rows) {
  const result = [];
  for await (const row of rows) result.push(row);
  return result;
}

const query = { sortBy: 'title', order: 'asc' };

describe('productCsvRows', () => {
  it('stops at the row cap, in the list order', async () => {
    const category = await Category.create({ title: 'Tools' });
    await Product.create(
      ['Chisel', 'Anvil', 'Bolt'].map((title, index) => ({
        title,
        sku: `SKU-${index}`,
        category: category._id,
        price: 1,
      })),
    );

    const rows = await collect(productCsvRows({ role: 'admin' }, query, { maxRows: 2 }));

    expect(rows.map((row) => row[0])).toEqual(['Anvil', 'Bolt']);
  });

  it('caps a full export at 10,000 rows', () => {
    expect(MAX_CSV_ROWS).toBe(10_000);
  });
});
