import { z } from 'zod';

const emptyToUndefined = (value) => value || undefined;

const name = z
  .string({ required_error: 'Enter a name' })
  .trim()
  .min(1, 'Enter a name')
  .max(120, 'Name must be at most 120 characters');

// An empty optional field is allowed: on create it means "none", on update it clears the field.
const optionalText = (label, max) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`);

const email = z
  .string()
  .trim()
  .max(254, 'Email must be at most 254 characters')
  .refine((value) => value === '' || z.string().email().safeParse(value).success, {
    message: 'Enter a valid email address',
  });

const optionalFields = {
  contactPerson: optionalText('Contact person', 120).optional(),
  phone: optionalText('Phone', 40).optional(),
  email: email.optional(),
  address: optionalText('Address', 300).optional(),
  notes: optionalText('Notes', 1000).optional(),
};

export const createSupplierSchema = z.object({
  name,
  ...optionalFields,
});

export const updateSupplierSchema = z
  .object({
    name: name.optional(),
    ...optionalFields,
    isActive: z.boolean({ invalid_type_error: 'Choose active or inactive' }).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update',
  });

export const SUPPLIER_SORT_FIELDS = ['name'];

/** The Suppliers page query. `active` omitted lists every supplier. */
export const listSuppliersQuerySchema = z.object({
  search: z.string().trim().max(100, 'Search is too long').optional().transform(emptyToUndefined),
  active: z
    .enum(['true', 'false'], { errorMap: () => ({ message: 'Use true or false' }) })
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  sortBy: z
    .enum(SUPPLIER_SORT_FIELDS, { errorMap: () => ({ message: 'Sort by name' }) })
    .default('name'),
  order: z
    .enum(['asc', 'desc'], { errorMap: () => ({ message: 'Use asc or desc' }) })
    .default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
