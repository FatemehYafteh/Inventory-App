import { z } from 'zod';
import { m } from '../errorCodes.js';

const emptyToUndefined = (value) => value || undefined;

const objectId = (message) =>
  z
    .string()
    .trim()
    .regex(/^[0-9a-f]{24}$/i, message)
    .optional()
    .or(z.literal('').transform(() => undefined));

const OBJECT_ID = /^[0-9a-f]{24}$/i;

const title = z
  .string({ required_error: m.TITLE_REQUIRED })
  .trim()
  .min(1, m.TITLE_REQUIRED)
  .max(200, m.TITLE_TOO_LONG_200);

// Stored uppercase, so "ab-1" and "AB-1" are the same SKU.
const sku = z
  .string({ required_error: m.SKU_REQUIRED })
  .trim()
  .min(1, m.SKU_REQUIRED)
  .max(64, m.SKU_TOO_LONG)
  .transform((value) => value.toUpperCase());

// An empty description is allowed: on create it means "none", on update it clears the field.
const description = z.string().trim().max(2000, m.DESCRIPTION_TOO_LONG_2000);

const category = z
  .string({ required_error: m.CATEGORY_REQUIRED, invalid_type_error: m.CATEGORY_REQUIRED })
  .trim()
  .regex(OBJECT_ID, m.CATEGORY_REQUIRED);

// `null` or an empty string means "no supplier" (on update, it clears the supplier).
const supplier = z
  .string({ invalid_type_error: m.SUPPLIER_CHOOSE })
  .trim()
  .regex(OBJECT_ID, m.SUPPLIER_CHOOSE)
  .or(z.literal('').transform(() => null))
  .nullable();

const price = z
  .number({ required_error: m.PRICE_REQUIRED, invalid_type_error: m.PRICE_REQUIRED })
  .finite(m.PRICE_REQUIRED)
  .min(0, m.PRICE_NEGATIVE)
  .transform((value) => Math.round(value * 100) / 100);

const reorderLevel = z
  .number({ invalid_type_error: m.REORDER_LEVEL_NOT_INTEGER })
  .int(m.REORDER_LEVEL_NOT_INTEGER)
  .min(0, m.REORDER_LEVEL_NEGATIVE);

// Only on create: it becomes the first "Initial stock" receive. Zero means no movement.
const initialQuantity = z
  .number({ invalid_type_error: m.INITIAL_QUANTITY_NOT_INTEGER })
  .int(m.INITIAL_QUANTITY_NOT_INTEGER)
  .min(0, m.INITIAL_QUANTITY_NEGATIVE);

// Strict: quantity is changed only by stock actions, and archiving has its own endpoints.
const STRICT_MESSAGE = m.PRODUCT_UNKNOWN_FIELDS;

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
    message: m.NOTHING_TO_UPDATE,
  });

export const PRODUCT_SORT_FIELDS = ['title', 'quantity', 'price'];
export const PRODUCT_STATUS_FILTERS = ['in_stock', 'low_stock', 'out_of_stock'];

/** The Products page query. `archived` omitted lists active products only (admins may send true). */
export const listProductsQuerySchema = z.object({
  search: z.string().trim().max(100, m.SEARCH_TOO_LONG).optional().transform(emptyToUndefined),
  category: objectId(m.CATEGORY_INVALID),
  supplier: objectId(m.SUPPLIER_INVALID),
  status: z
    .enum(PRODUCT_STATUS_FILTERS, { errorMap: () => ({ message: m.STOCK_STATUS_INVALID }) })
    .optional()
    .or(z.literal('').transform(() => undefined)),
  archived: z
    .enum(['true', 'false'], { errorMap: () => ({ message: m.BOOLEAN_INVALID }) })
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  sortBy: z
    .enum(PRODUCT_SORT_FIELDS, {
      errorMap: () => ({ message: m.PRODUCT_SORT_INVALID }),
    })
    .default('title'),
  order: z
    .enum(['asc', 'desc'], { errorMap: () => ({ message: m.SORT_ORDER_INVALID }) })
    .default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
