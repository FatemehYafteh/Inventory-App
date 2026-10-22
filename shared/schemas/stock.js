import { z } from 'zod';
import { m } from '../errorCodes.js';

export const STOCK_ACTION_TYPES = ['receive', 'ship', 'adjust', 'increment', 'decrement'];

const note = z
  .string({ invalid_type_error: m.NOTE_NOT_TEXT })
  .trim()
  .max(500, m.NOTE_TOO_LONG)
  .optional();

// Receive and ship need an amount above zero; adjust is the new total, so zero is allowed.
// Increment and decrement always move by one, so any `quantity` sent with them is ignored.
const quantity = z
  .number({ invalid_type_error: m.QUANTITY_NOT_INTEGER })
  .int(m.QUANTITY_NOT_INTEGER)
  .optional();

/** The body of `POST /products/:id/stock`. Unknown keys such as `performedBy` are dropped. */
export const stockChangeSchema = z
  .object({
    type: z.enum(STOCK_ACTION_TYPES, {
      errorMap: () => ({ message: m.STOCK_TYPE_INVALID }),
    }),
    quantity,
    note,
  })
  .superRefine((value, ctx) => {
    const { type } = value;
    if (type === 'increment' || type === 'decrement') return;
    if (value.quantity === undefined) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: m.QUANTITY_REQUIRED });
    } else if (type === 'adjust' ? value.quantity < 0 : value.quantity < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: type === 'adjust' ? m.QUANTITY_ADJUST_NEGATIVE : m.QUANTITY_TOO_SMALL,
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
