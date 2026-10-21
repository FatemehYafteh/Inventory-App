import { z } from 'zod';

export const STOCK_ACTION_TYPES = ['receive', 'ship', 'adjust', 'increment', 'decrement'];

const note = z
  .string({ invalid_type_error: 'Note must be text' })
  .trim()
  .max(500, 'Note must be at most 500 characters')
  .optional();

// Receive and ship need an amount above zero; adjust is the new total, so zero is allowed.
// Increment and decrement always move by one, so any `quantity` sent with them is ignored.
const quantity = z
  .number({ invalid_type_error: 'Enter a whole number' })
  .int('Enter a whole number')
  .optional();

/** The body of `POST /products/:id/stock`. Unknown keys such as `performedBy` are dropped. */
export const stockChangeSchema = z
  .object({
    type: z.enum(STOCK_ACTION_TYPES, {
      errorMap: () => ({ message: 'Choose receive, ship, adjust, increment or decrement' }),
    }),
    quantity,
    note,
  })
  .superRefine((value, ctx) => {
    const { type } = value;
    if (type === 'increment' || type === 'decrement') return;
    if (value.quantity === undefined) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Enter a quantity' });
    } else if (type === 'adjust' ? value.quantity < 0 : value.quantity < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: type === 'adjust' ? 'Quantity must be 0 or more' : 'Quantity must be at least 1',
      });
    }
  })
  .transform(({ type, quantity: amount, note: text }) => ({
    type,
    ...(type !== 'increment' && type !== 'decrement' && { quantity: amount }),
    ...(text && { note: text }),
  }));

/** `GET /products/:id/movements`. */
export const listMovementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
