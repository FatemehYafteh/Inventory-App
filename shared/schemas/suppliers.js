import { z } from 'zod';
import { m } from '../errorCodes.js';

const emptyToUndefined = (value) => value || undefined;

const name = z
  .string({ required_error: m.SUPPLIER_NAME_REQUIRED })
  .trim()
  .min(1, m.SUPPLIER_NAME_REQUIRED)
  .max(120, m.SUPPLIER_NAME_TOO_LONG);

// An empty optional field is allowed: on create it means "none", on update it clears the field.
const optionalText = (max, message) => z.string().trim().max(max, message);

const email = z
  .string()
  .trim()
  .max(254, m.SUPPLIER_EMAIL_TOO_LONG)
  .refine((value) => value === '' || z.string().email().safeParse(value).success, {
    message: m.EMAIL_INVALID,
  });

const optionalFields = {
  contactPerson: optionalText(120, m.CONTACT_PERSON_TOO_LONG).optional(),
  phone: optionalText(40, m.PHONE_TOO_LONG).optional(),
  email: email.optional(),
  address: optionalText(300, m.ADDRESS_TOO_LONG).optional(),
  notes: optionalText(1000, m.NOTES_TOO_LONG).optional(),
};

export const createSupplierSchema = z.object({
  name,
  ...optionalFields,
});

export const updateSupplierSchema = z
  .object({
    name: name.optional(),
    ...optionalFields,
    isActive: z.boolean({ invalid_type_error: m.SUPPLIER_ACTIVE_INVALID }).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: m.NOTHING_TO_UPDATE,
  });

export const SUPPLIER_SORT_FIELDS = ['name'];

/** The Suppliers page query. `active` omitted lists every supplier. */
export const listSuppliersQuerySchema = z.object({
  search: z.string().trim().max(100, m.SEARCH_TOO_LONG).optional().transform(emptyToUndefined),
  active: z
    .enum(['true', 'false'], { errorMap: () => ({ message: m.BOOLEAN_INVALID }) })
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  sortBy: z
    .enum(SUPPLIER_SORT_FIELDS, { errorMap: () => ({ message: m.SUPPLIER_SORT_INVALID }) })
    .default('name'),
  order: z
    .enum(['asc', 'desc'], { errorMap: () => ({ message: m.SORT_ORDER_INVALID }) })
    .default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
