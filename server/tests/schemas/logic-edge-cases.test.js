import {
  createProductSchema,
  listProductsQuerySchema,
  stockChangeSchema,
  updateProductSchema,
} from '@inventory/shared/schemas';
import { describe, expect, it } from 'vitest';

const CATEGORY = 'a'.repeat(24);
const product = (overrides = {}) => ({
  title: 'Widget',
  sku: 'ab-1',
  category: CATEGORY,
  price: 10,
  ...overrides,
});
const fails = (schema, input) => !schema.safeParse(input).success;

describe('stockChangeSchema edge cases', () => {
  it('rejects empty input, null and a non-object', () => {
    expect(fails(stockChangeSchema, {})).toBe(true);
    expect(fails(stockChangeSchema, undefined)).toBe(true);
    expect(fails(stockChangeSchema, null)).toBe(true);
    expect(fails(stockChangeSchema, 'receive')).toBe(true);
  });

  it('rejects an unknown type, including different case and padding', () => {
    for (const type of ['', 'Receive', ' ship', 'delete', 7, null]) {
      expect(fails(stockChangeSchema, { type, quantity: 1 })).toBe(true);
    }
  });

  it('rejects zero and negative amounts for receive and ship', () => {
    for (const type of ['receive', 'ship']) {
      for (const quantity of [0, -1, -1000]) {
        expect(fails(stockChangeSchema, { type, quantity })).toBe(true);
      }
    }
  });

  it('adjust allows 0 but not a negative target', () => {
    expect(stockChangeSchema.parse({ type: 'adjust', quantity: 0 })).toEqual({
      type: 'adjust',
      quantity: 0,
    });
    expect(fails(stockChangeSchema, { type: 'adjust', quantity: -1 })).toBe(true);
  });

  it('rejects fractions, NaN, Infinity and numeric strings', () => {
    for (const quantity of [1.5, 0.1, NaN, Infinity, -Infinity, '5', '', true, [5]]) {
      expect(fails(stockChangeSchema, { type: 'receive', quantity })).toBe(true);
    }
  });

  it('rejects a quantity beyond what a double can hold exactly', () => {
    // Above 2^53 integers lose precision, so $inc would silently store a wrong total.
    for (const quantity of [Number.MAX_SAFE_INTEGER + 2, 1e300, 1e21]) {
      expect(fails(stockChangeSchema, { type: 'receive', quantity })).toBe(true);
    }
  });

  it('increment and decrement ignore any quantity, and drop it from the output', () => {
    expect(stockChangeSchema.parse({ type: 'increment', quantity: 999 })).toEqual({
      type: 'increment',
    });
    expect(stockChangeSchema.parse({ type: 'decrement', quantity: -5 })).toEqual({
      type: 'decrement',
    });
  });

  it('trims a note, drops a blank one, and caps it at 500 characters', () => {
    const ok = stockChangeSchema.parse({ type: 'receive', quantity: 1, note: '  hi  ' });
    expect(ok.note).toBe('hi');
    expect(
      stockChangeSchema.parse({ type: 'receive', quantity: 1, note: '   ' }).note,
    ).toBeUndefined();
    expect(
      stockChangeSchema.safeParse({ type: 'receive', quantity: 1, note: 'x'.repeat(500) }).success,
    ).toBe(true);
    expect(fails(stockChangeSchema, { type: 'receive', quantity: 1, note: 'x'.repeat(501) })).toBe(
      true,
    );
    expect(
      fails(stockChangeSchema, { type: 'receive', quantity: 1, note: 'x'.repeat(1_000_000) }),
    ).toBe(true);
  });

  it('drops unknown keys such as performedBy instead of passing them on', () => {
    const out = stockChangeSchema.parse({
      type: 'ship',
      quantity: 1,
      performedBy: 'someone-else',
      $set: { quantity: 1e9 },
    });
    expect(out).toEqual({ type: 'ship', quantity: 1 });
  });
});

