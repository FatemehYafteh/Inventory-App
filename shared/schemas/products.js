import { z } from 'zod';

const emptyToUndefined = (value) => value || undefined;

const objectId = (label) =>
  z
    .string()
    .trim()
    .regex(/^[0-9a-f]{24}$/i, `Choose a valid ${label}`)
    .optional()
    .or(z.literal('').transform(() => undefined));

const OBJECT_ID = /^[0-9a-f]{24}$/i;

const title = z
  .string({ required_error: 'Enter a title' })
  .trim()
  .min(1, 'Enter a title')
  .max(200, 'Title must be at most 200 characters');

// Stored uppercase, so "ab-1" and "AB-1" are the same SKU.
const sku = z
  .string({ required_error: 'Enter a SKU' })
  .trim()
  .min(1, 'Enter a SKU')
  .max(64, 'SKU must be at most 64 characters')
  .transform((value) => value.toUpperCase());

// An empty description is allowed: on create it means "none", on update it clears the field.
const description = z.string().trim().max(2000, 'Description must be at most 2000 characters');

const category = z
  .string({ required_error: 'Choose a category', invalid_type_error: 'Choose a category' })
  .trim()
  .regex(OBJECT_ID, 'Choose a category');

// `null` or an empty string means "no supplier" (on update, it clears the supplier).
const supplier = z
  .string({ invalid_type_error: 'Choose a supplier' })
  .trim()
  .regex(OBJECT_ID, 'Choose a supplier')
  .or(z.literal('').transform(() => null))
  .nullable();

const price = z
  .number({ required_error: 'Enter a price', invalid_type_error: 'Enter a price' })
  .finite('Enter a price')
  .min(0, 'Price must be 0 or more')
  .transform((value) => Math.round(value * 100) / 100);

const reorderLevel = z
  .number({ invalid_type_error: 'Reorder level must be a whole number' })
  .int('Reorder level must be a whole number')
  .min(0, 'Reorder level must be 0 or more');

// Only on create: it becomes the first "Initial stock" receive. Zero means no movement.
const initialQuantity = z
  .number({ invalid_type_error: 'Initial quantity must be a whole number' })
  .int('Initial quantity must be a whole number')
  .min(0, 'Initial quantity must be 0 or more');

// Strict: quantity is changed only by stock actions, and archiving has its own endpoints.
const STRICT_MESSAGE =
  'Only title, SKU, description, category, supplier, price and reorder level can be set here. Stock quantity changes through stock actions.';

export const createProductSchema = z
  .object({
    title,
    sku,
    description: description.optional(),
    category,
    supplier: supplier.optional(),
    price,
    reorderLevel: reorderLevel.optional(),
    initialQuantity: initialQuantity.optional(),
  })
  .strict(STRICT_MESSAGE);

export const updateProductSchema = z
  .object({
    title: title.optional(),
    sku: sku.optional(),
    description: description.optional(),
    category: category.optional(),
    supplier: supplier.optional(),
    price: price.optional(),
    reorderLevel: reorderLevel.optional(),
  })
  .strict(STRICT_MESSAGE)
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update',
  });

export const PRODUCT_SORT_FIELDS = ['title', 'quantity', 'price'];
export const PRODUCT_STATUS_FILTERS = ['in_stock', 'low_stock', 'out_of_stock'];

/** The Products page query. `archived` omitted lists active products only (admins may send true). */
export const listProductsQuerySchema = z.object({
  search: z.string().trim().max(100, 'Search is too long').optional().transform(emptyToUndefined),
  category: objectId('category'),
  supplier: objectId('supplier'),
  status: z
    .enum(PRODUCT_STATUS_FILTERS, { errorMap: () => ({ message: 'Choose a stock status' }) })
    .optional()
    .or(z.literal('').transform(() => undefined)),
  archived: z
    .enum(['true', 'false'], { errorMap: () => ({ message: 'Use true or false' }) })
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  sortBy: z
    .enum(PRODUCT_SORT_FIELDS, {
      errorMap: () => ({ message: 'Sort by title, quantity or price' }),
    })
    .default('title'),
  order: z
    .enum(['asc', 'desc'], { errorMap: () => ({ message: 'Use asc or desc' }) })
    .default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