describe('createProductSchema edge cases', () => {
  it('accepts a minimal valid product and uppercases the SKU', () => {
    const out = createProductSchema.parse(product());
    expect(out.sku).toBe('AB-1');
  });

  it('treats "ab-1" and "AB-1" as the same SKU (duplicate data)', () => {
    expect(createProductSchema.parse(product({ sku: 'ab-1' })).sku).toBe(
      createProductSchema.parse(product({ sku: 'AB-1' })).sku,
    );
  });

  it('rejects empty and whitespace-only title and SKU', () => {
    for (const field of ['title', 'sku']) {
      for (const value of ['', '   ', undefined, null, 5]) {
        expect(fails(createProductSchema, product({ [field]: value }))).toBe(true);
      }
    }
  });

  it('enforces the length limits exactly at the boundary', () => {
    expect(createProductSchema.safeParse(product({ title: 'x'.repeat(200) })).success).toBe(true);
    expect(fails(createProductSchema, product({ title: 'x'.repeat(201) }))).toBe(true);
    expect(createProductSchema.safeParse(product({ sku: 'x'.repeat(64) })).success).toBe(true);
    expect(fails(createProductSchema, product({ sku: 'x'.repeat(65) }))).toBe(true);
    expect(fails(createProductSchema, product({ description: 'x'.repeat(2001) }))).toBe(true);
    expect(fails(createProductSchema, product({ title: 'x'.repeat(5_000_000) }))).toBe(true);
  });

  it('rejects negative, non-finite and non-numeric prices', () => {
    for (const price of [-0.01, -1, NaN, Infinity, '10', null, undefined]) {
      expect(fails(createProductSchema, product({ price }))).toBe(true);
    }
  });

  it('accepts a price of 0 and rounds to cents', () => {
    expect(createProductSchema.parse(product({ price: 0 })).price).toBe(0);
    expect(createProductSchema.parse(product({ price: 1.239 })).price).toBe(1.24);
  });

  it('never turns a finite price into Infinity (overflow when rounding)', () => {
    expect(fails(createProductSchema, product({ price: 1e308 }))).toBe(true);
    expect(createProductSchema.parse(product({ price: 1_000_000_000_000 })).price).toBe(
      1_000_000_000_000,
    );
  });

  it('rejects negative or fractional reorder level and initial quantity', () => {
    for (const field of ['reorderLevel', 'initialQuantity']) {
      for (const value of [-1, 1.5, NaN, '3']) {
        expect(fails(createProductSchema, product({ [field]: value }))).toBe(true);
      }
    }
  });

  it('rejects an absurdly large initial quantity', () => {
    expect(fails(createProductSchema, product({ initialQuantity: 1e300 }))).toBe(true);
    expect(
      fails(createProductSchema, product({ initialQuantity: Number.MAX_SAFE_INTEGER + 2 })),
    ).toBe(true);
  });

  it('refuses unknown fields so quantity and isArchived cannot be set directly', () => {
    expect(fails(createProductSchema, product({ quantity: 5 }))).toBe(true);
    expect(fails(createProductSchema, product({ isArchived: true }))).toBe(true);
  });

  it('rejects a malformed category id and malformed supplier id', () => {
    expect(fails(createProductSchema, product({ category: 'nope' }))).toBe(true);
    expect(fails(createProductSchema, product({ category: { $ne: null } }))).toBe(true);
    expect(fails(createProductSchema, product({ supplier: { $ne: null } }))).toBe(true);
  });

  it('maps an empty supplier to null (none)', () => {
    expect(createProductSchema.parse(product({ supplier: '' })).supplier).toBeNull();
  });
});

describe('updateProductSchema edge cases', () => {
  it('refuses an empty update', () => {
    expect(fails(updateProductSchema, {})).toBe(true);
  });
  it('accepts a single field', () => {
    expect(updateProductSchema.parse({ reorderLevel: 0 })).toEqual({ reorderLevel: 0 });
  });
});

describe('listProductsQuerySchema edge cases', () => {
  it('applies defaults on an empty query', () => {
    expect(listProductsQuerySchema.parse({})).toMatchObject({
      sortBy: 'title',
      order: 'asc',
      page: 1,
      limit: 20,
    });
  });
  it('rejects page 0, negative page, limit 0 and limit above 100', () => {
    for (const query of [{ page: '0' }, { page: '-1' }, { limit: '0' }, { limit: '101' }]) {
      expect(fails(listProductsQuerySchema, query)).toBe(true);
    }
  });
  it('rejects a non-numeric or fractional page', () => {
    expect(fails(listProductsQuerySchema, { page: 'abc' })).toBe(true);
    expect(fails(listProductsQuerySchema, { page: '1.5' })).toBe(true);
  });
  it('caps the search text at 100 characters', () => {
    expect(fails(listProductsQuerySchema, { search: 'x'.repeat(101) })).toBe(true);
  });
  it('rejects an unknown sort field (no injection into sort)', () => {
    expect(fails(listProductsQuerySchema, { sortBy: '$where' })).toBe(true);
    expect(fails(listProductsQuerySchema, { order: 'sideways' })).toBe(true);
  });
  it('rejects an object-shaped search (query-string NoSQL injection)', () => {
    expect(fails(listProductsQuerySchema, { search: { $ne: '' } })).toBe(true);
    expect(fails(listProductsQuerySchema, { category: { $ne: '' } })).toBe(true);
  });
});
